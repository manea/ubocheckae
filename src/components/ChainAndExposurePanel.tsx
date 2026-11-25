import type { AssessmentInput, AssessmentResult } from '../core/types.ts';
import { validateEmiratesId } from '../core/uboEngine.ts';
import {
  DETERMINATION_TIER_LABELS,
  PENALTY_STAGE_LABELS,
  type Locale,
} from '../lib/i18n.ts';

interface Props {
  input: AssessmentInput;
  result: AssessmentResult;
  locale: Locale;
  onChange: (patch: Partial<AssessmentInput>) => void;
}

export function ChainAndExposurePanel({ input, result, locale, onChange }: Props) {
  const isAr = locale === 'ar';
  const { obligations } = result;
  const eidText = (input.authorizedContactEmiratesId || '').trim();
  const eidValid = eidText.length > 0 ? validateEmiratesId(eidText) : null;

  const booleanToggles: Array<{ key: keyof AssessmentInput; ar: string; en: string }> = [
    {
      key: 'rboAndPartnersRegistersMaintained',
      ar: 'سجلا المستفيد الحقيقي (RBO) والشركاء (RPS) محفوظان ومحدثان في المقر',
      en: 'RBO & Partners/Shareholders Registers maintained at registered office',
    },
    {
      key: 'chainLookthroughVerified',
      ar: 'أدلة اختراق سلاسل الملكية (شهادات الأسهم/عقود التأسيس حتى الشخص الطبيعي) مكتملة',
      en: 'Multi-layer ownership look-through documentary proof verified',
    },
    {
      key: 'registrarUpdatedWithin15Days',
      ar: 'تم إشعار المسجّل التجاري بالتغيير خلال مهلة 15 يوماً (أو لم يحدث تغيير)',
      en: 'Registrar notified of UBO/partner change within 15-day statutory SLA',
    },
    {
      key: 'otherVotingOrControlRights',
      ar: 'توجد سيطرة فعلية بوسائل أخرى (مثل تعيين/عزل أغلبية مجلس الإدارة)',
      en: 'Effective control exercised by other means (appoint/dismiss board majority)',
    },
    {
      key: 'seniorManagementFallbackNamed',
      ar: 'تم تسجيل مسؤول الإدارة العليا البديل عند عدم بلوغ أي شخص عتبة 25%',
      en: 'Senior Management Official designated as Tier 3 fallback if no >= 25% owner',
    },
    {
      key: 'hasNomineeArrangements',
      ar: 'يوجد مدير/عضو مجلس إدارة أو مساهم اسمي (Nominee Arrangement)',
      en: 'Entity uses Nominee Director / Manager / Shareholder arrangement',
    },
    {
      key: 'nomineeRegisterMaintained',
      ar: 'سجل المديرين/المساهمين الاسميين (RND) منشأ ومكتمل',
      en: 'Nominee Directors/Managers Register (RND) established & current',
    },
    {
      key: 'nomineeDisclosedWithin15Days',
      ar: 'إفصاح المدير الاسمي عن صفته وهوية الموكِّل خلال 15 يوماً من التعيين',
      en: 'Nominee arrangement disclosed in writing within 15 days of appointment',
    },
    {
      key: 'fiveYearRetentionCommitted',
      ar: 'الالتزام الموثق بحفظ سجلات UBO والشركاء 5 سنوات بعد التصفية أو الشطب',
      en: '5-year post-dissolution / liquidator record retention policy active',
    },
    {
      key: 'scopeAndExemptionVerified',
      ar: 'التحقق الصحيح من النطاق (إخضاع المناطق التجارية وعزل DIFC/ADGM/الحكومية/المدرجة)',
      en: 'Scope & statutory exemptions (DIFC/ADGM, SOE, Listed) verified on file',
    },
    {
      key: 'authorizedResidentContactAppointed',
      ar: 'تعيين شخص طبيعي مفوّض مقيم في الإمارات لتسليم البيانات للمسجّل',
      en: 'Authorized UAE-resident natural person contact appointed for Registrar',
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="ubo-card rounded-2xl p-4 sm:p-5 lg:col-span-7">
        <h3 className="mb-3 text-base font-bold text-[var(--text-primary)]">
          {isAr
            ? 'بيانات المنشأة وسلاسل الملكية (25% فأكثر) ونطاق قرار 109/2023'
            : 'Entity Scope, Indirect Chain Calculator (>= 25%) & CR 109/2023 Inputs'}
        </h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
              {isAr ? 'اسم المنشأة الاعتبارية' : 'Legal Entity Name'}
            </label>
            <input
              type="text"
              dir="auto"
              data-testid="entity-name-input"
              className="ubo-input"
              value={input.entityName}
              onChange={(e) => onChange({ entityName: e.target.value })}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
              {isAr
                ? 'الهوية الإماراتية للمفوّض المقيم (15 خانة تبدأ بـ 784)'
                : 'Resident Contact Emirates ID (15 digits, 784...)'}
            </label>
            <input
              type="text"
              dir="ltr"
              data-testid="eid-input"
              className="ubo-input ubo-mono"
              value={input.authorizedContactEmiratesId || ''}
              onChange={(e) => onChange({ authorizedContactEmiratesId: e.target.value })}
              placeholder="784198612345672"
            />
            {eidValid !== null && (
              <div
                className="mt-1 text-[11px] font-semibold"
                style={{ color: eidValid ? 'var(--accent-emerald)' : 'var(--accent-crimson)' }}
              >
                {eidValid
                  ? isAr
                    ? '✓ صيغة 784 Luhn صالحة'
                    : '✓ Valid 784 Luhn Emirates ID'
                  : isAr
                    ? '✗ رقم غير صالح (يلزم 15 خانة 784 Luhn)'
                    : '✗ Invalid 784 Luhn Emirates ID'}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
              {isAr ? 'النطاق الجغرافي والاستثناءات' : 'Jurisdictional Scope & Exemption'}
            </label>
            <select
              data-testid="jurisdiction-select"
              className="ubo-input"
              value={input.jurisdiction}
              onChange={(e) =>
                onChange({
                  jurisdiction: e.target.value as AssessmentInput['jurisdiction'],
                })
              }
            >
              <option value="uae_mainland">
                {isAr ? 'البر الرئيسي بالإمارات (خاضع CR 109/2023)' : 'UAE Mainland (Subject to CR 109)'}
              </option>
              <option value="non_financial_freezone">
                {isAr ? 'منطقة حرة تجارية غير مالية (JAFZA/DMCC — خاضعة)' : 'Commercial Free Zone (Subject)'}
              </option>
              <option value="difc_adgm_financial_fz">
                {isAr ? 'منطقة حرة مالية DIFC/ADGM (مستثناة DFSA/FSRA)' : 'Financial Free Zone DIFC/ADGM (Exempt)'}
              </option>
              <option value="wholly_government_owned">
                {isAr ? 'مملوكة 100% للحكومة الاتحادية/المحلية (مستثناة)' : 'Wholly Gov-Owned (Exempt Art. 3)'}
              </option>
              <option value="listed_company_or_subsidiary">
                {isAr ? 'شركة مدرجة أو تابعة بالأغلبية لها (مستثناة)' : 'Listed Entity / Majority Sub (Exempt)'}
              </option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
              {isAr ? 'بنية الملكية' : 'Ownership Structure Kind'}
            </label>
            <select
              className="ubo-input"
              value={input.structureKind}
              onChange={(e) =>
                onChange({
                  structureKind: e.target.value as AssessmentInput['structureKind'],
                })
              }
            >
              <option value="direct_simple">
                {isAr ? 'ملكية مباشرة بسيطة (طبقة 1)' : 'Direct Simple (1 Layer)'}
              </option>
              <option value="multi_layer_holding">
                {isAr ? 'سلسلة قابضة متعددة الطبقات' : 'Multi-Layer Holding Chain'}
              </option>
              <option value="complex_cross_border">
                {isAr ? 'هيكل معقد عابر للحدود (Complex Structure)' : 'Complex Cross-Border Structure'}
              </option>
              <option value="widely_held_no_25pct">
                {isAr ? 'ملكية متفرقة < 25% (انتقال للإدارة العليا)' : 'Widely Held < 25% (Fallback)'}
              </option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
              {isAr ? 'عدد طبقات السلسلة (Layers Count)' : 'Corporate Ownership Layers'}
            </label>
            <input
              type="number"
              min={1}
              max={50}
              dir="ltr"
              className="ubo-input ubo-mono num-tabular"
              value={input.ownershipLayersCount}
              onChange={(e) =>
                onChange({ ownershipLayersCount: Math.max(1, Number(e.target.value) || 1) })
              }
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
              {isAr ? 'حصة الملكية المباشرة (%)' : 'Direct Ownership (%)'}
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              dir="ltr"
              data-testid="direct-pct-input"
              className="ubo-input ubo-mono num-tabular"
              value={input.directOwnershipPct}
              onChange={(e) => onChange({ directOwnershipPct: Number(e.target.value) || 0 })}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
              {isAr ? 'حصة الفرد في القابضة الأعلى (%)' : 'Parent Layer 1 Share (%)'}
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              dir="ltr"
              data-testid="layer1-pct-input"
              className="ubo-input ubo-mono num-tabular"
              value={input.intermediateLayer1Pct}
              onChange={(e) => onChange({ intermediateLayer1Pct: Number(e.target.value) || 0 })}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
              {isAr ? 'حصة القابضة في المنشأة الإماراتية (%)' : 'HoldCo Layer 2 Share in UAE Co (%)'}
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              dir="ltr"
              data-testid="layer2-pct-input"
              className="ubo-input ubo-mono num-tabular"
              value={input.intermediateLayer2Pct}
              onChange={(e) => onChange({ intermediateLayer2Pct: Number(e.target.value) || 0 })}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
              {isAr ? 'الأيام منذ التغيير / التعيين (مهلة 15/60)' : 'Days Since Change (15d / 60d SLA)'}
            </label>
            <input
              type="number"
              min={0}
              max={3650}
              dir="ltr"
              className="ubo-input ubo-mono num-tabular"
              value={input.daysSinceUboChangeOrIncorporation}
              onChange={(e) =>
                onChange({
                  daysSinceUboChangeOrIncorporation: Math.max(0, Number(e.target.value) || 0),
                })
              }
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
              {isAr ? 'السوابق / التكرار بموجب CR 132/2023' : 'Prior CR 132/2023 Offenses (0/1/2+)'}
            </label>
            <select
              data-testid="prior-offense-select"
              className="ubo-input"
              value={input.priorOffenseCount}
              onChange={(e) => onChange({ priorOffenseCount: Number(e.target.value) || 0 })}
            >
              <option value={0}>
                {isAr ? '0 — مخالفة أولى (إنذار خطي)' : '0 — First Offense (Written Warning)'}
              </option>
              <option value={1}>
                {isAr ? '1 — مخالفة ثانية (غرامة 10k–50k د.إ)' : '1 — 2nd Offense (AED 10k–50k)'}
              </option>
              <option value={2}>
                {isAr ? '2+ — تكرار ثالث (حتى 100k د.إ + إيقاف الرخصة)' : '2+ — 3rd+ Repeat (AED 100k + Suspension)'}
              </option>
            </select>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {booleanToggles.map((item) => (
            <label
              key={item.key}
              className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5 text-xs"
            >
              <input
                type="checkbox"
                data-testid={`toggle-${item.key}`}
                checked={Boolean(input[item.key])}
                onChange={(e) => onChange({ [item.key]: e.target.checked })}
                className="mt-0.5 h-4 w-4 accent-[var(--accent-primary)]"
              />
              <span className="leading-snug text-[var(--text-primary)]">
                {isAr ? item.ar : item.en}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="ubo-card rounded-2xl p-4 sm:p-5 lg:col-span-5">
        <h3 className="mb-3 text-base font-bold text-[var(--text-primary)]">
          {isAr
            ? 'نتائج التدرج الثلاثي وسلم الجزاءات الإماراتي'
            : 'Cascading UBO Output & CR 132/2023 Exposure'}
        </h3>

        <div className="space-y-3 text-xs">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
            <div className="text-[11px] font-semibold text-[var(--text-secondary)]">
              {isAr ? 'السلطة التنظيمية المختصة' : 'Competent Authority'}
            </div>
            <div className="mt-1 font-bold text-[var(--text-primary)]">
              {isAr ? obligations.regulatoryAuthorityAr : obligations.regulatoryAuthorityEn}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
              <div className="text-[11px] text-[var(--text-secondary)]">
                {isAr ? 'الملكية الفعالة (25% فأكثر)' : 'Effective Stake (>= 25%)'}
              </div>
              <div
                data-testid="metric-effective-pct"
                dir="ltr"
                className="ubo-mono num-tabular mt-1 text-base font-extrabold text-[var(--accent-primary)]"
              >
                {obligations.totalEffectiveOwnershipPct}%
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
              <div className="text-[11px] text-[var(--text-secondary)]">
                {isAr ? 'حصة السلاسل غير المباشرة' : 'Indirect Chain Equity'}
              </div>
              <div
                dir="ltr"
                className="ubo-mono num-tabular mt-1 text-base font-extrabold text-[var(--accent-teal)]"
              >
                {obligations.effectiveIndirectPct}%
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
            <div className="text-[11px] text-[var(--text-secondary)]">
              {isAr ? 'مسار تحديد المستفيد الحقيقي' : 'Cascading Determination Tier'}
            </div>
            <div className="mt-1 font-bold text-[var(--text-primary)]">
              {DETERMINATION_TIER_LABELS[obligations.determinationTier][isAr ? 'ar' : 'en']}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
            <div className="text-[11px] text-[var(--text-secondary)]">
              {isAr ? 'المرحلة التصاعدية وفق CR 132/2023' : 'CR 132/2023 Enforcement Stage'}
            </div>
            <div className="mt-1 font-bold text-[var(--text-primary)]">
              {PENALTY_STAGE_LABELS[obligations.penaltyStageCode][isAr ? 'ar' : 'en']}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
            <div className="text-[11px] text-[var(--text-secondary)]">
              {isAr
                ? 'نطاق الغرامة المقدرة وإيقاف الرخصة (المادة 3/2)'
                : 'Projected Fine Range & Art. 3(2) Suspension'}
            </div>
            <div
              data-testid="metric-fine-range"
              dir="ltr"
              className="ubo-mono num-tabular mt-1 text-base font-extrabold"
              style={{
                color:
                  obligations.projectedMaximumFineAed > 0
                    ? 'var(--accent-crimson)'
                    : 'var(--accent-emerald)',
              }}
            >
              AED {obligations.projectedMinimumFineAed.toLocaleString('en-US')} – AED{' '}
              {obligations.projectedMaximumFineAed.toLocaleString('en-US')}
              {obligations.licenseSuspensionRisk ? ' (SUSPENSION)' : ''}
            </div>
            <div className="mt-1 text-[11px] text-[var(--text-secondary)]">
              {isAr
                ? 'المهل: تحديث 15 يوماً | مدير اسمي 15 يوماً | تأسيس 60 يوماً | حفظ 5 سنوات'
                : 'Clocks: 15d update | 15d nominee | 60d initial | 5y post-dissolution archive'}
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-[var(--border-strong)] p-3 text-[11px] leading-relaxed text-[var(--text-secondary)]">
            {isAr ? result.legalDisclaimerAr : result.legalDisclaimerEn}
          </div>
        </div>
      </div>
    </section>
  );
}
