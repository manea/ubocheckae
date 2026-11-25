import type {
  AssessmentInput,
  PenaltyStageCode,
  UboDeterminationTier,
  UboObligationEvaluation,
} from './types.ts';
import {
  CR109_INITIAL_COMPLIANCE_DAYS,
  CR109_NOMINEE_DISCLOSURE_DAYS,
  CR109_RETENTION_YEARS,
  CR109_UBO_THRESHOLD_PCT,
  CR109_UPDATE_NOTICE_DAYS,
  CR132_MODERATE_TIER2_MAX_AED,
  CR132_MODERATE_TIER2_MIN_AED,
  CR132_SEVERE_TIER2_MAX_AED,
  CR132_SEVERE_TIER2_MIN_AED,
  CR132_SEVERE_TIER3_MIN_AED,
  CR132_TIER1_RECTIFICATION_DAYS,
  CR132_TIER3_MAX_CAP_AED,
} from './uboCatalog.ts';

function clampPct(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(100, value);
}

export function computeEmiratesIdCheckDigit(fourteenDigits: string): number {
  let sum = 0;
  for (let i = 0; i < fourteenDigits.length; i += 1) {
    const digit = Number(fourteenDigits[i]);
    const idxFromRight = fourteenDigits.length - 1 - i;
    if (idxFromRight % 2 === 0) {
      const doubled = digit * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    } else {
      sum += digit;
    }
  }
  return (10 - (sum % 10)) % 10;
}

export function validateEmiratesId(rawId: string): boolean {
  const digits = String(rawId ?? '').replace(/[^0-9]/g, '');
  if (digits.length !== 15 || !digits.startsWith('784')) {
    return false;
  }
  const year = Number(digits.slice(3, 7));
  if (year < 1900 || year > 2099) {
    return false;
  }
  const expected = computeEmiratesIdCheckDigit(digits.slice(0, 14));
  const actual = Number(digits[14]);
  return expected === actual;
}

export function computeEffectiveOwnershipPct(
  directPct: number,
  layer1Pct: number,
  layer2Pct: number,
): { effectiveIndirectPct: number; totalEffectiveOwnershipPct: number } {
  const d = clampPct(directPct);
  const l1 = clampPct(layer1Pct);
  const l2 = clampPct(layer2Pct);
  const effectiveIndirectPct = Math.round(((l1 * l2) / 100) * 100) / 100;
  const totalEffectiveOwnershipPct = Math.min(
    100,
    Math.round((d + effectiveIndirectPct) * 100) / 100,
  );
  return { effectiveIndirectPct, totalEffectiveOwnershipPct };
}

export function evaluateUboObligations(input: AssessmentInput): UboObligationEvaluation {
  const isSubjectToCr109 =
    input.jurisdiction === 'uae_mainland' || input.jurisdiction === 'non_financial_freezone';

  const { effectiveIndirectPct, totalEffectiveOwnershipPct } = computeEffectiveOwnershipPct(
    input.directOwnershipPct,
    input.intermediateLayer1Pct,
    input.intermediateLayer2Pct,
  );

  const meets25PctUboThreshold = totalEffectiveOwnershipPct >= CR109_UBO_THRESHOLD_PCT;
  const complexStructureScrutiny =
    isSubjectToCr109 &&
    (input.structureKind === 'complex_cross_border' || input.ownershipLayersCount >= 3);

  let determinationTier: UboDeterminationTier = 'unresolved';
  if (!isSubjectToCr109) {
    determinationTier = 'exempt_entity';
  } else if (meets25PctUboThreshold) {
    determinationTier = 'tier1_ownership_25pct';
  } else if (input.otherVotingOrControlRights) {
    determinationTier = 'tier2_control_other_means';
  } else if (input.seniorManagementFallbackNamed) {
    determinationTier = 'tier3_senior_management';
  }

  const rawEid = String(input.authorizedContactEmiratesId ?? '').trim();
  const authorizedContactEidValid = rawEid.length > 0 ? validateEmiratesId(rawEid) : null;

  const registersMissingGap = isSubjectToCr109 && !input.rboAndPartnersRegistersMaintained;
  const chainOrUboResolutionGap =
    isSubjectToCr109 &&
    (determinationTier === 'unresolved' ||
      ((complexStructureScrutiny || meets25PctUboThreshold) && !input.chainLookthroughVerified));
  const updateNoticeSlaGap = isSubjectToCr109 && !input.registrarUpdatedWithin15Days;
  const nomineeDisclosureGap =
    isSubjectToCr109 &&
    input.hasNomineeArrangements &&
    (!input.nomineeRegisterMaintained || !input.nomineeDisclosedWithin15Days);
  const fiveYearRetentionGap = isSubjectToCr109 && !input.fiveYearRetentionCommitted;
  const scopeExemptionGap = !input.scopeAndExemptionVerified;
  const residentContactOrEidGap =
    isSubjectToCr109 &&
    (!input.authorizedResidentContactAppointed || authorizedContactEidValid === false);

  const structuralGap =
    registersMissingGap || chainOrUboResolutionGap || fiveYearRetentionGap;
  const anySubstantiveGap =
    structuralGap || updateNoticeSlaGap || nomineeDisclosureGap;
  const anyGap = anySubstantiveGap || scopeExemptionGap || residentContactOrEidGap;

  const offenses = Math.max(
    0,
    Math.floor(Number.isFinite(input.priorOffenseCount) ? input.priorOffenseCount : 0),
  );

  let penaltyStageCode: PenaltyStageCode = 'compliant_no_penalty';
  let projectedMinimumFineAed = 0;
  let projectedMaximumFineAed = 0;
  let licenseSuspensionRisk = false;
  let rectificationGraceDays = 0;

  if (!isSubjectToCr109) {
    penaltyStageCode = 'exempt_out_of_scope';
  } else if (anyGap) {
    rectificationGraceDays = CR132_TIER1_RECTIFICATION_DAYS;
    if (offenses === 0) {
      penaltyStageCode = 'tier1_written_warning';
    } else if (offenses === 1) {
      penaltyStageCode = 'tier2_monetary_fine';
      projectedMinimumFineAed = structuralGap
        ? CR132_SEVERE_TIER2_MIN_AED
        : CR132_MODERATE_TIER2_MIN_AED;
      projectedMaximumFineAed = structuralGap
        ? CR132_SEVERE_TIER2_MAX_AED
        : CR132_MODERATE_TIER2_MAX_AED;
    } else {
      penaltyStageCode = 'tier3_cap_and_license_suspension';
      projectedMinimumFineAed = structuralGap
        ? CR132_SEVERE_TIER3_MIN_AED
        : CR132_SEVERE_TIER2_MIN_AED;
      projectedMaximumFineAed = structuralGap
        ? CR132_TIER3_MAX_CAP_AED
        : CR132_SEVERE_TIER2_MAX_AED;
      licenseSuspensionRisk = true;
    }
  }

  let regulatoryAuthorityAr =
    'المسجّل التجاري المختص في البر الرئيسي أو المنطقة الحرة غير المالية ووزارة الاقتصاد (CR 109/2023 & CR 132/2023)';
  let regulatoryAuthorityEn =
    'Relevant UAE Mainland / Non-Financial Free Zone Licensing Registrar & MoE (CR 109/2023 & CR 132/2023)';

  if (input.jurisdiction === 'difc_adgm_financial_fz') {
    regulatoryAuthorityAr =
      'مستثنى من CR 109/2023: يخضع لأنظمة المناطق الحرة المالية المستقلة (DFSA في DIFC أو FSRA في ADGM)';
    regulatoryAuthorityEn =
      'Exempt from CR 109/2023: Governed by Financial Free Zone Regulators (DFSA in DIFC / FSRA in ADGM)';
  } else if (input.jurisdiction === 'wholly_government_owned') {
    regulatoryAuthorityAr =
      'مستثنى من CR 109/2023 (المادة 3): جهة مملوكة بالكامل للحكومة الاتحادية أو المحلية أو تابعة لها بالكامل';
    regulatoryAuthorityEn =
      'Exempt under CR 109/2023 Art. 3: Wholly Federal or Local Government-Owned Entity / Subsidiary';
  } else if (input.jurisdiction === 'listed_company_or_subsidiary') {
    regulatoryAuthorityAr =
      'مستثنى من CR 109/2023 (المادة 3): شركة مدرجة في سوق مالي منظم أو شركة تابعة مملوكة بالأغلبية لها';
    regulatoryAuthorityEn =
      'Exempt under CR 109/2023 Art. 3: Regulated Stock-Exchange Listed Company or Majority-Owned Subsidiary';
  }

  return {
    regulatoryAuthorityAr,
    regulatoryAuthorityEn,
    isSubjectToCr109,
    effectiveIndirectPct,
    totalEffectiveOwnershipPct,
    meets25PctUboThreshold,
    complexStructureScrutiny,
    determinationTier,
    statutoryUpdateNoticeDays: isSubjectToCr109 ? CR109_UPDATE_NOTICE_DAYS : 0,
    statutoryInitialWindowDays: isSubjectToCr109 ? CR109_INITIAL_COMPLIANCE_DAYS : 0,
    statutoryNomineeDisclosureDays: isSubjectToCr109 ? CR109_NOMINEE_DISCLOSURE_DAYS : 0,
    statutoryRetentionYears: isSubjectToCr109 ? CR109_RETENTION_YEARS : 0,
    authorizedContactEidValid,
    registersMissingGap,
    chainOrUboResolutionGap,
    updateNoticeSlaGap,
    nomineeDisclosureGap,
    fiveYearRetentionGap,
    scopeExemptionGap,
    residentContactOrEidGap,
    penaltyStageCode,
    projectedMinimumFineAed,
    projectedMaximumFineAed,
    licenseSuspensionRisk,
    rectificationGraceDays,
  };
}
