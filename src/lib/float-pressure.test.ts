import { describe, expect, it } from "vitest";
import {
  calcFloatPressure,
  calcMandatorySellDown,
  formatLiquidityDays,
  getFloatStatus,
} from "./float-pressure";

describe("float pressure helpers", () => {
  it("maps free-float thresholds to the expected status", () => {
    expect(getFloatStatus(15)).toBe("COMPLIANT");
    expect(getFloatStatus(10)).toBe("AT_RISK");
    expect(getFloatStatus(7.5)).toBe("NON_COMPLIANT");
  });

  it("calculates shares, idr, and days required to reach 15% float", () => {
    const result = calcFloatPressure({
      freeFloatPct: 12,
      sharesOutstanding: 1_000_000_000,
      price: 5_000,
      avgVolume30d: 10_000_000,
    });

    expect(result.status).toBe("AT_RISK");
    expect(result.sharesRequired).toBe(30_000_000);
    expect(result.idrRequired).toBe(150_000_000_000);
    expect(result.daysToComply).toBe(3);
  });

  it("returns Infinity when float pressure exists but volume is zero", () => {
    const result = calcFloatPressure({
      freeFloatPct: 8,
      sharesOutstanding: 1_000_000_000,
      price: 1_000,
      avgVolume30d: 0,
    });

    expect(result.status).toBe("NON_COMPLIANT");
    expect(result.sharesRequired).toBe(70_000_000);
    expect(result.idrRequired).toBe(70_000_000_000);
    expect(result.daysToComply).toBe(Infinity);
    expect(formatLiquidityDays(result.daysToComply)).toBe("N/A");
  });

  it("calculates mandatory sell-down based on excess above 80%", () => {
    const result = calcMandatorySellDown({
      holderPct: 85,
      sharesOutstanding: 1_000_000_000,
      price: 2_000,
      avgVolume30d: 5_000_000,
    });

    expect(result.sharesToSell).toBe(50_000_000);
    expect(result.idrToSell).toBe(100_000_000_000);
    expect(result.daysToAbsorb).toBe(10);
  });

  it("supports larger sell-down cases and zero-output below the threshold", () => {
    const large = calcMandatorySellDown({
      holderPct: 92,
      sharesOutstanding: 2_000_000_000,
      price: 1_500,
      avgVolume30d: 4_000_000,
    });

    const none = calcMandatorySellDown({
      holderPct: 79.5,
      sharesOutstanding: 2_000_000_000,
      price: 1_500,
      avgVolume30d: 4_000_000,
    });

    expect(large.sharesToSell).toBe(240_000_000);
    expect(large.idrToSell).toBe(360_000_000_000);
    expect(large.daysToAbsorb).toBe(60);

    expect(none.sharesToSell).toBe(0);
    expect(none.idrToSell).toBe(0);
    expect(none.daysToAbsorb).toBe(0);
  });
});
