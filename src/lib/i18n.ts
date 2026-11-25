import type { PenaltyStageCode, ReadinessStatus, UboDeterminationTier } from '../core/types.ts';

export type Locale = 'ar' | 'en';
export type ThemeName = 'alabaster-registry' | 'obsidian-compliance';

export const STATUS_LABELS: Record<ReadinessStatus, { ar: string; en: string }> = {
  ready: { ar: 'مستوفٍ ✓', en: 'READY ✓' },
  conditional: { ar: 'تحت الإنذار / مشروط', en: 'CONDITIONAL' },
  blocked: { ar: 'مخالف / خطر إيقاف ✗', en: 'BLOCKED ✗' },
};

export const DETERMINATION_TIER_LABELS: Record<UboDeterminationTier, { ar: string; en: string }> = {
  tier1_ownership_25pct: {
    ar: 'المستوى 1: ملكية 25% فأكثر (مباشرة أو غير مباشرة)',
    en: 'Tier 1: >= 25% Ownership / Voting (Direct or Indirect)',
  },
  tier2_control_other_means: {
    ar: 'المستوى 2: السيطرة الفعلية بوسائل أخرى',
    en: 'Tier 2: Effective Control by Other Means',
  },
  tier3_senior_management: {
    ar: 'المستوى 3: مسؤول الإدارة العليا البديل',
    en: 'Tier 3: Senior Management Official Fallback',
  },
  exempt_entity: {
    ar: 'كيان مستثنى (DIFC/ADGM، حكومي 100%، أو مدرج)',
    en: 'Exempt Entity (DIFC/ADGM, Wholly Govt-Owned, or Listed)',
  },
  unresolved: {
    ar: 'غير محسوم — يتطلب إتمام التدرج الثلاثي',
    en: 'Unresolved — Cascading 3-Tier Identification Required',
  },
};

export const PENALTY_STAGE_LABELS: Record<PenaltyStageCode, { ar: string; en: string }> = {
  compliant_no_penalty: {
    ar: 'ممتثل — لا جزاءات (0 د.إ)',
    en: 'Compliant — No Penalty (AED 0)',
  },
  exempt_out_of_scope: {
    ar: 'خارج نطاق CR 109/2023 (معفى)',
    en: 'Exempt from CR 109/2023 Scope',
  },
  tier1_written_warning: {
    ar: 'المرحلة 1: إنذار خطي رسمي (مهلة تصحيح 15 يوماً)',
    en: 'Stage 1: Written Warning (15-Day Rectification Window)',
  },
  tier2_monetary_fine: {
    ar: 'المرحلة 2: غرامة إدارية متدرجة (10,000–50,000 د.إ)',
    en: 'Stage 2: Monetary Fine (AED 10,000–50,000)',
  },
  tier3_cap_and_license_suspension: {
    ar: 'المرحلة 3: تكرار المخالفة (حتى 100,000 د.إ + إيقاف الرخصة م 3/2)',
    en: 'Stage 3: 3rd/Repeat Offense (Up to AED 100k + Art. 3(2) Suspension)',
  },
};

export const UI_COPY = {
  ar: {
    brandTitle: 'UBOCheckAE — مدقق سجل المستفيد الحقيقي الإماراتي',
    brandSub:
      'محرك التدرج الثلاثي (25% فأكثر) عبر السلاسل ومهل 15/60 يوماً وحفظ 5 سنوات وسلم جزاءات CR 109/2023 وCR 132/2023',
    serverBadge: 'SQLite WAL حي',
    localBadge: 'تخزين محلي $0',
    presetLabel: 'سيناريو معياري:',
    printBtn: 'طباعة / PDF',
    tabDashboard: 'السلاسل والجزاءات',
    tabControls: 'مصفوفة الضوابط (7)',
    tabCsv: 'تدقيق الشركاء CSV',
    tabVault: 'خزنة الملفات والختم',
    missingReport: 'تعذر العثور على التقرير المختوم المطلوب.',
    viewsLabel: 'المشاهدات',
    backToWorkspace: 'العودة للاستوديو',
  },
  en: {
    brandTitle: 'UBOCheckAE — UAE Beneficial Owner (UBO) Chain Auditor',
    brandSub:
      'UAE Cabinet Resolutions No. 109/2023 & 132/2023 (>= 25% Indirect Chain, 15d/60d SLAs, 5y Retention & Art. 3(2) Penalties)',
    serverBadge: 'Live SQLite WAL',
    localBadge: '$0 Local Mode',
    presetLabel: 'Scenario Preset:',
    printBtn: 'Print / PDF',
    tabDashboard: 'Chain & Penalties',
    tabControls: '7-Control Matrix',
    tabCsv: 'CSV Chain Audit',
    tabVault: 'Vault & SHA-256',
    missingReport: 'Sealed public UBO report was not found.',
    viewsLabel: 'Views',
    backToWorkspace: 'Back to Studio',
  },
} as const;
