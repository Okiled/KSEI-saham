import { describe, expect, it } from "vitest";
import { buildInvestorStyleProfile, classifyInvestorStyle } from "./style-profiling";
import type { MarketDataMap } from "./market-data";
import type { InvestorPortfolioPosition } from "../types/ownership";

function makePosition(overrides: Partial<InvestorPortfolioPosition> = {}): InvestorPortfolioPosition {
  return {
    investorId: overrides.investorId ?? "investor:alpha",
    investorName: overrides.investorName ?? "Investor Alpha",
    investorType: overrides.investorType ?? "IB",
    localForeign: overrides.localForeign ?? "A",
    nationality: overrides.nationality ?? "Singapore",
    domicile: overrides.domicile ?? "Singapore",
    issuerId: overrides.issuerId ?? "issuer:AAAA",
    shareCode: overrides.shareCode ?? "AAAA",
    issuerName: overrides.issuerName ?? "Alpha Tbk",
    percentage: overrides.percentage ?? 10,
    shares: overrides.shares ?? 100_000_000,
    snapshotDate: overrides.snapshotDate ?? "08-Mar-2026",
  };
}

describe("style profiling", () => {
  it("classifies styles with the expected valuation thresholds", () => {
    expect(classifyInvestorStyle(10, 1.2, 2)).toBe("VALUE");
    expect(classifyInvestorStyle(35, 4, 1)).toBe("GROWTH");
    expect(classifyInvestorStyle(14, 1.8, 5.2)).toBe("DIVIDEND");
    expect(classifyInvestorStyle(14, 1.8, 2, 65)).toBe("SECTOR_SPECIALIST");
    expect(classifyInvestorStyle(18, 2.1, 2.5)).toBe("MIXED");
  });

  it("builds a weighted style profile from market data", () => {
    const positions = [
      makePosition({ shareCode: "AAAA", shares: 200_000_000 }),
      makePosition({ shareCode: "BBBB", issuerId: "issuer:BBBB", issuerName: "Beta Tbk", shares: 100_000_000 }),
    ];

    const marketData: MarketDataMap = {
      AAAA: {
        price: 1_000,
        avgVolume30d: 0,
        marketCap: 0,
        pe: 9,
        pb: 1.1,
        divYield: 0.02,
        sharesOutstanding: 0,
      },
      BBBB: {
        price: 1_000,
        avgVolume30d: 0,
        marketCap: 0,
        pe: 11,
        pb: 1.3,
        divYield: 0.03,
        sharesOutstanding: 0,
      },
    };

    const profile = buildInvestorStyleProfile(positions, marketData);

    expect(profile.style).toBe("VALUE");
    expect(profile.avgPE).toBeCloseTo(9.67, 2);
    expect(profile.avgPB).toBeCloseTo(1.17, 2);
    expect(profile.avgDivYieldPct).toBeCloseTo(2.33, 2);
    expect(profile.coveragePct).toBe(100);
  });

  it("falls back cleanly when valuation coverage is unavailable", () => {
    const profile = buildInvestorStyleProfile([makePosition()], { AAAA: null });

    expect(profile.style).toBe("MIXED");
    expect(profile.avgPE).toBeNull();
    expect(profile.coveragePct).toBe(0);
  });
});
