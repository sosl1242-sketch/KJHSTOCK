import {
  applyTickerUpdates,
  buildFuturesRows,
  calculateTechnicalIndicators,
  type BinanceFuturesSymbol,
  type BinanceFuturesTicker,
  type BinancePremiumIndex,
  type FuturesCandle,
  type FuturesMarketRow,
  type FuturesTechnicalIndicators,
} from "@shared/binanceFuturesAnalysis";

const FUTURES_REST_BASE = "https://fapi.binance.com";
const FUTURES_WS_URL = "wss://fstream.binance.com/ws/!ticker@arr";

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

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${FUTURES_REST_BASE}${path}`, { signal });
  if (!response.ok) {
    throw new Error(`Binance API ${path} returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchUsdMFuturesRows(signal?: AbortSignal): Promise<FuturesMarketRow[]> {
  const [exchangeInfo, tickers, premiumIndex] = await Promise.all([
    fetchJson<ExchangeInfoResponse>("/fapi/v1/exchangeInfo", signal),
    fetchJson<BinanceFuturesTicker[]>("/fapi/v1/ticker/24hr", signal),
    fetchJson<BinancePremiumIndex[]>("/fapi/v1/premiumIndex", signal),
  ]);

  return buildFuturesRows({
    symbols: exchangeInfo.symbols,
    tickers,
    premiumIndex,
    openInterestBySymbol: new Map(),
    nowIso: new Date().toISOString(),
  });
}

export function subscribeUsdMFuturesTicker(
  onRowsUpdate: (updater: (rows: FuturesMarketRow[]) => FuturesMarketRow[]) => void,
  onStatusChange: (status: "connecting" | "live" | "closed" | "error") => void,
) {
  onStatusChange("connecting");
  const socket = new WebSocket(FUTURES_WS_URL);

  socket.addEventListener("open", () => onStatusChange("live"));
  socket.addEventListener("close", () => onStatusChange("closed"));
  socket.addEventListener("error", () => onStatusChange("error"));
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
        quoteVolume: item.q,
        closeTime: item.E,
      }));
      onRowsUpdate(rows => applyTickerUpdates(rows, updates));
    } catch {
      onStatusChange("error");
    }
  });

  return () => {
    socket.close();
  };
}

export async function fetchFuturesCandles(symbol: string, interval: string, signal?: AbortSignal): Promise<FuturesCandle[]> {
  const klines = await fetchJson<BinanceKline[]>(
    `/fapi/v1/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=240`,
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
  interval: string,
  signal?: AbortSignal,
): Promise<{ candles: FuturesCandle[]; indicators: FuturesTechnicalIndicators }> {
  const candles = await fetchFuturesCandles(symbol, interval, signal);
  return {
    candles,
    indicators: calculateTechnicalIndicators(candles),
  };
}
