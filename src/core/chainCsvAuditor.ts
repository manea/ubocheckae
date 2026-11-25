import type { ChainCsvAuditSummary, ChainLayerRowAudit } from './types.ts';
import {
  CR109_UBO_THRESHOLD_PCT,
  CR109_UPDATE_NOTICE_DAYS,
  CR132_SEVERE_TIER2_MAX_AED,
  CR132_SEVERE_TIER2_MIN_AED,
} from './uboCatalog.ts';
import { computeEffectiveOwnershipPct, validateEmiratesId } from './uboEngine.ts';

const FORMULA_LEAD_REGEX = /^[\t\r\n\uFEFF\x00-\x20]*([=+\-@])/;

export function needsCsvFormulaSanitization(value: string): boolean {
  const str = String(value ?? '');
  return str.length > 0 && FORMULA_LEAD_REGEX.test(str);
}

export function sanitizeCsvTextField(value: string): {
  sanitized: string;
  wasSanitized: boolean;
} {
  const str = String(value ?? '');
  if (!str) return { sanitized: '', wasSanitized: false };
  if (str.startsWith("'") && FORMULA_LEAD_REGEX.test(str.slice(1))) {
    return { sanitized: str, wasSanitized: false };
  }
  if (FORMULA_LEAD_REGEX.test(str)) {
    return { sanitized: `'${str}`, wasSanitized: true };
  }
  return { sanitized: str, wasSanitized: false };
}

export function formatSafeCsvCell(value: string | number | boolean): {
  cell: string;
  wasSanitized: boolean;
} {
  const raw = String(value ?? '');
  const { sanitized, wasSanitized } = sanitizeCsvTextField(raw);
  const escaped = sanitized.replace(/"/g, '""');
  return { cell: `"${escaped}"`, wasSanitized };
}

function parseBool(raw: string | undefined): boolean {
  const norm = String(raw ?? '').trim().toLowerCase();
  return norm === 'true' || norm === '1' || norm === 'yes' || norm === 'y';
}

function parseNumNonNeg(raw: string | undefined): number {
  const n = Number(String(raw ?? '').replace(/[,\s]/g, '').trim());
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out;
}

const EXEMPT_JURISDICTIONS = new Set([
  'difc_adgm_financial_fz',
  'wholly_government_owned',
  'listed_company_or_subsidiary',
]);

export function auditChainCsv(csvText: string): ChainCsvAuditSummary {
  const rawLines = String(csvText ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (rawLines.length === 0) {
    return {
      totalRows: 0,
      compliantRows: 0,
      attentionRows: 0,
      violationRows: 0,
      qualifying25PctRows: 0,
      lateUpdateOver15DaysRows: 0,
      unverifiedNomineeOrUnregisteredRows: 0,
      totalEstimatedExposureMinAed: 0,
      totalEstimatedExposureMaxAed: 0,
      formulaInjectionSanitizedCount: 0,
      rows: [],
    };
  }

  const firstCells = parseCsvLine(rawLines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  const hasHeader =
    firstCells.includes('entity_id') ||
    firstCells.includes('direct_pct') ||
    firstCells.includes('layer1_pct');

  const headerIndex = new Map<string, number>();
  if (hasHeader) {
    firstCells.forEach((h, idx) => headerIndex.set(h, idx));
  }

  const startIdx = hasHeader ? 1 : 0;
  const rows: ChainLayerRowAudit[] = [];

  let compliantRows = 0;
  let attentionRows = 0;
  let violationRows = 0;
  let qualifying25PctRows = 0;
  let lateUpdateOver15DaysRows = 0;
  let unverifiedNomineeOrUnregisteredRows = 0;
  let totalEstimatedExposureMinAed = 0;
  let totalEstimatedExposureMaxAed = 0;
  let formulaInjectionSanitizedCount = 0;

  for (let i = startIdx; i < rawLines.length; i += 1) {
    const cells = parseCsvLine(rawLines[i]);
    const getCell = (name: string, fallbackPos: number): string => {
      const idx = headerIndex.get(name);
      return idx !== undefined ? (cells[idx] ?? '') : (cells[fallbackPos] ?? '');
    };

    const rawId = getCell('entity_id', 0) || `UBO-${rows.length + 1}`;
    const rawHolder = getCell('holder_or_layer_en', 1) || `Holder ${rows.length + 1}`;
    const rawJurisdiction = (getCell('jurisdiction', 2) || 'uae_mainland').trim().toLowerCase();
    const directPct = Math.min(100, parseNumNonNeg(getCell('direct_pct', 3)));
    const layer1Pct = Math.min(100, parseNumNonNeg(getCell('layer1_pct', 4)));
    const layer2Pct = Math.min(100, parseNumNonNeg(getCell('layer2_pct', 5)));
    const daysSinceChange = Math.floor(parseNumNonNeg(getCell('days_since_change', 6)));
    const nomineeDisclosed = parseBool(getCell('nominee_disclosed', 7) || 'true');
    const uboRegistered = parseBool(getCell('ubo_registered', 8) || 'true');
    const rawEid = getCell('emirates_id', 9).trim();

    const entityIdSan = sanitizeCsvTextField(rawId);
    const holderSan = sanitizeCsvTextField(rawHolder);
    const jurSan = sanitizeCsvTextField(rawJurisdiction);
    const eidSan = sanitizeCsvTextField(rawEid);

    if (entityIdSan.wasSanitized) formulaInjectionSanitizedCount += 1;
    if (holderSan.wasSanitized) formulaInjectionSanitizedCount += 1;
    if (jurSan.wasSanitized) formulaInjectionSanitizedCount += 1;
    if (eidSan.wasSanitized) formulaInjectionSanitizedCount += 1;

    const { totalEffectiveOwnershipPct } = computeEffectiveOwnershipPct(
      directPct,
      layer1Pct,
      layer2Pct,
    );
    const isExempt = EXEMPT_JURISDICTIONS.has(rawJurisdiction);
    const qualifies25PctUbo = totalEffectiveOwnershipPct >= CR109_UBO_THRESHOLD_PCT;
    if (qualifies25PctUbo) qualifying25PctRows += 1;

    const emiratesIdValid = rawEid.length > 0 ? validateEmiratesId(rawEid) : null;
    const lineIssues: string[] = [];

    if (!isExempt && qualifies25PctUbo && !uboRegistered) {
      lineIssues.push('QUALIFYING_25PCT_UBO_NOT_REGISTERED_IN_RBO');
    }
    if (!isExempt && !nomineeDisclosed) {
      lineIssues.push('NOMINEE_OR_CONTROL_LAYER_UNDISCLOSED');
    }
    if (!isExempt && qualifies25PctUbo && !uboRegistered && daysSinceChange > CR109_UPDATE_NOTICE_DAYS) {
      lineIssues.push('REGISTRAR_15D_UPDATE_SLA_BREACHED');
    }
    if (!isExempt && emiratesIdValid === false) {
      lineIssues.push('INVALID_784_EMIRATES_ID_LUHN');
    }

    const lateUpdate =
      !isExempt &&
      daysSinceChange > CR109_UPDATE_NOTICE_DAYS &&
      (!uboRegistered || !nomineeDisclosed);
    if (lateUpdate) lateUpdateOver15DaysRows += 1;

    const unregisteredOrNomineeIssue = !isExempt && (!uboRegistered || !nomineeDisclosed);
    if (unregisteredOrNomineeIssue) unverifiedNomineeOrUnregisteredRows += 1;

    let minExp = 0;
    let maxExp = 0;
    let status: 'compliant' | 'attention' | 'violation' = 'compliant';

    if (lineIssues.includes('QUALIFYING_25PCT_UBO_NOT_REGISTERED_IN_RBO') || lineIssues.includes('NOMINEE_OR_CONTROL_LAYER_UNDISCLOSED')) {
      status = 'violation';
      minExp = CR132_SEVERE_TIER2_MIN_AED;
      maxExp = CR132_SEVERE_TIER2_MAX_AED;
    } else if (lineIssues.length > 0) {
      status = 'attention';
    }

    if (status === 'compliant') compliantRows += 1;
    else if (status === 'attention') attentionRows += 1;
    else violationRows += 1;

    totalEstimatedExposureMinAed += minExp;
    totalEstimatedExposureMaxAed += maxExp;

    rows.push({
      rowNumber: rows.length + 1,
      entityId: entityIdSan.sanitized,
      holderOrLayerEn: holderSan.sanitized,
      jurisdiction: jurSan.sanitized,
      directPct,
      layer1Pct,
      layer2Pct,
      effectivePct: totalEffectiveOwnershipPct,
      qualifies25PctUbo,
      daysSinceChange,
      nomineeDisclosed,
      uboRegistered,
      reportedEmiratesId: eidSan.sanitized,
      emiratesIdValid,
      lineIssues,
      estimatedExposureMinAed: minExp,
      estimatedExposureMaxAed: maxExp,
      status,
    });
  }

  return {
    totalRows: rows.length,
    compliantRows,
    attentionRows,
    violationRows,
    qualifying25PctRows,
    lateUpdateOver15DaysRows,
    unverifiedNomineeOrUnregisteredRows,
    totalEstimatedExposureMinAed,
    totalEstimatedExposureMaxAed,
    formulaInjectionSanitizedCount,
    rows,
  };
}

export function exportChainAuditCsv(summary: ChainCsvAuditSummary): {
  csv: string;
  sanitizedCellCount: number;
} {
  let sanitizedCellCount = summary.formulaInjectionSanitizedCount;
  const headers = [
    'row_number',
    'entity_id',
    'holder_or_layer_en',
    'jurisdiction',
    'direct_pct',
    'layer1_pct',
    'layer2_pct',
    'effective_pct',
    'qualifies_25pct_ubo',
    'days_since_change',
    'nominee_disclosed',
    'ubo_registered',
    'reported_emirates_id',
    'emirates_id_valid',
    'status',
    'line_issues',
    'estimated_exposure_min_aed',
    'estimated_exposure_max_aed',
  ];

  const csvRows = [headers.join(',')];
  for (const row of summary.rows) {
    const rawValues: Array<string | number | boolean> = [
      row.rowNumber,
      row.entityId,
      row.holderOrLayerEn,
      row.jurisdiction,
      row.directPct,
      row.layer1Pct,
      row.layer2Pct,
      row.effectivePct,
      row.qualifies25PctUbo,
      row.daysSinceChange,
      row.nomineeDisclosed,
      row.uboRegistered,
      row.reportedEmiratesId,
      row.emiratesIdValid === null ? 'not_provided' : row.emiratesIdValid,
      row.status,
      row.lineIssues.join('; '),
      row.estimatedExposureMinAed,
      row.estimatedExposureMaxAed,
    ];
    const formatted = rawValues.map((val) => {
      const res = formatSafeCsvCell(val);
      if (res.wasSanitized) sanitizedCellCount += 1;
      return res.cell;
    });
    csvRows.push(formatted.join(','));
  }

  return {
    csv: `\uFEFF${csvRows.join('\r\n')}\r\n`,
    sanitizedCellCount,
  };
}
