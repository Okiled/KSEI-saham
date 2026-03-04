import { getInvestorId } from "./graph";
import type { OwnershipRow } from "../types/ownership";
import type { InvestorTag } from "../store/app-store";

export type InvestorLabelRule = {
  match: string;
  tags: InvestorTag[];
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeTag(tag: string): InvestorTag | null {
  const clean = normalizeText(tag).toUpperCase();
  if (clean === "KONGLO" || clean === "PEP") return clean;
  return null;
}

export function sanitizeInvestorLabelRules(payload: unknown): InvestorLabelRule[] {
  if (!Array.isArray(payload)) return [];

  return payload
    .filter((item): item is { match: string; tags: string[] } => {
      if (typeof item !== "object" || item === null) return false;
      const rule = item as { match?: unknown; tags?: unknown };
      return typeof rule.match === "string" && Array.isArray(rule.tags);
    })
    .map((item) => {
      const match = normalizeText(item.match).toUpperCase();
      const tags = item.tags
        .map((tag) => (typeof tag === "string" ? normalizeTag(tag) : null))
        .filter((tag): tag is InvestorTag => tag !== null);
      return { match, tags };
    })
    .filter((rule) => rule.match.length > 0 && rule.tags.length > 0);
}

export function buildInvestorTagMap(
  rows: OwnershipRow[],
  rules: InvestorLabelRule[],
): Record<string, InvestorTag[]> {
  if (rows.length === 0 || rules.length === 0) return {};

  const byId = new Map<string, Set<InvestorTag>>();
  const seenNameByInvestor = new Map<string, string>();

  for (const row of rows) {
    const investorId = getInvestorId(row);
    if (!seenNameByInvestor.has(investorId)) {
      seenNameByInvestor.set(investorId, normalizeText(row.investorName).toUpperCase());
    }
  }

  for (const [investorId, investorName] of seenNameByInvestor.entries()) {
    for (const rule of rules) {
      if (!investorName.includes(rule.match)) continue;
      if (!byId.has(investorId)) byId.set(investorId, new Set<InvestorTag>());
      const bucket = byId.get(investorId);
      if (!bucket) continue;
      for (const tag of rule.tags) bucket.add(tag);
    }
  }

  return Object.fromEntries(
    [...byId.entries()].map(([investorId, tags]) => [investorId, [...tags]]),
  );
}
