import { getInvestorId, getIssuerId } from "./graph";
import type { OwnershipRow } from "../types/ownership";

export type DomicileCategory = "TAX_HAVEN" | "SOVEREIGN" | "WESTERN" | "OTHER";

export type DomicilePatternInvestor = {
  id: string;
  name: string;
  percentage: number;
  domicile: string | null;
};

export type CoordinatedBlocPattern = {
  id: string;
  issuerId: string;
  shareCode: string;
  issuerName: string;
  domicileCategory: Exclude<DomicileCategory, "OTHER">;
  combinedPct: number;
  entityCount: number;
  investors: DomicilePatternInvestor[];
  disclaimerKey: "coordinated-bloc";
};

const DOMICILE_PATTERNS: Record<Exclude<DomicileCategory, "OTHER">, string[]> = {
  TAX_HAVEN: ["cayman islands", "british virgin islands", "mauritius", "luxembourg", "labuan"],
  SOVEREIGN: ["norway", "singapore", "malaysia", "abu dhabi"],
  WESTERN: ["united states", "united kingdom", "netherlands", "switzerland"],
};

function normalizeDomicile(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safePct(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) return 0;
  return Math.max(0, value);
}

function rowsAtSnapshot(rows: OwnershipRow[], snapshotDate: string | null): OwnershipRow[] {
  if (!snapshotDate) return rows;
  return rows.filter((row) => row.date === snapshotDate);
}

export function getDomicileCategory(domicile: string | null | undefined): DomicileCategory {
  const normalized = normalizeDomicile(domicile);
  if (!normalized) return "OTHER";

  for (const [category, patterns] of Object.entries(DOMICILE_PATTERNS) as Array<
    [Exclude<DomicileCategory, "OTHER">, string[]]
  >) {
    if (patterns.some((pattern) => normalized.includes(pattern))) {
      return category;
    }
  }

  return "OTHER";
}

export function detectCoordinatedBloc(
  rows: OwnershipRow[],
  snapshotDate: string | null,
): CoordinatedBlocPattern[] {
  const scopedRows = rowsAtSnapshot(rows, snapshotDate);
  const issuerMap = new Map<string, OwnershipRow[]>();

  for (const row of scopedRows) {
    const issuerId = getIssuerId(row);
    if (!issuerMap.has(issuerId)) issuerMap.set(issuerId, []);
    issuerMap.get(issuerId)!.push(row);
  }

  const patterns: CoordinatedBlocPattern[] = [];

  for (const [issuerId, issuerRows] of issuerMap.entries()) {
    const categoryBuckets = new Map<Exclude<DomicileCategory, "OTHER">, OwnershipRow[]>();

    for (const row of issuerRows) {
      const pct = safePct(row.percentage);
      if (pct < 3 || pct > 6) continue;

      const category = getDomicileCategory(row.domicile);
      if (category === "OTHER") continue;

      if (!categoryBuckets.has(category)) categoryBuckets.set(category, []);
      categoryBuckets.get(category)!.push(row);
    }

    for (const [domicileCategory, matchedRows] of categoryBuckets.entries()) {
      if (matchedRows.length < 2) continue;

      const combinedPct = matchedRows.reduce((sum, row) => sum + safePct(row.percentage), 0);
      if (combinedPct < 10) continue;

      const first = matchedRows[0];
      const investors = [...matchedRows]
        .sort((left, right) => safePct(right.percentage) - safePct(left.percentage))
        .map((row) => ({
          id: getInvestorId(row),
          name: row.investorName,
          percentage: safePct(row.percentage),
          domicile: row.domicile,
        }));

      patterns.push({
        id: `bloc-${issuerId}-${domicileCategory.toLowerCase()}`,
        issuerId,
        shareCode: first.shareCode,
        issuerName: first.issuerName,
        domicileCategory,
        combinedPct: +combinedPct.toFixed(2),
        entityCount: investors.length,
        investors,
        disclaimerKey: "coordinated-bloc",
      });
    }
  }

  return patterns.sort((left, right) => {
    if (right.combinedPct !== left.combinedPct) {
      return right.combinedPct - left.combinedPct;
    }
    return right.entityCount - left.entityCount;
  });
}
