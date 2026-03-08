import { getInvestorId, getIssuerId } from "./graph";
import type { OwnershipRow } from "../types/ownership";
import type { UniverseIssuerItem } from "./ownership-analytics";
import type { InvestorTag } from "../store/app-store";
import type { MarketDataMap } from "./market-data";
import { calcFloatPressure, calcMandatorySellDown } from "./float-pressure";
import {
  detectCoordinatedBloc,
  type DomicileCategory,
} from "./domicile-intelligence";

export type TriggerAlertType =
  | "mto-squeeze"
  | "evasion-cluster"
  | "delisting-risk"
  | "float-pressure"
  | "mandatory-sell-down"
  | "shadow-accumulation"
  | "coordinated-bloc";

export type TriggerAlertInvestor = {
  id: string;
  name: string;
  percentage: number;
  domicile?: string | null;
  tags?: string[];
};

export type TriggerAlert = {
  id: string;
  type: TriggerAlertType;
  severity: "critical" | "high" | "medium";
  issuerId: string;
  shareCode: string;
  issuerName: string;
  message: string;
  details: {
    investors?: TriggerAlertInvestor[];
    currentPercentage?: number;
    threshold?: number;
    distance?: number;
    freeFloat?: number;
    sharesOutstanding?: number;
    avgVolume30d?: number;
    sharesRequired?: number;
    idrRequired?: number;
    daysToComply?: number;
    sharesToSell?: number;
    idrToSell?: number;
    daysToAbsorb?: number;
    topHolderName?: string;
    topHolderPct?: number;
    domicileCategory?: DomicileCategory;
    combinedPct?: number;
    entityCount?: number;
    disclaimerKey?: "coordinated-bloc";
  };
};

const OJK_THRESHOLDS = [5, 7.5, 25, 50, 75];

export function calculateDistanceToThreshold(percentage: number): { nextThreshold: number; distance: number } | null {
  for (const threshold of OJK_THRESHOLDS) {
    if (percentage < threshold) {
      return { nextThreshold: threshold, distance: threshold - percentage };
    }
  }
  return null;
}

function rowsAtSnapshot(rows: OwnershipRow[], snapshotDate: string | null): OwnershipRow[] {
  if (!snapshotDate) return rows;
  return rows.filter((row) => row.date === snapshotDate);
}

function safePct(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) return 0;
  return Math.max(0, value);
}

function topHolderByIssuer(rows: OwnershipRow[]): Map<string, { investorId: string; investorName: string; percentage: number }> {
  const map = new Map<string, { investorId: string; investorName: string; percentage: number }>();

  for (const row of rows) {
    const issuerId = getIssuerId(row);
    const percentage = safePct(row.percentage);
    const existing = map.get(issuerId);
    if (!existing || percentage > existing.percentage) {
      map.set(issuerId, {
        investorId: getInvestorId(row),
        investorName: row.investorName,
        percentage,
      });
    }
  }

  return map;
}

function sortDescendingBy<T>(items: T[], pickValue: (item: T) => number | null | undefined): T[] {
  return [...items].sort((a, b) => {
    const aValue = pickValue(a);
    const bValue = pickValue(b);
    const normalizedA = Number.isFinite(aValue) ? (aValue ?? 0) : Number.NEGATIVE_INFINITY;
    const normalizedB = Number.isFinite(bValue) ? (bValue ?? 0) : Number.NEGATIVE_INFINITY;
    return normalizedB - normalizedA;
  });
}

export function detectMtoSqueeze(rows: OwnershipRow[], snapshotDate: string | null): TriggerAlert[] {
  const scopedRows = rowsAtSnapshot(rows, snapshotDate);
  const alerts: TriggerAlert[] = [];

  for (const row of scopedRows) {
    const pct = safePct(row.percentage);
    if (pct >= 45 && pct < 50) {
      alerts.push({
        id: `mto-${row.id}`,
        type: "mto-squeeze",
        severity: pct >= 48 ? "critical" : "high",
        issuerId: getIssuerId(row),
        shareCode: row.shareCode,
        issuerName: row.issuerName,
        message: `Entitas ${row.investorName} berada di ${pct.toFixed(2)}%, mendekati ambang MTO 50%.`,
        details: {
          investors: [{ id: getInvestorId(row), name: row.investorName, percentage: pct }],
          currentPercentage: pct,
          threshold: 50,
          distance: +(50 - pct).toFixed(2),
          topHolderName: row.investorName,
          topHolderPct: pct,
        },
      });
    }
  }

  return alerts.sort((a, b) => (a.details.distance ?? 100) - (b.details.distance ?? 100));
}

export function detectThresholdEvasion(
  rows: OwnershipRow[],
  snapshotDate: string | null,
  investorTagsById: Record<string, InvestorTag[]>,
): TriggerAlert[] {
  const scopedRows = rowsAtSnapshot(rows, snapshotDate);
  const byIssuer = new Map<string, OwnershipRow[]>();

  for (const row of scopedRows) {
    const issuerId = getIssuerId(row);
    if (!byIssuer.has(issuerId)) byIssuer.set(issuerId, []);
    byIssuer.get(issuerId)!.push(row);
  }

  const alerts: TriggerAlert[] = [];

  for (const [issuerId, issuerRows] of byIssuer.entries()) {
    const evasionCandidates = issuerRows.filter((row) => {
      const pct = safePct(row.percentage);
      return pct >= 4.5 && pct < 5.0;
    });

    if (evasionCandidates.length < 2) continue;

    const first = evasionCandidates[0];
    const aggregatedPct = evasionCandidates.reduce((total, row) => total + safePct(row.percentage), 0);
    const involvedInvestors = evasionCandidates.map((row) => {
      const investorId = getInvestorId(row);
      return {
        id: investorId,
        name: row.investorName,
        percentage: safePct(row.percentage),
        domicile: row.domicile,
        tags: investorTagsById[investorId] ?? [],
      };
    });
    const anyKonglo = involvedInvestors.some((investor) => investor.tags?.includes("KONGLO"));

    alerts.push({
      id: `evasion-${issuerId}`,
      type: "evasion-cluster",
      severity: anyKonglo || evasionCandidates.length >= 3 ? "critical" : "medium",
      issuerId,
      shareCode: first.shareCode,
      issuerName: first.issuerName,
      message: `Terdeteksi ${evasionCandidates.length} entitas tepat di bawah 5% dengan agregat ${aggregatedPct.toFixed(2)}%.`,
      details: {
        investors: involvedInvestors,
        currentPercentage: aggregatedPct,
        threshold: 5,
      },
    });
  }

  return alerts.sort((a, b) => (b.details.currentPercentage ?? 0) - (a.details.currentPercentage ?? 0));
}

export function detectShadowAccumulation(rows: OwnershipRow[], snapshotDate: string | null): TriggerAlert[] {
  const scopedRows = rowsAtSnapshot(rows, snapshotDate);
  const byIssuer = new Map<string, OwnershipRow[]>();

  for (const row of scopedRows) {
    const issuerId = getIssuerId(row);
    if (!byIssuer.has(issuerId)) byIssuer.set(issuerId, []);
    byIssuer.get(issuerId)!.push(row);
  }

  const alerts: TriggerAlert[] = [];

  for (const [issuerId, issuerRows] of byIssuer.entries()) {
    const clusteredRows = issuerRows.filter((row) => {
      const pct = safePct(row.percentage);
      return pct >= 3 && pct < 5;
    });

    if (clusteredRows.length < 3) continue;

    const combinedPct = clusteredRows.reduce((sum, row) => sum + safePct(row.percentage), 0);
    if (combinedPct <= 12) continue;

    const first = clusteredRows[0];
    const investors = [...clusteredRows]
      .sort((left, right) => safePct(right.percentage) - safePct(left.percentage))
      .map((row) => ({
        id: getInvestorId(row),
        name: row.investorName,
        percentage: safePct(row.percentage),
        domicile: row.domicile,
      }));

    const severity =
      combinedPct > 20 ? "critical" : combinedPct > 15 ? "high" : "medium";

    alerts.push({
      id: `shadow-${issuerId}`,
      type: "shadow-accumulation",
      severity,
      issuerId,
      shareCode: first.shareCode,
      issuerName: first.issuerName,
      message: `SHADOW ACCUMULATION - PATTERN DETECTED: ${investors.length} entitas berada di rentang 3%-<5% dengan agregat ${combinedPct.toFixed(2)}%.`,
      details: {
        investors,
        combinedPct: +combinedPct.toFixed(2),
        entityCount: investors.length,
      },
    });
  }

  return alerts.sort((left, right) => {
    const combinedGap = (right.details.combinedPct ?? 0) - (left.details.combinedPct ?? 0);
    if (combinedGap !== 0) return combinedGap;
    return (right.details.entityCount ?? 0) - (left.details.entityCount ?? 0);
  });
}

function detectCoordinatedBlocAlerts(rows: OwnershipRow[], snapshotDate: string | null): TriggerAlert[] {
  return detectCoordinatedBloc(rows, snapshotDate).map((pattern) => ({
    id: pattern.id,
    type: "coordinated-bloc",
    severity: pattern.combinedPct >= 15 || pattern.entityCount >= 3 ? "high" : "medium",
    issuerId: pattern.issuerId,
    shareCode: pattern.shareCode,
    issuerName: pattern.issuerName,
    message: `POSSIBLE COORDINATED PATTERN: ${pattern.entityCount} entitas dengan domisili ${pattern.domicileCategory.replace(/_/g, " ")} terklaster di ${pattern.combinedPct.toFixed(2)}%.`,
    details: {
      investors: pattern.investors,
      domicileCategory: pattern.domicileCategory,
      combinedPct: pattern.combinedPct,
      entityCount: pattern.entityCount,
      disclaimerKey: pattern.disclaimerKey,
    },
  }));
}

export function detectDelistingRisk(universeItems: UniverseIssuerItem[]): TriggerAlert[] {
  const alerts: TriggerAlert[] = [];

  for (const item of universeItems) {
    if (item.freeFloatPct < 9) {
      alerts.push({
        id: `delist-${item.issuerId}`,
        type: "delisting-risk",
        severity: item.freeFloatPct < 7.5 ? "critical" : "high",
        issuerId: item.issuerId,
        shareCode: item.shareCode,
        issuerName: item.issuerName,
        message: `Free float kritis di ${item.freeFloatPct.toFixed(2)}%; tail risk menuju ambang delisting 7.5%.`,
        details: {
          freeFloat: item.freeFloatPct,
          threshold: 7.5,
          distance: +(item.freeFloatPct - 7.5).toFixed(2),
          topHolderPct: item.topHolderPct,
        },
      });
    }
  }

  return alerts.sort((a, b) => (a.details.freeFloat ?? 100) - (b.details.freeFloat ?? 100));
}

export function detectFloatPressure(
  rows: OwnershipRow[],
  snapshotDate: string | null,
  universeItems: UniverseIssuerItem[],
  marketData: MarketDataMap,
): TriggerAlert[] {
  const scopedRows = rowsAtSnapshot(rows, snapshotDate);
  const topHolders = topHolderByIssuer(scopedRows);
  const alerts: TriggerAlert[] = [];

  for (const item of universeItems) {
    if (item.freeFloatPct >= 15) continue;

    const marketEntry = marketData[item.shareCode] ?? null;
    const pressure = calcFloatPressure({
      freeFloatPct: item.freeFloatPct,
      sharesOutstanding: marketEntry?.sharesOutstanding,
      price: marketEntry?.price,
      avgVolume30d: marketEntry?.avgVolume30d,
    });
    const topHolder = topHolders.get(item.issuerId);
    const gap = Math.max(0, 15 - item.freeFloatPct);

    alerts.push({
      id: `float-${item.issuerId}`,
      type: "float-pressure",
      severity: item.freeFloatPct < 7.5 ? "critical" : item.freeFloatPct < 10 ? "high" : "medium",
      issuerId: item.issuerId,
      shareCode: item.shareCode,
      issuerName: item.issuerName,
      message: `Free float ${item.freeFloatPct.toFixed(2)}%; masih butuh ${gap.toFixed(2)} poin untuk mencapai 15%.`,
      details: {
        currentPercentage: item.freeFloatPct,
        threshold: 15,
        distance: +gap.toFixed(2),
        freeFloat: item.freeFloatPct,
        sharesOutstanding: marketEntry?.sharesOutstanding,
        avgVolume30d: marketEntry?.avgVolume30d,
        sharesRequired: pressure.sharesRequired ?? undefined,
        idrRequired: pressure.idrRequired ?? undefined,
        daysToComply: pressure.daysToComply ?? undefined,
        topHolderName: topHolder?.investorName,
        topHolderPct: topHolder?.percentage ?? item.topHolderPct,
      },
    });
  }

  return sortDescendingBy(alerts, (alert) => alert.details.idrRequired);
}

export function detectMandatorySellDown(
  rows: OwnershipRow[],
  snapshotDate: string | null,
  marketData: MarketDataMap,
): TriggerAlert[] {
  const scopedRows = rowsAtSnapshot(rows, snapshotDate);
  const alerts: TriggerAlert[] = [];

  for (const row of scopedRows) {
    const pct = safePct(row.percentage);
    if (pct <= 80) continue;

    const marketEntry = marketData[row.shareCode] ?? null;
    const sellDown = calcMandatorySellDown({
      holderPct: pct,
      sharesOutstanding: marketEntry?.sharesOutstanding,
      price: marketEntry?.price,
      avgVolume30d: marketEntry?.avgVolume30d,
    });
    const excessPct = Math.max(0, pct - 80);

    alerts.push({
      id: `sell-down-${row.id}`,
      type: "mandatory-sell-down",
      severity: pct >= 90 ? "critical" : "high",
      issuerId: getIssuerId(row),
      shareCode: row.shareCode,
      issuerName: row.issuerName,
      message: `${row.investorName} berada di ${pct.toFixed(2)}%; excess ${excessPct.toFixed(2)}% di atas ambang 80%.`,
      details: {
        investors: [{ id: getInvestorId(row), name: row.investorName, percentage: pct }],
        currentPercentage: pct,
        threshold: 80,
        distance: +excessPct.toFixed(2),
        sharesOutstanding: marketEntry?.sharesOutstanding,
        avgVolume30d: marketEntry?.avgVolume30d,
        sharesToSell: sellDown.sharesToSell ?? undefined,
        idrToSell: sellDown.idrToSell ?? undefined,
        daysToAbsorb: sellDown.daysToAbsorb ?? undefined,
        topHolderName: row.investorName,
        topHolderPct: pct,
      },
    });
  }

  return sortDescendingBy(alerts, (alert) => alert.details.idrToSell);
}

export function runTriggerEngine(
  rows: OwnershipRow[],
  snapshotDate: string | null,
  universeItems: UniverseIssuerItem[],
  marketData: MarketDataMap,
  investorTagsById: Record<string, InvestorTag[]>,
): TriggerAlert[] {
  const mandatorySellDown = detectMandatorySellDown(rows, snapshotDate, marketData);
  const mto = detectMtoSqueeze(rows, snapshotDate);
  const floatPressure = detectFloatPressure(rows, snapshotDate, universeItems, marketData);
  const shadowAccumulation = detectShadowAccumulation(rows, snapshotDate);
  const coordinatedBloc = detectCoordinatedBlocAlerts(rows, snapshotDate);
  const evasion = detectThresholdEvasion(rows, snapshotDate, investorTagsById);
  const delisting = detectDelistingRisk(universeItems);

  return [
    ...mandatorySellDown,
    ...mto,
    ...floatPressure,
    ...shadowAccumulation,
    ...coordinatedBloc,
    ...evasion,
    ...delisting,
  ];
}
