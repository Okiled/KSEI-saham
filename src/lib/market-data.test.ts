import { describe, expect, it } from "vitest";
import {
  buildPriceMap,
  chunkTickers,
  getPositionValueIDR,
  mergeMarketDataResponses,
  normalizeTickerList,
} from "./market-data";

describe("market data helpers", () => {
  it("normalizes, deduplicates, and sorts tickers", () => {
    expect(normalizeTickerList([" bbca ", "BMRI", "bbca", "", null, "   ", "bad ticker!"])).toEqual([
      "BBCA",
      "BMRI",
    ]);
  });

  it("chunks tickers by max request size", () => {
    expect(chunkTickers(["A", "B", "C", "D", "E"], 2)).toEqual([
      ["A", "B"],
      ["C", "D"],
      ["E"],
    ]);
  });

  it("merges market data payloads and keeps latest updatedAt", () => {
    expect(
      mergeMarketDataResponses([
        {
          updatedAt: "2026-03-08T00:00:00.000Z",
          data: {
            BBCA: { price: 9200, avgVolume30d: 1, marketCap: 2, pe: 3, pb: 4, divYield: 5, sharesOutstanding: 6 },
          },
        },
        {
          updatedAt: "2026-03-08T01:00:00.000Z",
          data: {
            BMRI: { price: 5100, avgVolume30d: 10, marketCap: 20, pe: 30, pb: 40, divYield: 50, sharesOutstanding: 60 },
          },
        },
      ]),
    ).toEqual({
      updatedAt: "2026-03-08T01:00:00.000Z",
      data: {
        BBCA: { price: 9200, avgVolume30d: 1, marketCap: 2, pe: 3, pb: 4, divYield: 5, sharesOutstanding: 6 },
        BMRI: { price: 5100, avgVolume30d: 10, marketCap: 20, pe: 30, pb: 40, divYield: 50, sharesOutstanding: 60 },
      },
    });
  });

  it("builds a price map from populated market data only", () => {
    expect(
      buildPriceMap({
        BBCA: { price: 9200, avgVolume30d: 0, marketCap: 0, pe: 0, pb: 0, divYield: 0, sharesOutstanding: 0 },
        BMRI: null,
        BBRI: { price: 0, avgVolume30d: 0, marketCap: 0, pe: 0, pb: 0, divYield: 0, sharesOutstanding: 0 },
      }),
    ).toEqual({
      BBCA: 9200,
    });
  });

  it("calculates disclosed position value in IDR", () => {
    expect(getPositionValueIDR(1_000_000, 9250)).toBe(9_250_000_000);
    expect(getPositionValueIDR(0, 9250)).toBeNull();
    expect(getPositionValueIDR(1_000_000, 0)).toBeNull();
  });
});
