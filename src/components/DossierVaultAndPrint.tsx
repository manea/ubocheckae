import { Copy, Download, ExternalLink, FileText, Lock, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ApiMode, UboDossierRecord } from '../lib/api.ts';
import type { Locale } from '../lib/i18n.ts';

interface Props {
  mode: ApiMode;
  locale: Locale;
  dossiers: UboDossierRecord[];
  busyAction: string | null;
  liveShaDigest: string;
  onSaveDossier: (title: string) => void;
  onFinalize: (record: UboDossierRecord) => void;
  onDuplicate: (record: UboDossierRecord) => void;
  onDelete: (record: UboDossierRecord) => void;
  onLoadDossier: (record: UboDossierRecord) => void;
  onDownloadBrief: (record: UboDossierRecord, lang: Locale) => void;
  onDownloadCsv: (record: UboDossierRecord) => void;
  onOpenPublicReport: (slugOrCode: string) => void;
}

export function DossierVaultAndPrint({
  mode,
  locale,
  dossiers,
  busyAction,
  liveShaDigest,
  onSaveDossier,
  onFinalize,
  onDuplicate,
  onDelete,
  onLoadDossier,
  onDownloadBrief,
  onDownloadCsv,
  onOpenPublicReport,
}: Props) {
  const isAr = locale === 'ar';
  const [customTitle, setCustomTitle] = useState('');

  return (
    <section className="ubo-card rounded-2xl p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            {isAr
              ? 'خزنة ملفات المستفيد الحقيقي والختم التشفيري SHA-256'
              : 'UBO Dossier Vault & Cryptographic SHA-256 Seal'}
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            {isAr
              ? `وضع التخزين النشط: ${mode === 'server' ? 'قاعدة SQLite WAL' : 'متصفح محلي $0'} | بصمة المعاينة الحية:`
              : `Storage Engine: ${mode === 'server' ? 'SQLite WAL Server' : '$0 Browser LocalStorage'} | Live Digest:`}{' '}
            <code dir="ltr" className="ubo-mono text-[var(--accent-primary)]">
              {liveShaDigest ? liveShaDigest.slice(0, 16) : 'computing...'}
            </code>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            dir="auto"
            className="ubo-input w-56"
            placeholder={isAr ? 'عنوان الملف (اختياري)...' : 'Dossier title (optional)...'}
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
          />
          <button
            type="button"
            data-testid="save-dossier-btn"
            disabled={Boolean(busyAction)}
            onClick={() => {
              onSaveDossier(customTitle);
              setCustomTitle('');
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-bold text-[var(--accent-primary-fg)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {isAr ? 'حفظ ملف تقييم' : 'Save Dossier'}
          </button>
        </div>
      </div>

      {dossiers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-elevated)] p-6 text-center text-xs text-[var(--text-secondary)]">
          {isAr
            ? 'لا توجد ملفات محفوظة بعد — اضغط «حفظ ملف تقييم» لترقيم UBO-YYYY-0001 ثم ختمه ومشاركته.'
            : 'No saved dossiers yet — click "Save Dossier" to allocate UBO-YYYY-0001 and seal with SHA-256.'}
        </div>
      ) : (
        <div className="space-y-3">
          {dossiers.map((rec) => {
            const sealed = Boolean(rec.lockedAt);
            return (
              <div
                key={rec.dossierCode}
                data-testid={`dossier-card-${rec.dossierCode}`}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span dir="ltr" className="ubo-mono text-xs font-extrabold text-[var(--accent-primary)]">
                        {rec.dossierCode}
                      </span>
                      <span dir="auto" className="text-sm font-bold text-[var(--text-primary)]">
                        {rec.title}
                      </span>
                      <span
                        dir="ltr"
                        className="ubo-mono rounded px-2 py-0.5 text-[10px] font-bold uppercase"
                        style={{
                          backgroundColor:
                            rec.status === 'ready'
                              ? 'var(--accent-emerald-soft)'
                              : rec.status === 'conditional'
                                ? 'var(--accent-amber-soft)'
                                : 'var(--accent-crimson-soft)',
                          color:
                            rec.status === 'ready'
                              ? 'var(--accent-emerald)'
                              : rec.status === 'conditional'
                                ? 'var(--accent-amber)'
                                : 'var(--accent-crimson)',
                        }}
                      >
                        {rec.status} · {rec.readinessScore}/100
                      </span>
                      {sealed && (
                        <span
                          dir="ltr"
                          className="ubo-mono inline-flex items-center gap-1 rounded bg-[var(--accent-teal-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent-teal)]"
                        >
                          <Lock className="h-3 w-3" /> SEALED
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-[var(--text-secondary)]">
                      <span>{rec.entityName}</span> ·{' '}
                      <span dir="ltr" className="ubo-mono">
                        {rec.effectiveOwnershipPct}% | {rec.determinationTier} | {rec.dossierSha256.slice(0, 14)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onLoadDossier(rec)}
                      className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
                    >
                      {isAr ? 'تحميل' : 'Load'}
                    </button>

                    <button
                      type="button"
                      onClick={() => onDownloadBrief(rec, locale)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
                    >
                      <FileText className="h-3 w-3" /> MD
                    </button>

                    <button
                      type="button"
                      data-testid={`export-csv-${rec.dossierCode}`}
                      onClick={() => onDownloadCsv(rec)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
                    >
                      <Download className="h-3 w-3" /> CSV
                    </button>

                    <button
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() => onDuplicate(rec)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
                    >
                      <Copy className="h-3 w-3" /> {isAr ? 'نسخ' : 'Copy'}
                    </button>

                    {!sealed ? (
                      <>
                        <button
                          type="button"
                          data-testid={`finalize-dossier-${rec.dossierCode}`}
                          disabled={Boolean(busyAction)}
                          onClick={() => onFinalize(rec)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-teal)] px-2.5 py-1.5 text-[11px] font-bold text-white hover:opacity-90"
                        >
                          <Lock className="h-3 w-3" /> {isAr ? 'ختم ومشاركة' : 'Seal & Share'}
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(busyAction)}
                          onClick={() => onDelete(rec)}
                          aria-label={`Delete ${rec.dossierCode}`}
                          className="inline-flex items-center rounded-lg border border-[var(--accent-crimson)] px-2 py-1.5 text-[11px] font-bold text-[var(--accent-crimson)] hover:bg-[var(--accent-crimson-soft)]"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        data-testid={`open-public-${rec.dossierCode}`}
                        onClick={() => onOpenPublicReport(rec.dossierCode)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-primary)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--accent-primary-fg)] hover:bg-[var(--accent-primary-hover)]"
                      >
                        <ExternalLink className="h-3 w-3" /> /r/{rec.dossierCode}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
