import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../server/app.mjs';
import { UBOCHECKAE_TOOL_VERSION, UBO_PRESETS } from '../../src/core/index.ts';

const createdServers: Array<{ close: () => Promise<void> }> = [];
const tempDirs: string[] = [];

async function startTempApp(options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ubocheckae-test-'));
  tempDirs.push(dir);
  const app = createApp({ dataDir: dir, ...options });
  const bound = await app.listen(0, '127.0.0.1');
  createdServers.push(app);
  return { app, url: bound.url, dir };
}

afterEach(async () => {
  while (createdServers.length > 0) {
    const inst = createdServers.pop();
    if (inst) await inst.close();
  }
  while (tempDirs.length > 0) {
    const d = tempDirs.pop();
    if (d) fs.rmSync(d, { recursive: true, force: true });
  }
});

describe('UBOCheckAE SQLite WAL server & HTTP API (v0.2.0)', () => {
  it('serves /health, /readyz WAL mode, and /api/presets with explicit UAE Registrar non-affiliation disclaimers', async () => {
    const { url } = await startTempApp();

    const healthRes = await fetch(`${url}/health`);
    expect(healthRes.status).toBe(200);
    const health = (await healthRes.json()) as { ok: boolean; service: string; version: string };
    expect(health.ok).toBe(true);
    expect(health.service).toBe('ubocheckae');
    expect(health.version).toBe(UBOCHECKAE_TOOL_VERSION);

    const readyRes = await fetch(`${url}/readyz`);
    expect(readyRes.status).toBe(200);
    const ready = (await readyRes.json()) as { ready: boolean; journalMode: string };
    expect(ready.ready).toBe(true);
    expect(ready.journalMode).toBe('wal');

    const presetsRes = await fetch(`${url}/api/presets`);
    expect(presetsRes.status).toBe(200);
    const presetsData = (await presetsRes.json()) as {
      toolName: string;
      presets: unknown[];
      controls: unknown[];
      legalDisclaimerEn: string;
      legalDisclaimerAr: string;
    };
    expect(presetsData.toolName).toBe('UBOCheckAE');
    expect(presetsData.presets).toHaveLength(3);
    expect(presetsData.controls).toHaveLength(7);
    expect(presetsData.legalDisclaimerEn).toContain('not affiliated with the UAE Ministry of Economy');
    expect(presetsData.legalDisclaimerAr).toContain('ولا تتبع وزارة الاقتصاد الإماراتية');
  });

  it('evaluates CR 109/2023 & CR 132/2023 obligations, audits chain CSV with CWE-1236 + BOM, and scores /api/assess', async () => {
    const { url } = await startTempApp();

    const p2Res = await fetch(`${url}/api/evaluate-obligations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ presetId: UBO_PRESETS[1].id }),
    });
    expect(p2Res.status).toBe(200);
    const p2Data = (await p2Res.json()) as {
      obligations: {
        determinationTier: string;
        penaltyStageCode: string;
        nomineeDisclosureGap: boolean;
        rectificationGraceDays: number;
      };
    };
    expect(p2Data.obligations.determinationTier).toBe('tier3_senior_management');
    expect(p2Data.obligations.penaltyStageCode).toBe('tier1_written_warning');
    expect(p2Data.obligations.nomineeDisclosureGap).toBe(true);
    expect(p2Data.obligations.rectificationGraceDays).toBe(15);

    const p3Res = await fetch(`${url}/api/evaluate-obligations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ presetId: UBO_PRESETS[2].id }),
    });
    expect(p3Res.status).toBe(200);
    const p3Data = (await p3Res.json()) as {
      obligations: {
        effectiveIndirectPct: number;
        penaltyStageCode: string;
        projectedMinimumFineAed: number;
        projectedMaximumFineAed: number;
        licenseSuspensionRisk: boolean;
      };
    };
    expect(p3Data.obligations.effectiveIndirectPct).toBe(30);
    expect(p3Data.obligations.penaltyStageCode).toBe('tier3_cap_and_license_suspension');
    expect(p3Data.obligations.projectedMinimumFineAed).toBe(50_000);
    expect(p3Data.obligations.projectedMaximumFineAed).toBe(100_000);
    expect(p3Data.obligations.licenseSuspensionRisk).toBe(true);

    const maliciousCsv = [
      'entity_id,holder_or_layer_en,jurisdiction,direct_pct,layer1_pct,layer2_pct,days_since_change,nominee_disclosed,ubo_registered,emirates_id',
      '"=HYPERLINK(""https://evil.example"",""ENT"")",Offshore SPV Layer 4,uae_mainland,0,60,50,48,false,false,784197899001123',
    ].join('\n');

    const auditRes = await fetch(`${url}/api/audit-chains`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ csv: maliciousCsv }),
    });
    expect(auditRes.status).toBe(200);
    const auditData = (await auditRes.json()) as {
      audit: {
        totalRows: number;
        formulaInjectionSanitizedCount: number;
        violationRows: number;
        qualifying25PctRows: number;
        totalEstimatedExposureMinAed: number;
        totalEstimatedExposureMaxAed: number;
      };
      exportedCsv: string;
    };
    expect(auditData.audit.totalRows).toBe(1);
    expect(auditData.audit.violationRows).toBe(1);
    expect(auditData.audit.qualifying25PctRows).toBe(1);
    expect(auditData.audit.formulaInjectionSanitizedCount).toBe(1);
    expect(auditData.audit.totalEstimatedExposureMinAed).toBe(20_000);
    expect(auditData.audit.totalEstimatedExposureMaxAed).toBe(50_000);
    expect(auditData.exportedCsv.startsWith('\uFEFF')).toBe(true);
    expect(auditData.exportedCsv).toContain("'=HYPERLINK");

    const wireCsvRes = await fetch(`${url}/api/export/chains-csv`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ csv: maliciousCsv }),
    });
    expect(wireCsvRes.status).toBe(200);
    expect(wireCsvRes.headers.get('content-type')).toContain('text/csv');
    const wireCsvBuf = Buffer.from(await wireCsvRes.arrayBuffer());
    expect(Array.from(wireCsvBuf.subarray(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(wireCsvBuf.toString('utf8')).toContain("'=HYPERLINK");
    expect(wireCsvBuf.toString('utf8')).not.toContain("''=");

    const assessRes = await fetch(`${url}/api/assess`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ presetId: UBO_PRESETS[2].id }),
    });
    expect(assessRes.status).toBe(200);
    const assessData = (await assessRes.json()) as {
      result: { readinessStatus: string; readinessScore: number; dossierSha256: string };
    };
    expect(assessData.result.readinessStatus).toBe('blocked');
    expect(assessData.result.readinessScore).toBe(0);
    expect(assessData.result.dossierSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('persists profiles & dossiers, enforces 409 lock immutability, exports BOM CSV & AR/EN brief, and tracks public views', async () => {
    const { url } = await startTempApp();

    const profRes = await fetch(`${url}/api/profiles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        entityName: 'Vanguard Multi-Tier Holdings LLC',
        authorizedContactEmiratesId: '784197899001123',
        jurisdiction: 'uae_mainland',
        structureKind: 'complex_cross_border',
      }),
    });
    expect(profRes.status).toBe(201);
    const profData = (await profRes.json()) as { profile: { id: number } };

    const createRes = await fetch(`${url}/api/dossiers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        profileId: profData.profile.id,
        year: 2026,
        presetId: UBO_PRESETS[2].id,
        title: 'UAE Complex Cross-Border UBO Review',
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as {
      item: { dossierCode: string; status: string; penaltyStageCode: string };
    };
    expect(created.item.dossierCode).toBe('UBO-2026-0001');
    expect(created.item.status).toBe('blocked');
    expect(created.item.penaltyStageCode).toBe('tier3_cap_and_license_suspension');

    const dupRes = await fetch(`${url}/api/dossiers/${created.item.dossierCode}/duplicate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(dupRes.status).toBe(201);
    const dup = (await dupRes.json()) as { item: { dossierCode: string } };
    expect(dup.item.dossierCode).toBe('UBO-2026-0002');

    const delDupRes = await fetch(`${url}/api/dossiers/${dup.item.dossierCode}`, {
      method: 'DELETE',
    });
    expect(delDupRes.status).toBe(200);

    const finalizeRes = await fetch(`${url}/api/dossiers/${created.item.dossierCode}/finalize`, {
      method: 'POST',
    });
    expect(finalizeRes.status).toBe(200);
    const finalized = (await finalizeRes.json()) as {
      item: { lockedAt: string; publicSlug: string };
    };
    expect(finalized.item.lockedAt).toBeTruthy();
    expect(finalized.item.publicSlug).toMatch(/^ubo-[a-f0-9]{12}$/);

    const lockedPatch = await fetch(`${url}/api/dossiers/${created.item.dossierCode}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Attempted Tamper' }),
    });
    expect(lockedPatch.status).toBe(409);

    const lockedDelete = await fetch(`${url}/api/dossiers/${created.item.dossierCode}`, {
      method: 'DELETE',
    });
    expect(lockedDelete.status).toBe(409);

    const relockRes = await fetch(`${url}/api/dossiers/${created.item.dossierCode}/lock`, {
      method: 'POST',
    });
    expect(relockRes.status).toBe(409);

    const briefArRes = await fetch(
      `${url}/api/dossiers/${created.item.dossierCode}/brief.md?lang=ar`,
    );
    expect(briefArRes.status).toBe(200);
    expect(await briefArRes.text()).toContain('ملف جاهزية سجل المستفيد الحقيقي الإماراتي');

    const summaryRes = await fetch(
      `${url}/api/dossiers/${created.item.dossierCode}/summary?lang=en`,
    );
    expect(summaryRes.status).toBe(200);
    const summaryData = (await summaryRes.json()) as { briefMarkdown: string; readinessScore: number };
    expect(summaryData.readinessScore).toBe(0);
    expect(summaryData.briefMarkdown).toContain('CR 109/2023');

    const csvDlRes = await fetch(`${url}/api/dossiers/${created.item.dossierCode}/export.csv`);
    expect(csvDlRes.status).toBe(200);
    const csvBuf = Buffer.from(await csvDlRes.arrayBuffer());
    expect(Array.from(csvBuf.subarray(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(csvBuf.toString('utf8')).toContain("'=ENT-301");
    expect(csvBuf.toString('utf8')).not.toContain("''=");

    const pub1 = await fetch(`${url}/api/public/reports/${finalized.item.publicSlug}`);
    expect(pub1.status).toBe(200);
    const pub1Json = (await pub1.json()) as { viewCount: number; report: { briefEn: string } };
    expect(pub1Json.viewCount).toBe(1);
    expect(pub1Json.report.briefEn).toContain('CR 132/2023');

    const pub2 = await fetch(`${url}/api/public/reports/${created.item.dossierCode}`);
    expect(pub2.status).toBe(200);
    expect(((await pub2.json()) as { viewCount: number }).viewCount).toBe(2);
  });

  it('supports BASE_PATH=/ubocheckae prefix stripping and HTML base tag injection', async () => {
    const { url } = await startTempApp({ basePath: '/ubocheckae' });

    const htmlRes = await fetch(`${url}/`);
    expect(htmlRes.status).toBe(200);
    const html = await htmlRes.text();
    expect(html).toContain('window.__UBOCHECKAE_BASE__="/ubocheckae"');

    const hRes = await fetch(`${url}/health`);
    expect(hRes.status).toBe(200);
    expect(((await hRes.json()) as { basePath: string }).basePath).toBe('/ubocheckae');
  });

  it('enforces 413 body limit and 429 API rate limit while exempting /health and /readyz', async () => {
    const { url } = await startTempApp({ maxBodyBytes: 128, rateLimitMax: 2 });

    const bigRes = await fetch(`${url}/api/assess`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entityName: 'X'.repeat(300) }),
    });
    expect(bigRes.status).toBe(413);

    expect((await fetch(`${url}/api/presets`)).status).toBe(200);
    expect((await fetch(`${url}/api/presets`)).status).toBe(429);

    expect((await fetch(`${url}/health`)).status).toBe(200);
    expect((await fetch(`${url}/readyz`)).status).toBe(200);
  });
});
