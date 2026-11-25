import type { UboControlSpec } from './types.ts';

export const UBOCHECKAE_TOOL_VERSION = '0.5.0';

export const CR109_UBO_THRESHOLD_PCT = 25;
export const CR109_UPDATE_NOTICE_DAYS = 15;
export const CR109_NOMINEE_DISCLOSURE_DAYS = 15;
export const CR109_INITIAL_COMPLIANCE_DAYS = 60;
export const CR109_RETENTION_YEARS = 5;

export const CR132_TIER1_RECTIFICATION_DAYS = 15;
export const CR132_MODERATE_TIER2_MIN_AED = 10_000;
export const CR132_MODERATE_TIER2_MAX_AED = 20_000;
export const CR132_SEVERE_TIER2_MIN_AED = 20_000;
export const CR132_SEVERE_TIER2_MAX_AED = 50_000;
export const CR132_SEVERE_TIER3_MIN_AED = 50_000;
export const CR132_TIER3_MAX_CAP_AED = 100_000;

export const LEGAL_DISCLAIMER_AR =
  'تنويه تنظيمي: أداة UBOCheckAE أداة مساعدة هندسية وإدارية مفتوحة المصدر ولا تتبع وزارة الاقتصاد الإماراتية أو دوائر التنمية الاقتصادية أو المسجلين التجاريين أو DFSA/FSRA، ولا تمثل استشارة قانونية رسمية. تعتمد على قراري مجلس الوزراء رقم (109) و(132) لسنة 2023.';

export const LEGAL_DISCLAIMER_EN =
  'Regulatory Disclaimer: UBOCheckAE is an independent open-source UBO compliance and ownership-chain modeling tool not affiliated with the UAE Ministry of Economy, local Commercial Registrars (DED/ADDED), or DFSA/FSRA, and does not constitute formal legal advice. Modeled on UAE Cabinet Resolutions No. 109 of 2023 and No. 132 of 2023.';

export const UBO_CONTROLS: readonly UboControlSpec[] = [
  {
    id: 'UBO-CTRL-01',
    weight: 20,
    severity: 'critical',
    legalRef: 'CR 109/2023 Arts. 8–10 & CR 132/2023 (RBO & RPS)',
    titleAr: 'إنشاء وحفظ سجل المستفيد الحقيقي (RBO) وسجل الشركاء والمساهمين (RPS)',
    titleEn: 'Maintain Register of Beneficial Owners (RBO) & Partners/Shareholders (RPS)',
    summaryAr:
      'التزام كل شركة خاضعة في البر الرئيسي والمناطق الحرة التجارية بحفظ سجل المستفيد الحقيقي وسجل الشركاء محدثين في مقرها المسجل وتقديمهما للمسجّل عند الطلب.',
    summaryEn:
      'Mandatory maintenance of current RBO and Partners/Shareholders Registers at the registered UAE office and submission to the Licensing Registrar.',
  },
  {
    id: 'UBO-CTRL-02',
    weight: 20,
    severity: 'critical',
    legalRef: 'CR 109/2023 Arts. 1 & 5 Cascading 3-Tier Test & Complex Look-Through',
    titleAr: 'تطبيق الاختبار الثلاثي (>= 25% مباشرة/عبر السلاسل -> السيطرة -> الإدارة العليا) وشفافية الهياكل المعقدة',
    titleEn: 'Cascading 3-Tier UBO Test (>= 25% Chain -> Control -> Senior Management) & Complex Look-Through',
    summaryAr:
      'تتبع الملكية الفعالة >= 25% مباشرة أو بضرب نسب الطبقات القابضة، والانتقال للسيطرة الفعلية أو الإدارة العليا البديل عند تعذر بلوغ 25% مع توثيق الهياكل متعددة الطبقات.',
    summaryEn:
      'Calculates effective >= 25% direct/indirect corporate chains, falls back to control by other means or Senior Management Official, and verifies complex multi-layer proof.',
  },
  {
    id: 'UBO-CTRL-03',
    weight: 15,
    severity: 'high',
    legalRef: 'CR 109/2023 Art. 8–9 · 15-Day Change Notice & 60-Day Initial Window',
    titleAr: 'مهلة إشعار المسجّل خلال 15 يوماً من أي تغيير (ونافذة التأسيس 60 يوماً)',
    titleEn: 'Mandatory 15-Day Registrar Change Update SLA (60-Day Initial Window)',
    summaryAr:
      'إخطار المسجّل التجاري خلال 15 يوماً من تاريخ العلم بأي تعديل في بيانات المستفيد الحقيقي أو الشركاء، ومراعاة نافذة 60 يوماً عند التأسيس أو التحديث الهيكلي.',
    summaryEn:
      'Notifies the Registrar within 15 days of becoming aware of any UBO or partner modification, honoring the 60-day initial registration/compliance window.',
  },
  {
    id: 'UBO-CTRL-04',
    weight: 15,
    severity: 'high',
    legalRef: 'CR 109/2023 Nominee Directors/Managers Register & 15-Day Disclosure',
    titleAr: 'إفصاح وسجل المديرين والمساهمين الاسميين (Nominee Register خلال 15 يوماً)',
    titleEn: 'Nominee Director/Manager Register & 15-Day Appointment Disclosure',
    summaryAr:
      'إلزام المديرين وأعضاء الإدارة الاسميين بالإفصاح عن صفتهم وهوية الموكِّل للشركة خلال 15 يوماً من التعيين وإدراجهم في سجل المديرين الاسميين.',
    summaryEn:
      'Requires nominee directors/managers to disclose proxy status and nominator details within 15 days of appointment and logs them in the Nominee Register.',
  },
  {
    id: 'UBO-CTRL-05',
    weight: 15,
    severity: 'high',
    legalRef: 'CR 109/2023 Art. 11 & CR 132/2023 5-Year Post-Liquidation Archive',
    titleAr: 'الاحتفاظ بسجلات المستفيد الحقيقي 5 سنوات بعد التصفية أو الحل أو الشطب',
    titleEn: 'Mandatory 5-Year Post-Dissolution / Liquidation Record Retention',
    summaryAr:
      'التزام الشركة ومديريها والمصفي بحفظ سجلات المستفيد الحقيقي والشركاء والبيانات الداعمة لمدة لا تقل عن 5 سنوات من تاريخ التصفية أو الشطب.',
    summaryEn:
      'Obligates the company, management, or appointed liquidator to preserve UBO and partner registers for at least 5 years post-dissolution or de-registration.',
  },
  {
    id: 'UBO-CTRL-06',
    weight: 10,
    severity: 'medium',
    legalRef: 'CR 109/2023 Arts. 1–3 Scope & Financial Free-Zone / SOE / Listed Exemptions',
    titleAr: 'التحقق الصحيح من النطاق الإماراتي مقابل استثناءات DIFC/ADGM والحكومية والمدرجة',
    titleEn: 'Scope & Exemption Guardrail (Mainland/Commercial FZ vs. DIFC/ADGM, SOE & Listed)',
    summaryAr:
      'عدم افتراض الإعفاء لشركات البر الرئيسي أو المناطق الحرة التجارية (مثل JAFZA/DMCC/RAKEZ)، وحصر الاستثناء في DIFC/ADGM والحكومية 100% والشركات المدرجة.',
    summaryEn:
      'Confirms commercial free-zone entities remain subject to CR 109/2023 while correctly scoping DIFC/ADGM (DFSA/FSRA), 100% government-owned, and listed entities.',
  },
  {
    id: 'UBO-CTRL-07',
    weight: 5,
    severity: 'medium',
    legalRef: 'CR 109/2023 Resident Authorized Contact Person & 784 Emirates ID Audit',
    titleAr: 'تسمية الشخص المفوّض المقيم بالإمارات والتحقق من الهوية الإماراتية (784 Luhn)',
    titleEn: 'UAE Resident Contact Point & 784 Emirates ID Luhn Verification',
    summaryAr:
      'تعيين شخص طبيعي مقيم داخل الدولة مخوّل بالتواصل مع المسجّل وتزويد البيانات، وفحص صحة الهوية الإماراتية (15 رقماً تبدأ بـ 784) وتدقيق ملف CSV.',
    summaryEn:
      'Designates an authorized UAE-resident natural person as Registrar contact point and validates 15-digit 784 Luhn Emirates IDs and entity chain CSV ledgers.',
  },
] as const;
