import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Database,
  Globe,
  Moon,
  Network,
  Printer,
  ShieldAlert,
  Sun,
} from 'lucide-react';
import { ChainAndExposurePanel } from './components/ChainAndExposurePanel.tsx';
import { ChainCsvAuditPanel } from './components/ChainCsvAuditPanel.tsx';
import { ControlsAndFindingsPanel } from './components/ControlsAndFindingsPanel.tsx';
import { DossierVaultAndPrint } from './components/DossierVaultAndPrint.tsx';
import { UboCascadeAndPenaltySvg } from './components/UboCascadeAndPenaltySvg.tsx';
import { UBOCHECKAE_TOOL_VERSION } from './core/uboCatalog.ts';
import { UBO_PRESETS } from './core/presets.ts';
import { assessUboReadiness, evaluateUboCoreSync } from './core/readinessAssessor.ts';
import type { AssessmentInput, AssessmentResult } from './core/types.ts';
import {
  type ApiMode,
  type PublicUboReport,
  type UboDossierRecord,
  deleteDossier,
  detectServerMode,
  duplicateDossier,
  fetchBriefMarkdown,
  fetchExportCsv,
  fetchPublicReport,
  finalizeDossier,
  listDossiers,
  saveDossier,
} from './lib/api.ts';
import { stripBase, withBase } from './lib/basePath.ts';
import {
  STATUS_LABELS,
  UI_COPY,
  type Locale,
  type ThemeName,
} from './lib/i18n.ts';

type StudioTab = 'dashboard' | 'controls' | 'csv' | 'vault';

const LS_LOCALE = 'ubocheckae.v1.locale';
const LS_THEME = 'ubocheckae.v1.theme';

function getInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem(LS_LOCALE);
    if (saved === 'en' || saved === 'ar') return saved;
  } catch {
    // Ignore storage read errors
  }
  return 'ar';
}

function getInitialTheme(): ThemeName {
  try {
    const saved = localStorage.getItem(LS_THEME);
    if (saved === 'alabaster-registry' || saved === 'obsidian-compliance') return saved;
  } catch {
    // Ignore storage read errors
  }
  return 'alabaster-registry';
}

function parsePublicSlugFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  const rel = stripBase(window.location.pathname);
  const match = rel.match(/^\/r\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]!) : null;
}

function triggerFileDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const [theme, setTheme] = useState<ThemeName>(getInitialTheme);
  const [mode, setMode] = useState<ApiMode>('local');
  const [activeTab, setActiveTab] = useState<StudioTab>('dashboard');
  const [selectedPresetId, setSelectedPresetId] = useState<string>(UBO_PRESETS[0]!.id);
  const [input, setInput] = useState<AssessmentInput>(() => ({
    ...structuredClone(UBO_PRESETS[0]!.input),
    chainCsv: UBO_PRESETS[0]!.input.chainCsv ?? UBO_PRESETS[0]!.sampleCsv,
  }));
  const [shaDigest, setShaDigest] = useState<string>('');
  const [canonicalText, setCanonicalText] = useState<string>('');
  const [dossiers, setDossiers] = useState<UboDossierRecord[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [publicSlugRoute, setPublicSlugRoute] = useState<string | null>(() =>
    parsePublicSlugFromLocation(),
  );
  const [publicReportState, setPublicReportState] = useState<{
    loading: boolean;
    error: string | null;
    data: PublicUboReport | null;
  }>({ loading: false, error: null, data: null });

  const copy = UI_COPY[locale];
  const isAr = locale === 'ar';

  const syncCore = useMemo(() => evaluateUboCoreSync(input), [input]);
  const liveResult: AssessmentResult = useMemo(
    () => ({
      ...syncCore,
      canonicalDossierText: canonicalText,
      dossierSha256: shaDigest,
    }),
    [syncCore, canonicalText, shaDigest],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    try {
      localStorage.setItem(LS_LOCALE, locale);
    } catch {
      // Ignore storage write errors
    }
  }, [locale]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'obsidian-compliance' ? '#07101D' : '#F7F9FC');
    }
    try {
      localStorage.setItem(LS_THEME, theme);
    } catch {
      // Ignore storage write errors
    }
  }, [theme]);

  useEffect(() => {
    let active = true;
    void assessUboReadiness(input).then((res) => {
      if (active) {
        setShaDigest(res.dossierSha256 || '');
        setCanonicalText(res.canonicalDossierText || '');
      }
    });
    return () => {
      active = false;
    };
  }, [input]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const detected = await detectServerMode();
      if (cancelled) return;
      setMode(detected);
      try {
        const items = await listDossiers(detected);
        if (!cancelled) setDossiers(items);
      } catch {
        // Ignore initial list failure
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onPop = () => setPublicSlugRoute(parsePublicSlugFromLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!publicSlugRoute) return;
    let active = true;
    setPublicReportState({ loading: true, error: null, data: null });
    void (async () => {
      try {
        const detected = await detectServerMode();
        if (active) setMode(detected);
        const rep = await fetchPublicReport(detected, publicSlugRoute);
        if (active) setPublicReportState({ loading: false, error: null, data: rep });
      } catch (err) {
        if (active) {
          setPublicReportState({
            loading: false,
            error: err instanceof Error ? err.message : copy.missingReport,
            data: null,
          });
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [publicSlugRoute, copy.missingReport]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSelectPreset = (presetId: string) => {
    const found = UBO_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    setSelectedPresetId(found.id);
    setInput({
      ...structuredClone(found.input),
      chainCsv: found.input.chainCsv ?? found.sampleCsv,
    });
  };

  const handleSaveDossier = async (title: string) => {
    setBusyAction('save');
    try {
      const created = await saveDossier(mode, input, title);
      const updated = await listDossiers(mode);
      setDossiers(updated);
      setToast(
        isAr
          ? `تم حفظ الملف ${created.dossierCode} بنجاح`
          : `Saved dossier ${created.dossierCode}`,
      );
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusyAction(null);
    }
  };

  const handleFinalize = async (rec: UboDossierRecord) => {
    setBusyAction(rec.dossierCode);
    try {
      await finalizeDossier(mode, rec);
      setDossiers(await listDossiers(mode));
      setToast(
        isAr
          ? `تم ختم الملف ${rec.dossierCode} بصيغة SHA-256`
          : `Sealed dossier ${rec.dossierCode} with SHA-256`,
      );
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Finalize failed');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDuplicate = async (rec: UboDossierRecord) => {
    setBusyAction(rec.dossierCode);
    try {
      const cloned = await duplicateDossier(mode, rec);
      setDossiers(await listDossiers(mode));
      setToast(
        isAr ? `تم نسخ الملف إلى ${cloned.dossierCode}` : `Duplicated as ${cloned.dossierCode}`,
      );
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Duplicate failed');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async (rec: UboDossierRecord) => {
    setBusyAction(rec.dossierCode);
    try {
      await deleteDossier(mode, rec);
      setDossiers(await listDossiers(mode));
      setToast(isAr ? `تم حذف ${rec.dossierCode}` : `Deleted ${rec.dossierCode}`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDownloadBrief = async (rec: UboDossierRecord, lang: Locale) => {
    try {
      const md = await fetchBriefMarkdown(mode, rec, lang);
      triggerFileDownload(`${rec.dossierCode}.${lang}.brief.md`, md, 'text/markdown;charset=utf-8');
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Brief export failed');
    }
  };

  const handleDownloadDossierCsv = async (rec: UboDossierRecord) => {
    try {
      const csv = await fetchExportCsv(mode, rec);
      triggerFileDownload(`${rec.dossierCode}.chains-audit.csv`, csv, 'text/csv;charset=utf-8');
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'CSV export failed');
    }
  };

  const handleOpenPublicReport = (slugOrCode: string) => {
    window.history.pushState({}, '', withBase(`/r/${encodeURIComponent(slugOrCode)}`));
    setPublicSlugRoute(slugOrCode);
  };

  const handleClosePublicReport = () => {
    window.history.pushState({}, '', withBase('/'));
    setPublicSlugRoute(null);
  };

  if (publicSlugRoute) {
    const rep = publicReportState.data?.report;
    return (
      <div className="mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-6">
        <header className="ubo-card no-print mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
          <button
            type="button"
            onClick={handleClosePublicReport}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-bold text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
          >
            <ArrowLeft className="h-4 w-4" />
            {copy.backToWorkspace}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="lang-toggle-btn"
              onClick={() => setLocale((l) => (l === 'ar' ? 'en' : 'ar'))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-bold"
            >
              <Globe className="h-4 w-4 text-[var(--accent-primary)]" />
              {locale === 'ar' ? 'EN' : 'العربية'}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3 py-2 text-xs font-bold text-[var(--accent-primary-fg)]"
            >
              <Printer className="h-4 w-4" />
              {copy.printBtn}
            </button>
          </div>
        </header>

        {publicReportState.loading ? (
          <div className="ubo-card rounded-2xl p-8 text-center text-sm text-[var(--text-secondary)]">
            {isAr ? 'جاري تحميل التقرير المختوم...' : 'Loading sealed UBO report...'}
          </div>
        ) : publicReportState.error || !rep ? (
          <div className="ubo-card rounded-2xl p-8 text-center text-sm text-[var(--accent-crimson)]">
            {publicReportState.error || copy.missingReport}
          </div>
        ) : (
          <article className="ubo-card rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
              <div>
                <div dir="ltr" className="ubo-mono text-xs font-bold text-[var(--accent-primary)]">
                  {rep.dossierCode} · {rep.publicSlug}
                </div>
                <h1 className="mt-1 text-xl font-extrabold text-[var(--text-primary)]">
                  {rep.entityName}
                </h1>
              </div>
              <div className="text-end">
                <div dir="ltr" className="ubo-mono text-sm font-extrabold text-[var(--accent-emerald)]">
                  {rep.status.toUpperCase()} · {rep.readinessScore}/100
                </div>
                <div data-testid="public-view-count" className="text-xs text-[var(--text-secondary)]">
                  {copy.viewsLabel}: <span className="ubo-mono font-bold">{publicReportState.data?.viewCount ?? 1}</span>
                </div>
              </div>
            </div>
            <pre className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-[var(--bg-elevated)] p-4 text-xs leading-relaxed text-[var(--text-primary)]">
              {isAr ? rep.briefAr : rep.briefEn}
            </pre>
          </article>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-5 sm:px-6">
      <header className="ubo-card no-print mb-5 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-[var(--accent-primary-fg)]">
              <Network className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight text-[var(--text-primary)]">
                  {copy.brandTitle}
                </h1>
                <span
                  dir="ltr"
                  className="ubo-mono rounded-full bg-[var(--bg-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--accent-primary)]"
                >
                  v{UBOCHECKAE_TOOL_VERSION}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-teal-soft)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--accent-teal)]">
                  <Database className="h-3 w-3" />
                  {mode === 'server' ? copy.serverBadge : copy.localBadge}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">{copy.brandSub}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              data-testid="preset-select"
              aria-label={copy.presetLabel}
              className="ubo-input w-full text-xs sm:w-72"
              value={selectedPresetId}
              onChange={(e) => handleSelectPreset(e.target.value)}
            >
              {UBO_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {isAr ? p.labelAr : p.labelEn}
                </option>
              ))}
            </select>

            <button
              type="button"
              data-testid="lang-toggle-btn"
              onClick={() => setLocale((l) => (l === 'ar' ? 'en' : 'ar'))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-bold text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
            >
              <Globe className="h-4 w-4 text-[var(--accent-primary)]" />
              {locale === 'ar' ? 'EN' : 'العربية'}
            </button>

            <button
              type="button"
              data-testid="theme-toggle-btn"
              aria-label="Toggle theme"
              onClick={() =>
                setTheme((t) =>
                  t === 'alabaster-registry' ? 'obsidian-compliance' : 'alabaster-registry',
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-bold text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
            >
              {theme === 'alabaster-registry' ? (
                <Moon className="h-4 w-4 text-[var(--accent-primary)]" />
              ) : (
                <Sun className="h-4 w-4 text-[var(--accent-amber)]" />
              )}
              <span className="hidden sm:inline">
                {theme === 'alabaster-registry' ? 'Obsidian' : 'Alabaster'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3 py-2 text-xs font-bold text-[var(--accent-primary-fg)] hover:bg-[var(--accent-primary-hover)]"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">{copy.printBtn}</span>
            </button>
          </div>
        </div>

        <nav className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-3" role="tablist">
          {(
            [
              ['dashboard', copy.tabDashboard],
              ['controls', copy.tabControls],
              ['csv', copy.tabCsv],
              ['vault', copy.tabVault],
            ] as Array<[StudioTab, string]>
          ).map(([tabId, label]) => {
            const active = activeTab === tabId;
            return (
              <button
                key={tabId}
                type="button"
                data-testid={`tab-${tabId}`}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tabId)}
                className="rounded-xl px-3.5 py-2 text-xs font-bold transition-colors"
                style={{
                  backgroundColor: active ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                  color: active ? 'var(--accent-primary-fg)' : 'var(--text-primary)',
                }}
              >
                {label}
              </button>
            );
          })}

          <span
            data-testid="status-badge"
            dir="ltr"
            className="ubo-mono ms-auto inline-flex items-center rounded-xl bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-bold"
            style={{
              color:
                liveResult.readinessStatus === 'ready'
                  ? 'var(--accent-emerald)'
                  : liveResult.readinessStatus === 'conditional'
                    ? 'var(--accent-amber)'
                    : 'var(--accent-crimson)',
            }}
          >
            {STATUS_LABELS[liveResult.readinessStatus][isAr ? 'ar' : 'en']} · {liveResult.readinessScore}/100
          </span>
        </nav>
      </header>

      {toast && (
        <div
          role="status"
          className="ubo-card no-print mb-4 flex items-center gap-2 rounded-xl border-[var(--accent-primary)] px-4 py-2.5 text-xs font-bold text-[var(--text-primary)]"
        >
          <ShieldAlert className="h-4 w-4 text-[var(--accent-primary)]" />
          <span>{toast}</span>
        </div>
      )}

      <main>
        <UboCascadeAndPenaltySvg input={input} result={liveResult} locale={locale} />

        {activeTab === 'dashboard' && (
          <ChainAndExposurePanel
            input={input}
            result={liveResult}
            locale={locale}
            onChange={(patch) => setInput((prev) => ({ ...prev, ...patch }))}
          />
        )}

        {activeTab === 'controls' && (
          <ControlsAndFindingsPanel result={liveResult} locale={locale} />
        )}

        {activeTab === 'csv' && (
          <ChainCsvAuditPanel
            csvText={input.chainCsv || ''}
            locale={locale}
            onCsvChange={(nextCsv) => setInput((prev) => ({ ...prev, chainCsv: nextCsv }))}
            onDownloadCsv={(csvContent, filename) =>
              triggerFileDownload(filename, csvContent, 'text/csv;charset=utf-8')
            }
          />
        )}

        {activeTab === 'vault' && (
          <DossierVaultAndPrint
            mode={mode}
            locale={locale}
            dossiers={dossiers}
            busyAction={busyAction}
            liveShaDigest={shaDigest}
            onSaveDossier={handleSaveDossier}
            onFinalize={handleFinalize}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onLoadDossier={(rec) => {
              setInput(structuredClone(rec.input));
              setActiveTab('dashboard');
            }}
            onDownloadBrief={handleDownloadBrief}
            onDownloadCsv={handleDownloadDossierCsv}
            onOpenPublicReport={handleOpenPublicReport}
          />
        )}
      </main>

      <footer
        data-testid="legal-disclaimer-banner"
        className="mt-6 border-t border-[var(--border-subtle)] pt-4 text-center text-[11px] text-[var(--text-secondary)]"
      >
        <p>{isAr ? liveResult.legalDisclaimerAr : liveResult.legalDisclaimerEn}</p>
      </footer>
    </div>
  );
}
