import type { InvestorPortfolioPosition } from "../types/ownership";
import type { MarketDataMap } from "./market-data";
import { getPositionValueIDR } from "./market-data";

export type InvestorStyle = "VALUE" | "GROWTH" | "DIVIDEND" | "SECTOR_SPECIALIST" | "MIXED";

export type InvestorStyleProfile = {
  style: InvestorStyle;
  avgPE: number | null;
  avgPB: number | null;
  avgDivYieldPct: number | null;
  topSectorPct: number | null;
  coveredPositions: number;
  totalPositions: number;
  coveredValueIDR: number;
  totalValueIDR: number;
  coveragePct: number;
  reason: string;
};

function safeNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeDividendYieldPct(value: number | null | undefined): number | null {
  const numeric = safeNumber(value);
  if (numeric === null) return null;
  return numeric <= 1 ? numeric * 100 : numeric;
}

function weightedAverage(items: Array<{ value: number | null; weight: number }>): number | null {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const item of items) {
    if (item.value === null || !Number.isFinite(item.weight) || item.weight <= 0) continue;
    weightedSum += item.value * item.weight;
    totalWeight += item.weight;
  }

  if (totalWeight <= 0) return null;
  return weightedSum / totalWeight;
}

export function classifyInvestorStyle(
  avgPE: number | null,
  avgPB: number | null,
  avgDivYieldPct: number | null,
  topSectorPct: number | null = null,
): InvestorStyle {
  if (topSectorPct !== null && topSectorPct > 60) return "SECTOR_SPECIALIST";
  if (avgPE !== null && avgPB !== null && avgPE < 12 && avgPB < 1.5) return "VALUE";
  if (avgPE !== null && avgPE > 30) return "GROWTH";
  if (avgDivYieldPct !== null && avgDivYieldPct > 4) return "DIVIDEND";
  return "MIXED";
}

function styleReason(
  style: InvestorStyle,
  avgPE: number | null,
  avgPB: number | null,
  avgDivYieldPct: number | null,
  coveragePct: number,
): string {
  if (coveragePct <= 0) return "Data valuasi pasar belum cukup untuk membaca gaya portofolio.";
  if (style === "VALUE") {
    return `Weighted PE ${avgPE?.toFixed(1) ?? "-"}x dan PB ${avgPB?.toFixed(2) ?? "-"}x menunjukkan profil value yang relatif murah.`;
  }
  if (style === "GROWTH") {
    return `Weighted PE ${avgPE?.toFixed(1) ?? "-"}x menunjukkan preferensi pada saham dengan valuasi growth lebih tinggi.`;
  }
  if (style === "DIVIDEND") {
    return `Rata-rata dividend yield ${avgDivYieldPct?.toFixed(1) ?? "-"}% menunjukkan bias ke cash-yield yang lebih tinggi.`;
  }
  if (style === "SECTOR_SPECIALIST") {
    return "Portofolio sangat terkonsentrasi pada satu sektor dominan.";
  }
  return `Portofolio terbaca campuran, tanpa sinyal value/growth/dividend yang dominan pada coverage ${coveragePct.toFixed(0)}%.`;
}

export function buildInvestorStyleProfile(
  positions: InvestorPortfolioPosition[],
  marketData: MarketDataMap,
  topSectorPct: number | null = null,
): InvestorStyleProfile {
  const valuedPositions = positions
    .map((position) => {
      const entry = marketData[position.shareCode] ?? null;
      const positionValueIDR = getPositionValueIDR(position.shares, entry?.price) ?? 0;
      return {
        position,
        entry,
        positionValueIDR,
      };
    })
    .filter((item) => item.positionValueIDR > 0);

  const totalValueIDR = valuedPositions.reduce((sum, item) => sum + item.positionValueIDR, 0);
  const metricCoveredPositions = valuedPositions.filter((item) => {
    const pe = safeNumber(item.entry?.pe);
    const pb = safeNumber(item.entry?.pb);
    const divYieldPct = normalizeDividendYieldPct(item.entry?.divYield);
    return pe !== null || pb !== null || divYieldPct !== null;
  });
  const coveredValueIDR = metricCoveredPositions.reduce((sum, item) => sum + item.positionValueIDR, 0);
  const coveragePct = totalValueIDR > 0 ? (coveredValueIDR / totalValueIDR) * 100 : 0;

  const avgPE = weightedAverage(
    metricCoveredPositions.map((item) => ({
      value: safeNumber(item.entry?.pe),
      weight: item.positionValueIDR,
    })),
  );
  const avgPB = weightedAverage(
    metricCoveredPositions.map((item) => ({
      value: safeNumber(item.entry?.pb),
      weight: item.positionValueIDR,
    })),
  );
  const avgDivYieldPct = weightedAverage(
    metricCoveredPositions.map((item) => ({
      value: normalizeDividendYieldPct(item.entry?.divYield),
      weight: item.positionValueIDR,
    })),
  );

  const style = classifyInvestorStyle(avgPE, avgPB, avgDivYieldPct, topSectorPct);

  return {
    style,
    avgPE,
    avgPB,
    avgDivYieldPct,
    topSectorPct,
    coveredPositions: metricCoveredPositions.length,
    totalPositions: positions.length,
    coveredValueIDR,
    totalValueIDR,
    coveragePct,
    reason: styleReason(style, avgPE, avgPB, avgDivYieldPct, coveragePct),
  };
}
