import { useMemo } from "react";
import { arc } from "d3-shape";
import { getInvestorId, getIssuerId } from "../lib/graph";
import { fmtPercent } from "../lib/utils";
import type { OwnershipRow } from "../types/ownership";

type FocusType = "issuer" | "investor";

type PolarPrismProps = {
  rows: OwnershipRow[];
  selectedIssuerId: string | null;
  selectedInvestorId?: string | null;
  focusType?: FocusType | null;
  allRows?: OwnershipRow[];
};

type PrismSlice = {
  id: string;
  label: string;
  percentage: number;
  localForeign: "L" | "A" | null;
};

function isValidPct(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0 && value <= 100;
}

function buildIssuerSlices(sourceRows: OwnershipRow[], selectedIssuerId: string | null): PrismSlice[] {
  if (sourceRows.length === 0) return [];
  const issuerId = selectedIssuerId ?? getIssuerId(sourceRows[0]);
  const issuerRows = sourceRows.filter((row) => getIssuerId(row) === issuerId);
  const map = new Map<string, PrismSlice>();

  for (const row of issuerRows) {
    if (!isValidPct(row.percentage)) continue;
    const key = getInvestorId(row);
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        label: row.investorName,
        percentage: 0,
        localForeign: row.localForeign,
      });
    }
    const entry = map.get(key);
    if (entry) entry.percentage += row.percentage;
  }

  return [...map.values()].sort((a, b) => b.percentage - a.percentage).slice(0, 20);
}

function buildInvestorSlices(sourceRows: OwnershipRow[], selectedInvestorId: string | null): PrismSlice[] {
  if (sourceRows.length === 0) return [];
  const investorId = selectedInvestorId ?? getInvestorId(sourceRows[0]);
  const investorRows = sourceRows.filter((row) => getInvestorId(row) === investorId);
  const map = new Map<string, PrismSlice>();

  for (const row of investorRows) {
    if (!isValidPct(row.percentage)) continue;
    const key = getIssuerId(row);
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        label: row.shareCode,
        percentage: 0,
        localForeign: row.localForeign,
      });
    }
    const entry = map.get(key);
    if (entry) entry.percentage += row.percentage;
  }

  return [...map.values()].sort((a, b) => b.percentage - a.percentage).slice(0, 20);
}

export function PolarPrism({
  rows,
  selectedIssuerId,
  selectedInvestorId = null,
  focusType,
  allRows = [],
}: PolarPrismProps) {
  const effectiveFocus: FocusType = focusType ?? (selectedInvestorId ? "investor" : "issuer");
  const invalidPctCount = useMemo(
    () =>
      (rows.length > 0 ? rows : allRows).reduce((sum, row) => {
        if (row.percentage === null) return sum;
        return Number.isFinite(row.percentage) && row.percentage >= 0 && row.percentage <= 100 ? sum : sum + 1;
      }, 0),
    [allRows, rows],
  );

  const slices = useMemo<PrismSlice[]>(() => {
    const source = rows.length > 0 ? rows : allRows;
    if (effectiveFocus === "investor") {
      return buildInvestorSlices(source, selectedInvestorId);
    }
    return buildIssuerSlices(source, selectedIssuerId);
  }, [allRows, effectiveFocus, rows, selectedInvestorId, selectedIssuerId]);

  if (slices.length === 0) {
    return (
      <div className="flex h-[340px] items-center justify-center rounded-xl border border-border bg-background/25 px-4 text-center text-sm text-muted">
        <div>
          <div>Tidak ada data polar untuk context ini. Coba longgarkan filter atau pilih focus lain.</div>
          {invalidPctCount > 0 ? <div className="mt-2 text-xs text-warning">Invalid % rows: {invalidPctCount}</div> : null}
        </div>
      </div>
    );
  }

  const width = 420;
  const height = 340;
  const cx = width / 2;
  const cy = height / 2;
  const outer = 136;
  const inner = 34;
  const angle = (Math.PI * 2) / slices.length;
  const maxPct = Math.max(...slices.map((item) => item.percentage), 1);
  const radiusScale = (value: number): number => inner + (value / maxPct) * (outer - inner);
  const makeArc = arc();

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[340px] w-full rounded-xl border border-border bg-background/20">
      <defs>
        <radialGradient id="polarBg" cx="50%" cy="50%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.03)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.006)" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={outer + 10} fill="url(#polarBg)" />

      {slices.map((slice, idx) => {
        const startAngle = idx * angle - Math.PI / 2;
        const endAngle = startAngle + angle * 0.9;
        const radius = radiusScale(slice.percentage);
        const path = makeArc({
          innerRadius: inner,
          outerRadius: radius,
          startAngle,
          endAngle,
        });
        return (
          <path
            key={slice.id}
            transform={`translate(${cx},${cy})`}
            d={path ?? ""}
            fill={
              slice.localForeign === "A"
                ? "rgba(131,144,222,0.8)"
                : slice.localForeign === "L"
                  ? "rgba(85,186,171,0.82)"
                  : "rgba(124,132,146,0.75)"
            }
          />
        );
      })}

      <text x={cx} y={cy - 2} textAnchor="middle" fill="rgb(239,244,251)" fontSize={14} fontWeight={700}>
        {effectiveFocus === "investor" ? "Investor Holdings Prism" : "Holder Concentration Prism"}
      </text>
      <text x={cx} y={cy + 18} textAnchor="middle" fill="rgb(136,151,171)" fontSize={12}>
        Top {slices.length} slices
      </text>
      <text x={12} y={height - 10} fill="rgb(136,151,171)" fontSize={11}>
        Dominan: {slices[0]?.label ?? "-"} ({fmtPercent(slices[0]?.percentage)})
      </text>
    </svg>
  );
}
