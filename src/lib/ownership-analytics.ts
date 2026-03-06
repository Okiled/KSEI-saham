import { getInvestorId, getIssuerId } from "./graph";
import type {
  CoInvestorOverlapCell,
  CoInvestorOverlapView,
  CompositionBucket,
  InvestorPortfolioPosition,
  IssuerOwnershipSummary,
  OwnershipRow,
  OwnershipSnapshotMeta,
  OwnershipTimelineView,
  TimelinePoint,
  TimelineSeries,
} from "../types/ownership";

type DateBucket = {
  key: string;
  timestamp: number;
};

export type UniverseIssuerItem = {
  issuerId: string;
  shareCode: string;
  issuerName: string;
  holderCount: number;
  topHolderPct: number;
  totalKnownPct: number;
  localPct: number;
  foreignPct: number;
  unknownPct: number;
  freeFloatPct: number;
  totalShares: number;
  signals: string[];
  hhi: number;
};

const MONTH_INDEX: Record<string, number> = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

function parseSnapshotDate(raw: string): DateBucket {
  const normalized = (raw ?? "").trim();
  const match = normalized.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) {
    const fallback = Date.parse(normalized);
    return {
      key: normalized || "UNKNOWN",
      timestamp: Number.isFinite(fallback) ? fallback : Number.MAX_SAFE_INTEGER,
    };
  }
  const day = Number.parseInt(match[1], 10);
  const month = MONTH_INDEX[match[2].toUpperCase()] ?? 0;
  const year = Number.parseInt(match[3], 10);
  const ts = Date.UTC(year, month, day);
  return {
    key: normalized,
    timestamp: Number.isFinite(ts) ? ts : Number.MAX_SAFE_INTEGER,
  };
}

function safePct(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) return 0;
  return Math.max(0, value);
}

function safeShares(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) return 0;
  return Math.max(0, value);
}

function normalizeInvestorType(value: string | null | undefined): string {
  const normalized = (value ?? "").trim().toUpperCase();
  return normalized || "UNKNOWN";
}

function buildDateBuckets(rows: OwnershipRow[]): DateBucket[] {
  const map = new Map<string, DateBucket>();
  for (const row of rows) {
    const parsed = parseSnapshotDate(row.date);
    if (!map.has(parsed.key)) map.set(parsed.key, parsed);
  }
  return [...map.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function rowsAtSnapshot(rows: OwnershipRow[], snapshotDate: string | null): OwnershipRow[] {
  if (!snapshotDate) return rows;
  return rows.filter((row) => row.date === snapshotDate);
}

function isReksaDana(value: string | null): boolean {
  const name = (value ?? "").toUpperCase();
  return name.includes("REKSA DANA") || name.includes("MUTUAL FUND");
}

function isInsider(value: string | null): boolean {
  const name = (value ?? "").toUpperCase();
  return (
    name.includes("DIREKSI") ||
    name.includes("KOMISARIS") ||
    name.includes("PRESIDEN") ||
    name.includes("DIRECTOR")
  );
}

function isInstitution(investorType: string | null): boolean {
  const normalized = normalizeInvestorType(investorType);
  return !(
    normalized === "ID" ||
    normalized === "I" ||
    normalized.includes("INDIV") ||
    normalized.includes("PERORANGAN")
  );
}

export function buildOwnershipSnapshotMeta(rows: OwnershipRow[]): OwnershipSnapshotMeta[] {
  const dates = buildDateBuckets(rows);
  return dates.map((dateBucket, index) => {
    const scopedRows = rows.filter((row) => row.date === dateBucket.key);
    return {
      snapshotId: `snapshot:${index}:${dateBucket.key}`,
      snapshotDate: dateBucket.key,
      rowCount: scopedRows.length,
      issuerCount: new Set(scopedRows.map((row) => getIssuerId(row))).size,
      investorCount: new Set(scopedRows.map((row) => getInvestorId(row))).size,
    };
  });
}

export function latestSnapshotDate(rows: OwnershipRow[]): string | null {
  const buckets = buildDateBuckets(rows);
  return buckets.length === 0 ? null : buckets[buckets.length - 1].key;
}

export function buildUniverseIssuerItems(rows: OwnershipRow[], snapshotDate: string | null): UniverseIssuerItem[] {
  const scopedRows = rowsAtSnapshot(rows, snapshotDate);
  const map = new Map<
    string,
    {
      issuerId: string;
      shareCode: string;
      issuerName: string;
      holderIds: Set<string>;
      topHolderPct: number;
      totalKnownPct: number;
      localPct: number;
      foreignPct: number;
      unknownPct: number;
      totalShares: number;
      hhiSqSum: number;
    }
  >();

  for (const row of scopedRows) {
    const issuerId = getIssuerId(row);
    if (!map.has(issuerId)) {
      map.set(issuerId, {
        issuerId,
        shareCode: row.shareCode,
        issuerName: row.issuerName,
        holderIds: new Set<string>(),
        topHolderPct: 0,
        totalKnownPct: 0,
        localPct: 0,
        foreignPct: 0,
        unknownPct: 0,
        totalShares: 0,
        hhiSqSum: 0,
      });
    }
    const item = map.get(issuerId)!;
    const pct = safePct(row.percentage);
    const shares = safeShares(row.totalHoldingShares);
    item.holderIds.add(getInvestorId(row));
    item.topHolderPct = Math.max(item.topHolderPct, pct);
    item.totalKnownPct += pct;
    item.totalShares += shares;
    item.hhiSqSum += Math.pow(pct, 2);
    if (row.localForeign === "L") item.localPct += pct;
    else if (row.localForeign === "A") item.foreignPct += pct;
    else item.unknownPct += pct;
  }

  return [...map.values()]
    .map((item) => {
      const freeFloatPct = Math.max(0, 100 - item.totalKnownPct);
      const signals: string[] = [];
      if (item.topHolderPct >= 45) signals.push("Kontrol Terkonsentrasi");
      if (item.foreignPct >= 35) signals.push("Asing Dominan");
      if (freeFloatPct <= 20) signals.push("Free Float Rendah");
      if (item.unknownPct >= 8) signals.push("Unknown Tinggi");
      return {
        issuerId: item.issuerId,
        shareCode: item.shareCode,
        issuerName: item.issuerName,
        holderCount: item.holderIds.size,
        topHolderPct: item.topHolderPct,
        totalKnownPct: item.totalKnownPct,
        localPct: item.localPct,
        foreignPct: item.foreignPct,
        unknownPct: item.unknownPct,
        freeFloatPct,
        totalShares: item.totalShares,
        signals,
        hhi: item.hhiSqSum * 10000,
      };
    })
    .sort((a, b) => b.topHolderPct - a.topHolderPct || b.holderCount - a.holderCount);
}

function buildComposition(holders: OwnershipRow[], totalKnownPercentage: number): CompositionBucket[] {
  const template: Array<{ key: CompositionBucket["key"]; label: string }> = [
    { key: "institusi", label: "Institusi" },
    { key: "asing", label: "Asing" },
    { key: "lokal", label: "Lokal" },
    { key: "insider", label: "Insider" },
    { key: "reksadana", label: "Reksadana" },
    { key: "lainnya", label: "Lainnya" },
  ];

  const bucketMap = new Map(
    template.map((item) => [
      item.key,
      {
        key: item.key,
        label: item.label,
        percentage: 0,
        totalShares: 0,
        holderCount: 0,
      },
    ]),
  );

  for (const row of holders) {
    const pct = safePct(row.percentage);
    const shares = safeShares(row.totalHoldingShares);
    const type = normalizeInvestorType(row.investorType);

    // Assign each investor to exactly ONE primary bucket (priority order)
    let primaryKey: CompositionBucket["key"];
    if (isInsider(row.investorName)) {
      primaryKey = "insider";
    } else if (isReksaDana(row.investorName) || type === "MF") {
      primaryKey = "reksadana";
    } else if (row.localForeign === "A") {
      primaryKey = "asing";
    } else if (row.localForeign === "L") {
      primaryKey = "lokal";
    } else if (isInstitution(type)) {
      primaryKey = "institusi";
    } else {
      primaryKey = "lainnya";
    }

    const target = bucketMap.get(primaryKey);
    if (target) {
      target.percentage += pct;
      target.totalShares += shares;
      target.holderCount += 1;
    }
  }

  const freeFloat = Math.max(0, 100 - totalKnownPercentage);
  const freeFloatBucket: CompositionBucket = {
    key: "freeFloat",
    label: "Free Float (Estimasi)",
    percentage: freeFloat,
    totalShares: 0,
    holderCount: 0,
  };

  return [...bucketMap.values(), freeFloatBucket].sort((a, b) => b.percentage - a.percentage);
}

export function buildIssuerOwnershipView(
  rows: OwnershipRow[],
  issuerId: string,
  snapshotDate: string | null,
): IssuerOwnershipSummary | null {
  const scopedRows = rowsAtSnapshot(rows, snapshotDate).filter((row) => getIssuerId(row) === issuerId);
  if (scopedRows.length === 0) return null;

  const holders = scopedRows
    .map((row) => ({
      issuerId,
      shareCode: row.shareCode,
      issuerName: row.issuerName,
      investorId: getInvestorId(row),
      investorName: row.investorName,
      investorType: row.investorType,
      localForeign: row.localForeign,
      nationality: row.nationality,
      domicile: row.domicile,
      percentage: safePct(row.percentage),
      shares: safeShares(row.totalHoldingShares),
    }))
    .sort((a, b) => b.percentage - a.percentage || b.shares - a.shares);

  const totalKnownPercentage = holders.reduce((sum, holder) => sum + holder.percentage, 0);
  const freeFloatEstimatePct = Math.max(0, 100 - totalKnownPercentage);
  const composition = buildComposition(scopedRows, totalKnownPercentage);

  const crossHoldingsByInvestor: Record<string, IssuerOwnershipSummary["crossHoldingsByInvestor"][string]> = {};
  const scopedAllRows = rowsAtSnapshot(rows, snapshotDate);
  for (const holder of holders) {
    const positions = scopedAllRows
      .filter((row) => getInvestorId(row) === holder.investorId && getIssuerId(row) !== issuerId)
      .map((row) => ({
        investorId: holder.investorId,
        investorName: holder.investorName,
        issuerId: getIssuerId(row),
        shareCode: row.shareCode,
        issuerName: row.issuerName,
        percentage: safePct(row.percentage),
        shares: safeShares(row.totalHoldingShares),
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 8);
    crossHoldingsByInvestor[holder.investorId] = positions;
  }

  const first = holders[0];
  return {
    issuerId,
    shareCode: first.shareCode,
    issuerName: first.issuerName,
    snapshotDate,
    totalKnownPercentage,
    freeFloatEstimatePct,
    holders,
    composition,
    crossHoldingsByInvestor,
  };
}

export function buildInvestorPortfolioView(
  rows: OwnershipRow[],
  investorId: string,
  snapshotDate: string | null,
): InvestorPortfolioPosition[] {
  const scopedRows = rowsAtSnapshot(rows, snapshotDate)
    .filter((row) => getInvestorId(row) === investorId)
    .map((row) => ({
      investorId,
      investorName: row.investorName,
      investorType: row.investorType,
      localForeign: row.localForeign,
      nationality: row.nationality,
      domicile: row.domicile,
      issuerId: getIssuerId(row),
      shareCode: row.shareCode,
      issuerName: row.issuerName,
      percentage: safePct(row.percentage),
      shares: safeShares(row.totalHoldingShares),
      snapshotDate: row.date,
    }));

  return scopedRows.sort((a, b) => b.percentage - a.percentage || b.shares - a.shares);
}

export function buildOwnershipTimelineView(
  rows: OwnershipRow[],
  issuerId: string,
  holderIds: string[],
): OwnershipTimelineView | null {
  const issuerRows = rows.filter((row) => getIssuerId(row) === issuerId);
  if (issuerRows.length === 0) return null;

  const first = issuerRows[0];
  const dates = buildDateBuckets(issuerRows).map((item) => item.key);
  const uniqueHolders = holderIds.length > 0 ? holderIds : [...new Set(issuerRows.map((row) => getInvestorId(row)))];

  const series: TimelineSeries[] = uniqueHolders
    .map((investorId) => {
      const name = issuerRows.find((row) => getInvestorId(row) === investorId)?.investorName ?? investorId;
      const points: TimelinePoint[] = dates.map((date) => {
        const row = issuerRows.find((item) => item.date === date && getInvestorId(item) === investorId);
        return {
          snapshotDate: date,
          percentage: safePct(row?.percentage ?? 0),
          shares: safeShares(row?.totalHoldingShares ?? 0),
        };
      });
      return { investorId, investorName: name, points };
    })
    .filter((item) => item.points.some((point) => point.percentage > 0))
    .sort((a, b) => {
      const aLast = a.points[a.points.length - 1]?.percentage ?? 0;
      const bLast = b.points[b.points.length - 1]?.percentage ?? 0;
      return bLast - aLast;
    })
    .slice(0, 8);

  return {
    issuerId,
    shareCode: first.shareCode,
    issuerName: first.issuerName,
    snapshotDates: dates,
    hasEnoughHistory: dates.length >= 2,
    series,
  };
}

export function buildCoInvestorOverlapView(
  rows: OwnershipRow[],
  issuerId: string,
  snapshotDate: string | null,
  topN: number,
): CoInvestorOverlapView | null {
  const scopedRows = rowsAtSnapshot(rows, snapshotDate);
  const issuerRows = scopedRows
    .filter((row) => getIssuerId(row) === issuerId)
    .sort((a, b) => safePct(b.percentage) - safePct(a.percentage))
    .slice(0, topN);

  if (issuerRows.length === 0) return null;

  const first = issuerRows[0];
  const holderIds = issuerRows.map((row) => getInvestorId(row));
  const holderNamesById: Record<string, string> = {};
  for (const row of issuerRows) {
    holderNamesById[getInvestorId(row)] = row.investorName;
  }

  const holdingsByInvestor = new Map<
    string,
    Map<string, { issuerId: string; shareCode: string; issuerName: string; percentage: number }>
  >();

  for (const row of scopedRows) {
    const investorId = getInvestorId(row);
    if (!holdingsByInvestor.has(investorId)) holdingsByInvestor.set(investorId, new Map());
    holdingsByInvestor.get(investorId)!.set(getIssuerId(row), {
      issuerId: getIssuerId(row),
      shareCode: row.shareCode,
      issuerName: row.issuerName,
      percentage: safePct(row.percentage),
    });
  }

  const cells: CoInvestorOverlapCell[] = [];
  for (const aId of holderIds) {
    for (const bId of holderIds) {
      const aMap = holdingsByInvestor.get(aId) ?? new Map();
      const bMap = holdingsByInvestor.get(bId) ?? new Map();
      const common: CoInvestorOverlapCell["commonIssuers"] = [];
      let weightedOverlap = 0;
      for (const [issuerKey, aItem] of aMap.entries()) {
        const bItem = bMap.get(issuerKey);
        if (!bItem) continue;
        common.push({
          issuerId: issuerKey,
          shareCode: aItem.shareCode,
          issuerName: aItem.issuerName,
        });
        weightedOverlap += Math.min(aItem.percentage, bItem.percentage);
      }
      cells.push({
        investorAId: aId,
        investorAName: holderNamesById[aId] ?? aId,
        investorBId: bId,
        investorBName: holderNamesById[bId] ?? bId,
        commonIssuerCount: common.length,
        weightedOverlap,
        commonIssuers: common.sort((x, y) => x.shareCode.localeCompare(y.shareCode)).slice(0, 20),
      });
    }
  }

  return {
    issuerId,
    shareCode: first.shareCode,
    issuerName: first.issuerName,
    holderIds,
    holderNamesById,
    cells,
  };
}

export function mapConnectedInvestors(
  rows: OwnershipRow[],
  investorId: string,
  snapshotDate: string | null,
  topN = 12,
): Array<{
  investorId: string;
  investorName: string;
  commonIssuerCount: number;
  commonShareCodes: string[];
}> {
  const scopedRows = rowsAtSnapshot(rows, snapshotDate);
  const positions = scopedRows.filter((row) => getInvestorId(row) === investorId);
  if (positions.length === 0) return [];

  const issuerIds = new Set(positions.map((row) => getIssuerId(row)));
  const issuerCodesById = new Map(positions.map((row) => [getIssuerId(row), row.shareCode]));
  const overlaps = new Map<string, { investorName: string; codes: Set<string> }>();

  for (const row of scopedRows) {
    const otherId = getInvestorId(row);
    if (otherId === investorId) continue;
    const issuerKey = getIssuerId(row);
    if (!issuerIds.has(issuerKey)) continue;
    if (!overlaps.has(otherId)) {
      overlaps.set(otherId, { investorName: row.investorName, codes: new Set() });
    }
    overlaps.get(otherId)!.codes.add(issuerCodesById.get(issuerKey) ?? row.shareCode);
  }

  return [...overlaps.entries()]
    .map(([id, value]) => ({
      investorId: id,
      investorName: value.investorName,
      commonIssuerCount: value.codes.size,
      commonShareCodes: [...value.codes].sort(),
    }))
    .sort((a, b) => b.commonIssuerCount - a.commonIssuerCount || a.investorName.localeCompare(b.investorName))
    .slice(0, topN);
}

/**
 * Build co-investor heatmap from the investor's perspective.
 * Finds top co-investors across the investor's portfolio emitens, then
 * builds an overlap matrix of how many emitens each pair shares (across full universe).
 */
export function buildInvestorCoInvestorOverlap(
  rows: OwnershipRow[],
  investorId: string,
  snapshotDate: string | null,
  topN = 10,
): CoInvestorOverlapView | null {
  const scopedRows = rowsAtSnapshot(rows, snapshotDate);
  const myPositions = scopedRows.filter((row) => getInvestorId(row) === investorId);
  if (myPositions.length === 0) return null;

  const myIssuerIds = new Set(myPositions.map((row) => getIssuerId(row)));
  const firstName = myPositions[0].investorName;

  // Find co-investors (others who hold emitens I hold)
  const coInvestorCounts = new Map<string, { name: string; count: number }>();
  for (const row of scopedRows) {
    const otherId = getInvestorId(row);
    if (otherId === investorId) continue;
    if (!myIssuerIds.has(getIssuerId(row))) continue;
    const existing = coInvestorCounts.get(otherId);
    if (existing) existing.count++;
    else coInvestorCounts.set(otherId, { name: row.investorName, count: 1 });
  }

  // Take top co-investors + self
  const topCoInvestors = [...coInvestorCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, topN - 1)
    .map(([id, val]) => ({ id, name: val.name }));

  const allHolderIds = [investorId, ...topCoInvestors.map((c) => c.id)];
  const holderNamesById: Record<string, string> = { [investorId]: firstName };
  for (const c of topCoInvestors) holderNamesById[c.id] = c.name;

  // Build full portfolio map for each holder (across entire universe)
  const holdingsByInvestor = new Map<
    string,
    Map<string, { issuerId: string; shareCode: string; issuerName: string; percentage: number }>
  >();
  for (const row of scopedRows) {
    const iid = getInvestorId(row);
    if (!allHolderIds.includes(iid)) continue;
    if (!holdingsByInvestor.has(iid)) holdingsByInvestor.set(iid, new Map());
    holdingsByInvestor.get(iid)!.set(getIssuerId(row), {
      issuerId: getIssuerId(row),
      shareCode: row.shareCode,
      issuerName: row.issuerName,
      percentage: safePct(row.percentage),
    });
  }

  // Build overlap cells
  const cells: CoInvestorOverlapCell[] = [];
  for (const aId of allHolderIds) {
    for (const bId of allHolderIds) {
      const aMap = holdingsByInvestor.get(aId) ?? new Map();
      const bMap = holdingsByInvestor.get(bId) ?? new Map();
      const common: CoInvestorOverlapCell["commonIssuers"] = [];
      let weightedOverlap = 0;
      for (const [issuerKey, aItem] of aMap.entries()) {
        const bItem = bMap.get(issuerKey);
        if (!bItem) continue;
        common.push({ issuerId: issuerKey, shareCode: aItem.shareCode, issuerName: aItem.issuerName });
        weightedOverlap += Math.min(aItem.percentage, bItem.percentage);
      }
      cells.push({
        investorAId: aId,
        investorAName: holderNamesById[aId] ?? aId,
        investorBId: bId,
        investorBName: holderNamesById[bId] ?? bId,
        commonIssuerCount: common.length,
        weightedOverlap,
        commonIssuers: common.sort((x, y) => x.shareCode.localeCompare(y.shareCode)).slice(0, 20),
      });
    }
  }

  return {
    issuerId: investorId,
    shareCode: firstName,
    issuerName: firstName,
    holderIds: allHolderIds,
    holderNamesById,
    cells,
  };
}
