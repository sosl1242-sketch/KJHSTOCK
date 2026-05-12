from pathlib import Path

root = Path('/home/ubuntu/korea-stock-sector-analyzer')

# 1) technicalIndicators: export MarketSuffix, extend domestic range to 3y, append generic builder
tech = root / 'server' / 'technicalIndicators.ts'
s = tech.read_text()
s = s.replace('type MarketSuffix = "KS" | "KQ";', 'export type MarketSuffix = "KS" | "KQ";')
s = s.replace('range: "1y",', 'range: "3y",')
if 'export function buildTechnicalIndicatorDetailFromCandles' not in s:
    s += r'''

export type GenericTechnicalIndicatorDetail = {
  code: string;
  name?: string;
  symbol: string;
  latestClose: number | null;
  high52Week: number | null;
  low52Week: number | null;
  fairPriceMedian: number | null;
  indicators: TechnicalIndicator[];
  priceHistory: PriceCandle[];
  source: string;
  fetchedAt: string;
  note?: string;
};

export function buildTechnicalIndicatorDetailFromCandles(input: {
  code: string;
  name?: string;
  symbol: string;
  candles: PriceCandle[];
  source: string;
  note?: string;
}): GenericTechnicalIndicatorDetail {
  const candles = input.candles
    .filter(candle => [candle.open, candle.high, candle.low, candle.close].every(value => typeof value === "number" && Number.isFinite(value) && value > 0))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (candles.length < 30) {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `${input.symbol} 보조지표를 계산할 가격 이력이 부족합니다. 최소 30개 이상의 일봉이 필요합니다.`,
    });
  }

  const calculated = calculateTechnicalIndicators(candles);
  return {
    code: input.code,
    name: input.name,
    symbol: input.symbol,
    latestClose: round(calculated.latestClose, 4),
    high52Week: round(calculated.high52Week, 4),
    low52Week: round(calculated.low52Week, 4),
    fairPriceMedian: round(calculated.fairPriceMedian, 4),
    indicators: calculated.indicators,
    priceHistory: candles,
    source: input.source,
    fetchedAt: new Date().toISOString(),
    note: input.note ?? (candles.length < 220 ? "거래 이력이 1년보다 짧아 52주 지표는 조회 가능한 기간 기준입니다." : undefined),
  };
}
'''
tech.write_text(s)

# 2) usStocks: import helpers, add Yahoo detail function
us = root / 'server' / 'usStocks.ts'
s = us.read_text()
if 'buildTechnicalIndicatorDetailFromCandles' not in s.split('\n', 5)[0:5]:
    s = 'import { buildTechnicalIndicatorDetailFromCandles, PriceCandle } from "./technicalIndicators";\n' + s
if 'type YahooChartResponse' not in s:
    insert_after = 'type StooqQuote = {\n  ticker: string;\n  close: number;\n  open: number | null;\n  volume: number | null;\n  updatedAt: string;\n};\n'
    s = s.replace(insert_after, insert_after + r'''

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      meta?: { symbol?: string };
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
    error?: unknown;
  };
};
''')
if 'function parseYahooCandles' not in s:
    s += r'''

function parseYahooCandles(payload: YahooChartResponse): { symbol?: string; candles: PriceCandle[] } {
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  const candles: PriceCandle[] = [];
  for (let index = 0; index < timestamps.length; index += 1) {
    const close = quote?.close?.[index];
    const high = quote?.high?.[index];
    const low = quote?.low?.[index];
    const open = quote?.open?.[index] ?? close;
    const volume = quote?.volume?.[index] ?? 0;
    if ([open, high, low, close].every(value => typeof value === "number" && Number.isFinite(value) && value > 0)) {
      candles.push({
        date: new Date(timestamps[index] * 1000).toISOString().slice(0, 10),
        open: open as number,
        high: high as number,
        low: low as number,
        close: close as number,
        volume: typeof volume === "number" && Number.isFinite(volume) ? volume : 0,
      });
    }
  }
  return { symbol: result?.meta?.symbol, candles };
}

export async function fetchUsStockTechnicalDetail(input: { ticker: string; name?: string }) {
  const ticker = input.ticker.trim().toUpperCase();
  const yahooSymbol = ticker.replace(".", "-");
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=3y&interval=1d&includeAdjustedClose=true`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KoreaStockSectorAnalyzer/1.0)" },
    });
    if (!response.ok) throw new Error(`Yahoo Finance chart returned ${response.status}`);
    const payload = await response.json() as YahooChartResponse;
    const parsed = parseYahooCandles(payload);
    return buildTechnicalIndicatorDetailFromCandles({
      code: ticker,
      name: input.name,
      symbol: parsed.symbol ?? yahooSymbol,
      candles: parsed.candles,
      source: "YahooFinance",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "알 수 없는 오류";
    throw new Error(`${ticker} 해외주식 보조지표 데이터를 가져오지 못했습니다. ${reason}`);
  } finally {
    clearTimeout(timeout);
  }
}
'''
us.write_text(s)

# 3) cryptoFutures: import helpers, expand from top100 to full USDT perpetuals, add kline detail function
crypto = root / 'server' / 'cryptoFutures.ts'
s = crypto.read_text(errors='replace')
if not s.startswith('import { buildTechnicalIndicatorDetailFromCandles'):
    s = 'import { buildTechnicalIndicatorDetailFromCandles, PriceCandle } from "./technicalIndicators";\n' + s
s = s.replace('const TOP_USDT_FUTURES_LIMIT = 100;', 'const OPEN_INTEREST_DETAIL_LIMIT = 120;')
s = s.replace('.slice(0, TOP_USDT_FUTURES_LIMIT);', ';')
s = s.replace('const openInterestUsdMap = await fetchOpenInterestUsd(topTickers.map(ticker => ticker.symbol), priceBySymbol);', 'const openInterestSymbols = topTickers.slice(0, OPEN_INTEREST_DETAIL_LIMIT).map(ticker => ticker.symbol);\n  const openInterestUsdMap = await fetchOpenInterestUsd(openInterestSymbols, priceBySymbol);')
if 'type BinanceKline' not in s:
    s = s.replace('type BinanceOpenInterest = {\n  symbol: string;\n  openInterest: string;\n};', 'type BinanceOpenInterest = {\n  symbol: string;\n  openInterest: string;\n};\ntype BinanceKline = [number, string, string, string, string, string, number, string, number, string, string, string];')
if 'export async function fetchCryptoFuturesTechnicalDetail' not in s:
    s += r'''

function parseKlinesToCandles(klines: BinanceKline[]): PriceCandle[] {
  return klines.map(kline => ({
    date: new Date(kline[0]).toISOString().slice(0, 10),
    open: requireNumber(kline[1]),
    high: requireNumber(kline[2]),
    low: requireNumber(kline[3]),
    close: requireNumber(kline[4]),
    volume: requireNumber(kline[5]),
  })).filter(candle => [candle.open, candle.high, candle.low, candle.close].every(value => Number.isFinite(value) && value > 0));
}

export async function fetchCryptoFuturesTechnicalDetail(input: { symbol: string; name?: string }) {
  const symbol = input.symbol.trim().toUpperCase();
  if (!symbol.endsWith("USDT")) {
    throw new Error("USDT 선물 심볼만 상세 분석할 수 있습니다.");
  }
  const klines = await fetchJson<BinanceKline[]>(`/fapi/v1/klines?symbol=${encodeURIComponent(symbol)}&interval=1d&limit=1095`);
  return buildTechnicalIndicatorDetailFromCandles({
    code: symbol,
    name: input.name,
    symbol,
    candles: parseKlinesToCandles(klines),
    source: "Binance Futures Public API",
  });
}
'''
crypto.write_text(s)

# 4) routers: import and add detail endpoints
routers = root / 'server' / 'routers.ts'
s = routers.read_text()
s = s.replace('import { getCryptoFuturesSummary, getCryptoFuturesTable } from "./cryptoFutures";', 'import { fetchCryptoFuturesTechnicalDetail, getCryptoFuturesSummary, getCryptoFuturesTable } from "./cryptoFutures";')
s = s.replace('import { getUsStocksSummary, getUsStocksTable } from "./usStocks";', 'import { fetchUsStockTechnicalDetail, getUsStocksSummary, getUsStocksTable } from "./usStocks";')
if 'technicalIndicators: publicProcedure' not in s:
    s = s.replace('''    getTable: publicProcedure.query(async () => {
      try {
        const stocks = await getUsStocksTable();
        return { success: true, stocks, total: stocks.length, lastUpdated: new Date().toISOString() };
      } catch (error) {
        return { success: false, error: "Failed to fetch US stock table" };
      }
    }),
  }),''', '''    getTable: publicProcedure.query(async () => {
      try {
        const stocks = await getUsStocksTable();
        return { success: true, stocks, total: stocks.length, lastUpdated: new Date().toISOString() };
      } catch (error) {
        return { success: false, error: "Failed to fetch US stock table" };
      }
    }),
    technicalIndicators: publicProcedure
      .input(z.object({ ticker: z.string().min(1).max(16), name: z.string().max(120).optional() }))
      .query(async ({ input }) => {
        try {
          return { success: true, detail: await fetchUsStockTechnicalDetail(input) };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to fetch US technical indicators";
          return { success: false, error: message };
        }
      }),
  }),''')
if 'technicalIndicators: publicProcedure' not in s.split('cryptoFutures: router({',1)[1]:
    s = s.replace('''    getTable: publicProcedure.query(async () => {
      try {
        const coins = await getCryptoFuturesTable();
        return { success: true, coins, total: coins.length, lastUpdated: new Date().toISOString() };
      } catch (error) {
        return { success: false, error: "Failed to fetch crypto table" };
      }
    }),
  }),''', '''    getTable: publicProcedure.query(async () => {
      try {
        const coins = await getCryptoFuturesTable();
        return { success: true, coins, total: coins.length, lastUpdated: new Date().toISOString() };
      } catch (error) {
        return { success: false, error: "Failed to fetch crypto table" };
      }
    }),
    technicalIndicators: publicProcedure
      .input(z.object({ symbol: z.string().min(4).max(24), name: z.string().max(120).optional() }))
      .query(async ({ input }) => {
        try {
          return { success: true, detail: await fetchCryptoFuturesTechnicalDetail(input) };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to fetch crypto technical indicators";
          return { success: false, error: message };
        }
      }),
  }),''')
routers.write_text(s)
print('sector analysis server updates applied')
