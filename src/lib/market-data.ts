export interface MarketDataEntry {
  price: number;
  avgVolume30d: number;
  marketCap: number;
  pe: number;
  pb: number;
  divYield: number;
  sharesOutstanding: number;
}

export interface MarketDataMap {
  [ticker: string]: MarketDataEntry | null;
}

export interface MarketDataApiResponse {
  updatedAt: string;
  data: MarketDataMap;
}

const TICKER_PATTERN = /^[A-Z0-9.-]{2,12}$/;

export function normalizeTickerList(tickers: Array<string | null | undefined>): string[] {
  const unique = new Set<string>();

  for (const ticker of tickers) {
    const normalized = (ticker ?? "").trim().toUpperCase();
    if (!normalized || !TICKER_PATTERN.test(normalized)) continue;
    unique.add(normalized);
  }

  return [...unique].sort();
}

export function chunkTickers(tickers: string[], chunkSize = 50): string[][] {
  if (chunkSize <= 0) return [tickers];

  const chunks: string[][] = [];
  for (let index = 0; index < tickers.length; index += chunkSize) {
    chunks.push(tickers.slice(index, index + chunkSize));
  }
  return chunks;
}

export function mergeMarketDataResponses(responses: MarketDataApiResponse[]): MarketDataApiResponse {
  const data: MarketDataMap = {};
  let updatedAt = "";

  for (const response of responses) {
    if (response.updatedAt && (!updatedAt || response.updatedAt > updatedAt)) {
      updatedAt = response.updatedAt;
    }
    Object.assign(data, response.data);
  }

  return {
    updatedAt,
    data,
  };
}

export function buildPriceMap(marketData: MarketDataMap): Record<string, number> {
  const prices: Record<string, number> = {};

  for (const [ticker, entry] of Object.entries(marketData)) {
    if (!entry || !Number.isFinite(entry.price) || entry.price <= 0) continue;
    prices[ticker] = entry.price;
  }

  return prices;
}

export function getPositionValueIDR(shares: number, price?: number | null): number | null {
  if (!Number.isFinite(shares) || shares <= 0) return null;
  if (!Number.isFinite(price) || (price ?? 0) <= 0) return null;
  return shares * (price ?? 0);
}
