import type {
  AssessmentInput,
  AssessmentResult,
  FindingItem,
  ReadinessStatus,
} from './types.ts';
import {
  LEGAL_DISCLAIMER_AR,
  LEGAL_DISCLAIMER_EN,
  UBOCHECKAE_TOOL_VERSION,
  UBO_CONTROLS,
} from './uboCatalog.ts';
import { auditChainCsv } from './chainCsvAuditor.ts';
import { canonicalizeDossierPayload, computePayloadDigest } from './dossierDigest.ts';
import { evaluateUboObligations } from './uboEngine.ts';

export function evaluateUboCoreSync(input: AssessmentInput): AssessmentResult {
  const obligations = evaluateUboObligations(input);

  const controls: FindingItem[] = UBO_CONTROLS.map((spec) => {
    let passed = true;
    let detailAr = spec.summaryAr;
    let detailEn = spec.summaryEn;
    let remediationAr = 'مكتمل — حافظ على حداثة سجلات RBO/RPS والالتزام بمهلة 15 يوماً.';
    let remediationEn = 'Compliant — maintain up-to-date RBO/RPS registers and 15-day update SLAs.';

    switch (spec.id) {
      case 'UBO-CTRL-01': {
        passed = !obligations.registersMissingGap;
        if (!passed) {
          detailAr =
            'الشركة خاضعة لقرار 109/2023 ولم تنشئ أو تحفظ سجل المستفيد الحقيقي (RBO) وسجل الشركاء/المساهمين (RPS) في مقرها المسجل.';
          detailEn =
            'Entity is subject to CR 109/2023 and lacks an up-to-date Register of Beneficial Owners (RBO) or Partners/Shareholders Register (RPS).';
          remediationAr =
            'أنشئ سجل المستفيد الحقيقي وسجل الشركاء فوراً في المقر المسجل وتأكد من تطابق الحصص بنسبة 100% قبل تقديمها للمسجّل.';
          remediationEn =
            'Establish RBO and RPS registers at the registered UAE office covering 100% of issued equity/voting layers and submit to the Registrar.';
        }
        break;
      }

      case 'UBO-CTRL-02': {
        passed = !obligations.chainOrUboResolutionGap;
        if (!passed) {
          detailAr = `تعذر إغلاق اختبار التدرج الثلاثي أو توثيق اختراق سلاسل الملكية (${obligations.totalEffectiveOwnershipPct}% ملكية فعالة، عدد الطبقات ${input.ownershipLayersCount})؛ هياكل الطبقات المتعددة تخضع لتدقيق المسجّل القائم على المخاطر.`;
          detailEn = `Unresolved 3-tier UBO cascading test or missing look-through evidence (${obligations.totalEffectiveOwnershipPct}% effective stake across ${input.ownershipLayersCount} corporate layers).`;
          remediationAr =
            'استخرج شهادات الأسهم وعقود التأسيس لكل طبقة وسلسلة حتى الشخص الطبيعي (>= 25% أو السيطرة أو الإدارة العليا البديل).';
          remediationEn =
            'Compile legalized corporate registers and cap-table look-through proof for all layers up to natural-person UBO(s) or Tier 3 Senior Management.';
        }
        break;
      }

      case 'UBO-CTRL-03': {
        passed = !obligations.updateNoticeSlaGap;
        if (!passed) {
          detailAr = `عدم إشعار المسجّل التجاري بالتعديلات خلال مهلة 15 يوماً من العلم بالتغيير (المدة المسجلة منذ التغيير: ${input.daysSinceUboChangeOrIncorporation} يوماً).`;
          detailEn = `Registrar not notified within the statutory 15-day SLA after UBO/partner change (${input.daysSinceUboChangeOrIncorporation} days elapsed).`;
          remediationAr =
            'قدّم طلب تحديث المستفيد الحقيقي عبر بوابة دائرة التنمية الاقتصادية / المنطقة الحرة فوراً لتلافي غرامات CR 132/2023.';
          remediationEn =
            'File the UBO amendment via the Registrar portal immediately to stop CR 132/2023 repeat-offense escalation.';
        }
        break;
      }

      case 'UBO-CTRL-04': {
        passed = !obligations.nomineeDisclosureGap;
        if (!passed) {
          detailAr =
            'وجود ترتيبات مدير/عضو اسمي دون سجل مديرين اسميين مكتمل أو دون إفصاح رسمي للشركة خلال مهلة 15 يوماً من التعيين.';
          detailEn =
            'Nominee director/manager arrangement exists without a complete Nominee Register or mandatory 15-day written disclosure to the company.';
          remediationAr =
            'ألزم المدير الاسمي بتسليم بيان التعيين وهوية الموكِّل خلال 15 يوماً وادرجه في سجل المديرين الاسميين.';
          remediationEn =
            'Obtain signed nominee appointment particulars within 15 days and update the Nominee Directors/Managers Register.';
        }
        break;
      }

      case 'UBO-CTRL-05': {
        passed = !obligations.fiveYearRetentionGap;
        if (!passed) {
          detailAr =
            'غياب التزام موثق للشركة أو المصفي بحفظ سجلات المستفيد الحقيقي والشركاء لمدة لا تقل عن 5 سنوات بعد التصفية أو الحل.';
          detailEn =
            'Missing documented 5-year post-dissolution/liquidation UBO and shareholder register archive commitment (company, directors, or liquidator).';
          remediationAr =
            'أصدر قراراً مؤسسياً وسياسة أرشفة (أو تعهد المصفي) بحفظ السجلات والنسخ الاحتياطية لمدة 5 سنوات بعد الشطب.';
          remediationEn =
            'Adopt an entity/liquidator retention policy guaranteeing 5-year preservation of RBO/RPS/Nominee records post-deregistration.';
        }
        break;
      }

      case 'UBO-CTRL-06': {
        passed = !obligations.scopeExemptionGap;
        if (!passed) {
          detailAr =
            'عدم التحقق الرسمي من نطاق الولاية (عدم الخلط بين المناطق الحرة التجارية الخاضعة لـ CR 109/2023 واستثناءات DIFC/ADGM أو الحكومية 100% أو المدرجة).';
          detailEn =
            'Unverified CR 109/2023 jurisdictional scope or exemption claim (commercial free zones remain caught; DIFC/ADGM, wholly govt-owned, and listed entities have separate rules).';
          remediationAr =
            'وثّق الرخصة التجارية وحدد خضوع الكيان للقرار 109/2023 أو مستند الاستثناء النظامي في DIFC/ADGM أو القيد البورصي.';
          remediationEn =
            'Document commercial licence authority and confirm either CR 109/2023 applicability or written exemption basis (DIFC/ADGM/SOE/Listed).';
        }
        break;
      }

      case 'UBO-CTRL-07': {
        passed = !obligations.residentContactOrEidGap;
        if (!passed) {
          detailAr =
            obligations.authorizedContactEidValid === false
              ? 'الهوية الإماراتية للشخص المفوّض المقيم غير صالحة (يجب 15 خانة تبدأ بـ 784 وتجتاز Luhn) أو لم يُعيّن مفوّض مقيم.'
              : 'لم يُسمَّ شخص طبيعي مقيم بالإمارات مخوّل بتسليم بيانات المستفيد الحقيقي للمسجّل عند الطلب.';
          detailEn =
            obligations.authorizedContactEidValid === false
              ? 'Authorized UAE-resident contact Emirates ID failed 15-digit 784 Luhn verification or resident contact is missing.'
              : 'No UAE-resident natural person designated as authorized UBO contact point for Registrar correspondence.';
          remediationAr =
            'عيّن موظفاً أو شريكاً مقيماً بالإمارات وسجّل هويته الإماراتية الصحيحة (784) لدى المسجّل المختص.';
          remediationEn =
            'Appoint an authorized UAE-resident natural person with a verified 784 Luhn Emirates ID on file with the Registrar.';
        }
        break;
      }
    }

    return {
      controlId: spec.id,
      severity: spec.severity,
      passed,
      legalRef: spec.legalRef,
      titleAr: spec.titleAr,
      titleEn: spec.titleEn,
      detailAr,
      detailEn,
      remediationAr,
      remediationEn,
    };
  });

  let earnedWeight = 0;
  let blockersCount = 0;
  let highRisksCount = 0;

  controls.forEach((c, idx) => {
    const spec = UBO_CONTROLS[idx];
    if (c.passed) {
      earnedWeight += spec.weight;
    } else if (c.severity === 'critical') {
      blockersCount += 1;
    } else if (c.severity === 'high') {
      highRisksCount += 1;
    }
  });

  const readinessScore = Math.max(0, Math.min(100, earnedWeight));
  const readinessStatus: ReadinessStatus =
    blockersCount === 0 && highRisksCount === 0 && readinessScore >= 95
      ? 'ready'
      : blockersCount === 0 && readinessScore >= 70
        ? 'conditional'
        : 'blocked';

  const csvAudit =
    input.chainCsv && input.chainCsv.trim().length > 0 ? auditChainCsv(input.chainCsv) : null;

  return {
    toolVersion: UBOCHECKAE_TOOL_VERSION,
    evaluatedAt: new Date().toISOString(),
    readinessScore,
    readinessStatus,
    obligations,
    controls,
    blockersCount,
    highRisksCount,
    csvAudit,
    legalDisclaimerAr: LEGAL_DISCLAIMER_AR,
    legalDisclaimerEn: LEGAL_DISCLAIMER_EN,
  };
}

export async function evaluateUboCoreAsync(input: AssessmentInput): Promise<AssessmentResult> {
  const result = evaluateUboCoreSync(input);
  const canonicalPayload = {
    toolVersion: result.toolVersion,
    readinessScore: result.readinessScore,
    readinessStatus: result.readinessStatus,
    obligations: result.obligations,
    controls: result.controls.map((c) => ({
      controlId: c.controlId,
      passed: c.passed,
      severity: c.severity,
    })),
    csvSummary: result.csvAudit
      ? {
          totalRows: result.csvAudit.totalRows,
          violationRows: result.csvAudit.violationRows,
          qualifying25PctRows: result.csvAudit.qualifying25PctRows,
          totalEstimatedExposureMinAed: result.csvAudit.totalEstimatedExposureMinAed,
          totalEstimatedExposureMaxAed: result.csvAudit.totalEstimatedExposureMaxAed,
        }
      : null,
  };
  const canonicalDossierText = canonicalizeDossierPayload(canonicalPayload);
  const dossierSha256 = await computePayloadDigest(canonicalDossierText);
  return {
    ...result,
    canonicalDossierText,
    dossierSha256,
  };
}

export const assessUboReadiness = evaluateUboCoreAsync;
