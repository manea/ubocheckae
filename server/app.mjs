import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {
  LEGAL_DISCLAIMER_AR,
  LEGAL_DISCLAIMER_EN,
  UBOCHECKAE_TOOL_VERSION,
  UBO_CONTROLS,
  UBO_PRESETS,
  assessUboReadiness,
  auditChainCsv,
  buildUboBriefMarkdown,
  evaluateUboCoreSync,
  evaluateUboObligations,
  exportChainAuditCsv,
  formatSafeCsvCell,
} from '../src/core/index.ts';
import {
  allocateDossierCodeTx,
  closeDb,
  createDb,
  generatePublicSlug,
  getDbStats,
  withImmediateTransaction,
} from './db.mjs';

const DEFAULT_MAX_BODY_BYTES = 512 * 1024;
const DEFAULT_RATE_LIMIT_MAX = 300;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

const VALID_JURISDICTIONS = new Set([
  'uae_mainland',
  'non_financial_freezone',
  'difc_adgm_financial_fz',
  'wholly_government_owned',
  'listed_company_or_subsidiary',
]);

const VALID_STRUCTURES = new Set([
  'direct_simple',
  'multi_layer_holding',
  'complex_cross_border',
  'widely_held_no_25pct',
]);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export function normalizeBasePath(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let cleaned = raw.trim();
  if (!cleaned || cleaned === '/') return '';
  if (!cleaned.startsWith('/')) cleaned = `/${cleaned}`;
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
}

function stripBasePath(pathname, basePath) {
  if (!basePath) return pathname || '/';
  if (pathname === basePath) return '/';
  if (pathname.startsWith(`${basePath}/`)) {
    return pathname.slice(basePath.length) || '/';
  }
  return pathname || '/';
}

function getSecurityHeaders(extra = {}) {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    ...extra,
  };
}

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    ...getSecurityHeaders(extraHeaders),
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendText(res, status, contentType, body, extraHeaders = {}, method = 'GET') {
  res.writeHead(status, {
    ...getSecurityHeaders(extraHeaders),
    'Content-Type': contentType,
  });
  if (method === 'HEAD') {
    res.end();
    return;
  }
  res.end(body);
}

function injectBaseTagHtml(html, basePath) {
  let updated = html;
  if (basePath) {
    updated = updated.replace(/(href|src)="\/(?!\/)/g, `$1="${basePath}/`);
    updated = updated.replace(/(href|src)="\.\//g, `$1="${basePath}/`);
  }
  const safeBase = JSON.stringify(basePath).replace(/</g, '\\u003c');
  const snippet = `<script>window.__UBOCHECKAE_BASE__=${safeBase};</script>`;
  if (updated.includes('</head>')) {
    return updated.replace('</head>', `${snippet}\n</head>`);
  }
  if (updated.includes('<body')) {
    return updated.replace('<body', `${snippet}\n<body`);
  }
  return `${snippet}\n${updated}`;
}

function buildFallbackShellHtml(basePath) {
  const apiPrefix = `${basePath}/api`;
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>UBOCheckAE v${UBOCHECKAE_TOOL_VERSION} — مدقق سجل المستفيد الحقيقي الإماراتي</title>
</head>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:760px;margin:2.5rem auto;padding:0 1.25rem;line-height:1.6;background:#0e1726;color:#f3f6fb">
  <h1>UBOCheckAE v${UBOCHECKAE_TOOL_VERSION}</h1>
  <p>UAE Cabinet Resolutions No. 109 of 2023 &amp; No. 132 of 2023 Beneficial Owner (UBO) Ownership Chain &amp; Penalty Readiness Studio.</p>
  <p><strong>HTTP/SQLite WAL Backend Active</strong> — Base Path: <code>${basePath || '/'}</code> | API Root: <code>${apiPrefix}</code></p>
  <p style="font-size:.9rem;color:#9fb2cf">${LEGAL_DISCLAIMER_AR}</p>
</body>
</html>`;
}

async function readJsonBody(req, maxBodyBytes) {
  const contentLength = Number(req.headers['content-length']);
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    req.resume();
    throw new HttpError(
      413,
      'PAYLOAD_TOO_LARGE',
      `Request body exceeds limit of ${maxBodyBytes} bytes.`,
    );
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let settled = false;

    req.on('data', (chunk) => {
      if (settled) return;
      totalBytes += chunk.length;
      if (totalBytes > maxBodyBytes) {
        settled = true;
        req.resume();
        reject(
          new HttpError(
            413,
            'PAYLOAD_TOO_LARGE',
            `Request body exceeds limit of ${maxBodyBytes} bytes.`,
          ),
        );
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (settled) return;
      settled = true;
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(new HttpError(400, 'INVALID_JSON', 'JSON body must be an object.'));
          return;
        }
        resolve(parsed);
      } catch {
        reject(new HttpError(400, 'INVALID_JSON', 'Malformed JSON request body.'));
      }
    });

    req.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

function validateNumberField(value, min, max, fieldName) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > max) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      `${fieldName} must be a number between ${min} and ${max}.`,
    );
  }
  return num;
}

function validateEnumField(value, validSet, fieldName) {
  if (!validSet.has(value)) {
    throw new HttpError(400, 'VALIDATION_ERROR', `Unsupported ${fieldName}: ${value}`);
  }
  return value;
}

function validateBoolField(value, fallback, fieldName) {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') {
    throw new HttpError(400, 'VALIDATION_ERROR', `${fieldName} must be a boolean.`);
  }
  return value;
}

function resolveAssessmentInput(body, baseInput = null) {
  let presetBase = baseInput;
  let presetSampleCsv = '';
  if (body.presetId !== undefined) {
    const found = UBO_PRESETS.find((p) => p.id === String(body.presetId));
    if (!found) {
      throw new HttpError(404, 'PRESET_NOT_FOUND', `Unknown presetId: ${body.presetId}`);
    }
    presetBase = found.input;
    presetSampleCsv = found.sampleCsv || '';
  }

  const defaults = presetBase || UBO_PRESETS[0].input;
  const rawInput =
    body.input && typeof body.input === 'object' && !Array.isArray(body.input)
      ? { ...body, ...body.input }
      : body;

  const entityName =
    rawInput.entityName !== undefined ? String(rawInput.entityName).trim() : defaults.entityName;
  if (!entityName) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'entityName is required.');
  }

  const authorizedContactEmiratesId =
    rawInput.authorizedContactEmiratesId !== undefined
      ? String(rawInput.authorizedContactEmiratesId).trim()
      : defaults.authorizedContactEmiratesId || '';

  const jurisdiction = validateEnumField(
    rawInput.jurisdiction !== undefined
      ? String(rawInput.jurisdiction).trim()
      : defaults.jurisdiction,
    VALID_JURISDICTIONS,
    'jurisdiction',
  );

  const structureKind = validateEnumField(
    rawInput.structureKind !== undefined
      ? String(rawInput.structureKind).trim()
      : defaults.structureKind,
    VALID_STRUCTURES,
    'structureKind',
  );

  let chainCsv = defaults.chainCsv || presetSampleCsv || '';
  if (rawInput.chainCsv !== undefined) {
    chainCsv = String(rawInput.chainCsv);
  } else if (rawInput.csv !== undefined) {
    chainCsv = String(rawInput.csv);
  }

  return {
    entityName,
    authorizedContactEmiratesId,
    jurisdiction,
    structureKind,
    ownershipLayersCount: Math.floor(
      validateNumberField(
        rawInput.ownershipLayersCount ?? defaults.ownershipLayersCount,
        1,
        50,
        'ownershipLayersCount',
      ),
    ),
    directOwnershipPct: validateNumberField(
      rawInput.directOwnershipPct ?? defaults.directOwnershipPct,
      0,
      100,
      'directOwnershipPct',
    ),
    intermediateLayer1Pct: validateNumberField(
      rawInput.intermediateLayer1Pct ?? defaults.intermediateLayer1Pct,
      0,
      100,
      'intermediateLayer1Pct',
    ),
    intermediateLayer2Pct: validateNumberField(
      rawInput.intermediateLayer2Pct ?? defaults.intermediateLayer2Pct,
      0,
      100,
      'intermediateLayer2Pct',
    ),
    otherVotingOrControlRights: validateBoolField(
      rawInput.otherVotingOrControlRights,
      defaults.otherVotingOrControlRights,
      'otherVotingOrControlRights',
    ),
    seniorManagementFallbackNamed: validateBoolField(
      rawInput.seniorManagementFallbackNamed,
      defaults.seniorManagementFallbackNamed,
      'seniorManagementFallbackNamed',
    ),
    rboAndPartnersRegistersMaintained: validateBoolField(
      rawInput.rboAndPartnersRegistersMaintained,
      defaults.rboAndPartnersRegistersMaintained,
      'rboAndPartnersRegistersMaintained',
    ),
    chainLookthroughVerified: validateBoolField(
      rawInput.chainLookthroughVerified,
      defaults.chainLookthroughVerified,
      'chainLookthroughVerified',
    ),
    daysSinceUboChangeOrIncorporation: Math.floor(
      validateNumberField(
        rawInput.daysSinceUboChangeOrIncorporation ?? defaults.daysSinceUboChangeOrIncorporation,
        0,
        3650,
        'daysSinceUboChangeOrIncorporation',
      ),
    ),
    registrarUpdatedWithin15Days: validateBoolField(
      rawInput.registrarUpdatedWithin15Days,
      defaults.registrarUpdatedWithin15Days,
      'registrarUpdatedWithin15Days',
    ),
    hasNomineeArrangements: validateBoolField(
      rawInput.hasNomineeArrangements,
      defaults.hasNomineeArrangements,
      'hasNomineeArrangements',
    ),
    nomineeRegisterMaintained: validateBoolField(
      rawInput.nomineeRegisterMaintained,
      defaults.nomineeRegisterMaintained,
      'nomineeRegisterMaintained',
    ),
    nomineeDisclosedWithin15Days: validateBoolField(
      rawInput.nomineeDisclosedWithin15Days,
      defaults.nomineeDisclosedWithin15Days,
      'nomineeDisclosedWithin15Days',
    ),
    fiveYearRetentionCommitted: validateBoolField(
      rawInput.fiveYearRetentionCommitted,
      defaults.fiveYearRetentionCommitted,
      'fiveYearRetentionCommitted',
    ),
    scopeAndExemptionVerified: validateBoolField(
      rawInput.scopeAndExemptionVerified,
      defaults.scopeAndExemptionVerified,
      'scopeAndExemptionVerified',
    ),
    authorizedResidentContactAppointed: validateBoolField(
      rawInput.authorizedResidentContactAppointed,
      defaults.authorizedResidentContactAppointed,
      'authorizedResidentContactAppointed',
    ),
    priorOffenseCount: Math.floor(
      validateNumberField(
        rawInput.priorOffenseCount ?? defaults.priorOffenseCount,
        0,
        20,
        'priorOffenseCount',
      ),
    ),
    chainCsv,
    notes: rawInput.notes !== undefined ? String(rawInput.notes) : defaults.notes || '',
  };
}

function mapProfileRow(row) {
  return {
    id: row.id,
    entityName: row.entity_name,
    authorizedContactEmiratesId: row.authorized_contact_eid,
    jurisdiction: row.jurisdiction,
    structureKind: row.structure_kind,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAssessmentRow(row) {
  return {
    id: row.id,
    profileId: row.profile_id,
    dossierCode: row.dossier_code,
    title: row.title,
    entityName: row.entity_name,
    authorizedContactEmiratesId: row.authorized_contact_eid,
    jurisdiction: row.jurisdiction,
    structureKind: row.structure_kind,
    effectiveOwnershipPct: row.effective_ownership_pct,
    determinationTier: row.determination_tier,
    penaltyStageCode: row.penalty_stage_code,
    projectedMinFineAed: row.projected_min_fine_aed,
    projectedMaxFineAed: row.projected_max_fine_aed,
    licenseSuspensionRisk: Boolean(row.license_suspension_risk),
    status: row.status,
    readinessScore: row.readiness_score,
    blockersCount: row.blockers_count,
    input: JSON.parse(row.input_json),
    result: JSON.parse(row.result_json),
    canonicalText: row.canonical_text,
    dossierSha256: row.dossier_sha256,
    publicSlug: row.public_slug,
    lockedAt: row.locked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function findAssessmentRow(db, idOrCode) {
  const key = decodeURIComponent(String(idOrCode || '')).trim();
  if (/^\d+$/.test(key)) {
    return db.prepare('SELECT * FROM assessments WHERE id = ?').get(Number(key));
  }
  return db.prepare('SELECT * FROM assessments WHERE dossier_code = ?').get(key);
}

function insertAssessmentRecord(db, { profileId = null, title, input, result, year }) {
  return withImmediateTransaction(db, () => {
    const targetYear =
      Number.isInteger(year) && year >= 2024 ? year : new Date().getUTCFullYear();
    const dossierCode = allocateDossierCodeTx(db, targetYear);
    const now = new Date().toISOString();
    const finalTitle =
      (title && title.trim()) ||
      `${input.entityName} — ${result.obligations.determinationTier}`;

    return db
      .prepare(
        `INSERT INTO assessments (
           profile_id, dossier_code, title, entity_name, authorized_contact_eid,
           jurisdiction, structure_kind, effective_ownership_pct, determination_tier,
           penalty_stage_code, projected_min_fine_aed, projected_max_fine_aed,
           license_suspension_risk, status, readiness_score, blockers_count,
           input_json, result_json, canonical_text, dossier_sha256,
           public_slug, locked_at, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)
         RETURNING *`,
      )
      .get(
        profileId,
        dossierCode,
        finalTitle,
        input.entityName,
        input.authorizedContactEmiratesId || '',
        input.jurisdiction,
        input.structureKind,
        result.obligations.totalEffectiveOwnershipPct,
        result.obligations.determinationTier,
        result.obligations.penaltyStageCode,
        result.obligations.projectedMinimumFineAed,
        result.obligations.projectedMaximumFineAed,
        result.obligations.licenseSuspensionRisk ? 1 : 0,
        result.readinessStatus,
        result.readinessScore,
        result.blockersCount,
        JSON.stringify(input),
        JSON.stringify(result),
        result.canonicalDossierText || '',
        result.dossierSha256 || '',
        now,
        now,
      );
  });
}

function buildFallbackSummaryCsv(item) {
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
    'notes',
    'dossier_sha256',
  ]
    .map((col) => formatSafeCsvCell(col).cell)
    .join(',');

  const row = [
    item.dossierCode,
    item.entityName,
    item.authorizedContactEmiratesId,
    item.jurisdiction,
    item.structureKind,
    item.effectiveOwnershipPct,
    item.determinationTier,
    item.penaltyStageCode,
    item.projectedMinFineAed,
    item.projectedMaxFineAed,
    item.licenseSuspensionRisk,
    item.status,
    item.readinessScore,
    item.input.notes || '',
    item.dossierSha256,
  ]
    .map((val) => formatSafeCsvCell(val).cell)
    .join(',');

  return `\uFEFF${header}\r\n${row}\r\n`;
}

function resolveCsvRequestPayload(body) {
  let payloadText = String(body.csv ?? body.chainCsv ?? '');
  if (body.presetId !== undefined) {
    const found = UBO_PRESETS.find((p) => p.id === String(body.presetId));
    if (!found) {
      throw new HttpError(404, 'PRESET_NOT_FOUND', `Unknown presetId: ${body.presetId}`);
    }
    if (!payloadText.trim()) {
      payloadText = found.sampleCsv || '';
    }
  }
  return payloadText;
}

export function createApp(options = {}) {
  const db = createDb({ dbPath: options.dbPath, dataDir: options.dataDir });
  const basePath = normalizeBasePath(
    options.basePath !== undefined ? options.basePath : process.env.BASE_PATH || '',
  );
  const staticDir = path.resolve(
    options.staticDir || path.resolve(import.meta.dirname, '..', 'dist'),
  );
  const maxBodyBytes = Number(options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES);
  const rateLimitMax = Number(options.rateLimitMax ?? DEFAULT_RATE_LIMIT_MAX);
  const rateLimitWindowMs = Number(options.rateLimitWindowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS);
  const rateCounters = new Map();
  const startedAtMs = Date.now();

  function checkRateLimit(req) {
    const ip =
      String(req.headers['x-forwarded-for'] || '')
        .split(',')[0]
        .trim() ||
      req.socket?.remoteAddress ||
      '127.0.0.1';
    const now = Date.now();
    const entry = rateCounters.get(ip);
    if (!entry || now >= entry.resetAt) {
      rateCounters.set(ip, { count: 1, resetAt: now + rateLimitWindowMs });
      return;
    }
    entry.count += 1;
    if (entry.count > rateLimitMax) {
      const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      throw new HttpError(
        429,
        'RATE_LIMIT_EXCEEDED',
        'Too many API requests; retry shortly.',
        { retryAfterSec },
      );
    }
  }

  function tryServeStatic(res, routePath, method) {
    const rel = routePath === '/' ? 'index.html' : routePath.replace(/^\/+/, '');
    const cleanRel = path.posix.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');
    const indexPath = path.join(staticDir, 'index.html');

    if (fs.existsSync(staticDir)) {
      const candidate = path.resolve(staticDir, cleanRel);
      if (
        candidate.startsWith(`${staticDir}${path.sep}`) &&
        fs.existsSync(candidate) &&
        fs.statSync(candidate).isFile()
      ) {
        const ext = path.extname(candidate).toLowerCase();
        const mime = MIME_TYPES[ext] || 'application/octet-stream';
        if (ext === '.html') {
          const html = injectBaseTagHtml(fs.readFileSync(candidate, 'utf8'), basePath);
          sendText(res, 200, mime, html, { 'Cache-Control': 'no-cache' }, method);
          return true;
        }
        const buf = fs.readFileSync(candidate);
        res.writeHead(200, {
          ...getSecurityHeaders(),
          'Content-Type': mime,
          'Content-Length': buf.byteLength,
          'Cache-Control': cleanRel.startsWith('assets/')
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=300',
        });
        if (method === 'HEAD') {
          res.end();
          return true;
        }
        res.end(buf);
        return true;
      }
    }

    if (fs.existsSync(indexPath)) {
      const html = injectBaseTagHtml(fs.readFileSync(indexPath, 'utf8'), basePath);
      sendText(res, 200, 'text/html; charset=utf-8', html, { 'Cache-Control': 'no-cache' }, method);
      return true;
    }

    const fallbackHtml = injectBaseTagHtml(buildFallbackShellHtml(basePath), basePath);
    sendText(
      res,
      200,
      'text/html; charset=utf-8',
      fallbackHtml,
      { 'Cache-Control': 'no-cache' },
      method,
    );
    return true;
  }

  async function handleRequest(req, res) {
    const method = (req.method || 'GET').toUpperCase();
    const urlObj = new URL(req.url || '/', 'http://127.0.0.1');
    const routePath = stripBasePath(urlObj.pathname, basePath);

    if (method === 'GET' && (routePath === '/health' || routePath === '/api/health')) {
      return sendJson(res, 200, {
        ok: true,
        service: 'ubocheckae',
        version: UBOCHECKAE_TOOL_VERSION,
        basePath,
        uptimeSec: Math.round((Date.now() - startedAtMs) / 1000),
        db: getDbStats(db),
      });
    }

    if (method === 'GET' && (routePath === '/readyz' || routePath === '/api/readyz')) {
      try {
        const check = db.prepare('SELECT 1 AS ready').get();
        const stats = getDbStats(db);
        if (Number(check?.ready) !== 1) {
          throw new Error('SQLite readiness probe failed.');
        }
        return sendJson(res, 200, {
          ok: true,
          ready: true,
          service: 'ubocheckae',
          version: UBOCHECKAE_TOOL_VERSION,
          journalMode: stats.journalMode,
        });
      } catch (err) {
        return sendJson(res, 503, {
          ok: false,
          ready: false,
          error: 'DB_UNAVAILABLE',
          message: err instanceof Error ? err.message : 'Database unavailable',
        });
      }
    }

    if (routePath.startsWith('/api/')) {
      checkRateLimit(req);
    }

    if (method === 'GET' && routePath === '/api/presets') {
      return sendJson(res, 200, {
        ok: true,
        toolName: 'UBOCheckAE',
        version: UBOCHECKAE_TOOL_VERSION,
        legalDisclaimerEn: LEGAL_DISCLAIMER_EN,
        legalDisclaimerAr: LEGAL_DISCLAIMER_AR,
        controls: UBO_CONTROLS,
        presets: UBO_PRESETS,
      });
    }

    if (method === 'POST' && routePath === '/api/evaluate-obligations') {
      const body = await readJsonBody(req, maxBodyBytes);
      const input = resolveAssessmentInput(body);
      const obligations = evaluateUboObligations(input);
      const core = evaluateUboCoreSync(input);
      return sendJson(res, 200, {
        ok: true,
        legalDisclaimerEn: LEGAL_DISCLAIMER_EN,
        legalDisclaimerAr: LEGAL_DISCLAIMER_AR,
        obligations,
        controls: core.controls,
      });
    }

    if (
      method === 'POST' &&
      (routePath === '/api/audit-chains' || routePath === '/api/audit-layers')
    ) {
      const body = await readJsonBody(req, maxBodyBytes);
      const payloadText = resolveCsvRequestPayload(body);
      const audit = auditChainCsv(payloadText);
      const exportedCsv = audit.totalRows > 0 ? exportChainAuditCsv(audit).csv : '';
      return sendJson(res, 200, {
        ok: true,
        audit,
        exportedCsv,
      });
    }

    if (
      method === 'POST' &&
      (routePath === '/api/export/chains-csv' || routePath === '/api/export/layers-csv')
    ) {
      const body = await readJsonBody(req, maxBodyBytes);
      const payloadText = resolveCsvRequestPayload(body);
      const audit = auditChainCsv(payloadText);
      if (!payloadText.trim() || audit.rows.length === 0) {
        throw new HttpError(
          400,
          'CSV_PARSE_ERROR',
          'Ownership chain CSV payload is empty or contains no rows.',
        );
      }
      const { csv } = exportChainAuditCsv(audit);
      return sendText(res, 200, 'text/csv; charset=utf-8', csv, {
        'Content-Disposition': 'attachment; filename="ubocheckae-chains-audit.csv"',
        'Cache-Control': 'no-store',
      });
    }

    if (method === 'POST' && routePath === '/api/assess') {
      const body = await readJsonBody(req, maxBodyBytes);
      const input = resolveAssessmentInput(body);
      const result = await assessUboReadiness(input);
      return sendJson(res, 200, { ok: true, input, result });
    }

    if (routePath === '/api/profiles' && method === 'GET') {
      const rows = db.prepare('SELECT * FROM profiles ORDER BY updated_at DESC, id DESC').all();
      return sendJson(res, 200, { ok: true, profiles: rows.map(mapProfileRow) });
    }

    if (routePath === '/api/profiles' && method === 'POST') {
      const body = await readJsonBody(req, maxBodyBytes);
      const entityName = String(body.entityName || '').trim();
      if (!entityName) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'entityName is required.');
      }
      const authorizedContactEmiratesId = String(body.authorizedContactEmiratesId || '').trim();
      const jurisdiction = validateEnumField(
        body.jurisdiction ? String(body.jurisdiction).trim() : 'uae_mainland',
        VALID_JURISDICTIONS,
        'jurisdiction',
      );
      const structureKind = validateEnumField(
        body.structureKind ? String(body.structureKind).trim() : 'multi_layer_holding',
        VALID_STRUCTURES,
        'structureKind',
      );
      const notes = String(body.notes || '').trim();
      const now = new Date().toISOString();

      const inserted = db
        .prepare(
          `INSERT INTO profiles (
             entity_name, authorized_contact_eid, jurisdiction, structure_kind,
             notes, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?)
           RETURNING *`,
        )
        .get(
          entityName,
          authorizedContactEmiratesId,
          jurisdiction,
          structureKind,
          notes,
          now,
          now,
        );
      return sendJson(res, 201, { ok: true, profile: mapProfileRow(inserted) });
    }

    const profileMatch = routePath.match(/^\/api\/profiles\/(\d+)$/);
    if (profileMatch) {
      const profileId = Number(profileMatch[1]);
      const existing = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId);
      if (!existing) {
        throw new HttpError(404, 'PROFILE_NOT_FOUND', `Profile ${profileId} not found.`);
      }
      if (method === 'GET') {
        return sendJson(res, 200, { ok: true, profile: mapProfileRow(existing) });
      }
      if (method === 'PATCH') {
        const body = await readJsonBody(req, maxBodyBytes);
        const entityName =
          body.entityName !== undefined ? String(body.entityName).trim() : existing.entity_name;
        if (!entityName) {
          throw new HttpError(400, 'VALIDATION_ERROR', 'entityName cannot be empty.');
        }
        const authorizedContactEmiratesId =
          body.authorizedContactEmiratesId !== undefined
            ? String(body.authorizedContactEmiratesId).trim()
            : existing.authorized_contact_eid;
        const jurisdiction = validateEnumField(
          body.jurisdiction !== undefined
            ? String(body.jurisdiction).trim()
            : existing.jurisdiction,
          VALID_JURISDICTIONS,
          'jurisdiction',
        );
        const structureKind = validateEnumField(
          body.structureKind !== undefined
            ? String(body.structureKind).trim()
            : existing.structure_kind,
          VALID_STRUCTURES,
          'structureKind',
        );
        const notes = body.notes !== undefined ? String(body.notes).trim() : existing.notes;
        const now = new Date().toISOString();

        const updated = db
          .prepare(
            `UPDATE profiles
             SET entity_name = ?, authorized_contact_eid = ?, jurisdiction = ?,
                 structure_kind = ?, notes = ?, updated_at = ?
             WHERE id = ?
             RETURNING *`,
          )
          .get(
            entityName,
            authorizedContactEmiratesId,
            jurisdiction,
            structureKind,
            notes,
            now,
            profileId,
          );
        return sendJson(res, 200, { ok: true, profile: mapProfileRow(updated) });
      }
      if (method === 'DELETE') {
        db.prepare('DELETE FROM profiles WHERE id = ?').run(profileId);
        return sendJson(res, 200, { ok: true, deletedId: profileId });
      }
    }

    const isCollection = routePath === '/api/assessments' || routePath === '/api/dossiers';
    if (isCollection && method === 'GET') {
      const statusFilter = (urlObj.searchParams.get('status') || '').trim().toLowerCase();
      const searchQ = (urlObj.searchParams.get('q') || '').trim().toLowerCase();
      let rows = db.prepare('SELECT * FROM assessments ORDER BY updated_at DESC, id DESC').all();
      if (statusFilter) {
        rows = rows.filter((r) => r.status.toLowerCase() === statusFilter);
      }
      if (searchQ) {
        rows = rows.filter(
          (r) =>
            r.dossier_code.toLowerCase().includes(searchQ) ||
            r.entity_name.toLowerCase().includes(searchQ) ||
            r.authorized_contact_eid.toLowerCase().includes(searchQ) ||
            r.determination_tier.toLowerCase().includes(searchQ) ||
            r.penalty_stage_code.toLowerCase().includes(searchQ) ||
            r.title.toLowerCase().includes(searchQ),
        );
      }
      return sendJson(res, 200, {
        ok: true,
        items: rows.map(mapAssessmentRow),
        total: rows.length,
      });
    }

    if (isCollection && method === 'POST') {
      const body = await readJsonBody(req, maxBodyBytes);
      let profileId = null;
      let profileBase = null;
      if (body.profileId !== undefined && body.profileId !== null) {
        const pid = Number(body.profileId);
        const prof = db.prepare('SELECT * FROM profiles WHERE id = ?').get(pid);
        if (!prof) {
          throw new HttpError(404, 'PROFILE_NOT_FOUND', `Profile ${pid} not found.`);
        }
        profileId = pid;
        profileBase = {
          ...UBO_PRESETS[0].input,
          entityName: prof.entity_name,
          authorizedContactEmiratesId: prof.authorized_contact_eid,
          jurisdiction: prof.jurisdiction,
          structureKind: prof.structure_kind,
          notes: prof.notes,
        };
      }

      const input = resolveAssessmentInput(body, profileBase);
      const result = await assessUboReadiness(input);
      const year =
        body.year !== undefined ? validateNumberField(body.year, 2024, 2100, 'year') : undefined;
      const inserted = insertAssessmentRecord(db, {
        profileId,
        title: typeof body.title === 'string' ? body.title : undefined,
        input,
        result,
        year,
      });
      return sendJson(res, 201, { ok: true, item: mapAssessmentRow(inserted) });
    }

    const itemMatch = routePath.match(
      /^\/api\/(?:assessments|dossiers)\/([^/]+)(?:\/(duplicate|finalize|lock|brief\.md|export\.csv|summary))?$/,
    );
    if (itemMatch) {
      const idOrCode = itemMatch[1];
      const action = itemMatch[2] || '';
      const row = findAssessmentRow(db, idOrCode);
      if (!row) {
        throw new HttpError(
          404,
          'DOSSIER_NOT_FOUND',
          `UBOCheckAE dossier "${idOrCode}" not found.`,
        );
      }

      if (!action && method === 'GET') {
        return sendJson(res, 200, { ok: true, item: mapAssessmentRow(row) });
      }

      if (!action && method === 'PATCH') {
        if (row.locked_at) {
          throw new HttpError(
            409,
            'DOSSIER_LOCKED',
            'Sealed dossier is immutable and cannot be edited.',
            { dossierCode: row.dossier_code, lockedAt: row.locked_at },
          );
        }
        const body = await readJsonBody(req, maxBodyBytes);
        const prevInput = JSON.parse(row.input_json);
        const nextInput = resolveAssessmentInput(body, prevInput);
        const result = await assessUboReadiness(nextInput);
        const title =
          body.title !== undefined && String(body.title).trim()
            ? String(body.title).trim()
            : row.title;
        const now = new Date().toISOString();

        const updated = db
          .prepare(
            `UPDATE assessments
             SET title = ?, entity_name = ?, authorized_contact_eid = ?,
                 jurisdiction = ?, structure_kind = ?, effective_ownership_pct = ?,
                 determination_tier = ?, penalty_stage_code = ?, projected_min_fine_aed = ?,
                 projected_max_fine_aed = ?, license_suspension_risk = ?, status = ?,
                 readiness_score = ?, blockers_count = ?, input_json = ?,
                 result_json = ?, canonical_text = ?, dossier_sha256 = ?, updated_at = ?
             WHERE id = ?
             RETURNING *`,
          )
          .get(
            title,
            nextInput.entityName,
            nextInput.authorizedContactEmiratesId || '',
            nextInput.jurisdiction,
            nextInput.structureKind,
            result.obligations.totalEffectiveOwnershipPct,
            result.obligations.determinationTier,
            result.obligations.penaltyStageCode,
            result.obligations.projectedMinimumFineAed,
            result.obligations.projectedMaximumFineAed,
            result.obligations.licenseSuspensionRisk ? 1 : 0,
            result.readinessStatus,
            result.readinessScore,
            result.blockersCount,
            JSON.stringify(nextInput),
            JSON.stringify(result),
            result.canonicalDossierText || '',
            result.dossierSha256 || '',
            now,
            row.id,
          );
        return sendJson(res, 200, { ok: true, item: mapAssessmentRow(updated) });
      }

      if (!action && method === 'DELETE') {
        if (row.locked_at) {
          throw new HttpError(409, 'DOSSIER_LOCKED', 'Sealed dossier cannot be deleted.', {
            dossierCode: row.dossier_code,
            lockedAt: row.locked_at,
          });
        }
        db.prepare('DELETE FROM assessments WHERE id = ?').run(row.id);
        return sendJson(res, 200, {
          ok: true,
          deletedId: row.id,
          dossierCode: row.dossier_code,
        });
      }

      if (action === 'duplicate' && method === 'POST') {
        const body = await readJsonBody(req, maxBodyBytes);
        const sourceInput = JSON.parse(row.input_json);
        const result = await assessUboReadiness(sourceInput);
        const copyTitle =
          body.title && String(body.title).trim()
            ? String(body.title).trim()
            : `${row.title} (Copy)`;
        const cloned = insertAssessmentRecord(db, {
          profileId: row.profile_id,
          title: copyTitle,
          input: sourceInput,
          result,
        });
        return sendJson(res, 201, { ok: true, item: mapAssessmentRow(cloned) });
      }

      if ((action === 'finalize' || action === 'lock') && method === 'POST') {
        if (row.locked_at) {
          throw new HttpError(
            409,
            'ALREADY_LOCKED',
            'Dossier is already finalized and cryptographically sealed.',
            {
              dossierCode: row.dossier_code,
              lockedAt: row.locked_at,
              dossierSha256: row.dossier_sha256,
              publicSlug: row.public_slug,
            },
          );
        }
        const sourceInput = JSON.parse(row.input_json);
        const result = await assessUboReadiness(sourceInput);
        const publicSlug = row.public_slug || generatePublicSlug();
        const now = new Date().toISOString();
        const sealed = db
          .prepare(
            `UPDATE assessments
             SET effective_ownership_pct = ?, determination_tier = ?, penalty_stage_code = ?,
                 projected_min_fine_aed = ?, projected_max_fine_aed = ?, license_suspension_risk = ?,
                 status = ?, readiness_score = ?, blockers_count = ?, result_json = ?,
                 canonical_text = ?, dossier_sha256 = ?, public_slug = ?, locked_at = ?,
                 updated_at = ?
             WHERE id = ?
             RETURNING *`,
          )
          .get(
            result.obligations.totalEffectiveOwnershipPct,
            result.obligations.determinationTier,
            result.obligations.penaltyStageCode,
            result.obligations.projectedMinimumFineAed,
            result.obligations.projectedMaximumFineAed,
            result.obligations.licenseSuspensionRisk ? 1 : 0,
            result.readinessStatus,
            result.readinessScore,
            result.blockersCount,
            JSON.stringify(result),
            result.canonicalDossierText || '',
            result.dossierSha256 || '',
            publicSlug,
            now,
            now,
            row.id,
          );
        return sendJson(res, 200, { ok: true, item: mapAssessmentRow(sealed) });
      }

      if (action === 'brief.md' && method === 'GET') {
        const langRaw = (
          urlObj.searchParams.get('lang') ||
          urlObj.searchParams.get('locale') ||
          'ar'
        )
          .trim()
          .toLowerCase();
        const locale = langRaw === 'en' ? 'en' : 'ar';
        const item = mapAssessmentRow(row);
        const md = buildUboBriefMarkdown(
          item.input,
          item.result,
          item.dossierCode,
          item.dossierSha256,
          locale,
        );
        const safeFilename = item.dossierCode.replace(/[^A-Za-z0-9_-]/g, '');
        return sendText(res, 200, 'text/markdown; charset=utf-8', md, {
          'Content-Disposition': `attachment; filename="${safeFilename}.${locale}.brief.md"`,
          'Cache-Control': 'no-store',
        });
      }

      if (action === 'export.csv' && method === 'GET') {
        const item = mapAssessmentRow(row);
        const csvContent =
          item.result.csvAudit && item.result.csvAudit.rows.length > 0
            ? exportChainAuditCsv(item.result.csvAudit).csv
            : buildFallbackSummaryCsv(item);
        const safeFilename = item.dossierCode.replace(/[^A-Za-z0-9_-]/g, '');
        return sendText(res, 200, 'text/csv; charset=utf-8', csvContent, {
          'Content-Disposition': `attachment; filename="${safeFilename}.chains-audit.csv"`,
          'Cache-Control': 'no-store',
        });
      }

      if (action === 'summary' && method === 'GET') {
        const item = mapAssessmentRow(row);
        const langRaw = (
          urlObj.searchParams.get('lang') ||
          urlObj.searchParams.get('locale') ||
          'ar'
        )
          .trim()
          .toLowerCase();
        const locale = langRaw === 'en' ? 'en' : 'ar';
        const briefMarkdown = buildUboBriefMarkdown(
          item.input,
          item.result,
          item.dossierCode,
          item.dossierSha256,
          locale,
        );
        return sendJson(res, 200, {
          ok: true,
          dossierCode: item.dossierCode,
          title: item.title,
          entityName: item.entityName,
          authorizedContactEmiratesId: item.authorizedContactEmiratesId,
          jurisdiction: item.jurisdiction,
          structureKind: item.structureKind,
          determinationTier: item.determinationTier,
          penaltyStageCode: item.penaltyStageCode,
          status: item.status,
          readinessScore: item.readinessScore,
          lockedAt: item.lockedAt,
          publicSlug: item.publicSlug,
          dossierSha256: item.dossierSha256,
          legalDisclaimerEn: item.result.legalDisclaimerEn,
          legalDisclaimerAr: item.result.legalDisclaimerAr,
          obligations: item.result.obligations,
          csvAuditSummary: item.result.csvAudit
            ? {
                totalRows: item.result.csvAudit.totalRows,
                compliantRows: item.result.csvAudit.compliantRows,
                attentionRows: item.result.csvAudit.attentionRows,
                violationRows: item.result.csvAudit.violationRows,
                qualifying25PctRows: item.result.csvAudit.qualifying25PctRows,
                lateUpdateOver15DaysRows: item.result.csvAudit.lateUpdateOver15DaysRows,
                unverifiedNomineeOrUnregisteredRows:
                  item.result.csvAudit.unverifiedNomineeOrUnregisteredRows,
                totalEstimatedExposureMinAed: item.result.csvAudit.totalEstimatedExposureMinAed,
                totalEstimatedExposureMaxAed: item.result.csvAudit.totalEstimatedExposureMaxAed,
                formulaInjectionSanitizedCount:
                  item.result.csvAudit.formulaInjectionSanitizedCount,
              }
            : null,
          topControls: item.result.controls,
          briefMarkdown,
        });
      }
    }

    const publicMatch = routePath.match(/^\/api\/public\/reports\/([^/]+)$/);
    if (publicMatch && method === 'GET') {
      const slugOrCode = decodeURIComponent(publicMatch[1]).trim();
      const row = db
        .prepare(
          'SELECT * FROM assessments WHERE (public_slug = ? OR dossier_code = ?) AND locked_at IS NOT NULL',
        )
        .get(slugOrCode, slugOrCode);
      if (!row) {
        throw new HttpError(
          404,
          'PUBLIC_REPORT_NOT_FOUND',
          `Published sealed UBOCheckAE report "${slugOrCode}" was not found.`,
        );
      }

      const now = new Date().toISOString();
      const viewRow = db
        .prepare(
          `INSERT INTO public_report_views (slug_or_code, view_count, last_viewed_at)
           VALUES (?, 1, ?)
           ON CONFLICT(slug_or_code) DO UPDATE SET
             view_count = view_count + 1,
             last_viewed_at = excluded.last_viewed_at
           RETURNING view_count, last_viewed_at`,
        )
        .get(row.dossier_code, now);

      const item = mapAssessmentRow(row);
      return sendJson(res, 200, {
        ok: true,
        viewCount: Number(viewRow?.view_count ?? 1),
        lastViewedAt: viewRow?.last_viewed_at ?? now,
        report: {
          dossierCode: item.dossierCode,
          publicSlug: item.publicSlug,
          entityName: item.entityName,
          authorizedContactEmiratesId: item.authorizedContactEmiratesId,
          jurisdiction: item.jurisdiction,
          structureKind: item.structureKind,
          determinationTier: item.determinationTier,
          penaltyStageCode: item.penaltyStageCode,
          status: item.status,
          readinessScore: item.readinessScore,
          lockedAt: item.lockedAt,
          dossierSha256: item.dossierSha256,
          legalDisclaimerEn: item.result.legalDisclaimerEn,
          legalDisclaimerAr: item.result.legalDisclaimerAr,
          obligations: item.result.obligations,
          briefAr: buildUboBriefMarkdown(
            item.input,
            item.result,
            item.dossierCode,
            item.dossierSha256,
            'ar',
          ),
          briefEn: buildUboBriefMarkdown(
            item.input,
            item.result,
            item.dossierCode,
            item.dossierSha256,
            'en',
          ),
        },
      });
    }

    if (routePath.startsWith('/api/')) {
      throw new HttpError(404, 'API_NOT_FOUND', `Unknown API endpoint: ${method} ${routePath}`);
    }

    if (method === 'GET' || method === 'HEAD') {
      return tryServeStatic(res, routePath, method);
    }

    throw new HttpError(405, 'METHOD_NOT_ALLOWED', `Method ${method} not allowed on ${routePath}`);
  }

  const server = http.createServer((req, res) => {
    void handleRequest(req, res).catch((err) => {
      if (err instanceof HttpError) {
        return sendJson(res, err.status, {
          ok: false,
          error: err.code,
          message: err.message,
          ...err.extra,
        });
      }
      return sendJson(res, 500, {
        ok: false,
        error: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Unexpected server error',
      });
    });
  });

  return {
    server,
    db,
    basePath,
    async listen(port = Number(options.port ?? 0), host = options.host || '127.0.0.1') {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.removeListener('error', reject);
          resolve();
        });
      });
      const addr = server.address();
      const boundPort = typeof addr === 'object' && addr ? addr.port : port;
      return {
        port: boundPort,
        host,
        url: `http://${host}:${boundPort}${basePath}`,
      };
    },
    async close() {
      await new Promise((resolve) => {
        server.close(() => resolve());
      });
      closeDb(db);
    },
  };
}
