import { describe, expect, it } from "vitest";
import { parseYahooChartMarketData } from "./prices-service";

describe("parseYahooChartMarketData", () => {
  it("prefers regularMarketPrice when Yahoo provides it", () => {
    expect(
      parseYahooChartMarketData({
        chart: {
          result: [
            {
              meta: {
                regularMarketPrice: 9250,
                averageDailyVolume3Month: 123,
                marketCap: 456,
                trailingPE: 7.8,
                priceToBook: 1.2,
                dividendYield: 0.03,
                sharesOutstanding: 999,
              },
              indicators: {
                quote: [{ close: [9100, 9200] }],
              },
            },
          ],
        },
      }),
    ).toEqual({
      price: 9250,
      avgVolume30d: 123,
      marketCap: 456,
      pe: 7.8,
      pb: 1.2,
      divYield: 0.03,
      sharesOutstanding: 999,
    });
  });

  it("uses the last valid Yahoo close when regularMarketPrice is zero", () => {
    expect(
      parseYahooChartMarketData({
        chart: {
          result: [
            {
              meta: {
                regularMarketPrice: 0,
                chartPreviousClose: 29000,
                averageDailyVolume3Month: 321,
              },
              indicators: {
                quote: [{ close: [null, 0, 28500, 29000] }],
              },
            },
          ],
        },
      }),
    ).toEqual({
      price: 29000,
      avgVolume30d: 321,
      marketCap: 0,
      pe: 0,
      pb: 0,
      divYield: 0,
      sharesOutstanding: 0,
    });
  });

  it("returns null when Yahoo has no usable positive price", () => {
    expect(
      parseYahooChartMarketData({
        chart: {
          result: [
            {
              meta: {
                regularMarketPrice: 0,
                previousClose: 0,
                chartPreviousClose: 0,
              },
              indicators: {
                quote: [{ close: [null, 0, undefined] }],
              },
            },
          ],
        },
      }),
    ).toBeNull();
  });
});
