import { describe, expect, it } from "vitest";
import { detectCoordinatedBloc, getDomicileCategory } from "./domicile-intelligence";
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
    totalHoldingShares: overrides.totalHoldingShares ?? 0,
    percentage: overrides.percentage ?? 0,
    evidence: overrides.evidence ?? {
      pageIndex: 0,
      yTopNorm: 0,
      yBottomNorm: 0,
      rawRowText: "sample",
    },
  };
}

describe("domicile intelligence", () => {
  it("classifies raw domicile strings into the supported categories", () => {
    expect(getDomicileCategory("  Cayman   Islands ")).toBe("TAX_HAVEN");
    expect(getDomicileCategory("SINGAPORE")).toBe("SOVEREIGN");
    expect(getDomicileCategory("United Kingdom")).toBe("WESTERN");
    expect(getDomicileCategory("Jakarta")).toBe("OTHER");
    expect(getDomicileCategory("")).toBe("OTHER");
    expect(getDomicileCategory(null)).toBe("OTHER");
  });

  it("detects coordinated domicile blocs only on the active snapshot and only outside OTHER", () => {
    const rows = [
      makeRow({
        id: "old-1",
        date: "01-Mar-2026",
        shareCode: "AAAA",
        issuerName: "Alpha Tbk",
        investorName: "Old Holder",
        domicile: "Singapore",
        percentage: 5,
      }),
      makeRow({
        id: "bloc-1",
        shareCode: "AAAA",
        issuerName: "Alpha Tbk",
        investorName: "Singapore One",
        domicile: "Singapore",
        percentage: 5.2,
      }),
      makeRow({
        id: "bloc-2",
        shareCode: "AAAA",
        issuerName: "Alpha Tbk",
        investorName: "Singapore Two",
        domicile: "Singapore",
        percentage: 4.9,
      }),
      makeRow({
        id: "other-1",
        shareCode: "BBBB",
        issuerName: "Beta Tbk",
        investorName: "Jakarta One",
        domicile: "Jakarta",
        percentage: 5.5,
      }),
      makeRow({
        id: "other-2",
        shareCode: "BBBB",
        issuerName: "Beta Tbk",
        investorName: "Jakarta Two",
        domicile: "Jakarta",
        percentage: 5.1,
      }),
    ];

    const patterns = detectCoordinatedBloc(rows, "08-Mar-2026");

    expect(patterns).toHaveLength(1);
    expect(patterns[0].shareCode).toBe("AAAA");
    expect(patterns[0].domicileCategory).toBe("SOVEREIGN");
    expect(patterns[0].combinedPct).toBe(10.1);
    expect(patterns[0].entityCount).toBe(2);
    expect(patterns[0].disclaimerKey).toBe("coordinated-bloc");
  });
});
