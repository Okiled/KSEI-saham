import { normalizeTickerList, type MarketDataApiResponse, type MarketDataEntry } from "../../src/lib/market-data";

export const MAX_TICKERS_PER_REQUEST = 50;

const SUCCESS_CACHE_TTL_MS = 60 * 60 * 1000;
const FAILURE_CACHE_TTL_MS = 5 * 60 * 1000;

type CachedTicker = {
  value: MarketDataEntry | null;
  expiresAt: number;
};

type ApiResponseShape = {
  status: number;
  headers: Record<string, string>;
  payload: unknown;
};

type YahooChartPayload = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: unknown;
        previousClose?: unknown;
        chartPreviousClose?: unknown;
        averageDailyVolume3Month?: unknown;
        marketCap?: unknown;
        trailingPE?: unknown;
        priceToBook?: unknown;
        dividendYield?: unknown;
        sharesOutstanding?: unknown;
      };
      indicators?: {
        quote?: Array<{
          close?: unknown[];
        }>;
      };
    }>;
  };
};

const tickerCache = new Map<string, CachedTicker>();

function jsonResponse(status: number, payload: unknown): ApiResponseShape {
  return {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    },
    payload,
  };
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function firstPositiveNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const next = toNumber(value);
    if (next > 0) return next;
  }
  return null;
}

function getLastPositiveClose(values: unknown[] | undefined): number | null {
  if (!Array.isArray(values)) return null;

  for (let index = values.length - 1; index >= 0; index -= 1) {
    const next = toNumber(values[index]);
    if (next > 0) return next;
  }

  return null;
}

export function parseYahooChartMarketData(payload: YahooChartPayload): MarketDataEntry | null {
  const result = payload.chart?.result?.[0];
  const meta = result?.meta;
  const closes = result?.indicators?.quote?.[0]?.close;
  const price = firstPositiveNumber(
    meta?.regularMarketPrice,
    getLastPositiveClose(closes),
    meta?.previousClose,
    meta?.chartPreviousClose,
  );

  if (!price) return null;

  return {
    price,
    avgVolume30d: toNumber(meta?.averageDailyVolume3Month),
    marketCap: toNumber(meta?.marketCap),
    pe: toNumber(meta?.trailingPE),
    pb: toNumber(meta?.priceToBook),
    divYield: toNumber(meta?.dividendYield),
    sharesOutstanding: toNumber(meta?.sharesOutstanding),
  };
}

async function fetchTickerFromYahoo(ticker: string): Promise<MarketDataEntry | null> {
  try {
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.JK?range=1mo&interval=1d`, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as YahooChartPayload;
    return parseYahooChartMarketData(payload);
  } catch {
    return null;
  }
}

async function getTickerMarketData(ticker: string): Promise<MarketDataEntry | null> {
  const cached = tickerCache.get(ticker);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const value = await fetchTickerFromYahoo(ticker);
  tickerCache.set(ticker, {
    value,
    expiresAt: Date.now() + (value ? SUCCESS_CACHE_TTL_MS : FAILURE_CACHE_TTL_MS),
  });
  return value;
}

export async function handlePricesRequest(rawTickers: string | string[] | undefined): Promise<ApiResponseShape> {
  const joined = Array.isArray(rawTickers) ? rawTickers.join(",") : rawTickers ?? "";
  const tickers = normalizeTickerList(joined.split(","));

  if (tickers.length === 0) {
    return jsonResponse(400, {
      error: "tickers query parameter is required",
    });
  }

  if (tickers.length > MAX_TICKERS_PER_REQUEST) {
    return jsonResponse(400, {
      error: `maximum ${MAX_TICKERS_PER_REQUEST} tickers per request`,
    });
  }

  const entries = await Promise.all(
    tickers.map(async (ticker) => {
      const value = await getTickerMarketData(ticker);
      return [ticker, value] as const;
    }),
  );

  const payload: MarketDataApiResponse = {
    updatedAt: new Date().toISOString(),
    data: Object.fromEntries(entries),
  };

  return jsonResponse(200, payload);
}
