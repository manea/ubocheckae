import {
  assessUboReadiness,
  buildUboBriefMarkdown,
  exportChainAuditCsv,
  formatSafeCsvCell,
} from '../core/index.ts';
import type { AssessmentInput, AssessmentResult } from '../core/types.ts';
import { withBase } from './basePath.ts';
import type { Locale } from './i18n.ts';

export type ApiMode = 'server' | 'local';

export interface UboDossierRecord {
  id: number | string;
  profileId: number | string | null;
  dossierCode: string;
  title: string;
  entityName: string;
  authorizedContactEmiratesId: string;
  jurisdiction: AssessmentInput['jurisdiction'];
  structureKind: AssessmentInput['structureKind'];
  effectiveOwnershipPct: number;
  determinationTier: AssessmentResult['obligations']['determinationTier'];
  penaltyStageCode: AssessmentResult['obligations']['penaltyStageCode'];
  projectedMinFineAed: number;
  projectedMaxFineAed: number;
  licenseSuspensionRisk: boolean;
  status: AssessmentResult['readinessStatus'];
  readinessScore: number;
  blockersCount: number;
  canonicalText: string;
  dossierSha256: string;
  publicSlug: string | null;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
  input: AssessmentInput;
  result: AssessmentResult;
}

export interface PublicUboReport {
  viewCount: number;
  lastViewedAt: string;
  report: {
    dossierCode: string;
    publicSlug: string;
    entityName: string;
    authorizedContactEmiratesId: string;
    jurisdiction: AssessmentInput['jurisdiction'];
    structureKind: AssessmentInput['structureKind'];
    determinationTier: AssessmentResult['obligations']['determinationTier'];
    penaltyStageCode: AssessmentResult['obligations']['penaltyStageCode'];
    status: AssessmentResult['readinessStatus'];
    readinessScore: number;
    lockedAt: string;
    dossierSha256: string;
    legalDisclaimerEn: string;
    legalDisclaimerAr: string;
    obligations: AssessmentResult['obligations'];
    briefAr: string;
    briefEn: string;
  };
}

const LS_DOSSIERS = 'ubocheckae.v1.dossiers';
const LS_SEQ = 'ubocheckae.v1.seq';
const LS_VIEWS = 'ubocheckae.v1.views';

function readLocalList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocalList<T>(key: string, items: T[]): void {
  localStorage.setItem(key, JSON.stringify(items));
}

function allocateLocalDossierCode(): string {
  const year = new Date().getUTCFullYear();
  let seqMap: Record<string, number> = {};
  try {
    const raw = localStorage.getItem(LS_SEQ);
    seqMap = raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    seqMap = {};
  }
  const next = Number(seqMap[String(year)] ?? 0) + 1;
  seqMap[String(year)] = next;
  localStorage.setItem(LS_SEQ, JSON.stringify(seqMap));
  return `UBO-${year}-${String(next).padStart(4, '0')}`;
}

function makeLocalSlug(dossierCode: string): string {
  return `ubo-${dossierCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const payload = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) {
    throw new Error(payload.message || `HTTP ${res.status}`);
  }
  return payload as T;
}

export async function detectServerMode(): Promise<ApiMode> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1600);
    const res = await fetch(withBase('/health'), {
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return 'local';
    const data = (await res.json()) as { ok?: boolean; service?: string };
    return data.ok && data.service === 'ubocheckae' ? 'server' : 'local';
  } catch {
    return 'local';
  }
}

export async function listDossiers(mode: ApiMode): Promise<UboDossierRecord[]> {
  if (mode === 'server') {
    const data = await fetchJson<{ items?: UboDossierRecord[] }>(
      withBase('/api/dossiers?limit=50'),
    );
    return Array.isArray(data.items) ? data.items : [];
  }
  return readLocalList<UboDossierRecord>(LS_DOSSIERS).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export async function saveDossier(
  mode: ApiMode,
  input: AssessmentInput,
  title?: string,
): Promise<UboDossierRecord> {
  if (mode === 'server') {
    const data = await fetchJson<{ item: UboDossierRecord }>(withBase('/api/dossiers'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title?.trim() || `${input.entityName}`,
        input,
      }),
    });
    return data.item;
  }

  const result = await assessUboReadiness(input);
  const now = new Date().toISOString();
  const dossierCode = allocateLocalDossierCode();
  const record: UboDossierRecord = {
    id: dossierCode,
    profileId: null,
    dossierCode,
    title: title?.trim() || `${input.entityName} — ${result.obligations.determinationTier}`,
    entityName: input.entityName,
    authorizedContactEmiratesId: input.authorizedContactEmiratesId || '',
    jurisdiction: input.jurisdiction,
    structureKind: input.structureKind,
    effectiveOwnershipPct: result.obligations.totalEffectiveOwnershipPct,
    determinationTier: result.obligations.determinationTier,
    penaltyStageCode: result.obligations.penaltyStageCode,
    projectedMinFineAed: result.obligations.projectedMinimumFineAed,
    projectedMaxFineAed: result.obligations.projectedMaximumFineAed,
    licenseSuspensionRisk: result.obligations.licenseSuspensionRisk,
    status: result.readinessStatus,
    readinessScore: result.readinessScore,
    blockersCount: result.blockersCount,
    canonicalText: result.canonicalDossierText || '',
    dossierSha256: result.dossierSha256 || '',
    publicSlug: null,
    lockedAt: null,
    createdAt: now,
    updatedAt: now,
    input: structuredClone(input),
    result,
  };
  const existing = readLocalList<UboDossierRecord>(LS_DOSSIERS);
  writeLocalList(LS_DOSSIERS, [record, ...existing]);
  return record;
}

export async function finalizeDossier(
  mode: ApiMode,
  record: UboDossierRecord,
): Promise<UboDossierRecord> {
  if (mode === 'server') {
    const data = await fetchJson<{ item: UboDossierRecord }>(
      withBase(`/api/dossiers/${encodeURIComponent(record.dossierCode)}/finalize`),
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    );
    return data.item;
  }

  const items = readLocalList<UboDossierRecord>(LS_DOSSIERS);
  const target = items.find((i) => i.dossierCode === record.dossierCode);
  if (!target) throw new Error('Dossier not found in local storage.');
  if (target.lockedAt) throw new Error('Dossier is already finalized and sealed.');

  const result = await assessUboReadiness(target.input);
  const now = new Date().toISOString();
  const sealed: UboDossierRecord = {
    ...target,
    effectiveOwnershipPct: result.obligations.totalEffectiveOwnershipPct,
    determinationTier: result.obligations.determinationTier,
    penaltyStageCode: result.obligations.penaltyStageCode,
    projectedMinFineAed: result.obligations.projectedMinimumFineAed,
    projectedMaxFineAed: result.obligations.projectedMaximumFineAed,
    licenseSuspensionRisk: result.obligations.licenseSuspensionRisk,
    status: result.readinessStatus,
    readinessScore: result.readinessScore,
    blockersCount: result.blockersCount,
    canonicalText: result.canonicalDossierText || '',
    dossierSha256: result.dossierSha256 || '',
    publicSlug: target.publicSlug || makeLocalSlug(target.dossierCode),
    lockedAt: now,
    updatedAt: now,
    result,
  };
  writeLocalList(
    LS_DOSSIERS,
    items.map((i) => (i.dossierCode === target.dossierCode ? sealed : i)),
  );
  return sealed;
}

export async function duplicateDossier(
  mode: ApiMode,
  record: UboDossierRecord,
): Promise<UboDossierRecord> {
  if (mode === 'server') {
    const data = await fetchJson<{ item: UboDossierRecord }>(
      withBase(`/api/dossiers/${encodeURIComponent(record.dossierCode)}/duplicate`),
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    );
    return data.item;
  }
  return saveDossier(mode, record.input, `${record.title} (Copy)`);
}

export async function deleteDossier(
  mode: ApiMode,
  record: UboDossierRecord,
): Promise<void> {
  if (mode === 'server') {
    await fetchJson<{ ok: boolean }>(
      withBase(`/api/dossiers/${encodeURIComponent(record.dossierCode)}`),
      { method: 'DELETE' },
    );
    return;
  }
  const items = readLocalList<UboDossierRecord>(LS_DOSSIERS);
  const target = items.find((i) => i.dossierCode === record.dossierCode);
  if (target?.lockedAt) {
    throw new Error('Sealed dossier is immutable and cannot be deleted.');
  }
  writeLocalList(
    LS_DOSSIERS,
    items.filter((i) => i.dossierCode !== record.dossierCode),
  );
}

export async function fetchBriefMarkdown(
  mode: ApiMode,
  record: UboDossierRecord,
  locale: Locale,
): Promise<string> {
  if (mode === 'server') {
    const res = await fetch(
      withBase(`/api/dossiers/${encodeURIComponent(record.dossierCode)}/brief.md?lang=${locale}`),
      { cache: 'no-store' },
    );
    if (!res.ok) throw new Error(`Failed to fetch brief (${res.status})`);
    return res.text();
  }
  return buildUboBriefMarkdown(
    record.input,
    record.result,
    record.dossierCode,
    record.dossierSha256,
    locale,
  );
}

export async function fetchExportCsv(
  mode: ApiMode,
  record: UboDossierRecord,
): Promise<string> {
  if (mode === 'server') {
    const res = await fetch(
      withBase(`/api/dossiers/${encodeURIComponent(record.dossierCode)}/export.csv`),
      { cache: 'no-store' },
    );
    if (!res.ok) throw new Error(`Failed to export CSV (${res.status})`);
    const buf = await res.arrayBuffer();
    return new TextDecoder('utf-8', { ignoreBOM: true }).decode(buf);
  }

  if (record.result.csvAudit && record.result.csvAudit.rows.length > 0) {
    return exportChainAuditCsv(record.result.csvAudit).csv;
  }
  const header = [
    'dossier_code',
    'entity_name',
    'authorized_contact_eid',
    'jurisdiction',
    'structure_kind',
    'effective_ownership_pct',
    'determination_tier',
    'penalty_stage_code',
    'projected_min_fine_aed',
    'projected_max_fine_aed',
    'license_suspension_risk',
    'status',
    'readiness_score',
    'dossier_sha256',
  ]
    .map((h) => formatSafeCsvCell(h).cell)
    .join(',');
  const row = [
    record.dossierCode,
    record.entityName,
    record.authorizedContactEmiratesId,
    record.jurisdiction,
    record.structureKind,
    record.effectiveOwnershipPct,
    record.determinationTier,
    record.penaltyStageCode,
    record.projectedMinFineAed,
    record.projectedMaxFineAed,
    record.licenseSuspensionRisk,
    record.status,
    record.readinessScore,
    record.dossierSha256,
  ]
    .map((v) => formatSafeCsvCell(v).cell)
    .join(',');
  return `\uFEFF${header}\r\n${row}\r\n`;
}

export async function fetchPublicReport(
  mode: ApiMode,
  slugOrCode: string,
): Promise<PublicUboReport> {
  if (mode === 'server') {
    return fetchJson<PublicUboReport>(
      withBase(`/api/public/reports/${encodeURIComponent(slugOrCode)}`),
    );
  }

  const items = readLocalList<UboDossierRecord>(LS_DOSSIERS);
  const target = items.find(
    (i) => i.lockedAt && (i.publicSlug === slugOrCode || i.dossierCode === slugOrCode),
  );
  if (!target || !target.lockedAt || !target.publicSlug) {
    throw new Error('Published sealed UBOCheckAE report was not found.');
  }

  let viewsMap: Record<string, number> = {};
  try {
    const raw = localStorage.getItem(LS_VIEWS);
    viewsMap = raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    viewsMap = {};
  }
  const nextCount = Number(viewsMap[target.dossierCode] ?? 0) + 1;
  viewsMap[target.dossierCode] = nextCount;
  localStorage.setItem(LS_VIEWS, JSON.stringify(viewsMap));
  const now = new Date().toISOString();

  return {
    viewCount: nextCount,
    lastViewedAt: now,
    report: {
      dossierCode: target.dossierCode,
      publicSlug: target.publicSlug,
      entityName: target.entityName,
      authorizedContactEmiratesId: target.authorizedContactEmiratesId,
      jurisdiction: target.jurisdiction,
      structureKind: target.structureKind,
      determinationTier: target.determinationTier,
      penaltyStageCode: target.penaltyStageCode,
      status: target.status,
      readinessScore: target.readinessScore,
      lockedAt: target.lockedAt,
      dossierSha256: target.dossierSha256,
      legalDisclaimerEn: target.result.legalDisclaimerEn,
      legalDisclaimerAr: target.result.legalDisclaimerAr,
      obligations: target.result.obligations,
      briefAr: buildUboBriefMarkdown(
        target.input,
        target.result,
        target.dossierCode,
        target.dossierSha256,
        'ar',
      ),
      briefEn: buildUboBriefMarkdown(
        target.input,
        target.result,
        target.dossierCode,
        target.dossierSha256,
        'en',
      ),
    },
  };
}
