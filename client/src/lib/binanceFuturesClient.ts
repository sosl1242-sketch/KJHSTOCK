import {
  applyTickerUpdates,
  buildFuturesRows,
  calculateTechnicalIndicators,
  type BinanceFuturesSymbol,
  type BinanceFuturesTicker,
  type BinancePremiumIndex,
  type FuturesCandle,
  type FuturesMarketRow,
  type FuturesMarketType,
  type FuturesTechnicalIndicators,
} from "@shared/binanceFuturesAnalysis";

const USD_M_REST_BASE = "https://fapi.binance.com";
const COIN_M_REST_BASE = "https://dapi.binance.com";
const USD_M_WS_URL = "wss://fstream.binance.com/ws/!ticker@arr";
const COIN_M_WS_URL = "wss://dstream.binance.com/ws/!ticker@arr";

type ExchangeInfoResponse = {
  symbols: BinanceFuturesSymbol[];
};

type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

type BinanceTickerStreamItem = {
  s: string;
  c: string;
  h: string;
  l: string;
  P: string;
  v: string;
  q: string;
  E: number;
};

async function fetchJson<T>(baseUrl: string, path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { signal });
  if (!response.ok) {
    throw new Error(`Binance API ${path} returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function coinMTickerToUnified(ticker: BinanceFuturesTicker): BinanceFuturesTicker {
  return {
    ...ticker,
    baseVolume: ticker.baseVolume ?? ticker.quoteVolume,
    quoteVolume: undefined,
  };
}

async function fetchMarketRows(marketType: FuturesMarketType, signal?: AbortSignal): Promise<FuturesMarketRow[]> {
  const baseUrl = marketType === "USD-M" ? USD_M_REST_BASE : COIN_M_REST_BASE;
  const [exchangeInfo, tickers, premiumIndex] = await Promise.all([
    fetchJson<ExchangeInfoResponse>(baseUrl, marketType === "USD-M" ? "/fapi/v1/exchangeInfo" : "/dapi/v1/exchangeInfo", signal),
    fetchJson<BinanceFuturesTicker[]>(baseUrl, marketType === "USD-M" ? "/fapi/v1/ticker/24hr" : "/dapi/v1/ticker/24hr", signal),
    fetchJson<BinancePremiumIndex[]>(baseUrl, marketType === "USD-M" ? "/fapi/v1/premiumIndex" : "/dapi/v1/premiumIndex", signal),
  ]);

  return buildFuturesRows({
    marketType,
    symbols: exchangeInfo.symbols,
    tickers: marketType === "COIN-M" ? tickers.map(coinMTickerToUnified) : tickers,
    premiumIndex,
    openInterestBySymbol: new Map(),
    nowIso: new Date().toISOString(),
  });
}

export async function fetchAllFuturesRows(signal?: AbortSignal): Promise<FuturesMarketRow[]> {
  const [usdMRows, coinMRows] = await Promise.all([
    fetchMarketRows("USD-M", signal),
    fetchMarketRows("COIN-M", signal),
  ]);

  return [...usdMRows, ...coinMRows]
    .sort((a, b) => b.volume24hUsd - a.volume24hUsd || a.symbol.localeCompare(b.symbol))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function subscribeTickerStream(
  marketType: FuturesMarketType,
  url: string,
  onRowsUpdate: (updater: (rows: FuturesMarketRow[]) => FuturesMarketRow[]) => void,
  onStatusChange: (marketType: FuturesMarketType, status: "connecting" | "live" | "closed" | "error") => void,
) {
  onStatusChange(marketType, "connecting");
  const socket = new WebSocket(url);

  socket.addEventListener("open", () => onStatusChange(marketType, "live"));
  socket.addEventListener("close", () => onStatusChange(marketType, "closed"));
  socket.addEventListener("error", () => onStatusChange(marketType, "error"));
  socket.addEventListener("message", event => {
    try {
      const payload = JSON.parse(String(event.data)) as BinanceTickerStreamItem[];
      if (!Array.isArray(payload)) return;
      const updates: BinanceFuturesTicker[] = payload.map(item => ({
        symbol: item.s,
        lastPrice: item.c,
        highPrice: item.h,
        lowPrice: item.l,
        priceChangePercent: item.P,
        volume: item.v,
        baseVolume: marketType === "COIN-M" ? item.q : undefined,
        quoteVolume: marketType === "USD-M" ? item.q : undefined,
        closeTime: item.E,
      }));
      onRowsUpdate(rows => applyTickerUpdates(rows, updates));
    } catch {
      onStatusChange(marketType, "error");
    }
  });

  return () => {
    socket.close();
  };
}

export function subscribeAllFuturesTicker(
  onRowsUpdate: (updater: (rows: FuturesMarketRow[]) => FuturesMarketRow[]) => void,
  onStatusChange: (marketType: FuturesMarketType, status: "connecting" | "live" | "closed" | "error") => void,
) {
  const closeUsdM = subscribeTickerStream("USD-M", USD_M_WS_URL, onRowsUpdate, onStatusChange);
  const closeCoinM = subscribeTickerStream("COIN-M", COIN_M_WS_URL, onRowsUpdate, onStatusChange);

  return () => {
    closeUsdM();
    closeCoinM();
  };
}

export async function fetchFuturesCandles(symbol: string, marketType: FuturesMarketType, interval: string, signal?: AbortSignal): Promise<FuturesCandle[]> {
  const baseUrl = marketType === "USD-M" ? USD_M_REST_BASE : COIN_M_REST_BASE;
  const klines = await fetchJson<BinanceKline[]>(
    baseUrl,
    `${marketType === "USD-M" ? "/fapi" : "/dapi"}/v1/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=240`,
    signal,
  );
  return klines.map(kline => ({
    openTime: kline[0],
    open: Number(kline[1]),
    high: Number(kline[2]),
    low: Number(kline[3]),
    close: Number(kline[4]),
    volume: Number(kline[5]),
  }));
}

export async function fetchFuturesTechnicalDetail(
  symbol: string,
  marketType: FuturesMarketType,
  interval: string,
  signal?: AbortSignal,
): Promise<{ candles: FuturesCandle[]; indicators: FuturesTechnicalIndicators }> {
  const candles = await fetchFuturesCandles(symbol, marketType, interval, signal);
  return {
    candles,
    indicators: calculateTechnicalIndicators(candles),
  };
}
