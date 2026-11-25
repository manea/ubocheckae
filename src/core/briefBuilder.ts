import type {
  AssessmentInput,
  AssessmentResult,
  EntityJurisdiction,
  OwnershipStructureKind,
} from './types.ts';

function escMdCell(value: unknown): string {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function formatNum(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : decimals,
    maximumFractionDigits: decimals,
  });
}

const JURISDICTION_LABELS: Record<EntityJurisdiction, { ar: string; en: string }> = {
  uae_mainland: {
    ar: 'شركة في البر الرئيسي لدولة الإمارات (DED / دائرة اقتصادية)',
    en: 'UAE Mainland Commercial Entity (DED)',
  },
  non_financial_freezone: {
    ar: 'شركة منطقة حرة تجارية غير مالية (مثل JAFZA / DMCC / RAKEZ — خاضعة)',
    en: 'Non-Financial UAE Free Zone Entity (Subject to CR 109/2023)',
  },
  difc_adgm_financial_fz: {
    ar: 'منطقة حرة مالية (DIFC / ADGM — مستثناة بأنظمة DFSA/FSRA)',
    en: 'Financial Free Zone (DIFC / ADGM — Exempt under DFSA/FSRA)',
  },
  wholly_government_owned: {
    ar: 'شركة مملوكة بالكامل للحكومة الاتحادية أو المحلية (مستثناة)',
    en: 'Wholly Federal / Local Government-Owned Entity (Exempt)',
  },
  listed_company_or_subsidiary: {
    ar: 'شركة مدرجة في سوق مالي منظم أو تابعة مملوكة بالأغلبية لها (مستثناة)',
    en: 'Regulated Stock-Exchange Listed Company or Majority Subsidiary (Exempt)',
  },
};

const STRUCTURE_LABELS: Record<OwnershipStructureKind, { ar: string; en: string }> = {
  direct_simple: {
    ar: 'ملكية مباشرة بسيطة (طبقة واحدة)',
    en: 'Direct Simple Ownership (Single Layer)',
  },
  multi_layer_holding: {
    ar: 'سلسلة ملكية عبر شركات قابضة متعددة الطبقات',
    en: 'Multi-Layer Holding Chain',
  },
  complex_cross_border: {
    ar: 'هيكل ملكية معقد عابر للحدود (يستدعي تدقيق اختراق السلسلة)',
    en: 'Complex Cross-Border Structure (Look-Through Required)',
  },
  widely_held_no_25pct: {
    ar: 'ملكية متفرقة دون 25% (انتقال للسيطرة الفعلية أو الإدارة العليا)',
    en: 'Widely Held < 25% (Cascades to Control / Senior Management Fallback)',
  },
};

export function buildUboBriefMarkdown(
  input: AssessmentInput,
  result: AssessmentResult,
  dossierCode: string,
  sha256Digest = '',
  locale: 'en' | 'ar' = 'ar',
): string {
  const digest = sha256Digest || result.dossierSha256 || '';
  const jurLbl = JURISDICTION_LABELS[input.jurisdiction] ?? {
    ar: input.jurisdiction,
    en: input.jurisdiction,
  };
  const strLbl = STRUCTURE_LABELS[input.structureKind] ?? {
    ar: input.structureKind,
    en: input.structureKind,
  };
  const { obligations, csvAudit } = result;

  if (locale === 'ar') {
    const lines: string[] = [
      `# ملف جاهزية سجل المستفيد الحقيقي الإماراتي (CR 109/2023 & CR 132/2023) — \`${escMdCell(dossierCode)}\``,
      '',
      `> **تنويه الاستقلالية:** ${result.legalDisclaimerAr}`,
      '',
      '## 1. هوية المنشأة ونطاق القرار والملكية الفعالة',
      '',
      '| البند | القيمة |',
      '|---|---|',
      `| رمز الملف | \`${escMdCell(dossierCode)}\` |`,
      `| الأداة والإصدار | \`UBOCheckAE v${escMdCell(result.toolVersion)}\` |`,
      `| الكيان الاعتباري | ${escMdCell(input.entityName)} |`,
      `| الهوية الإماراتية للمفوّض المقيم (\`784\`) | \`${escMdCell(input.authorizedContactEmiratesId || 'N/A')}\` (${obligations.authorizedContactEidValid === null ? 'غير مرفقة' : obligations.authorizedContactEidValid ? 'صالحة ✓' : 'غير صالحة ✗'}) |`,
      `| النطاق والولاية | ${jurLbl.ar} |`,
      `| بنية الملكية | ${strLbl.ar} (**${input.ownershipLayersCount}** طبقات) |`,
      `| الملكية الفعالة المحسوبة | **${formatNum(obligations.totalEffectiveOwnershipPct)}%** (مباشرة \`${formatNum(input.directOwnershipPct)}%\` + غير مباشرة \`${formatNum(obligations.effectiveIndirectPct)}%\`) |`,
      `| مسار تحديد المستفيد الحقيقي | \`${obligations.determinationTier}\` (عتبة \`>= 25%\`: **${obligations.meets25PctUboThreshold ? 'محققة' : 'غير محققة'}**) |`,
      `| مرحلة الجزاءات (\`CR 132/2023\`) | \`${obligations.penaltyStageCode}\` |`,
      `| حالة الجاهزية والدرجة | **${result.readinessStatus.toUpperCase()}** (**${result.readinessScore}/100**) |`,
      `| بصمة التثبيت \`SHA-256\` | \`${escMdCell(digest || 'PENDING')}\` |`,
      '',
      '## 2. تحليل المهل القانونية (15/60 يوماً و5 سنوات) والتعرض المالي',
      '',
      `- **الجهة المختصة**: ${escMdCell(obligations.regulatoryAuthorityAr)}`,
      `- **نطاق الخضوع (\`CR 109/2023\`)**: **${obligations.isSubjectToCr109 ? 'خاضع للسجلات الثلاثة' : 'مستثنى بموجب المادة 3 / المنطقة المالية'}** | تدقيق الهياكل المعقدة: **${obligations.complexStructureScrutiny ? 'مفعّل' : 'غير مطلوب'}**`,
      `- **المهل والاحتفاظ النظامي**: مهلة إشعار المسجّل بالتحديث: **${obligations.statutoryUpdateNoticeDays} يوماً** | إفصاح المدير الاسمي: **${obligations.statutoryNomineeDisclosureDays} يوماً** | نافذة التأسيس: **${obligations.statutoryInitialWindowDays} يوماً** | الحفظ بعد التصفية: **${obligations.statutoryRetentionYears} سنوات**`,
      `- **الفجوات المرصودة**: سجلات \`RBO/RPS\`: **${obligations.registersMissingGap ? 'مفقودة' : 'مكتملة'}** | اختراق السلاسل/التدرج الثلاثي: **${obligations.chainOrUboResolutionGap ? 'غير محسوم' : 'محسوم'}** | مهلة \`15 يوماً\`: **${obligations.updateNoticeSlaGap ? 'متأخر' : 'سليم'}** | المدير الاسمي \`15 يوماً\`: **${obligations.nomineeDisclosureGap ? 'فجوة' : 'سليم'}** | حفظ \`5 سنوات\`: **${obligations.fiveYearRetentionGap ? 'ناقص' : 'مؤمّن'}** | المفوّض المقيم/الهوية: **${obligations.residentContactOrEidGap ? 'فجوة' : 'سليم'}**`,
      `- **التعرض للجزاءات (\`CR 132/2023\`)**: الغرامة المتوقعة: **${formatNum(obligations.projectedMinimumFineAed, 0)} – ${formatNum(obligations.projectedMaximumFineAed, 0)} د.إ** | خطر إيقاف الرخصة التجارية (المادة \`3(2)\`): **${obligations.licenseSuspensionRisk ? 'قائم (التكرار الثالث)' : 'غير قائم'}**`,
      '',
      '## 3. مصفوفة الضوابط السبعة (100 نقطة)',
      '',
      '| الضابط | الحالة | الأهمية | البيان والإجراء المطلوب |',
      '|---|---|---|---|',
      ...result.controls.map(
        (c) =>
          `| \`${c.controlId}\` | ${c.passed ? 'مستوفٍ ✓' : 'غير مستوفٍ ✗'} | \`${c.severity.toUpperCase()}\` | ${escMdCell(c.detailAr)} |`,
      ),
    ];

    if (csvAudit && csvAudit.totalRows > 0) {
      lines.push(
        '',
        '## 4. نتائج تدقيق سجل سلاسل الملكية والشركاء CSV (حماية CWE-1236)',
        '',
        `- إجمالي السجلات: **${csvAudit.totalRows}** | سليم: **${csvAudit.compliantRows}** | تنبيه: **${csvAudit.attentionRows}** | مخالفة: **${csvAudit.violationRows}** | يحقق \`>= 25%\`: **${csvAudit.qualifying25PctRows}** | متأخر > 15 يوماً: **${csvAudit.lateUpdateOver15DaysRows}** | تعقيم \`CWE-1236\`: **${csvAudit.formulaInjectionSanitizedCount}** | التعرض المقدر: **${formatNum(csvAudit.totalEstimatedExposureMinAed, 0)} – ${formatNum(csvAudit.totalEstimatedExposureMaxAed, 0)} د.إ**`,
        '',
        '| الصف | الكيان/الطبقة | الملكية الفعالة (%) | >= 25% | أيام التغيير | مسجل بـ RBO | التعرض (د.إ) | الحالة |',
        '|---|---|---|---|---|---|---|---|',
        ...csvAudit.rows.map(
          (r) =>
            `| ${r.rowNumber} | \`${escMdCell(r.entityId)}\` | ${formatNum(r.effectivePct)}% | ${r.qualifies25PctUbo ? 'نعم' : 'لا'} | ${r.daysSinceChange} | ${r.uboRegistered ? 'نعم' : 'لا'} | ${formatNum(r.estimatedExposureMinAed, 0)}–${formatNum(r.estimatedExposureMaxAed, 0)} | **${r.status.toUpperCase()}** |`,
        ),
      );
    }

    lines.push('', '---', result.legalDisclaimerAr);
    return lines.join('\n');
  }

  const lines: string[] = [
    `# UAE Beneficial Owner (UBO) Readiness Dossier (CR 109/2023 & CR 132/2023) — \`${escMdCell(dossierCode)}\``,
    '',
    `> **Independence Disclaimer:** ${result.legalDisclaimerEn}`,
    '',
    '## 1. Legal Entity Identity, Ownership Chain & Determination Tier',
    '',
    '| Field | Value |',
    '|---|---|',
    `| Dossier Code | \`${escMdCell(dossierCode)}\` |`,
    `| Tool & Version | \`UBOCheckAE v${escMdCell(result.toolVersion)}\` |`,
    `| Legal Entity | ${escMdCell(input.entityName)} |`,
    `| Resident Contact Emirates ID (\`784\`) | \`${escMdCell(input.authorizedContactEmiratesId || 'N/A')}\` (${obligations.authorizedContactEidValid === null ? 'Not Provided' : obligations.authorizedContactEidValid ? 'Valid ✓' : 'Invalid ✗'}) |`,
    `| Jurisdiction | ${jurLbl.en} |`,
    `| Structure Type | ${strLbl.en} (**${input.ownershipLayersCount}** layers) |`,
    `| Computed Effective Ownership | **${formatNum(obligations.totalEffectiveOwnershipPct)}%** (Direct \`${formatNum(input.directOwnershipPct)}%\` + Indirect \`${formatNum(obligations.effectiveIndirectPct)}%\`) |`,
    `| Cascading UBO Determination | \`${obligations.determinationTier}\` (\`>= 25%\` threshold: **${obligations.meets25PctUboThreshold ? 'Met' : 'Not Met'}**) |`,
    `| CR 132/2023 Penalty Stage | \`${obligations.penaltyStageCode}\` |`,
    `| Readiness Status & Score | **${result.readinessStatus.toUpperCase()}** (**${result.readinessScore}/100**) |`,
    `| Canonical \`SHA-256\` Digest | \`${escMdCell(digest || 'PENDING')}\` |`,
    '',
    '## 2. CR 109/2023 Deadlines (15d / 60d / 5y) & CR 132/2023 Penalty Exposure',
    '',
    `- **Supervising Authority**: ${escMdCell(obligations.regulatoryAuthorityEn)}`,
    `- **Applicability**: **${obligations.isSubjectToCr109 ? 'SUBJECT TO CR 109/2023' : 'EXEMPT (DIFC/ADGM, Wholly Gov-Owned, or Listed)'}** | Complex-Structure Look-Through: **${obligations.complexStructureScrutiny ? 'Active' : 'Standard'}**`,
    `- **Statutory Clocks**: Registrar Update SLA: **${obligations.statutoryUpdateNoticeDays} days** | Nominee Disclosure SLA: **${obligations.statutoryNomineeDisclosureDays} days** | Initial Compliance Window: **${obligations.statutoryInitialWindowDays} days** | Post-Dissolution Retention: **${obligations.statutoryRetentionYears} years**`,
    `- **Gap Summary**: RBO/RPS Registers: **${obligations.registersMissingGap ? 'Missing' : 'OK'}** | Chain / Cascading Test: **${obligations.chainOrUboResolutionGap ? 'Gap' : 'Resolved'}** | 15d Update SLA: **${obligations.updateNoticeSlaGap ? 'Breach' : 'On Time'}** | Nominee 15d SLA: **${obligations.nomineeDisclosureGap ? 'Gap' : 'OK'}** | 5y Retention: **${obligations.fiveYearRetentionGap ? 'Gap' : 'OK'}** | Resident Contact / 784 EID: **${obligations.residentContactOrEidGap ? 'Gap' : 'Valid'}**`,
    `- **Projected Exposure (\`CR 132/2023\`)**: Fine Range: **AED ${formatNum(obligations.projectedMinimumFineAed, 0)} – AED ${formatNum(obligations.projectedMaximumFineAed, 0)}** | Art. 3(2) Commercial Licence Suspension Risk: **${obligations.licenseSuspensionRisk ? 'HIGH RISK (3rd/Repeat Offense)' : 'None'}**`,
    '',
    '## 3. Seven-Control Compliance Matrix (100 Points)',
    '',
    '| Control | Status | Severity | Assessment Detail |',
    '|---|---|---|---|',
    ...result.controls.map(
      (c) =>
        `| \`${c.controlId}\` | ${c.passed ? 'PASS' : 'FAIL'} | \`${c.severity.toUpperCase()}\` | ${escMdCell(c.detailEn)} |`,
    ),
  ];

  if (csvAudit && csvAudit.totalRows > 0) {
    lines.push(
      '',
      '## 4. Ownership Chain & Partner CSV Audit (CWE-1236 Neutralized)',
      '',
      `- Total Rows: **${csvAudit.totalRows}** | Compliant: **${csvAudit.compliantRows}** | Attention: **${csvAudit.attentionRows}** | Violations: **${csvAudit.violationRows}** | Qualifying \`>= 25%\`: **${csvAudit.qualifying25PctRows}** | Overdue > 15d: **${csvAudit.lateUpdateOver15DaysRows}** | Sanitized \`CWE-1236\`: **${csvAudit.formulaInjectionSanitizedCount}** | Exposure Range: **AED ${formatNum(csvAudit.totalEstimatedExposureMinAed, 0)} – AED ${formatNum(csvAudit.totalEstimatedExposureMaxAed, 0)}**`,
      '',
      '| Row | Entity ID | Effective (%) | >= 25% | Days Elapsed | RBO Registered | Exposure Min–Max (AED) | Status |',
      '|---|---|---|---|---|---|---|---|',
      ...csvAudit.rows.map(
        (r) =>
          `| ${r.rowNumber} | \`${escMdCell(r.entityId)}\` | ${formatNum(r.effectivePct)}% | ${r.qualifies25PctUbo ? 'Yes' : 'No'} | ${r.daysSinceChange} | ${r.uboRegistered ? 'Yes' : 'No'} | ${formatNum(r.estimatedExposureMinAed, 0)}–${formatNum(r.estimatedExposureMaxAed, 0)} | **${r.status.toUpperCase()}** |`,
      ),
    );
  }

  lines.push('', '---', result.legalDisclaimerEn);
  return lines.join('\n');
}
