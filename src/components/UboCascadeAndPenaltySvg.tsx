import type { AssessmentInput, AssessmentResult, ReadinessStatus } from '../core/types.ts';
import type { Locale } from '../lib/i18n.ts';

interface Props {
  input: AssessmentInput;
  result: AssessmentResult;
  locale: Locale;
}

function statusStroke(status: ReadinessStatus): string {
  if (status === 'ready') return 'var(--accent-emerald)';
  if (status === 'conditional') return 'var(--accent-amber)';
  return 'var(--accent-crimson)';
}

function fmtAedCompact(val: number, isAr: boolean): string {
  const rounded = Math.round(val).toLocaleString('en-US');
  return isAr ? `${rounded} د.إ` : `AED ${rounded}`;
}

export function UboCascadeAndPenaltySvg({ input, result, locale }: Props) {
  const isAr = locale === 'ar';
  const { obligations, csvAudit, readinessScore, readinessStatus, controls } = result;

  const trackMaxW = 292;
  const scalePct = (pct: number) =>
    Math.max(6, Math.min(trackMaxW, Math.round((Math.min(100, Math.max(0, pct)) / 100) * trackMaxW)));

  const p1HeadingX = isAr ? 314 : 26;
  const p1MetricX = isAr ? 26 : 314;
  const p1BoxHeadingX = isAr ? 304 : 36;
  const p1BoxMetricX = isAr ? 36 : 304;

  const p2HeadingX = isAr ? 654 : 366;
  const p2MetricX = isAr ? 366 : 654;
  const p2CardHeadingX = isAr ? 644 : 376;
  const p2CardMetricX = isAr ? 376 : 644;

  const barOriginX1 = (w: number) => (isAr ? 316 - w : 24);
  const barOriginX2 = (w: number) => (isAr ? 656 - w : 364);

  const segW = Math.round(292 / 4);
  const stageBands = [
    {
      label: isAr ? 'سليم / معفى' : 'Compliant',
      color: 'var(--accent-emerald-soft)',
      textColor: 'var(--accent-emerald)',
    },
    {
      label: isAr ? 'إنذار أول' : '1st Warning',
      color: 'var(--accent-teal-soft)',
      textColor: 'var(--accent-teal)',
    },
    {
      label: isAr ? '10k–50k د.إ' : 'AED 10k–50k',
      color: 'var(--accent-amber-soft)',
      textColor: 'var(--accent-amber)',
    },
    {
      label: isAr ? '100k + إيقاف' : '100k + Susp.',
      color: 'var(--accent-crimson-soft)',
      textColor: 'var(--accent-crimson)',
    },
  ];

  let activeBandIdx = 0;
  if (obligations.penaltyStageCode === 'tier3_cap_and_license_suspension') {
    activeBandIdx = 3;
  } else if (obligations.penaltyStageCode === 'tier2_monetary_fine') {
    activeBandIdx = 2;
  } else if (obligations.penaltyStageCode === 'tier1_written_warning') {
    activeBandIdx = 1;
  }
  const pinX = Math.round(24 + activeBandIdx * segW + (segW - 2) / 2);

  let tierBadge = 'TIER 1 >=25%';
  if (obligations.determinationTier === 'exempt_entity') tierBadge = 'EXEMPT';
  else if (obligations.determinationTier === 'tier2_control_other_means') tierBadge = 'TIER 2 CTRL';
  else if (obligations.determinationTier === 'tier3_senior_management') tierBadge = 'TIER 3 MGMT';
  else if (obligations.determinationTier === 'unresolved') tierBadge = 'UNRESOLVED';

  const chainRows = [
    {
      label: isAr ? 'الملكية المباشرة (%)' : 'Direct Equity Ownership (%)',
      pct: input.directOwnershipPct,
      display: `${input.directOwnershipPct}%`,
      color: 'var(--accent-teal)',
      y: 138,
    },
    {
      label: isAr
        ? `السلاسل (${input.intermediateLayer1Pct}×${input.intermediateLayer2Pct}%)`
        : `Indirect Chain (${input.intermediateLayer1Pct}% x ${input.intermediateLayer2Pct}%)`,
      pct: obligations.effectiveIndirectPct,
      display: `${obligations.effectiveIndirectPct}%`,
      color: obligations.complexStructureScrutiny ? 'var(--accent-amber)' : 'var(--accent-teal)',
      y: 186,
    },
    {
      label: isAr ? 'الملكية الفعالة (عتبة 25% فأكثر)' : 'Effective Ownership (>= 25% Gate)',
      pct: obligations.totalEffectiveOwnershipPct,
      display: `${obligations.totalEffectiveOwnershipPct}%`,
      color: obligations.meets25PctUboThreshold ? 'var(--accent-emerald)' : 'var(--accent-amber)',
      y: 234,
    },
  ];

  const fineSummaryText =
    obligations.projectedMaximumFineAed > 0
      ? isAr
        ? `${obligations.projectedMinimumFineAed.toLocaleString('en-US')}–${obligations.projectedMaximumFineAed.toLocaleString('en-US')} د.إ${obligations.licenseSuspensionRisk ? ' + إيقاف' : ''}`
        : `AED ${obligations.projectedMinimumFineAed.toLocaleString('en-US')}–${obligations.projectedMaximumFineAed.toLocaleString('en-US')}${obligations.licenseSuspensionRisk ? ' + Susp.' : ''}`
      : obligations.penaltyStageCode === 'tier1_written_warning'
        ? isAr
          ? 'إنذار خطي (مهلة 15 يوم)'
          : 'Written Warning (15d)'
        : isAr
          ? `آمن ✓ (${fmtAedCompact(0, true)})`
          : 'CLEAR ✓ (AED 0)';

  const readinessW = Math.max(6, Math.min(292, Math.round((readinessScore / 100) * 292)));
  const passedCount = controls.filter((c) => c.passed).length;

  const registersAndChainOk =
    !obligations.registersMissingGap && !obligations.chainOrUboResolutionGap;
  const registersBadge = obligations.registersMissingGap
    ? isAr
      ? 'سجلات مفقودة'
      : 'RBO/RPS MISSING'
    : obligations.chainOrUboResolutionGap
      ? isAr
        ? 'اختراق ناقص'
        : 'CHAIN GAP'
      : isAr
        ? 'مكتمل ✓'
        : 'VERIFIED ✓';

  const slaAndRetentionOk =
    !obligations.updateNoticeSlaGap &&
    !obligations.nomineeDisclosureGap &&
    !obligations.fiveYearRetentionGap;
  const slaBadge = obligations.updateNoticeSlaGap
    ? isAr
      ? 'تأخر > 15 يوم'
      : '> 15d BREACH'
    : obligations.nomineeDisclosureGap
      ? isAr
        ? 'فجوة اسمي 15d'
        : 'NOMINEE 15d GAP'
      : obligations.fiveYearRetentionGap
        ? isAr
          ? 'نقص حفظ 5y'
          : '5y ARCHIVE GAP'
        : isAr
          ? 'مهل سليمة ✓'
          : 'SLA ON TIME ✓';

  const csvViolation = Boolean(csvAudit && csvAudit.violationRows > 0);
  const enforcementOk =
    !obligations.licenseSuspensionRisk && !obligations.residentContactOrEidGap && !csvViolation;
  const enforcementBadge = obligations.licenseSuspensionRisk
    ? isAr
      ? 'خطر إيقاف م 3/2'
      : 'ART 3(2) SUSP RISK'
    : obligations.residentContactOrEidGap
      ? isAr
        ? 'مفوض / هوية 784'
        : 'CONTACT / EID'
      : csvViolation
        ? isAr
          ? `CSV: ${csvAudit!.violationRows} مخالفة`
          : `CSV: ${csvAudit!.violationRows} FAIL`
        : isAr
          ? 'محصّن ✓'
          : 'CLEAN ✓';

  const gateCards = [
    {
      label: isAr ? 'سجلات RBO / RPS والاختراق' : 'RBO / RPS & Chain Proof',
      badge: registersBadge,
      ok: registersAndChainOk,
      y: 142,
    },
    {
      label: isAr ? 'مهل 15 يوماً وحفظ 5 سنوات' : '15d Update / Nominee & 5y',
      badge: slaBadge,
      ok: slaAndRetentionOk,
      y: 194,
    },
    {
      label: isAr ? 'إيقاف الرخصة (م 3/2) وCSV' : 'Art. 3(2) Suspension & CSV',
      badge: enforcementBadge,
      ok: enforcementOk,
      y: 246,
    },
  ];

  return (
    <section className="ubo-card mb-5 rounded-2xl p-4 sm:p-5">
      <svg
        viewBox="0 0 684 315"
        role="img"
        aria-label={
          isAr
            ? 'مخطط التدرج الثلاثي للمستفيد الحقيقي وسلم جزاءات CR 109/2023 و CR 132/2023'
            : 'UAE CR 109/2023 & CR 132/2023 Cascading UBO Ownership Chain & Penalty Ladder SVG'
        }
        className="w-full"
      >
        <rect
          x="12"
          y="8"
          width="324"
          height="299"
          rx="14"
          fill="var(--bg-elevated)"
          stroke="var(--border-subtle)"
        />
        <rect
          x="348"
          y="8"
          width="324"
          height="299"
          rx="14"
          fill="var(--bg-elevated)"
          stroke="var(--border-subtle)"
        />

        <text x={p1HeadingX} y="34" fontSize="11.2" fontWeight="700" fill="var(--text-primary)">
          {isAr ? 'تدرج المستفيد الحقيقي وCR 132' : 'CR 109/2023 Tier & Escalation'}
        </text>
        <text
          x={p1MetricX}
          y="34"
          direction="ltr"
          textAnchor={isAr ? 'start' : 'end'}
          fontSize="10.2"
          fontWeight="700"
          className="ubo-mono num-tabular"
          fill={
            obligations.meets25PctUboThreshold
              ? 'var(--accent-teal)'
              : obligations.determinationTier === 'unresolved'
                ? 'var(--accent-crimson)'
                : 'var(--accent-amber)'
          }
        >
          {tierBadge}
        </text>

        <g transform="translate(0, 50)">
          {stageBands.map((b, idx) => (
            <g key={b.label}>
              <rect
                x={24 + idx * segW}
                y="0"
                width={segW - 2}
                height="24"
                rx="5"
                fill={b.color}
                stroke={idx === activeBandIdx ? 'var(--text-primary)' : 'var(--border-subtle)'}
                strokeWidth={idx === activeBandIdx ? '1.8' : '1'}
              />
              <text
                x={24 + idx * segW + segW / 2 - 1}
                y="15"
                direction="ltr"
                textAnchor="middle"
                fontSize="8.2"
                fontWeight="700"
                fill={b.textColor}
              >
                {b.label}
              </text>
            </g>
          ))}
          <polygon
            points={`${pinX - 5},-7 ${pinX + 5},-7 ${pinX},-1`}
            fill="var(--accent-crimson)"
          />
        </g>

        <text x={p1HeadingX} y="96" fontSize="9.3" fill="var(--text-secondary)">
          {isAr
            ? 'تحديث/اسمي 15 يوم · تأسيس 60 يوم · حفظ 5 سنوات'
            : '15d Update & Nominee · 60d Initial · 5y Post-Dissolution'}
        </text>

        <g>
          {chainRows.map((row) => {
            const w = scalePct(row.pct);
            return (
              <g key={row.label}>
                <text x={p1HeadingX} y={row.y - 8} fontSize="10.6" fontWeight="600" fill="var(--text-primary)">
                  {row.label}
                </text>
                <text
                  x={p1MetricX}
                  y={row.y - 8}
                  direction="ltr"
                  textAnchor={isAr ? 'start' : 'end'}
                  fontSize="10.2"
                  fontWeight="700"
                  className="ubo-mono num-tabular"
                  fill={row.color}
                >
                  {row.display}
                </text>
                <rect
                  x="24"
                  y={row.y}
                  width="292"
                  height="11"
                  rx="5.5"
                  fill="var(--bg-surface)"
                  stroke="var(--border-subtle)"
                />
                <rect x={barOriginX1(w)} y={row.y} width={w} height="11" rx="5.5" fill={row.color} />
              </g>
            );
          })}
        </g>

        <rect
          x="24"
          y="258"
          width="292"
          height="36"
          rx="8"
          fill="var(--bg-surface)"
          stroke="var(--border-subtle)"
        />
        <text x={p1BoxHeadingX} y="280" fontSize="9.8" fontWeight="600" fill="var(--text-secondary)">
          {isAr ? 'جزاءات CR 132' : 'CR 132/2023 Exposure'}
        </text>
        <text
          x={p1BoxMetricX}
          y="280"
          direction="ltr"
          textAnchor={isAr ? 'start' : 'end'}
          fontSize="10.5"
          fontWeight="800"
          className="ubo-mono num-tabular"
          fill={
            obligations.projectedMaximumFineAed > 0
              ? 'var(--accent-crimson)'
              : obligations.penaltyStageCode === 'tier1_written_warning'
                ? 'var(--accent-amber)'
                : 'var(--accent-emerald)'
          }
        >
          {fineSummaryText}
        </text>

        <text x={p2HeadingX} y="34" fontSize="11.2" fontWeight="700" fill="var(--text-primary)">
          {isAr ? 'جاهزية الضوابط السبعة' : '7-Control Readiness'}
        </text>
        <text
          x={p2MetricX}
          y="34"
          direction="ltr"
          textAnchor={isAr ? 'start' : 'end'}
          fontSize="11.5"
          fontWeight="800"
          className="ubo-mono num-tabular"
          fill={statusStroke(readinessStatus)}
        >
          {`${passedCount}/7 PASS · ${readinessScore}%`}
        </text>

        <rect
          x="364"
          y="48"
          width="292"
          height="16"
          rx="8"
          fill="var(--bg-surface)"
          stroke="var(--border-subtle)"
        />
        <rect
          x={barOriginX2(readinessW)}
          y="48"
          width={readinessW}
          height="16"
          rx="8"
          fill={statusStroke(readinessStatus)}
        />
        <text x={p2HeadingX} y="82" fontSize="9.8" fill="var(--text-secondary)">
          {isAr
            ? `السوابق المسجلة: ${input.priorOffenseCount} | عدد الطبقات: ${input.ownershipLayersCount}`
            : `Prior Offenses: ${input.priorOffenseCount} | Ownership Layers: ${input.ownershipLayersCount}`}
        </text>

        <text x={p2HeadingX} y="106" fontSize="11.2" fontWeight="700" fill="var(--text-primary)">
          {isAr ? 'بوابات السجل والمهل والإيقاف' : 'Critical Registers, SLA & Suspension'}
        </text>

        {gateCards.map((card) => (
          <g key={card.label}>
            <rect
              x="364"
              y={card.y - 26}
              width="292"
              height="38"
              rx="9"
              fill="var(--bg-surface)"
              stroke={card.ok ? 'var(--border-subtle)' : 'var(--accent-crimson)'}
            />
            <text x={p2CardHeadingX} y={card.y - 3} fontSize="10.2" fontWeight="600" fill="var(--text-primary)">
              {card.label}
            </text>
            <text
              x={p2CardMetricX}
              y={card.y - 3}
              direction="ltr"
              textAnchor={isAr ? 'start' : 'end'}
              fontSize="9.5"
              fontWeight="800"
              className="ubo-mono num-tabular"
              fill={card.ok ? 'var(--accent-emerald)' : 'var(--accent-crimson)'}
            >
              {card.badge}
            </text>
          </g>
        ))}

        <text x={p2HeadingX} y="287" fontSize="9.2" fill="var(--text-secondary)">
          {isAr
            ? 'أداة استرشادية — لا تتبع وزارة الاقتصاد أو المسجلين أو DFSA/FSRA'
            : 'Independent tool — not MoE / Registrar / DFSA / FSRA'}
        </text>
      </svg>
    </section>
  );
}
