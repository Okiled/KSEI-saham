import Fuse from "fuse.js";
import { getInvestorId, getIssuerId } from "./graph";
import type { FiltersState, InvestorTag } from "../store/app-store";
import type { OwnershipRow } from "../types/ownership";

type RowStatus = "L" | "A" | "U";

type IssuerIndexItem = {
  issuerId: string;
  shareCode: string;
  issuerName: string;
};

type InvestorIndexItem = {
  investorId: string;
  investorName: string;
  investorType: string;
  nationality: string;
  domicile: string;
};

export type SearchIndices = {
  issuerItems: IssuerIndexItem[];
  investorItems: InvestorIndexItem[];
  issuerFuse: Fuse<IssuerIndexItem>;
  investorFuse: Fuse<InvestorIndexItem>;
};

export type FilteredIssuer = {
  issuerId: string;
  shareCode: string;
  issuerName: string;
  rowCount: number;
  totalPercentage: number;
  totalShares: number;
};

export type FilteredInvestor = {
  investorId: string;
  investorName: string;
  investorType: string;
  rowCount: number;
  totalPercentage: number;
  totalShares: number;
};

type QueryIntent = {
  cleanQuery: string;
  statusIntent: Set<RowStatus>;
};

type QuerySignature = {
  full: string;
  tokens: string[];
  shortStrict: boolean;
};

const LOCAL_WORDS = new Set(["lokal", "local", "domestic", "l"]);
const FOREIGN_WORDS = new Set(["asing", "foreign", "a"]);
const UNKNOWN_WORDS = new Set(["unknown", "tidakdiketahui", "unk", "null", "blank"]);

let lastWarnInvalidPctCount = -1;

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeUpper(value: string | null | undefined): string {
  return normalizeText(value).toUpperCase();
}

function normalizeSearchText(value: string | null | undefined): string {
  return normalizeUpper(value).replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenizeSearch(value: string): string[] {
  if (!value) return [];
  return value
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function buildQuerySignature(cleanQuery: string): QuerySignature {
  const full = normalizeSearchText(cleanQuery);
  const tokens = tokenizeSearch(full);
  return {
    full,
    tokens,
    shortStrict: tokens.length === 1 && tokens[0].length <= 3,
  };
}

function scoreByFields(signature: QuerySignature, primaryFields: string[], secondaryFields: string[]): number {
  if (!signature.full || signature.tokens.length === 0) return 0;

  const primaryTexts = primaryFields.map((value) => normalizeSearchText(value)).filter(Boolean);
  const secondaryTexts = secondaryFields.map((value) => normalizeSearchText(value)).filter(Boolean);
  const allTexts = [...primaryTexts, ...secondaryTexts];
  if (allTexts.length === 0) return 0;

  const primaryWords = primaryTexts.flatMap((text) => tokenizeSearch(text));
  const allWords = allTexts.flatMap((text) => tokenizeSearch(text));
  const allCombined = ` ${allTexts.join(" ")} `;

  let score = 0;

  if (primaryTexts.some((text) => text === signature.full)) score += 1200;
  else if (primaryTexts.some((text) => text.startsWith(signature.full))) score += 820;
  else if (!signature.shortStrict && allTexts.some((text) => text.includes(signature.full))) score += 280;

  for (const token of signature.tokens) {
    let tokenScore = 0;

    if (primaryWords.includes(token)) tokenScore = 220;
    else if (primaryWords.some((word) => word.startsWith(token))) tokenScore = 170;
    else if (allWords.includes(token)) tokenScore = 130;
    else if (allWords.some((word) => word.startsWith(token))) tokenScore = 100;
    else if (!signature.shortStrict && allCombined.includes(` ${token} `)) tokenScore = 70;
    else if (!signature.shortStrict && allCombined.includes(token)) tokenScore = 40;

    if (tokenScore === 0) return 0;
    score += tokenScore;
  }

  score += Math.max(0, 50 - Math.floor(allCombined.length / 14));
  return score;
}

export function scoreIssuerRelevance(query: string, shareCode: string, issuerName: string): number {
  const signature = buildQuerySignature(query);
  if (!signature.full) return 0;
  return scoreByFields(signature, [shareCode, issuerName], []);
}

export function scoreInvestorRelevance(
  query: string,
  investorName: string,
  investorType: string,
  nationality: string,
  domicile: string,
): number {
  const signature = buildQuerySignature(query);
  if (!signature.full) return 0;
  return scoreByFields(signature, [investorName], [investorType, nationality, domicile]);
}

function normalizeBucket(value: string | null | undefined): string {
  const text = normalizeUpper(value);
  return text || "UNKNOWN";
}

function rowStatusOf(row: OwnershipRow): RowStatus {
  if (row.localForeign === "L") return "L";
  if (row.localForeign === "A") return "A";
  return "U";
}

function parseQueryIntent(queryText: string): QueryIntent {
  const tokens = normalizeText(queryText)
    .split(" ")
    .map((token) => token.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);

  const statusIntent = new Set<RowStatus>();
  const kept: string[] = [];

  for (const token of tokens) {
    if (LOCAL_WORDS.has(token)) {
      statusIntent.add("L");
      continue;
    }
    if (FOREIGN_WORDS.has(token)) {
      statusIntent.add("A");
      continue;
    }
    if (UNKNOWN_WORDS.has(token)) {
      statusIntent.add("U");
      continue;
    }
    kept.push(token);
  }

  return {
    cleanQuery: kept.join(" "),
    statusIntent,
  };
}

function effectiveStatusSet(filters: FiltersState): Set<RowStatus> {
  const set = new Set<RowStatus>();
  if (filters.localEnabled) set.add("L");
  if (filters.foreignEnabled) set.add("A");
  if (filters.unknownEnabled) set.add("U");
  if (set.size === 0) {
    set.add("L");
    set.add("A");
    set.add("U");
  }
  return set;
}

function applyQueryWhitelist(
  filters: FiltersState,
  cleanQuery: string,
  indices: SearchIndices,
): { issuerWhitelist: Set<string> | null; investorWhitelist: Set<string> | null } {
  if (!cleanQuery) {
    return { issuerWhitelist: null, investorWhitelist: null };
  }

  if (filters.queryMode === "issuer") {
    const issuerWhitelist = new Set(
      indices.issuerItems
        .map((item) => ({
          id: item.issuerId,
          score: scoreIssuerRelevance(cleanQuery, item.shareCode, item.issuerName),
        }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 400)
        .map((item) => item.id),
    );
    return { issuerWhitelist, investorWhitelist: null };
  }

  if (filters.queryMode === "investor") {
    const investorWhitelist = new Set(
      indices.investorItems
        .map((item) => ({
          id: item.investorId,
          score: scoreInvestorRelevance(
            cleanQuery,
            item.investorName,
            item.investorType,
            item.nationality,
            item.domicile,
          ),
        }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 600)
        .map((item) => item.id),
    );
    return { issuerWhitelist: null, investorWhitelist };
  }

  const issuerWhitelist = new Set(
    indices.issuerItems
      .map((item) => ({
        id: item.issuerId,
        score: scoreIssuerRelevance(cleanQuery, item.shareCode, item.issuerName),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 400)
      .map((item) => item.id),
  );
  const investorWhitelist = new Set(
    indices.investorItems
      .map((item) => ({
        id: item.investorId,
        score: scoreInvestorRelevance(
          cleanQuery,
          item.investorName,
          item.investorType,
          item.nationality,
          item.domicile,
        ),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 600)
      .map((item) => item.id),
  );
  return { issuerWhitelist, investorWhitelist };
}

function hasAnyTag(selected: Set<InvestorTag>, tags: InvestorTag[] | undefined): boolean {
  if (!tags || tags.length === 0) return false;
  for (const tag of tags) {
    if (selected.has(tag)) return true;
  }
  return false;
}

export function buildSearchIndices(rows: OwnershipRow[]): SearchIndices {
  const issuerMap = new Map<string, IssuerIndexItem>();
  const investorMap = new Map<string, InvestorIndexItem>();

  for (const row of rows) {
    const issuerId = getIssuerId(row);
    if (!issuerMap.has(issuerId)) {
      issuerMap.set(issuerId, {
        issuerId,
        shareCode: normalizeUpper(row.shareCode),
        issuerName: normalizeText(row.issuerName),
      });
    }

    const investorId = getInvestorId(row);
    if (!investorMap.has(investorId)) {
      investorMap.set(investorId, {
        investorId,
        investorName: normalizeText(row.investorName),
        investorType: normalizeBucket(row.investorType),
        nationality: normalizeBucket(row.nationality),
        domicile: normalizeBucket(row.domicile),
      });
    }
  }

  const issuerItems = [...issuerMap.values()];
  const investorItems = [...investorMap.values()];

  const issuerFuse = new Fuse(issuerItems, {
    threshold: 0.32,
    ignoreLocation: true,
    minMatchCharLength: 1,
    keys: [
      { name: "shareCode", weight: 0.6 },
      { name: "issuerName", weight: 0.4 },
    ],
  });

  const investorFuse = new Fuse(investorItems, {
    threshold: 0.34,
    ignoreLocation: true,
    minMatchCharLength: 1,
    keys: [
      { name: "investorName", weight: 0.6 },
      { name: "investorType", weight: 0.2 },
      { name: "nationality", weight: 0.1 },
      { name: "domicile", weight: 0.1 },
    ],
  });

  return {
    issuerItems,
    investorItems,
    issuerFuse,
    investorFuse,
  };
}

export function applyFilters(
  rows: OwnershipRow[],
  filters: FiltersState,
  indices: SearchIndices,
  investorTagsById: Record<string, InvestorTag[]> = {},
): OwnershipRow[] {
  if (rows.length === 0) return [];

  const { cleanQuery, statusIntent } = parseQueryIntent(filters.queryText);
  const { issuerWhitelist, investorWhitelist } = applyQueryWhitelist(filters, cleanQuery, indices);

  const statusByToggle = effectiveStatusSet(filters);
  const statusByIntent = statusIntent.size > 0 ? statusIntent : new Set<RowStatus>(["L", "A", "U"]);

  let invalidPctDropped = 0;

  const filtered = rows.filter((row) => {
    const rowStatus = rowStatusOf(row);
    if (!statusByToggle.has(rowStatus) || !statusByIntent.has(rowStatus)) return false;

    if (row.percentage === null) {
      if (!filters.includeUnknownPercentage) return false;
    } else {
      if (Number.isNaN(row.percentage) || row.percentage < 0 || row.percentage > 100) {
        invalidPctDropped += 1;
        return false;
      }
      if (row.percentage < filters.minPercentage) return false;
    }

    const investorType = normalizeBucket(row.investorType);
    if (filters.investorTypes.size > 0 && !filters.investorTypes.has(investorType)) return false;

    const nationality = normalizeBucket(row.nationality);
    if (!filters.unknownEnabled && nationality === "UNKNOWN") return false;
    if (filters.nationalities.size > 0 && !filters.nationalities.has(nationality)) return false;

    const domicile = normalizeBucket(row.domicile);
    if (!filters.unknownEnabled && domicile === "UNKNOWN") return false;
    if (filters.domiciles.size > 0 && !filters.domiciles.has(domicile)) return false;

    const investorId = getInvestorId(row);
    if (filters.tagFilters.size > 0) {
      const tags = investorTagsById[investorId];
      if (!hasAnyTag(filters.tagFilters, tags)) return false;
    }

    if (cleanQuery) {
      const issuerId = getIssuerId(row);

      if (filters.queryMode === "issuer") {
        return issuerWhitelist?.has(issuerId) ?? false;
      }
      if (filters.queryMode === "investor") {
        return investorWhitelist?.has(investorId) ?? false;
      }

      const issuerMatch = issuerWhitelist?.has(issuerId) ?? false;
      const investorMatch = investorWhitelist?.has(investorId) ?? false;
      if (!issuerMatch && !investorMatch) return false;
    }

    return true;
  });

  if (import.meta.env.DEV && invalidPctDropped > 0 && invalidPctDropped !== lastWarnInvalidPctCount) {
    lastWarnInvalidPctCount = invalidPctDropped;
    console.warn(`[filters] dropped ${invalidPctDropped} rows with invalid percentage value`);
  }

  return filtered;
}

export function aggregateIssuers(rows: OwnershipRow[]): FilteredIssuer[] {
  const map = new Map<string, FilteredIssuer>();

  for (const row of rows) {
    const issuerId = getIssuerId(row);
    if (!map.has(issuerId)) {
      map.set(issuerId, {
        issuerId,
        shareCode: row.shareCode,
        issuerName: row.issuerName,
        rowCount: 0,
        totalPercentage: 0,
        totalShares: 0,
      });
    }

    const issuer = map.get(issuerId);
    if (!issuer) continue;
    issuer.rowCount += 1;
    issuer.totalPercentage += row.percentage ?? 0;
    issuer.totalShares += row.totalHoldingShares ?? 0;
  }

  return [...map.values()].sort((a, b) => b.totalShares - a.totalShares || b.totalPercentage - a.totalPercentage);
}

export function aggregateInvestors(rows: OwnershipRow[]): FilteredInvestor[] {
  const map = new Map<string, FilteredInvestor>();

  for (const row of rows) {
    const investorId = getInvestorId(row);
    if (!map.has(investorId)) {
      map.set(investorId, {
        investorId,
        investorName: row.investorName,
        investorType: normalizeBucket(row.investorType),
        rowCount: 0,
        totalPercentage: 0,
        totalShares: 0,
      });
    }

    const investor = map.get(investorId);
    if (!investor) continue;
    investor.rowCount += 1;
    investor.totalPercentage += row.percentage ?? 0;
    investor.totalShares += row.totalHoldingShares ?? 0;
  }

  return [...map.values()].sort((a, b) => b.totalShares - a.totalShares || b.totalPercentage - a.totalPercentage);
}

export function topRowsByPercentage(rows: OwnershipRow[], topN: number): OwnershipRow[] {
  const sorted = [...rows].sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0));
  if (topN <= 0) return sorted;
  return sorted.slice(0, topN);
}
