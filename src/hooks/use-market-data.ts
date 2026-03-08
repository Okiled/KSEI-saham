import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildPriceMap,
  chunkTickers,
  mergeMarketDataResponses,
  normalizeTickerList,
  type MarketDataApiResponse,
  type MarketDataMap,
} from "../lib/market-data";

interface UseMarketDataResult {
  prices: Record<string, number>;
  marketData: MarketDataMap;
  updatedAt: string | null;
  loading: boolean;
  error: string | null;
}

type CachedTickerEntry = {
  value: MarketDataMap[string];
  updatedAt: string | null;
  expiresAt: number;
};

const SUCCESS_CACHE_TTL_MS = 60 * 60 * 1000;
const FAILURE_CACHE_TTL_MS = 5 * 60 * 1000;

const tickerCache = new Map<string, CachedTickerEntry>();
const inflightChunkRequests = new Map<string, Promise<MarketDataApiResponse>>();

function buildStateFromCache(tickers: string[]): UseMarketDataResult & { missingTickers: string[] } {
  const marketData: MarketDataMap = {};
  const missingTickers: string[] = [];
  let updatedAt: string | null = null;

  for (const ticker of tickers) {
    const cached = tickerCache.get(ticker);
    if (!cached || cached.expiresAt <= Date.now()) {
      missingTickers.push(ticker);
      continue;
    }

    marketData[ticker] = cached.value;
    if (cached.updatedAt && (!updatedAt || cached.updatedAt > updatedAt)) {
      updatedAt = cached.updatedAt;
    }
  }

  return {
    prices: buildPriceMap(marketData),
    marketData,
    updatedAt,
    loading: missingTickers.length > 0 && tickers.length > 0,
    error: null,
    missingTickers,
  };
}

function cacheApiResponse(response: MarketDataApiResponse) {
  for (const [ticker, entry] of Object.entries(response.data)) {
    tickerCache.set(ticker, {
      value: entry,
      updatedAt: response.updatedAt ?? null,
      expiresAt: Date.now() + (entry ? SUCCESS_CACHE_TTL_MS : FAILURE_CACHE_TTL_MS),
    });
  }
}

async function fetchTickerChunk(chunk: string[]): Promise<MarketDataApiResponse> {
  const key = chunk.join(",");
  const existing = inflightChunkRequests.get(key);
  if (existing) return existing;

  const promise = fetch(`/api/prices?tickers=${encodeURIComponent(key)}`)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as Partial<MarketDataApiResponse>;
      if (!payload || typeof payload !== "object" || typeof payload.data !== "object" || typeof payload.updatedAt !== "string") {
        throw new Error("invalid market data payload");
      }

      return {
        updatedAt: payload.updatedAt,
        data: payload.data as MarketDataMap,
      };
    })
    .finally(() => {
      inflightChunkRequests.delete(key);
    });

  inflightChunkRequests.set(key, promise);
  return promise;
}

export function useMarketData(tickers: string[]): UseMarketDataResult {
  const requestKey = useMemo(() => normalizeTickerList(tickers).join(","), [tickers]);
  const normalizedTickers = useMemo(() => (requestKey ? requestKey.split(",") : []), [requestKey]);
  const requestIdRef = useRef(0);

  const [state, setState] = useState<UseMarketDataResult>(() => {
    const cached = buildStateFromCache(normalizedTickers);
    return {
      prices: cached.prices,
      marketData: cached.marketData,
      updatedAt: cached.updatedAt,
      loading: cached.loading,
      error: null,
    };
  });

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (normalizedTickers.length === 0) {
      setState({
        prices: {},
        marketData: {},
        updatedAt: null,
        loading: false,
        error: null,
      });
      return;
    }

    const cached = buildStateFromCache(normalizedTickers);
    setState({
      prices: cached.prices,
      marketData: cached.marketData,
      updatedAt: cached.updatedAt,
      loading: cached.loading,
      error: null,
    });

    if (cached.missingTickers.length === 0) {
      return;
    }

    let cancelled = false;

    void Promise.allSettled(chunkTickers(cached.missingTickers, 50).map((chunk) => fetchTickerChunk(chunk))).then((results) => {
      if (cancelled || requestIdRef.current !== requestId) return;

      const fulfilled = results
        .filter((result): result is PromiseFulfilledResult<MarketDataApiResponse> => result.status === "fulfilled")
        .map((result) => result.value);

      for (const response of fulfilled) {
        cacheApiResponse(response);
      }

      const nextCached = buildStateFromCache(normalizedTickers);
      const merged = fulfilled.length > 0 ? mergeMarketDataResponses(fulfilled) : null;
      const failed = results.find((result) => result.status === "rejected") as PromiseRejectedResult | undefined;

      setState({
        prices: nextCached.prices,
        marketData: nextCached.marketData,
        updatedAt: nextCached.updatedAt ?? merged?.updatedAt ?? null,
        loading: false,
        error: failed ? "Harga pasar belum bisa dimuat sepenuhnya." : null,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [normalizedTickers, requestKey]);

  return state;
}
