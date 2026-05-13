import { buildTechnicalIndicatorDetailFromCandles, PriceCandle } from "./technicalIndicators";
export const CRYPTO_FUTURES_METRICS = [
  { key: "volume24hUsd", label: "24h 거래대금", description: "바이낸스 USDT 무기한 선물의 최근 24시간 명목 거래대금입니다." },
  { key: "change24hPercent", label: "24h 등락률", description: "바이낸스 선물 티커 기준 하루 가격 변화율입니다." },
  { key: "fundingRate", label: "펀딩비", description: "최근 펀딩비 기준 롱·숏 비용 균형입니다." },
  { key: "openInterestUsd", label: "미결제약정", description: "현재 미결제약정 수량에 최근 가격을 곱한 추정 명목 규모입니다." },
  { key: "openInterestToVolumePercent", label: "OI/거래대금", description: "24시간 거래대금 대비 미결제약정 부담입니다." },
  { key: "price", label: "가격", description: "바이낸스 선물 최근 체결 가격입니다." },
  { key: "high24h", label: "24h 고가", description: "최근 24시간 최고가입니다." },
  { key: "low24h", label: "24h 저가", description: "최근 24시간 최저가입니다." },
  { key: "baseVolume24h", label: "24h 거래량", description: "기초자산 수량 기준 최근 24시간 거래량입니다." },
  { key: "markPrice", label: "마크가격", description: "펀딩비 산정에 활용되는 선물 마크가격입니다." },
  { key: "nextFundingTime", label: "다음 펀딩", description: "다음 펀딩 정산 예정 시각입니다." },
  { key: "contractType", label: "계약유형", description: "USDT 무기한 선물 계약 구분입니다." },
] as const;

export type CryptoMetricKey = (typeof CRYPTO_FUTURES_METRICS)[number]["key"];

export type CryptoFuturesSector = "L1" | "L2" | "AI" | "DeFi" | "Meme" | "Exchange" | "Payments" | "Infrastructure" | "Other";

export type CryptoFuturesAsset = {
  rank: number;
  ticker: string;
  name: string;
  baseAsset: string;
  sector: CryptoFuturesSector;
  contractType: "PERPETUAL";
  price: number;
  high24h: number;
  low24h: number;
  change24hPercent: number;
  change7dPercent: number | null;
  marketCapUsd: number | null;
  fdvUsd: number | null;
  circulatingSupply: number | null;
  baseVolume24h: number;
  volume24hUsd: number;
  fundingRate: number;
  markPrice: number | null;
  nextFundingTime: string | null;
  openInterestUsd: number | null;
  volatility30dPercent: number | null;
  longShortRatio: number | null;
  lastUpdated: string;
};

export type CryptoFuturesTableRow = CryptoFuturesAsset & {
  volumeToMarketCapPercent: number | null;
  openInterestToMarketCapPercent: number | null;
  openInterestToVolumePercent: number | null;
};

type BinanceTicker24hr = {
  symbol: string;
  lastPrice: string;
  highPrice: string;
  lowPrice: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
  closeTime: number;
};

type BinancePremiumIndex = {
  symbol: string;
  markPrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
};

type BinanceExchangeInfo = {
  symbols?: Array<{
    symbol: string;
    pair: string;
    baseAsset: string;
    quoteAsset: string;
    contractType: string;
    status: string;
  }>;
};

type BinanceOpenInterest = {
  symbol: string;
  openInterest: string;
};
type BinanceKline = [number, string, string, string, string, string, number, string, number, string, string, string];

type CachedCryptoFutures = {
  rows: CryptoFuturesTableRow[];
  fetchedAt: string;
  warning?: string;
};

const BINANCE_FUTURES_BASE_URL = "https://fapi.binance.com";
const CACHE_TTL_MS = 1000 * 60 * 3;
const OPEN_INTEREST_DETAIL_LIMIT = 120;
const REQUEST_TIMEOUT_MS = 30_000;

let cachedResult: CachedCryptoFutures | null = null;

const nowIso = () => new Date().toISOString();

const assetNames: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  BNB: "BNB",
  SOL: "Solana",
  XRP: "XRP",
  DOGE: "Dogecoin",
  ADA: "Cardano",
  AVAX: "Avalanche",
  LINK: "Chainlink",
  TON: "Toncoin",
  NEAR: "NEAR Protocol",
  APT: "Aptos",
  ARB: "Arbitrum",
  OP: "Optimism",
  UNI: "Uniswap",
  SUI: "Sui",
  INJ: "Injective",
  RENDER: "Render",
  RNDR: "Render",
  WLD: "Worldcoin",
  PEPE: "Pepe",
  SHIB: "Shiba Inu",
  LTC: "Litecoin",
  BCH: "Bitcoin Cash",
  DOT: "Polkadot",
  ATOM: "Cosmos",
  FIL: "Filecoin",
  ETC: "Ethereum Classic",
  TRX: "TRON",
  MATIC: "Polygon",
  POL: "Polygon Ecosystem Token",
  AAVE: "Aave",
  MKR: "Maker",
  LDO: "Lido DAO",
  DYDX: "dYdX",
  JUP: "Jupiter",
  SEI: "Sei",
  FET: "Artificial Superintelligence Alliance",
  TAO: "Bittensor",
  GRT: "The Graph",
  PYTH: "Pyth Network",
  ENA: "Ethena",
  ONDO: "Ondo",
  PENDLE: "Pendle",
};

const sectorSets: Record<Exclude<CryptoFuturesSector, "Other">, Set<string>> = {
  L1: new Set(["BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "AVAX", "TON", "NEAR", "APT", "SUI", "DOT", "ATOM", "SEI", "TRX", "ETC", "LTC", "BCH", "ICP", "KAS", "HBAR", "ALGO", "EGLD", "XLM", "FIL"]),
  L2: new Set(["ARB", "OP", "MATIC", "POL", "STRK", "METIS", "IMX", "MANTA", "ZK", "ZRO"]),
  AI: new Set(["FET", "TAO", "RNDR", "RENDER", "NEAR", "GRT", "WLD", "ARKM", "AI", "AGIX", "OCEAN", "NMR", "PHB", "VIRTUAL", "KAITO"]),
  DeFi: new Set(["UNI", "AAVE", "MKR", "LDO", "DYDX", "JUP", "ENA", "ONDO", "PENDLE", "INJ", "RUNE", "CRV", "COMP", "SNX", "SUSHI", "1INCH", "CAKE", "GMX", "WOO", "ZRX"]),
  Meme: new Set(["DOGE", "SHIB", "PEPE", "WIF", "BONK", "FLOKI", "MEME", "BRETT", "POPCAT", "PNUT", "MEW", "TURBO"]),
  Exchange: new Set(["BNB", "OKB", "CRO", "GT", "KCS", "LEO", "BGB", "FTT"]),
  Payments: new Set(["BTC", "XRP", "LTC", "BCH", "XLM", "DASH", "ZEC"]),
  Infrastructure: new Set(["LINK", "PYTH", "TIA", "AR", "FIL", "STORJ", "JASMY", "IOTX", "ENS", "API3", "ANKR"]),
};

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parseNumber(value: string | number | null | undefined): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function requireNumber(value: string | number | null | undefined, fallback = 0): number {
  return parseNumber(value) ?? fallback;
}

function asIsoTime(ms: number | null | undefined) {
  if (!ms || !Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function getBaseAsset(symbol: string) {
  return symbol.endsWith("USDT") ? symbol.slice(0, -4) : symbol;
}

function classifySector(baseAsset: string): CryptoFuturesSector {
  const entries = Object.entries(sectorSets) as Array<[Exclude<CryptoFuturesSector, "Other">, Set<string>]>;
  const matched = entries.find(([, set]) => set.has(baseAsset));
  return matched?.[0] ?? "Other";
}

async function fetchJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${BINANCE_FUTURES_BASE_URL}${path}`, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Binance API ${path} returned ${response.status}`);
    }
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function fetchOpenInterestUsd(symbols: string[], priceBySymbol: Map<string, number>) {
  const entries = await mapWithConcurrency(symbols, 10, async symbol => {
    try {
      const openInterest = await fetchJson<BinanceOpenInterest>(`/fapi/v1/openInterest?symbol=${encodeURIComponent(symbol)}`);
      const contracts = parseNumber(openInterest.openInterest);
      const price = priceBySymbol.get(symbol);
      return [symbol, contracts !== null && price ? contracts * price : null] as const;
    } catch {
      return [symbol, null] as const;
    }
  });
  return new Map(entries);
}

async function fetchLiveCryptoFutures(): Promise<CachedCryptoFutures> {
  const [tickers, premiumIndex, exchangeInfo] = await Promise.all([
    fetchJson<BinanceTicker24hr[]>("/fapi/v1/ticker/24hr"),
    fetchJson<BinancePremiumIndex[]>("/fapi/v1/premiumIndex"),
    fetchJson<BinanceExchangeInfo>("/fapi/v1/exchangeInfo"),
  ]);

  const tradablePerpetuals = new Set((exchangeInfo.symbols ?? [])
    .filter(symbol => symbol.quoteAsset === "USDT" && symbol.contractType === "PERPETUAL" && symbol.status === "TRADING")
    .map(symbol => symbol.symbol));
  const premiumMap = new Map(premiumIndex.map(item => [item.symbol, item]));

  const topTickers = tickers
    .filter(ticker => tradablePerpetuals.has(ticker.symbol))
    .filter(ticker => ticker.symbol.endsWith("USDT") && !ticker.symbol.includes("_"))
    .map(ticker => ({ ...ticker, parsedQuoteVolume: requireNumber(ticker.quoteVolume) }))
    .filter(ticker => ticker.parsedQuoteVolume > 0)
    .sort((a, b) => b.parsedQuoteVolume - a.parsedQuoteVolume)
    ;

  const priceBySymbol = new Map(topTickers.map(ticker => [ticker.symbol, requireNumber(ticker.lastPrice)]));
  const openInterestSymbols = topTickers.slice(0, OPEN_INTEREST_DETAIL_LIMIT).map(ticker => ticker.symbol);
  const openInterestUsdMap = await fetchOpenInterestUsd(openInterestSymbols, priceBySymbol);
  const fetchedAt = nowIso();

  const rows = topTickers.map((ticker, index): CryptoFuturesTableRow => {
    const baseAsset = getBaseAsset(ticker.symbol);
    const premium = premiumMap.get(ticker.symbol);
    const price = requireNumber(ticker.lastPrice);
    const volume24hUsd = requireNumber(ticker.quoteVolume);
    const openInterestUsd = openInterestUsdMap.get(ticker.symbol) ?? null;
    return {
      rank: index + 1,
      ticker: ticker.symbol,
      name: assetNames[baseAsset] ?? baseAsset,
      baseAsset,
      sector: classifySector(baseAsset),
      contractType: "PERPETUAL",
      price,
      high24h: requireNumber(ticker.highPrice),
      low24h: requireNumber(ticker.lowPrice),
      change24hPercent: round(requireNumber(ticker.priceChangePercent), 2),
      change7dPercent: null,
      marketCapUsd: null,
      fdvUsd: null,
      circulatingSupply: null,
      baseVolume24h: requireNumber(ticker.volume),
      volume24hUsd,
      fundingRate: requireNumber(premium?.lastFundingRate),
      markPrice: parseNumber(premium?.markPrice),
      nextFundingTime: asIsoTime(premium?.nextFundingTime),
      openInterestUsd: openInterestUsd === null ? null : round(openInterestUsd, 2),
      volatility30dPercent: null,
      longShortRatio: null,
      lastUpdated: fetchedAt,
      volumeToMarketCapPercent: null,
      openInterestToMarketCapPercent: null,
      openInterestToVolumePercent: openInterestUsd !== null && volume24hUsd > 0 ? round((openInterestUsd / volume24hUsd) * 100, 2) : null,
    };
  });

  return { rows, fetchedAt };
}

async function loadCryptoFutures(): Promise<CachedCryptoFutures> {
  if (cachedResult && Date.now() - new Date(cachedResult.fetchedAt).getTime() < CACHE_TTL_MS) {
    return cachedResult;
  }

  try {
    const live = await fetchLiveCryptoFutures();
    cachedResult = live;
    return live;
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 Binance API 오류";
    if (cachedResult) {
      cachedResult = {
        ...cachedResult,
        warning: `Binance 실시간 API 갱신에 실패해 최근 캐시를 표시합니다. 실패 원인: ${message}`,
      };
      return cachedResult;
    }
    throw new Error(`Binance USDT 선물 데이터를 가져오지 못했습니다. ${message}`);
  }
}

export async function getCryptoFuturesTable(): Promise<CryptoFuturesTableRow[]> {
  const result = await loadCryptoFutures();
  return result.rows;
}

export async function getCryptoFuturesDataStatus() {
  const result = await loadCryptoFutures();
  return {
    total: result.rows.length,
    lastUpdated: result.fetchedAt,
    warning: result.warning,
    source: "Binance Futures Public API",
    sourceUrl: `${BINANCE_FUTURES_BASE_URL}/fapi/v1/ticker/24hr`,
  };
}

export async function getCryptoFuturesSummary() {
  const rows = await getCryptoFuturesTable();
  const totalVolume24hUsd = rows.reduce((sum, row) => sum + row.volume24hUsd, 0);
  const oiRows = rows.filter(row => typeof row.openInterestUsd === "number" && Number.isFinite(row.openInterestUsd));
  const totalOpenInterestUsd = oiRows.reduce((sum, row) => sum + Number(row.openInterestUsd), 0);
  const avgFundingRate = rows.length ? rows.reduce((sum, row) => sum + row.fundingRate, 0) / rows.length : 0;
  const avgChange24hPercent = rows.length ? rows.reduce((sum, row) => sum + row.change24hPercent, 0) / rows.length : 0;
  const topGainer = [...rows].sort((a, b) => b.change24hPercent - a.change24hPercent)[0];
  const topLoser = [...rows].sort((a, b) => a.change24hPercent - b.change24hPercent)[0];
  const hottestFunding = [...rows].sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate))[0];
  const volumeLeader = [...rows].sort((a, b) => b.volume24hUsd - a.volume24hUsd)[0];
  const sectors = Array.from(rows.reduce((map, row) => {
    const current = map.get(row.sector) ?? { sector: row.sector, count: 0, marketCapUsd: 0, volume24hUsd: 0, openInterestUsd: 0 };
    current.count += 1;
    current.marketCapUsd += row.volume24hUsd;
    current.volume24hUsd += row.volume24hUsd;
    current.openInterestUsd += row.openInterestUsd ?? 0;
    map.set(row.sector, current);
    return map;
  }, new Map<CryptoFuturesTableRow["sector"], { sector: CryptoFuturesTableRow["sector"]; count: number; marketCapUsd: number; volume24hUsd: number; openInterestUsd: number }>()).values())
    .sort((a, b) => b.volume24hUsd - a.volume24hUsd);
  const status = await getCryptoFuturesDataStatus();

  return {
    totalCoins: rows.length,
    totalMarketCapUsd: totalVolume24hUsd,
    totalVolume24hUsd,
    totalOpenInterestUsd,
    avgFundingRate,
    avgChange24hPercent: round(avgChange24hPercent, 2),
    topGainer: { ticker: topGainer?.ticker ?? "-", change: topGainer?.change24hPercent ?? 0 },
    topLoser: { ticker: topLoser?.ticker ?? "-", change: topLoser?.change24hPercent ?? 0 },
    hottestFunding: { ticker: hottestFunding?.ticker ?? "-", fundingRate: hottestFunding?.fundingRate ?? 0 },
    volumeLeader: { ticker: volumeLeader?.ticker ?? "-", volume24hUsd: volumeLeader?.volume24hUsd ?? 0 },
    sectors,
    indicators: CRYPTO_FUTURES_METRICS,
    lastUpdated: status.lastUpdated,
    warning: status.warning,
    source: status.source,
    sourceUrl: status.sourceUrl,
  };
}


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
