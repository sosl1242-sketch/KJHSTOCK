export type TradeFiAssetType = "Stock" | "ETF" | "Commodity ETF";

export type TradeFiAssetRow = {
  rank: number;
  ticker: string;
  name: string;
  assetType: TradeFiAssetType;
  exchange: "NASDAQ" | "NYSE" | "NYSE Arca";
  price: number;
  change1dPercent: number;
  marketCapUsd: number | null;
  volume: number | null;
  turnoverUsd: number | null;
  quoteSource: "YahooFinance" | "Stooq" | "Fallback";
  quoteStatus: "live" | "fallback";
  lastUpdated: string;
};

type BaseTradeFiAsset = Omit<TradeFiAssetRow, "volume" | "turnoverUsd" | "quoteSource" | "quoteStatus" | "lastUpdated">;

type StooqQuote = {
  ticker: string;
  close: number;
  open: number | null;
  volume: number | null;
  updatedAt: string;
  source: "Stooq";
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      meta?: {
        symbol?: string;
        regularMarketPrice?: number;
        regularMarketTime?: number;
      };
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
};

type MarketQuote = StooqQuote | {
  ticker: string;
  close: number;
  open: number | null;
  volume: number | null;
  updatedAt: string;
  source: "YahooFinance";
};

const nowIso = () => new Date().toISOString();

const tradeFiAssets: BaseTradeFiAsset[] = [
  { rank: 1, ticker: "MSTR", name: "Strategy", assetType: "Stock", exchange: "NASDAQ", price: 370, change1dPercent: 0, marketCapUsd: 105000000000 },
  { rank: 2, ticker: "COIN", name: "Coinbase", assetType: "Stock", exchange: "NASDAQ", price: 230, change1dPercent: 0, marketCapUsd: 58000000000 },
  { rank: 3, ticker: "CRCL", name: "Circle Internet Group", assetType: "Stock", exchange: "NYSE", price: 80, change1dPercent: 0, marketCapUsd: 18000000000 },
  { rank: 4, ticker: "PLTR", name: "Palantir", assetType: "Stock", exchange: "NASDAQ", price: 120, change1dPercent: 0, marketCapUsd: 280000000000 },
  { rank: 5, ticker: "TSLA", name: "Tesla", assetType: "Stock", exchange: "NASDAQ", price: 180, change1dPercent: 0, marketCapUsd: 580000000000 },
  { rank: 6, ticker: "NVDA", name: "NVIDIA", assetType: "Stock", exchange: "NASDAQ", price: 135, change1dPercent: 0, marketCapUsd: 3300000000000 },
  { rank: 7, ticker: "META", name: "Meta Platforms", assetType: "Stock", exchange: "NASDAQ", price: 610, change1dPercent: 0, marketCapUsd: 1550000000000 },
  { rank: 8, ticker: "GOOGL", name: "Alphabet", assetType: "Stock", exchange: "NASDAQ", price: 175, change1dPercent: 0, marketCapUsd: 2150000000000 },
  { rank: 9, ticker: "AMZN", name: "Amazon", assetType: "Stock", exchange: "NASDAQ", price: 190, change1dPercent: 0, marketCapUsd: 2000000000000 },
  { rank: 10, ticker: "DVLT", name: "Datavault AI", assetType: "Stock", exchange: "NASDAQ", price: 0.49, change1dPercent: -5.65, marketCapUsd: 345000000 },
  { rank: 11, ticker: "QQQ", name: "Invesco QQQ Trust", assetType: "ETF", exchange: "NASDAQ", price: 520, change1dPercent: 0, marketCapUsd: null },
  { rank: 12, ticker: "SPY", name: "SPDR S&P 500 ETF Trust", assetType: "ETF", exchange: "NYSE Arca", price: 590, change1dPercent: 0, marketCapUsd: null },
  { rank: 13, ticker: "EWY", name: "iShares MSCI South Korea ETF", assetType: "ETF", exchange: "NYSE Arca", price: 65, change1dPercent: 0, marketCapUsd: null },
  { rank: 14, ticker: "EWJ", name: "iShares MSCI Japan ETF", assetType: "ETF", exchange: "NYSE Arca", price: 70, change1dPercent: 0, marketCapUsd: null },
  { rank: 15, ticker: "GLD", name: "SPDR Gold Shares", assetType: "Commodity ETF", exchange: "NYSE Arca", price: 220, change1dPercent: 0, marketCapUsd: null },
  { rank: 16, ticker: "SLV", name: "iShares Silver Trust", assetType: "Commodity ETF", exchange: "NYSE Arca", price: 28, change1dPercent: 0, marketCapUsd: null },
];

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parseNumber(value: string | undefined): number | null {
  if (!value || value === "N/D") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stooqSymbol(ticker: string) {
  return `${ticker.toLowerCase().replace(".", "-")}.us`;
}

async function fetchYahooQuote(asset: BaseTradeFiAsset): Promise<MarketQuote | null> {
  const symbol = asset.ticker.replace(".", "-");
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d&includeAdjustedClose=true`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KoreaStockSectorAnalyzer/1.0)" },
    });
    if (!response.ok) return null;
    const payload = await response.json() as YahooChartResponse;
    const result = payload.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const quote = result?.indicators?.quote?.[0];
    if (!timestamps.length || !quote?.close?.length) return null;

    for (let index = quote.close.length - 1; index >= 0; index -= 1) {
      const close = quote.close[index] ?? result?.meta?.regularMarketPrice;
      if (typeof close !== "number" || !Number.isFinite(close) || close <= 0) continue;
      const open = quote.open?.[index] ?? null;
      const volume = quote.volume?.[index] ?? null;
      const timestamp = timestamps[index] ?? result?.meta?.regularMarketTime;
      const updatedAt = timestamp ? new Date(timestamp * 1000).toISOString() : nowIso();

      return {
        ticker: asset.ticker,
        close,
        open: typeof open === "number" && Number.isFinite(open) ? open : null,
        volume: typeof volume === "number" && Number.isFinite(volume) ? volume : null,
        updatedAt,
        source: "YahooFinance",
      };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchStooqQuote(asset: BaseTradeFiAsset): Promise<StooqQuote | null> {
  const symbol = stooqSymbol(asset.ticker);
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcv&h&e=csv`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KoreaStockSectorAnalyzer/1.0)" },
    });
    if (!response.ok) return null;
    const csv = (await response.text()).trim();
    const [, row] = csv.split(/\r?\n/);
    if (!row) return null;
    const columns = row.split(",");
    const close = parseNumber(columns[6]);
    if (close === null || close <= 0) return null;
    const date = columns[1] && columns[1] !== "N/D" ? columns[1] : undefined;
    const time = columns[2] && columns[2] !== "N/D" ? columns[2] : undefined;
    const updatedAt = date ? new Date(`${date}T${time ?? "00:00:00"}Z`).toISOString() : nowIso();

    return {
      ticker: asset.ticker,
      close,
      open: parseNumber(columns[3]),
      volume: parseNumber(columns[7]),
      updatedAt,
      source: "Stooq",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchMarketQuote(asset: BaseTradeFiAsset): Promise<MarketQuote | null> {
  return await fetchYahooQuote(asset) ?? await fetchStooqQuote(asset);
}

export async function getTradeFiAssetsTable(): Promise<TradeFiAssetRow[]> {
  const settled = await Promise.allSettled(tradeFiAssets.map(asset => fetchMarketQuote(asset)));
  const quotes = new Map<string, MarketQuote>();
  for (const result of settled) {
    if (result.status === "fulfilled" && result.value) quotes.set(result.value.ticker, result.value);
  }

  const fallbackUpdatedAt = nowIso();
  return tradeFiAssets.map(asset => {
    const quote = quotes.get(asset.ticker);
    const price = quote?.close ?? asset.price;
    const change1dPercent = quote?.open && quote.open > 0 ? round(((price - quote.open) / quote.open) * 100, 2) : asset.change1dPercent;
    const volume = quote?.volume ?? null;

    return {
      ...asset,
      price,
      change1dPercent,
      volume,
      turnoverUsd: volume === null ? null : round(price * volume, 2),
      quoteSource: quote?.source ?? "Fallback",
      quoteStatus: quote ? "live" : "fallback",
      lastUpdated: quote?.updatedAt ?? fallbackUpdatedAt,
    };
  });
}

export async function getTradeFiAssetsSummary() {
  const rows = await getTradeFiAssetsTable();
  const liveQuoteCount = rows.filter(row => row.quoteStatus === "live").length;
  const totalTurnoverUsd = rows.reduce((sum, row) => sum + (row.turnoverUsd ?? 0), 0);
  const avgChange1dPercent = rows.length ? rows.reduce((sum, row) => sum + row.change1dPercent, 0) / rows.length : 0;

  return {
    totalAssets: rows.length,
    liveQuoteCount,
    totalTurnoverUsd,
    avgChange1dPercent: round(avgChange1dPercent, 2),
    lastUpdated: rows.map(row => row.lastUpdated).sort().at(-1) ?? nowIso(),
    warning: liveQuoteCount < rows.length ? `최신 시세는 ${liveQuoteCount}/${rows.length}개 TradeFi 자산에만 반영되었습니다.` : undefined,
  };
}
