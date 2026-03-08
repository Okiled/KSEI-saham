import { describe, expect, it } from "vitest";
import { calcRedemptionRisk, isMutualFundHolder } from "./redemption-risk";
import type { IssuerHolderPosition } from "../types/ownership";

function makeHolder(overrides: Partial<IssuerHolderPosition>): IssuerHolderPosition {
  return {
    issuerId: overrides.issuerId ?? "issuer:AAAA",
    shareCode: overrides.shareCode ?? "AAAA",
    issuerName: overrides.issuerName ?? "Alpha Tbk",
    investorId: overrides.investorId ?? "investor:fund-a",
    investorName: overrides.investorName ?? "REKSA DANA ALPHA FUND",
    investorType: overrides.investorType ?? "MF",
    localForeign: overrides.localForeign ?? "L",
    nationality: overrides.nationality ?? "Indonesia",
    domicile: overrides.domicile ?? "Jakarta",
    percentage: overrides.percentage ?? 4,
    shares: overrides.shares ?? 100_000_000,
  };
}

describe("redemption risk", () => {
  it("detects mutual fund holders from type or explicit fund names", () => {
    expect(isMutualFundHolder("MF", "Anything")).toBe(true);
    expect(isMutualFundHolder("IB", "Reksa Dana Example")).toBe(true);
    expect(isMutualFundHolder("IB", "Government of Norway")).toBe(false);
  });

  it("computes mutual fund pressure and risk flags", () => {
    const holders = [
      makeHolder({ investorId: "investor:fund-1", investorName: "REKSA DANA ALPHA", percentage: 16, shares: 160_000_000 }),
      makeHolder({ investorId: "investor:fund-2", investorName: "REKSA DANA BETA", percentage: 5, shares: 50_000_000 }),
      makeHolder({ investorId: "investor:fund-3", investorName: "REKSA DANA GAMMA", percentage: 4, shares: 40_000_000 }),
      makeHolder({ investorId: "investor:fund-4", investorName: "REKSA DANA DELTA", percentage: 3, shares: 30_000_000 }),
      makeHolder({ investorId: "investor:fund-5", investorName: "REKSA DANA EPSILON", percentage: 2, shares: 20_000_000 }),
      makeHolder({ investorId: "investor:corp", investorName: "PT STRATEGIC HOLDER", investorType: "CP", percentage: 40, shares: 400_000_000 }),
    ];

    const profile = calcRedemptionRisk(holders, {
      price: 1_000,
      avgVolume30d: 0,
      marketCap: 0,
      pe: 0,
      pb: 0,
      divYield: 0,
      sharesOutstanding: 1_000_000_000,
    });

    expect(profile).not.toBeNull();
    expect(profile?.mutualFundPct).toBe(30);
    expect(profile?.mutualFundCount).toBe(5);
    expect(profile?.mutualFundValueIDR).toBe(300_000_000_000);
    expect(profile?.redemption10pctIDR).toBe(30_000_000_000);
    expect(profile?.concentrationRisk).toBe(true);
    expect(profile?.herdingRisk).toBe(true);
    expect(profile?.topMutualFundName).toBe("REKSA DANA ALPHA");
  });
});
