import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { AssessmentResult } from '../core/types.ts';
import type { Locale } from '../lib/i18n.ts';

interface Props {
  result: AssessmentResult;
  locale: Locale;
}

export function ControlsAndFindingsPanel({ result, locale }: Props) {
  const isAr = locale === 'ar';

  return (
    <section className="ubo-card rounded-2xl p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            {isAr
              ? 'مصفوفة الضوابط السبعة لسجل المستفيد الحقيقي الإماراتي (100 نقطة)'
              : 'UAE UBO Seven-Control Matrix (100 Points)'}
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            {isAr
              ? 'تقييم تفصيلي وفق قرار مجلس الوزراء رقم (109) لسنة 2023 وقرار الجزاءات (132) لسنة 2023'
              : 'Detailed control evaluation per UAE Cabinet Resolutions No. 109 of 2023 and No. 132 of 2023'}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span
            dir="ltr"
            className="ubo-mono rounded-lg bg-[var(--accent-crimson-soft)] px-2.5 py-1 font-bold text-[var(--accent-crimson)]"
          >
            {result.blockersCount} CRITICAL
          </span>
          <span
            dir="ltr"
            className="ubo-mono rounded-lg bg-[var(--accent-amber-soft)] px-2.5 py-1 font-bold text-[var(--accent-amber)]"
          >
            {result.highRisksCount} HIGH
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {result.controls.map((item) => {
          const passed = item.passed;
          const borderColor = passed
            ? 'var(--border-subtle)'
            : item.severity === 'critical'
              ? 'var(--accent-crimson)'
              : 'var(--accent-amber)';

          return (
            <article
              key={item.controlId}
              data-testid={`control-card-${item.controlId}`}
              className="rounded-xl bg-[var(--bg-elevated)] p-3.5"
              style={{ border: `1px solid ${borderColor}` }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {passed ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--accent-emerald)]" />
                  ) : item.severity === 'critical' ? (
                    <XCircle className="h-4 w-4 shrink-0 text-[var(--accent-crimson)]" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--accent-amber)]" />
                  )}
                  <span dir="ltr" className="ubo-mono text-xs font-extrabold text-[var(--accent-primary)]">
                    {item.controlId}
                  </span>
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">
                    {isAr ? item.titleAr : item.titleEn}
                  </h4>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    dir="ltr"
                    className="ubo-mono rounded bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]"
                  >
                    {item.legalRef}
                  </span>
                  <span
                    dir="ltr"
                    className="ubo-mono rounded px-2 py-0.5 text-[10px] font-extrabold uppercase"
                    style={{
                      backgroundColor: passed
                        ? 'var(--accent-emerald-soft)'
                        : item.severity === 'critical'
                          ? 'var(--accent-crimson-soft)'
                          : 'var(--accent-amber-soft)',
                      color: passed
                        ? 'var(--accent-emerald)'
                        : item.severity === 'critical'
                          ? 'var(--accent-crimson)'
                          : 'var(--accent-amber)',
                    }}
                  >
                    {passed ? 'PASS' : item.severity}
                  </span>
                </div>
              </div>

              <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                {isAr ? item.detailAr : item.detailEn}
              </p>

              {!passed && (
                <div className="mt-2 rounded-lg bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)]">
                  <span className="font-bold text-[var(--accent-amber)]">
                    {isAr ? 'الإجراء التصحيحي: ' : 'Remediation: '}
                  </span>
                  {isAr ? item.remediationAr : item.remediationEn}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
