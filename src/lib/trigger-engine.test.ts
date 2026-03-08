import { describe, expect, it } from "vitest";
import {
  detectFloatPressure,
  detectMandatorySellDown,
  detectShadowAccumulation,
  runTriggerEngine,
} from "./trigger-engine";
import { buildUniverseIssuerItems } from "./ownership-analytics";
import type { MarketDataMap } from "./market-data";
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

describe("trigger engine", () => {
  it("uses excess above 80% for mandatory sell-down and sorts by IDR descending", () => {
    const rows = [
      makeRow({
        id: "sell-1",
        shareCode: "AAAA",
        issuerName: "Alpha Tbk",
        investorName: "Holder A",
        percentage: 85,
        totalHoldingShares: 850_000_000,
      }),
      makeRow({
        id: "sell-2",
        shareCode: "BBBB",
        issuerName: "Beta Tbk",
        investorName: "Holder B",
        percentage: 92,
        totalHoldingShares: 920_000_000,
      }),
    ];

    const marketData: MarketDataMap = {
      AAAA: {
        price: 2_000,
        avgVolume30d: 5_000_000,
        marketCap: 0,
        pe: 0,
        pb: 0,
        divYield: 0,
        sharesOutstanding: 1_000_000_000,
      },
      BBBB: {
        price: 3_000,
        avgVolume30d: 10_000_000,
        marketCap: 0,
        pe: 0,
        pb: 0,
        divYield: 0,
        sharesOutstanding: 1_000_000_000,
      },
    };

    const alerts = detectMandatorySellDown(rows, "08-Mar-2026", marketData);

    expect(alerts[0].shareCode).toBe("BBBB");
    expect(alerts[0].details.sharesToSell).toBe(120_000_000);
    expect(alerts[0].details.idrToSell).toBe(360_000_000_000);
    expect(alerts[1].details.sharesToSell).toBe(50_000_000);
    expect(alerts[1].details.idrToSell).toBe(100_000_000_000);
  });

  it("keeps float-pressure alerts visible even when market data is unavailable", () => {
    const rows = [
      makeRow({
        id: "float-1",
        shareCode: "CCCC",
        issuerName: "Gamma Tbk",
        investorName: "Controller Gamma",
        percentage: 92,
        totalHoldingShares: 920_000_000,
      }),
    ];

    const alerts = detectFloatPressure(rows, "08-Mar-2026", buildUniverseIssuerItems(rows, "08-Mar-2026"), {
      CCCC: null,
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("float-pressure");
    expect(alerts[0].details.freeFloat).toBe(8);
    expect(alerts[0].details.idrRequired).toBeUndefined();
    expect(alerts[0].details.daysToComply).toBeUndefined();
  });

  it("scopes runTriggerEngine to the active snapshot", () => {
    const rows = [
      makeRow({
        id: "old-sell",
        date: "01-Mar-2026",
        shareCode: "DDDD",
        issuerName: "Delta Tbk",
        investorName: "Old Controller",
        percentage: 92,
        totalHoldingShares: 920_000_000,
      }),
      makeRow({
        id: "current-mto",
        date: "08-Mar-2026",
        shareCode: "DDDD",
        issuerName: "Delta Tbk",
        investorName: "Current Holder",
        percentage: 46,
        totalHoldingShares: 460_000_000,
      }),
    ];

    const marketData: MarketDataMap = {
      DDDD: {
        price: 1_500,
        avgVolume30d: 8_000_000,
        marketCap: 0,
        pe: 0,
        pb: 0,
        divYield: 0,
        sharesOutstanding: 1_000_000_000,
      },
    };

    const alerts = runTriggerEngine(
      rows,
      "08-Mar-2026",
      buildUniverseIssuerItems(rows.filter((row) => row.date === "08-Mar-2026"), null),
      marketData,
      {},
    );

    expect(alerts.some((alert) => alert.type === "mandatory-sell-down")).toBe(false);
    expect(alerts.some((alert) => alert.type === "mto-squeeze")).toBe(true);
  });

  it("detects shadow accumulation with the right severity thresholds", () => {
    const rows = [
      makeRow({
        id: "shadow-1",
        shareCode: "EEEE",
        issuerName: "Epsilon Tbk",
        investorName: "Holder One",
        domicile: "Jakarta",
        percentage: 4.2,
      }),
      makeRow({
        id: "shadow-2",
        shareCode: "EEEE",
        issuerName: "Epsilon Tbk",
        investorName: "Holder Two",
        domicile: "Singapore",
        percentage: 4.6,
      }),
      makeRow({
        id: "shadow-3",
        shareCode: "EEEE",
        issuerName: "Epsilon Tbk",
        investorName: "Holder Three",
        domicile: "Cayman Islands",
        percentage: 4.5,
      }),
      makeRow({
        id: "shadow-4",
        shareCode: "FFFF",
        issuerName: "Zeta Tbk",
        investorName: "Holder Four",
        percentage: 4.9,
      }),
      makeRow({
        id: "shadow-5",
        shareCode: "FFFF",
        issuerName: "Zeta Tbk",
        investorName: "Holder Five",
        percentage: 4.8,
      }),
      makeRow({
        id: "shadow-6",
        shareCode: "FFFF",
        issuerName: "Zeta Tbk",
        investorName: "Holder Six",
        percentage: 4.7,
      }),
      makeRow({
        id: "shadow-7",
        shareCode: "FFFF",
        issuerName: "Zeta Tbk",
        investorName: "Holder Seven",
        percentage: 4.6,
      }),
      makeRow({
        id: "shadow-8",
        shareCode: "FFFF",
        issuerName: "Zeta Tbk",
        investorName: "Holder Eight",
        percentage: 4.5,
      }),
    ];

    const alerts = detectShadowAccumulation(rows, "08-Mar-2026");

    expect(alerts).toHaveLength(2);
    expect(alerts[0].shareCode).toBe("FFFF");
    expect(alerts[0].severity).toBe("critical");
    expect(alerts[0].details.combinedPct).toBe(23.5);
    expect(alerts[1].shareCode).toBe("EEEE");
    expect(alerts[1].severity).toBe("medium");
    expect(alerts[1].details.entityCount).toBe(3);
  });

  it("includes coordinated bloc and shadow alerts with investor domicile details", () => {
    const rows = [
      makeRow({
        id: "bloc-1",
        shareCode: "GGGG",
        issuerName: "Gamma Bloc Tbk",
        investorName: "Singapore One",
        domicile: "Singapore",
        percentage: 5.2,
      }),
      makeRow({
        id: "bloc-2",
        shareCode: "GGGG",
        issuerName: "Gamma Bloc Tbk",
        investorName: "Singapore Two",
        domicile: "Singapore",
        percentage: 4.9,
      }),
      makeRow({
        id: "shadow-1",
        shareCode: "HHHH",
        issuerName: "Theta Cluster Tbk",
        investorName: "Cluster One",
        domicile: "Jakarta",
        percentage: 4.3,
      }),
      makeRow({
        id: "shadow-2",
        shareCode: "HHHH",
        issuerName: "Theta Cluster Tbk",
        investorName: "Cluster Two",
        domicile: "Jakarta",
        percentage: 4.1,
      }),
      makeRow({
        id: "shadow-3",
        shareCode: "HHHH",
        issuerName: "Theta Cluster Tbk",
        investorName: "Cluster Three",
        domicile: "Singapore",
        percentage: 4.0,
      }),
    ];

    const alerts = runTriggerEngine(
      rows,
      "08-Mar-2026",
      buildUniverseIssuerItems(rows, "08-Mar-2026"),
      {},
      {},
    );

    const blocAlert = alerts.find((alert) => alert.type === "coordinated-bloc");
    const shadowAlert = alerts.find((alert) => alert.type === "shadow-accumulation");

    expect(blocAlert).toBeDefined();
    expect(blocAlert?.details.domicileCategory).toBe("SOVEREIGN");
    expect(blocAlert?.details.disclaimerKey).toBe("coordinated-bloc");
    expect(blocAlert?.details.investors?.[0].domicile).toBe("Singapore");

    expect(shadowAlert).toBeDefined();
    expect(shadowAlert?.details.combinedPct).toBe(12.4);
    expect(shadowAlert?.details.investors?.[0].domicile).toBe("Jakarta");
  });
});
