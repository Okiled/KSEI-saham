import { describe, expect, it } from "vitest";
import { buildInvestorTagMap, sanitizeInvestorLabelRules } from "./investor-tags";
import type { OwnershipRow } from "../types/ownership";

function makeRow(overrides: Partial<OwnershipRow>): OwnershipRow {
  return {
    id: overrides.id ?? "row-1",
    date: overrides.date ?? "08-Mar-2026",
    shareCode: overrides.shareCode ?? "AAAA",
    issuerName: overrides.issuerName ?? "Alpha Tbk",
    investorName: overrides.investorName ?? "Investor Alpha",
    investorType: overrides.investorType ?? "CP",
    localForeign: overrides.localForeign ?? "L",
    nationality: overrides.nationality ?? "Indonesia",
    domicile: overrides.domicile ?? "Jakarta",
    holdingsScripless: overrides.holdingsScripless ?? null,
    holdingsScrip: overrides.holdingsScrip ?? null,
    totalHoldingShares: overrides.totalHoldingShares ?? 100,
    percentage: overrides.percentage ?? 10,
    evidence: overrides.evidence ?? {
      pageIndex: 0,
      yTopNorm: 0,
      yBottomNorm: 0,
      rawRowText: "sample",
    },
  };
}

describe("investor tag rules", () => {
  it("sanitizes only supported public tags", () => {
    const rules = sanitizeInvestorLabelRules([
      { match: " alpha  ", tags: ["konglo", "pep", "SWF"] },
      { match: "", tags: ["PEP"] },
      { match: "beta", tags: ["unknown"] },
      null,
    ]);

    expect(rules).toEqual([
      { match: "ALPHA", tags: ["KONGLO", "PEP"] },
    ]);
  });

  it("builds a tag map only from curated label rules", () => {
    const rows = [
      makeRow({ investorName: "Alpha Capital Group", issuerName: "Alpha Tbk" }),
      makeRow({ id: "row-2", investorName: "Alpha Capital Group", issuerName: "Beta Tbk", shareCode: "BBBB" }),
      makeRow({ id: "row-3", investorName: "Investor Biasa", issuerName: "Gamma Tbk", shareCode: "CCCC" }),
    ];
    const rules = sanitizeInvestorLabelRules([{ match: "alpha capital", tags: ["KONGLO"] }]);

    const tags = buildInvestorTagMap(rows, rules);

    expect(Object.keys(tags)).toHaveLength(1);
    expect(Object.values(tags)[0]).toEqual(["KONGLO"]);
  });
});
