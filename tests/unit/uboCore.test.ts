import { describe, expect, it } from 'vitest';
import {
  UBO_PRESETS,
  auditChainCsv,
  computeDossierSha256,
  computeEffectiveOwnershipPct,
  evaluateUboCoreSync,
  evaluateUboObligations,
  exportChainAuditCsv,
  validateEmiratesId,
} from '../../src/core/index.ts';

describe('UBOCheckAE Zero-Dependency UAE CR 109/2023 & CR 132/2023 Core (v0.1.0)', () => {
  it('evaluates all three canonical UAE UBO presets across indirect 25%, Tier 3 Senior Management, and 3rd-offense cap', async () => {
    const ready = evaluateUboCoreSync(UBO_PRESETS[0].input);
    expect(ready.readinessStatus).toBe('ready');
    expect(ready.readinessScore).toBe(100);
    expect(ready.obligations.effectiveIndirectPct).toBe(25);
    expect(ready.obligations.totalEffectiveOwnershipPct).toBe(35);
    expect(ready.obligations.meets25PctUboThreshold).toBe(true);
    expect(ready.obligations.determinationTier).toBe('tier1_ownership_25pct');
    expect(ready.obligations.penaltyStageCode).toBe('compliant_no_penalty');
    expect(ready.obligations.projectedMinimumFineAed).toBe(0);
    expect(ready.obligations.licenseSuspensionRisk).toBe(false);

    const conditional = evaluateUboCoreSync(UBO_PRESETS[1].input);
    expect(conditional.readinessStatus).toBe('conditional');
    expect(conditional.readinessScore).toBe(85);
    expect(conditional.obligations.isSubjectToCr109).toBe(true);
    expect(conditional.obligations.meets25PctUboThreshold).toBe(false);
    expect(conditional.obligations.determinationTier).toBe('tier3_senior_management');
    expect(conditional.obligations.nomineeDisclosureGap).toBe(true);
    expect(conditional.obligations.penaltyStageCode).toBe('tier1_written_warning');
    expect(conditional.obligations.rectificationGraceDays).toBe(15);
    expect(conditional.obligations.projectedMaximumFineAed).toBe(0);

    const blocked = evaluateUboCoreSync(UBO_PRESETS[2].input);
    expect(blocked.readinessStatus).toBe('blocked');
    expect(blocked.readinessScore).toBe(0);
    expect(blocked.obligations.effectiveIndirectPct).toBe(30);
    expect(blocked.obligations.complexStructureScrutiny).toBe(true);
    expect(blocked.obligations.authorizedContactEidValid).toBe(false);
    expect(blocked.obligations.penaltyStageCode).toBe('tier3_cap_and_license_suspension');
    expect(blocked.obligations.projectedMinimumFineAed).toBe(50_000);
    expect(blocked.obligations.projectedMaximumFineAed).toBe(100_000);
    expect(blocked.obligations.licenseSuspensionRisk).toBe(true);

    const h1 = await computeDossierSha256(ready);
    const h2 = await computeDossierSha256({ ...ready, controls: [...ready.controls].reverse() });
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });

  it('calculates exact inclusive >= 25% indirect ownership boundary and Tier 2 control-by-other-means fallback', () => {
    const exact25 = computeEffectiveOwnershipPct(0, 50, 50);
    expect(exact25.effectiveIndirectPct).toBe(25);
    expect(exact25.totalEffectiveOwnershipPct).toBe(25);

    const tier1Exact = evaluateUboObligations({
      ...UBO_PRESETS[0].input,
      directOwnershipPct: 0,
      intermediateLayer1Pct: 50,
      intermediateLayer2Pct: 50,
    });
    expect(tier1Exact.meets25PctUboThreshold).toBe(true);
    expect(tier1Exact.determinationTier).toBe('tier1_ownership_25pct');

    const tier2Control = evaluateUboObligations({
      ...UBO_PRESETS[1].input,
      directOwnershipPct: 24.99,
      intermediateLayer1Pct: 0,
      intermediateLayer2Pct: 0,
      otherVotingOrControlRights: true,
    });
    expect(tier2Control.meets25PctUboThreshold).toBe(false);
    expect(tier2Control.determinationTier).toBe('tier2_control_other_means');
  });

  it('models 2nd-offense stepped fines (AED 10k-20k moderate vs AED 20k-50k structural) and CR 109/2023 Art. 3 exemptions', () => {
    const moderateSecond = evaluateUboObligations({
      ...UBO_PRESETS[1].input,
      priorOffenseCount: 1,
    });
    expect(moderateSecond.penaltyStageCode).toBe('tier2_monetary_fine');
    expect(moderateSecond.projectedMinimumFineAed).toBe(10_000);
    expect(moderateSecond.projectedMaximumFineAed).toBe(20_000);
    expect(moderateSecond.licenseSuspensionRisk).toBe(false);

    const structuralSecond = evaluateUboObligations({
      ...UBO_PRESETS[2].input,
      priorOffenseCount: 1,
    });
    expect(structuralSecond.penaltyStageCode).toBe('tier2_monetary_fine');
    expect(structuralSecond.projectedMinimumFineAed).toBe(20_000);
    expect(structuralSecond.projectedMaximumFineAed).toBe(50_000);
    expect(structuralSecond.licenseSuspensionRisk).toBe(false);

    for (const jur of [
      'difc_adgm_financial_fz',
      'wholly_government_owned',
      'listed_company_or_subsidiary',
    ] as const) {
      const exempt = evaluateUboObligations({
        ...UBO_PRESETS[2].input,
        jurisdiction: jur,
      });
      expect(exempt.isSubjectToCr109).toBe(false);
      expect(exempt.determinationTier).toBe('exempt_entity');
      expect(exempt.penaltyStageCode).toBe('exempt_out_of_scope');
      expect(exempt.projectedMaximumFineAed).toBe(0);
      expect(exempt.licenseSuspensionRisk).toBe(false);
    }
  });

  it('validates 15-digit UAE Emirates IDs starting with 784 using strict Luhn verification', () => {
    expect(validateEmiratesId('784198612345672')).toBe(true);
    expect(validateEmiratesId('784-1990-4455667-0')).toBe(true);
    expect(validateEmiratesId('784198612345679')).toBe(false);
    expect(validateEmiratesId('999198612345672')).toBe(false);
    expect(validateEmiratesId('784180012345670')).toBe(false);
  });

  it('audits partner/layer CSV rows, flags >= 25% unregistered chains & > 15d SLA breaches, and neutralizes CWE-1236 on export', () => {
    const clean = auditChainCsv(UBO_PRESETS[0].sampleCsv);
    expect(clean.totalRows).toBe(2);
    expect(clean.compliantRows).toBe(2);
    expect(clean.qualifying25PctRows).toBe(2);
    expect(clean.rows[0].effectivePct).toBe(35);
    expect(clean.rows[1].effectivePct).toBe(25);
    expect(clean.rows[0].emiratesIdValid).toBe(true);

    const dirty = auditChainCsv(UBO_PRESETS[2].sampleCsv);
    expect(dirty.totalRows).toBe(2);
    expect(dirty.violationRows).toBe(2);
    expect(dirty.qualifying25PctRows).toBe(1);
    expect(dirty.lateUpdateOver15DaysRows).toBe(2);
    expect(dirty.unverifiedNomineeOrUnregisteredRows).toBe(2);
    expect(dirty.formulaInjectionSanitizedCount).toBe(1);
    expect(dirty.rows[0].entityId).toBe("'=ENT-301");
    expect(dirty.rows[1].emiratesIdValid).toBe(false);
    expect(dirty.totalEstimatedExposureMinAed).toBe(40_000);
    expect(dirty.totalEstimatedExposureMaxAed).toBe(100_000);

    const exported = exportChainAuditCsv(dirty);
    expect(exported.csv.startsWith('\uFEFFrow_number,')).toBe(true);
    expect(exported.csv.includes("\"'=ENT-301\"")).toBe(true);
    expect(exported.csv.includes('\r\n')).toBe(true);
  });
});
