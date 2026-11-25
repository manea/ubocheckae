
جميع التغييرات الموثقة في هذا الملف تتبع سياسة `Git & CHANGELOG` لاستوديو عزم بميزانية `$0`.

## [0.5.0] - 2026-11-25
### أضيف (Added)
- إطلاق الإصدار **`0.5.0` (`MIT`)**: إضافة [`LICENSE`](LICENSE)، وسير عمل الاختبار والبناء [`.github/workflows/ci.yml`](.github/workflows/ci.yml) على Node 22، ونسخ لقطات المتصفح الست المعتمدة إلى [`docs/screenshots/`](docs/screenshots/) وتضمينها في [`README.md`](README.md).
- التحقق الكامل من البناء والتصدير النظيف (`bash -n deploy/*.sh`, `EXPORT_CLEAN_OK`, `tsc --noEmit`, `Vitest`, `vite build`, `Playwright Chrome E2E`) تمهيداً للإطلاق الحي عبر HTTPS والنشر المفتوح المصدر على GitHub.

## [0.4.0] - 2026-11-25
### أضيف (Added)
- ترقية الحزمة إلى `0.4.0` وإضافة [`playwright.config.ts`](playwright.config.ts) (`:4250`) واختبارات المتصفح الكاملة [`tests/e2e/ubocheckae.spec.ts`](tests/e2e/ubocheckae.spec.ts) عبر شاشات `1280×800` و`390×844` بوضعَي `AR RTL Alabaster Registry` و`EN LTR Obsidian Compliance` مع حفظ التفضيلات عبر إعادة التحميل، وتصحيح السيناريو الثالث إلى `100/100`، وختم `UBO-2026-0001` بـ `SHA-256`، وتنزيل `UTF-8 BOM CSV` على السلك، وفحص التقرير العام `/r/UBO-2026-0001` (`Views: 1 -> 2`).
- إضافة دلالات `<main>` و`data-testid="legal-disclaimer-banner"` في [`src/App.tsx`](src/App.tsx).
- بناء حزمة النشر الصفرية `$0` والخصوصية: [`wrangler.jsonc`](wrangler.jsonc)، [`Dockerfile`](Dockerfile)، [`docker-compose.yml`](docker-compose.yml)، [`.dockerignore`](.dockerignore)، وملفات `deploy/*` ([`ubocheckae.service`](deploy/ubocheckae.service)، [`backup-sqlite.sh`](deploy/backup-sqlite.sh)، [`Caddyfile`](deploy/Caddyfile)، [`.env.example`](deploy/.env.example)، ، [`export-public-github.sh`](deploy/export-public-github.sh))، ودليل [`launch/DEPLOY-AND-SHARE.md`](launch/DEPLOY-AND-SHARE.md) و[`README.md`](README.md).
- مراجعة لقطات Chrome الست حياً وتنقيح عرض رموز النسب الحسابية العربية (`≥ 25%` بدل انعكاس `=>` في الاتجاه من اليمين لليسار) وتوسيع عرض منتقي السيناريوهات في الترويسة (`sm:w-72`) عبر [`UboCascadeAndPenaltySvg.tsx`](src/components/UboCascadeAndPenaltySvg.tsx) و[`ChainAndExposurePanel.tsx`](src/components/ChainAndExposurePanel.tsx) و[`i18n.ts`](src/lib/i18n.ts) و[`App.tsx`](src/App.tsx) مع إعادة التحقق التام.

## [0.3.0] - 2026-11-25
### أضيف (Added)
- ترقية الحزمة إلى `0.3.0` وبناء واجهة الويب التفاعلية الثنائية الاتجاه (`AR RTL / EN LTR`) باستخدام **`React 19.2 + Tailwind CSS v4 + Vite 8`** بمظهري `Alabaster Registry` (النهاري) و`Obsidian Compliance` (الداكن) ودون ترويسة عائمة (`no sticky top-0`).
- إضافة [`vite.config.ts`](vite.config.ts) (`:4250` مع وكيل `/api`, `/health`, `/readyz` إلى `:4249`)، [`index.html`](index.html)، [`public/favicon.svg`](public/favicon.svg)، [`src/index.css`](src/index.css)، [`src/main.tsx`](src/main.tsx)، و[`src/lib/{basePath,i18n,api}.ts`](src/lib/api.ts) بالعمل المزدوج (`SQLite WAL` أو التخزين المحلي `$0`) ومسار البادئة `window.__UBOCHECKAE_BASE__`.
- بناء المكونات الخمسة [`src/components/UboCascadeAndPenaltySvg.tsx`](src/components/UboCascadeAndPenaltySvg.tsx) (مخطط التدرج الثلاثي، حاسبة `>= 25%` عبر السلاسل، مهل `15/60 يوماً` وحفظ `5 سنوات`، وسلم `10k–100k د.إ` وإيقاف الرخصة مـ `3/2`)، [`ChainAndExposurePanel.tsx`](src/components/ChainAndExposurePanel.tsx) (مع فحص الهوية `784 Luhn`)، [`ControlsAndFindingsPanel.tsx`](src/components/ControlsAndFindingsPanel.tsx)، [`ChainCsvAuditPanel.tsx`](src/components/ChainCsvAuditPanel.tsx)، و[`DossierVaultAndPrint.tsx`](src/components/DossierVaultAndPrint.tsx) مع [`src/App.tsx`](src/App.tsx) وعارض التقرير العام `/r/:slugOrCode`.

## [0.2.0] - 2026-11-25
### أضيف (Added)
- ترقية الحزمة إلى `0.2.0` مع الحفاظ على التبعيات التشغيلية الصفرية (`"dependencies": {}`) وإضافة سكربت `"start": "node --no-warnings server/index.mjs"`.
- إضافة باني الملخصات التنفيذية ثنائية اللغة (`AR/EN Markdown`) [`src/core/briefBuilder.ts`](src/core/briefBuilder.ts) وتصديره عبر [`src/core/index.ts`](src/core/index.ts).
- بناء طبقة التخزين الدائمة [`server/db.mjs`](server/db.mjs) بقاعدة **`node:sqlite` (`WAL`)** والترقيم الذري **`UBO-YYYY-0001`** والمعرّف العام **`ubo-<hex>`** وجدول المشاهدات العامة، وخادم [`server/app.mjs`](server/app.mjs) و[`server/index.mjs`](server/index.mjs) و[`server/app.d.mts`](server/app.d.mts) على المنفذ الافتراضي **`:4249`** وتحت المسار الفرعي **`BASE_PATH=/ubocheckae`** مع مسارات `/health`, `/readyz`, `/api/presets`, `/api/evaluate-obligations`, `/api/audit-chains`, `/api/export/chains-csv`, `/api/assess`, `/api/profiles`, `/api/(assessments|dossiers)`, `/duplicate`, `/finalize|lock` (`409`), `brief.md`, `export.csv` (`UTF-8 BOM + CRLF + CWE-1236`), `/summary`, و`/api/public/reports/:slugOrCode` وحواجز `413`/`429` وحقن `window.__UBOCHECKAE_BASE__`.
- إضافة اختبارات التكامل [`tests/unit/uboServer.test.ts`](tests/unit/uboServer.test.ts).

## [0.1.0] - 2026-11-25
### أضيف (Added)
- تأسيس الحزمة البرمجية الصفرية **`projects/ubocheckae` (`v0.1.0`, `MIT`)** لمدقق سجل المستفيد الحقيقي وسلاسل الملكية والجزاءات الإدارية في الإمارات وفق **قرار مجلس الوزراء رقم `(109)` لسنة `2023`** و**قرار مجلس الوزراء رقم `(132)` لسنة `2023`**.
- بناء محرك الامتثال وحاسبة الملكية غير المباشرة [`src/core/uboEngine.ts`](src/core/uboEngine.ts): حساب الملكية الفعّالة عبر الطبقات المباشرة وغير المباشرة (`>= 25%`)، والاختبار المتدرج الثلاثي (`25%` -> السيطرة الفعلية -> الإدارة العليا البديل)، واكتشاف الهياكل المعقدة (`>= 3` طبقات)، وعزل `DIFC/ADGM` والجهات الحكومية `100%` والشركات المدرجة، وسلم الجزاءات التصاعدي (`إنذار خطي أول -> 10,000–50,000 د.إ -> حتى 100,000 د.إ مع إيقاف الرخصة التجارية بموجب المادة 3/2`).
- بناء مصفوفة الجاهزية السبعية [`src/core/readinessAssessor.ts`](src/core/readinessAssessor.ts) (`UBO-CTRL-01`..`UBO-CTRL-07`: سجلا `RBO & RPS`، اختراق السلاسل، مهلة التحديث `15 يوماً`/`60 يوماً`، سجل وإفصاح الاسميين `15 يوماً`، حفظ `5 سنوات` بعد التصفية، نطاق الولاية، والمفوّض المقيم + الهوية الإماراتية `784 Luhn`)، وبصمة `SHA-256` [`src/core/dossierDigest.ts`](src/core/dossierDigest.ts).
- بناء مدقق سلاسل الشركاء CSV المقاوم لـ `CWE-1236` وتصدير `UTF-8 BOM + CRLF` [`src/core/chainCsvAuditor.ts`](src/core/chainCsvAuditor.ts) و`3` سيناريوهات معيارية [`src/core/presets.ts`](src/core/presets.ts) واختبارات `Vitest` [`tests/unit/uboCore.test.ts`](tests/unit/uboCore.test.ts).
