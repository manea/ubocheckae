import { Download, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import { auditChainCsv, exportChainAuditCsv } from '../core/chainCsvAuditor.ts';
import type { Locale } from '../lib/i18n.ts';

interface Props {
  csvText: string;
  locale: Locale;
  onCsvChange: (nextCsv: string) => void;
  onDownloadCsv: (csvContent: string, filename: string) => void;
}

export function ChainCsvAuditPanel({ csvText, locale, onCsvChange, onDownloadCsv }: Props) {
  const isAr = locale === 'ar';
  const summary = auditChainCsv(csvText);

  const handleDownloadSafeCsv = () => {
    const exported = exportChainAuditCsv(summary);
    onDownloadCsv(exported.csv, 'ubocheckae-chains-audit.csv');
  };

  return (
    <section className="ubo-card rounded-2xl p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
            <FileSpreadsheet className="h-4 w-4 text-[var(--accent-primary)]" />
            {isAr
              ? 'مدقق سلاسل الملكية والشركاء CSV (حصة 25% فأكثر، مهلة 15 يوماً وتعقيم CWE-1236)'
              : 'Ownership Chain & Partner CSV Auditor (>= 25%, 15d SLA & CWE-1236 Guard)'}
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            {isAr
              ? 'حساب النسبة الفعالة عبر طبقات الشركات وفحص الهوية الإماراتية 784 وتصدير CSV محصّن بـ UTF-8 BOM + CRLF'
              : 'Computes effective multi-layer equity, checks 784 Luhn EID & 15d SLAs, and sanitizes spreadsheet formula injection'}
          </p>
        </div>

        <button
          type="button"
          data-testid="download-csv-audit-btn"
          disabled={summary.totalRows === 0}
          onClick={handleDownloadSafeCsv}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-bold text-[var(--accent-primary-fg)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {isAr ? 'تصدير CSV آمن (UTF-8 BOM)' : 'Export Safe CSV (UTF-8 BOM)'}
        </button>
      </div>

      <textarea
        rows={6}
        dir="ltr"
        data-testid="chain-csv-textarea"
        className="ubo-input ubo-mono text-xs"
        value={csvText}
        onChange={(e) => onCsvChange(e.target.value)}
        placeholder="entity_id,holder_or_layer_en,jurisdiction,direct_pct,layer1_pct,layer2_pct,days_since_change,nominee_disclosed,ubo_registered,emirates_id"
      />

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-6">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5">
          <div className="text-[11px] text-[var(--text-secondary)]">{isAr ? 'السجلات' : 'Rows'}</div>
          <div data-testid="csv-total-rows" className="ubo-mono num-tabular text-base font-extrabold">
            {summary.totalRows}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5">
          <div className="text-[11px] text-[var(--text-secondary)]">{isAr ? 'يحقق 25% فأكثر' : '>= 25% UBO'}</div>
          <div className="ubo-mono num-tabular text-base font-extrabold text-[var(--accent-amber)]">
            {summary.qualifying25PctRows}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5">
          <div className="text-[11px] text-[var(--text-secondary)]">{isAr ? 'تأخر > 15 يوم' : '> 15d SLA'}</div>
          <div className="ubo-mono num-tabular text-base font-extrabold text-[var(--accent-crimson)]">
            {summary.lateUpdateOver15DaysRows}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5">
          <div className="text-[11px] text-[var(--text-secondary)]">{isAr ? 'اسمي / غير مسجل' : 'Unfiled / Nom'}</div>
          <div className="ubo-mono num-tabular text-base font-extrabold text-[var(--accent-amber)]">
            {summary.unverifiedNomineeOrUnregisteredRows}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5">
          <div className="text-[11px] text-[var(--text-secondary)]">{isAr ? 'تعقيم CWE-1236' : 'CWE-1236'}</div>
          <div
            data-testid="csv-sanitized-count"
            className="ubo-mono num-tabular flex items-center gap-1 text-base font-extrabold text-[var(--accent-teal)]"
          >
            <ShieldCheck className="h-4 w-4" />
            {summary.formulaInjectionSanitizedCount}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5">
          <div className="text-[11px] text-[var(--text-secondary)]">{isAr ? 'أقصى تعرض' : 'Max Fine Est.'}</div>
          <div
            data-testid="csv-exposure-max"
            dir="ltr"
            className="ubo-mono num-tabular text-sm font-extrabold text-[var(--accent-crimson)]"
          >
            AED {summary.totalEstimatedExposureMaxAed.toLocaleString('en-US')}
          </div>
        </div>
      </div>

      {summary.rows.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
          <table className="w-full border-collapse text-start text-xs">
            <thead className="bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">{isAr ? 'رمز الطبقة' : 'Entity ID'}</th>
                <th className="px-3 py-2">{isAr ? 'صاحب الحصة / الشركة' : 'Holder / Layer'}</th>
                <th className="px-3 py-2">{isAr ? 'الملكية الفعالة' : 'Effective %'}</th>
                <th className="px-3 py-2">{isAr ? 'أيام التغيير' : 'Days'}</th>
                <th className="px-3 py-2">{isAr ? 'مسجل RBO' : 'RBO'}</th>
                <th className="px-3 py-2">{isAr ? 'الهوية 784' : 'EID 784'}</th>
                <th className="px-3 py-2">{isAr ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {summary.rows.map((r) => (
                <tr key={`${r.rowNumber}-${r.entityId}`}>
                  <td dir="ltr" className="ubo-mono px-3 py-2">
                    {r.rowNumber}
                  </td>
                  <td dir="ltr" className="ubo-mono px-3 py-2 font-semibold">
                    {r.entityId}
                  </td>
                  <td dir="auto" className="px-3 py-2">
                    {r.holderOrLayerEn}
                  </td>
                  <td dir="ltr" className="ubo-mono num-tabular px-3 py-2 font-bold">
                    {r.effectivePct}% {r.qualifies25PctUbo ? '(>=25%)' : ''}
                  </td>
                  <td dir="ltr" className="ubo-mono num-tabular px-3 py-2">
                    {r.daysSinceChange}d
                  </td>
                  <td className="px-3 py-2">
                    {r.uboRegistered ? (isAr ? 'نعم' : 'Yes') : isAr ? 'لا ✗' : 'No ✗'}
                  </td>
                  <td dir="ltr" className="ubo-mono px-3 py-2">
                    {r.emiratesIdValid === null ? '—' : r.emiratesIdValid ? 'OK ✓' : 'INVALID ✗'}
                  </td>
                  <td
                    dir="ltr"
                    className="ubo-mono px-3 py-2 font-bold uppercase"
                    style={{
                      color:
                        r.status === 'compliant'
                          ? 'var(--accent-emerald)'
                          : r.status === 'attention'
                            ? 'var(--accent-amber)'
                            : 'var(--accent-crimson)',
                    }}
                  >
                    {r.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
