import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

async function assertNoHorizontalOverflow(page: Page) {
  const dims = await page.evaluate(() => {
    const main = document.querySelector('main');
    const header = document.querySelector('header');
    const mainRect = main?.getBoundingClientRect();
    const headerRect = header?.getBoundingClientRect();
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      mainWidth: mainRect ? Math.ceil(mainRect.width) : 0,
      headerWidth: headerRect ? Math.ceil(headerRect.width) : 0,
    };
  });
  expect(dims.scrollWidth).toBeLessThanOrEqual(dims.innerWidth);
  expect(dims.mainWidth).toBeLessThanOrEqual(dims.innerWidth);
  expect(dims.headerWidth).toBeLessThanOrEqual(dims.innerWidth);
}

function buildCleanChainCsvBatch(): string {
  return [
    'entity_id,holder_or_layer_en,jurisdiction,direct_pct,layer1_pct,layer2_pct,days_since_change,nominee_disclosed,ubo_registered,emirates_id',
    'ENT-CLEAN-01,Offshore SPV Layer 4 Holding (60% x 50%),uae_mainland,0,60,50,7,true,true,784197899001123',
    'ENT-CLEAN-02,Verified Resident Control Layer,uae_mainland,26,0,0,7,true,true,784198612345672',
  ].join('\n');
}

test.describe('UBOCheckAE — UAE CR 109/2023 & CR 132/2023 UBO E2E', () => {
  test('defaults to AR RTL Alabaster Registry, toggles EN LTR Obsidian Compliance, and persists across reload', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await expect(page.locator('header')).toContainText('SQLite WAL');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'alabaster-registry');
    await expect(page.locator('svg[role="img"]').first()).toBeVisible();
    await expect(page.getByTestId('status-badge')).toContainText('100/100');
    await expect(page.getByTestId('legal-disclaimer-banner')).toContainText('ولا تتبع وزارة الاقتصاد الإماراتية');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/01-workspace-ar-alabaster-registry.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.getByTestId('lang-toggle-btn').click();
    await page.getByTestId('theme-toggle-btn').click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'obsidian-compliance');
    await expect(page.getByTestId('legal-disclaimer-banner')).toContainText(
      'not affiliated with the UAE Ministry of Economy',
    );
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/02-workspace-en-obsidian-compliance.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'obsidian-compliance');

    expect(errors).toEqual([]);
  });

  test('evaluates Preset 1/2/3 & remediates Preset 3 into sealed UBO-2026-0001 with BOM CSV & /r/:code', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const expectedCode = 'UBO-2026-0001';

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByTestId('lang-toggle-btn').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    // Preset 1: Compliant Mainland Holding Chain (35% >= 25% -> 100/100)
    await page.getByTestId('preset-select').selectOption('preset-cleared-indirect-holding-chain');
    await expect(page.getByTestId('status-badge')).toContainText('READY');
    await expect(page.getByTestId('status-badge')).toContainText('100/100');
    await expect(page.getByTestId('metric-effective-pct')).toContainText('35%');

    // Preset 2: Commercial FZ Tier 3 Senior Mgmt + 15d Nominee Warning (85/100)
    await page.getByTestId('preset-select').selectOption('preset-conditional-senior-mgmt-nominee');
    await expect(page.getByTestId('status-badge')).toContainText('CONDITIONAL');
    await expect(page.getByTestId('status-badge')).toContainText('85/100');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/03-senior-mgmt-nominee-conditional-desktop.png',
      fullPage: true,
      animations: 'disabled',
    });

    // Preset 3: Repeat-offense 4-layer complex holding (Blocked 0/100, AED 50k-100k + SUSPENSION)
    await page.getByTestId('preset-select').selectOption('preset-blocked-repeat-complex-chain');
    await expect(page.getByTestId('status-badge')).toContainText('BLOCKED');
    await expect(page.getByTestId('status-badge')).toContainText('0/100');
    await expect(page.getByTestId('metric-fine-range')).toContainText('AED 50,000');
    await expect(page.getByTestId('metric-fine-range')).toContainText('100,000');
    await expect(page.getByTestId('metric-fine-range')).toContainText('SUSPENSION');

    // Remediate Preset 3 via valid 784 EID + RBO/RPS + Look-Through + 15d SLA + 5y Retention
    await page.getByTestId('eid-input').fill('784197899001123');
    await page.getByTestId('prior-offense-select').selectOption('0');
    await page.getByTestId('toggle-rboAndPartnersRegistersMaintained').check();
    await page.getByTestId('toggle-chainLookthroughVerified').check();
    await page.getByTestId('toggle-registrarUpdatedWithin15Days').check();
    await page.getByTestId('toggle-nomineeRegisterMaintained').check();
    await page.getByTestId('toggle-nomineeDisclosedWithin15Days').check();
    await page.getByTestId('toggle-fiveYearRetentionCommitted').check();
    await page.getByTestId('toggle-scopeAndExemptionVerified').check();
    await page.getByTestId('toggle-authorizedResidentContactAppointed').check();

    await page.getByTestId('tab-csv').click();
    await page.getByTestId('chain-csv-textarea').fill(buildCleanChainCsvBatch());

    await expect(page.getByTestId('status-badge')).toContainText('READY');
    await expect(page.getByTestId('status-badge')).toContainText('100/100');

    // Save, Finalize & Export UTF-8 BOM CSV in Vault
    await page.getByTestId('tab-vault').click();
    await page.getByTestId('save-dossier-btn').click();
    await expect(page.locator('main')).toContainText(expectedCode);

    await page.getByTestId(`finalize-dossier-${expectedCode}`).click();
    await expect(page.getByTestId(`finalize-dossier-${expectedCode}`)).toHaveCount(0);
    await expect(page.getByTestId(`open-public-${expectedCode}`)).toBeVisible();

    const dlPromise = page.waitForEvent('download');
    await page.getByTestId(`export-csv-${expectedCode}`).click();
    const dl = await dlPromise;
    expect(dl.suggestedFilename()).toContain('.csv');
    const dlPath = await dl.path();
    expect(dlPath).toBeTruthy();
    if (dlPath) {
      const bytes = fs.readFileSync(dlPath);
      expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    }

    await page.screenshot({
      path: 'test-results/qa-screenshots/04-sealed-dossier-desktop.png',
      fullPage: true,
      animations: 'disabled',
    });

    // Public report route & view counter persistence
    await page.getByTestId(`open-public-${expectedCode}`).click();
    await expect(page.locator('body')).toContainText(expectedCode);
    await expect(page.locator('body')).toContainText('Vanguard Multi-Tier Holdings LLC');
    await expect(page.getByTestId('public-view-count')).toContainText('1');

    await page.reload();
    await expect(page.locator('body')).toContainText(expectedCode);
    await expect(page.getByTestId('public-view-count')).toContainText('2');

    expect(errors).toEqual([]);
  });

  test('verifies mobile 390x844 responsiveness in AR Alabaster Registry and EN Obsidian Compliance with zero overflow', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('svg[role="img"]').first()).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/05-mobile-ar-alabaster-registry.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.getByTestId('lang-toggle-btn').click();
    await page.getByTestId('theme-toggle-btn').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'obsidian-compliance');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/06-mobile-en-obsidian-compliance.png',
      fullPage: true,
      animations: 'disabled',
    });

    expect(errors).toEqual([]);
  });
});
