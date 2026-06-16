export type BinanceFuturesSymbol = {
  symbol: string;
  pair?: string;
  baseAsset: string;
  quoteAsset: string;
  contractType: string;
  status?: string;
  contractStatus?: string;
};

export type BinanceFuturesTicker = {
  symbol: string;
  lastPrice: string;
  highPrice: string;
  lowPrice: string;
  priceChangePercent: string;
  volume: string;
  baseVolume?: string;
  quoteVolume?: string;
  closeTime: number;
};

export type BinancePremiumIndex = {
  symbol: string;
  markPrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
};

export type FuturesCandle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type FuturesBias = "bullish" | "neutral" | "bearish";
export type FuturesAssetClass = "crypto" | "tradefi";
export type FuturesMarketType = "USD-M" | "COIN-M";
export type FuturesWatchCategory =
  | "momentum_liquidity"
  | "volume_leader"
  | "funding_pressure"
  | "pullback_liquidity"
  | "coin_margin_focus";

export type FuturesMarketRow = {
  rank: number;
  marketType: FuturesMarketType;
  assetClass: FuturesAssetClass;
  symbol: string;
  pair: string;
  baseAsset: string;
  quoteAsset: string;
  contractType: string;
  price: number;
  high24h: number;
  low24h: number;
  change24hPercent: number;
  baseVolume24h: number;
  volume24hUsd: number;
  fundingRate: number | null;
  markPrice: number | null;
  nextFundingTime: string | null;
  openInterestUsd: number | null;
  openInterestToVolumePercent: number | null;
  lastUpdated: string;
  signal: FuturesBias;
};

export type FuturesWatchReportItem = {
  category: FuturesWatchCategory;
  title: string;
  symbol: string;
  marketType: FuturesMarketType;
  contractType: string;
  priorityScore: number;
  why: string;
  risk: string;
  metrics: {
    change24hPercent: number;
    volume24hUsd: number;
    fundingRate: number | null;
    price: number;
  };
  technical?: FuturesWatchTechnicalSnapshot;
};

export type FuturesWatchReport = {
  generatedAt: string | null;
  items: FuturesWatchReportItem[];
};

export type FuturesWatchTechnicalSnapshot = {
  score: number;
  bias: FuturesBias;
  rsi14: number;
  ema20: number;
  ema50: number;
  macdHistogram: number;
  atrPercent: number;
  volume20Ratio: number;
};

export type FuturesTechnicalIndicators = {
  latestClose: number;
  ema20: number;
  ema50: number;
  rsi14: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  bollingerMiddle: number;
  bollingerUpper: number;
  bollingerLower: number;
  bollingerPercentB: number;
  atrPercent: number;
  stochastic14: number;
  volume20Ratio: number;
  score: number;
  bias: FuturesBias;
};

export type FuturesSummary = {
  totalSymbols: number;
  totalVolume24hUsd: number;
  positiveCount: number;
  negativeCount: number;
  averageChange24hPercent: number;
  topGainer: FuturesMarketRow | null;
  topLoser: FuturesMarketRow | null;
  volumeLeader: FuturesMarketRow | null;
  fundingExtreme: FuturesMarketRow | null;
  lastUpdated: string | null;
};

export type BuildFuturesRowsInput = {
  marketType: FuturesMarketType;
  symbols: BinanceFuturesSymbol[];
  tickers: BinanceFuturesTicker[];
  premiumIndex: BinancePremiumIndex[];
  openInterestBySymbol: Map<string, number | null>;
  nowIso?: string;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const parseNumber = (value: string | number | null | undefined): number | null => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const numberOrZero = (value: string | number | null | undefined) => parseNumber(value) ?? 0;

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const formatUsd = (value: number) => {
  if (Math.abs(value) >= 1e9) return `$${round(value / 1e9, 2)}B`;
  if (Math.abs(value) >= 1e6) return `$${round(value / 1e6, 2)}M`;
  return `$${round(value, 2)}`;
};

const trimFixed = (value: string) => value.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");

const formatPriceUsd = (value: number) => {
  const absValue = Math.abs(value);
  const digits = absValue >= 1000 ? 2 : absValue >= 1 ? 4 : absValue >= 0.0001 ? 8 : 10;
  const formatted = Number(value.toFixed(digits)).toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
  return `$${trimFixed(formatted)}`;
};

const formatPercent = (value: number, digits = 2) => `${value > 0 ? "+" : ""}${round(value, digits)}%`;

const formatFunding = (value: number | null) => value === null ? "-" : `${round(value * 100, 4)}%`;

const reportCategoryName: Record<FuturesWatchCategory, string> = {
  momentum_liquidity: "모멘텀 + 유동성",
  volume_leader: "거래대금 리더",
  funding_pressure: "펀딩 과열",
  pullback_liquidity: "하락 변동성",
  coin_margin_focus: "COIN-M 관찰",
};

const biasName: Record<FuturesBias, string> = {
  bullish: "강세",
  neutral: "중립",
  bearish: "약세",
};

const isoFromMillis = (value: number | null | undefined) => {
  if (!value || !Number.isFinite(value)) return null;
  return new Date(value).toISOString();
};

const signalFromRow = (change24hPercent: number, fundingRate: number | null, openInterestToVolumePercent: number | null): FuturesBias => {
  let score = 50;
  score += clamp(change24hPercent * 2.4, -28, 28);
  if (fundingRate !== null) score -= clamp(Math.abs(fundingRate * 10000) * 1.5, 0, 12);
  if (openInterestToVolumePercent !== null && openInterestToVolumePercent > 60) score -= 6;
  if (score >= 58) return "bullish";
  if (score <= 42) return "bearish";
  return "neutral";
};

const tradeFiBaseAssets = new Set([
  "MSTR",
  "AMZN",
  "CRCL",
  "COIN",
  "PLTR",
  "TSLA",
  "META",
  "NVDA",
  "GOOGL",
  "QQQ",
  "SPY",
  "IWM",
  "EWY",
  "EWJ",
  "XAU",
  "XAG",
  "CL",
  "BZ",
  "NATGAS",
  "HYUNDAI",
  "INTC",
  "NVO",
  "DKNG",
  "SPCX",
  "XLE",
  "COHR",
  "CRWV",
]);

function classifyAsset(symbolInfo: BinanceFuturesSymbol): FuturesAssetClass {
  if (symbolInfo.contractType.includes("TRADIFI")) return "tradefi";
  return tradeFiBaseAssets.has(symbolInfo.baseAsset.toUpperCase()) ? "tradefi" : "crypto";
}

function compareByVolume(a: FuturesMarketRow, b: FuturesMarketRow) {
  return b.volume24hUsd - a.volume24hUsd || a.symbol.localeCompare(b.symbol);
}

function getFuturesSymbolStatus(symbolInfo: BinanceFuturesSymbol) {
  return symbolInfo.status ?? symbolInfo.contractStatus ?? "";
}

function getVolume24hUsd(marketType: FuturesMarketType, ticker: BinanceFuturesTicker) {
  const price = numberOrZero(ticker.lastPrice);
  const quoteVolume = parseNumber(ticker.quoteVolume);
  const baseVolume = parseNumber(ticker.baseVolume);

  if (marketType === "USD-M") {
    return quoteVolume ?? (baseVolume !== null ? baseVolume * price : numberOrZero(ticker.volume));
  }

  return baseVolume !== null ? baseVolume * price : quoteVolume ?? numberOrZero(ticker.volume);
}

export function buildFuturesRows(input: BuildFuturesRowsInput): FuturesMarketRow[] {
  const tradableContracts = new Map(
    input.symbols
      .filter(item => getFuturesSymbolStatus(item) === "TRADING")
      .map(item => [item.symbol, item]),
  );
  const premiumBySymbol = new Map(input.premiumIndex.map(item => [item.symbol, item]));

  const rows = input.tickers
    .filter(ticker => tradableContracts.has(ticker.symbol))
    .map((ticker): FuturesMarketRow => {
      const symbolInfo = tradableContracts.get(ticker.symbol);
      if (!symbolInfo) throw new Error(`Missing exchange info for ${ticker.symbol}`);
      const premium = premiumBySymbol.get(ticker.symbol);
      const volume24hUsd = getVolume24hUsd(input.marketType, ticker);
      const fundingRate = parseNumber(premium?.lastFundingRate);
      const openInterestUsd = input.openInterestBySymbol.get(ticker.symbol) ?? null;
      const openInterestToVolumePercent =
        openInterestUsd !== null && volume24hUsd > 0 ? round((openInterestUsd / volume24hUsd) * 100, 2) : null;
      const change24hPercent = round(numberOrZero(ticker.priceChangePercent), 2);

      return {
        rank: 0,
        marketType: input.marketType,
        assetClass: classifyAsset(symbolInfo),
        symbol: ticker.symbol,
        pair: symbolInfo.pair ?? `${symbolInfo.baseAsset}${symbolInfo.quoteAsset}`,
        baseAsset: symbolInfo.baseAsset,
        quoteAsset: symbolInfo.quoteAsset,
        contractType: symbolInfo.contractType,
        price: numberOrZero(ticker.lastPrice),
        high24h: numberOrZero(ticker.highPrice),
        low24h: numberOrZero(ticker.lowPrice),
        change24hPercent,
        baseVolume24h: numberOrZero(ticker.volume),
        volume24hUsd,
        fundingRate,
        markPrice: parseNumber(premium?.markPrice),
        nextFundingTime: isoFromMillis(premium?.nextFundingTime),
        openInterestUsd,
        openInterestToVolumePercent,
        lastUpdated: input.nowIso ?? isoFromMillis(ticker.closeTime) ?? new Date().toISOString(),
        signal: signalFromRow(change24hPercent, fundingRate, openInterestToVolumePercent),
      };
    })
    .sort(compareByVolume);

  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function applyTickerUpdates(rows: FuturesMarketRow[], updates: BinanceFuturesTicker[]): FuturesMarketRow[] {
  const updateBySymbol = new Map(updates.map(update => [update.symbol, update]));
  const merged = rows.map(row => {
    const update = updateBySymbol.get(row.symbol);
    if (!update) return row;
    const volume24hUsd = getVolume24hUsd(row.marketType, update);
    const openInterestToVolumePercent =
      row.openInterestUsd !== null && volume24hUsd > 0 ? round((row.openInterestUsd / volume24hUsd) * 100, 2) : null;
    const change24hPercent = round(numberOrZero(update.priceChangePercent), 2);

    return {
      ...row,
      price: numberOrZero(update.lastPrice),
      high24h: numberOrZero(update.highPrice),
      low24h: numberOrZero(update.lowPrice),
      change24hPercent,
      baseVolume24h: numberOrZero(update.volume),
      volume24hUsd,
      openInterestToVolumePercent,
      lastUpdated: isoFromMillis(update.closeTime) ?? row.lastUpdated,
      signal: signalFromRow(change24hPercent, row.fundingRate, openInterestToVolumePercent),
    };
  }).sort(compareByVolume);

  return merged.map((row, index) => ({ ...row, rank: index + 1 }));
}

function scoreLogVolume(value: number) {
  return Math.log10(Math.max(value, 1));
}

function makeWatchItem(
  category: FuturesWatchCategory,
  row: FuturesMarketRow,
  title: string,
  priorityScore: number,
  why: string,
  risk: string,
): FuturesWatchReportItem {
  return {
    category,
    title,
    symbol: row.symbol,
    marketType: row.marketType,
    contractType: row.contractType,
    priorityScore: round(clamp(priorityScore, 0, 100), 1),
    why,
    risk,
    metrics: {
      change24hPercent: row.change24hPercent,
      volume24hUsd: row.volume24hUsd,
      fundingRate: row.fundingRate,
      price: row.price,
    },
  };
}

function pushUnique(items: FuturesWatchReportItem[], item: FuturesWatchReportItem | null) {
  if (!item) return;
  if (items.some(existing => existing.symbol === item.symbol && existing.category === item.category)) return;
  items.push(item);
}

export function buildFuturesWatchReport(rows: FuturesMarketRow[]): FuturesWatchReport {
  const cryptoRows = rows.filter(row => row.assetClass === "crypto");
  const liquidRows = (cryptoRows.length ? cryptoRows : rows).filter(row => row.volume24hUsd > 0);
  const items: FuturesWatchReportItem[] = [];

  const momentum = [...liquidRows]
    .filter(row => row.change24hPercent > 0)
    .sort((a, b) => (b.change24hPercent * 1.2 + scoreLogVolume(b.volume24hUsd) * 5) - (a.change24hPercent * 1.2 + scoreLogVolume(a.volume24hUsd) * 5))[0];
  if (momentum) {
    pushUnique(items, makeWatchItem(
      "momentum_liquidity",
      momentum,
      "거래대금이 동반된 상승 모멘텀",
      momentum.change24hPercent * 1.2 + scoreLogVolume(momentum.volume24hUsd) * 5,
      `${momentum.marketType} ${momentum.contractType}에서 24h ${formatPercent(momentum.change24hPercent)}, 거래대금 ${formatUsd(momentum.volume24hUsd)}로 가격 움직임과 유동성이 같이 붙었습니다.`,
      "급등 직후에는 되돌림과 청산 변동성이 커질 수 있어 펀딩비와 다음 캔들 거래량 확인이 필요합니다.",
    ));
  }

  const volumeLeader = [...liquidRows].sort(compareByVolume)[0];
  if (volumeLeader) {
    pushUnique(items, makeWatchItem(
      "volume_leader",
      volumeLeader,
      "시장 관심이 가장 크게 몰린 유동성 리더",
      scoreLogVolume(volumeLeader.volume24hUsd) * 8 + Math.abs(volumeLeader.change24hPercent),
      volumeLeader === momentum
        ? `${volumeLeader.symbol}는 상승 후보이면서 전체 거래대금도 ${formatUsd(volumeLeader.volume24hUsd)}로 최상위권이라 추세 지속 여부를 볼 가치가 있습니다.`
        : `${volumeLeader.symbol}는 24h 거래대금 ${formatUsd(volumeLeader.volume24hUsd)}로 시장 자금 회전이 가장 큰 축에 있어 방향 전환 신호가 빠르게 나타날 수 있습니다.`,
      "거래대금 1위가 항상 방향성을 뜻하지는 않습니다. 가격 등락률과 펀딩비가 엇갈리면 관망 신호일 수 있습니다.",
    ));
  }

  const fundingPressure = [...liquidRows]
    .filter(row => row.fundingRate !== null)
    .sort((a, b) => Math.abs(b.fundingRate ?? 0) - Math.abs(a.fundingRate ?? 0))[0];
  if (fundingPressure) {
    const side = (fundingPressure.fundingRate ?? 0) > 0 ? "롱 비용 부담" : "숏 비용 부담";
    pushUnique(items, makeWatchItem(
      "funding_pressure",
      fundingPressure,
      "펀딩비 압력이 큰 과열 후보",
      Math.abs(fundingPressure.fundingRate ?? 0) * 20000 + scoreLogVolume(fundingPressure.volume24hUsd) * 2,
      `${fundingPressure.symbol}는 펀딩비 ${formatFunding(fundingPressure.fundingRate)}로 ${side}이 두드러지고, 거래대금은 ${formatUsd(fundingPressure.volume24hUsd)}입니다.`,
      "펀딩비 극단값은 추세 지속과 반대 청산 압력을 모두 만들 수 있어 단독 매수·매도 근거로 쓰면 위험합니다.",
    ));
  }

  const pullback = [...liquidRows]
    .filter(row => row.change24hPercent < 0)
    .sort((a, b) => (Math.abs(b.change24hPercent) * 1.3 + scoreLogVolume(b.volume24hUsd) * 4) - (Math.abs(a.change24hPercent) * 1.3 + scoreLogVolume(a.volume24hUsd) * 4))[0];
  if (pullback) {
    pushUnique(items, makeWatchItem(
      "pullback_liquidity",
      pullback,
      "큰 하락과 유동성이 겹친 변동성 후보",
      Math.abs(pullback.change24hPercent) * 1.3 + scoreLogVolume(pullback.volume24hUsd) * 4,
      `${pullback.symbol}는 24h ${formatPercent(pullback.change24hPercent)} 하락에도 거래대금 ${formatUsd(pullback.volume24hUsd)}가 붙어 매도 압력과 반등 시도를 함께 관찰할 만합니다.`,
      "하락 중 거래량 증가는 저점 확인이 아니라 추가 청산 흐름일 수 있으므로 저가 갱신 여부를 먼저 봐야 합니다.",
    ));
  }

  const coinMargin = [...liquidRows]
    .filter(row => row.marketType === "COIN-M")
    .sort(compareByVolume)[0];
  if (coinMargin) {
    pushUnique(items, makeWatchItem(
      "coin_margin_focus",
      coinMargin,
      "COIN-M 시장 대표 관찰 후보",
      scoreLogVolume(coinMargin.volume24hUsd) * 7 + Math.abs(coinMargin.change24hPercent) * 2,
      `${coinMargin.symbol}는 COIN-M ${coinMargin.contractType} 중 거래대금 ${formatUsd(coinMargin.volume24hUsd)}가 가장 커서 USD-M과 다른 담보 시장의 포지션 흐름을 비교하기 좋습니다.`,
      "COIN-M은 담보와 손익 구조가 USD-M과 달라 같은 심볼이라도 변동성 체감과 리스크가 다를 수 있습니다.",
    ));
  }

  const generatedAt = rows
    .map(row => row.lastUpdated)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  return {
    generatedAt,
    items: items.sort((a, b) => b.priorityScore - a.priorityScore),
  };
}

export function buildFuturesWatchReportMarkdown(report: FuturesWatchReport): string {
  const generatedAt = report.generatedAt ?? new Date().toISOString();
  const lines = [
    "# Binance Futures Watch Report",
    "",
    `- 생성 시각: ${generatedAt}`,
    "- 범위: Binance USD-M 및 COIN-M 선물 공개 데이터",
    "- 목적: 현재 주목할 만한 선물 계약과 관찰 이유를 빠르게 정리",
    "- 주의: 이 리포트는 투자 조언이 아니며, 데이터는 지연되거나 누락될 수 있습니다.",
    "",
    "## 주목 후보",
  ];

  if (report.items.length === 0) {
    lines.push("", "현재 조건에서 주목 후보를 만들 수 있는 충분한 데이터가 없습니다.");
    return lines.join("\n");
  }

  report.items.forEach((item, index) => {
    lines.push(
      "",
      `### ${index + 1}. ${item.symbol} (${item.marketType} / ${item.contractType})`,
      "",
      `- 분류: ${reportCategoryName[item.category]}`,
      `- 우선 점수: ${item.priorityScore}`,
      `- 가격: ${formatPriceUsd(item.metrics.price)}`,
      `- 24h 등락률: ${formatPercent(item.metrics.change24hPercent)}`,
      `- 24h 거래대금: ${formatUsd(item.metrics.volume24hUsd)}`,
      `- 펀딩비: ${formatFunding(item.metrics.fundingRate)}`,
      `- 왜 주목: ${item.why}`,
      `- 리스크: ${item.risk}`,
    );

    if (item.technical) {
      const emaTrend = item.technical.ema20 >= item.technical.ema50 ? "EMA20 우위" : "EMA50 우위";
      lines.push(
        `- 기술 점수: ${item.technical.score} (${biasName[item.technical.bias]})`,
        `- RSI 14: ${round(item.technical.rsi14, 2)}`,
        `- EMA 20/50: ${formatPriceUsd(item.technical.ema20)} / ${formatPriceUsd(item.technical.ema50)} (${emaTrend})`,
        `- MACD Histogram: ${round(item.technical.macdHistogram, 8)}`,
        `- ATR %: ${round(item.technical.atrPercent, 2)}%`,
        `- Volume / 20: ${round(item.technical.volume20Ratio, 2)}%`,
      );
    }
  });

  return lines.join("\n");
}

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((sum, value) => sum + value, 0) / period;
}

function emaSeries(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const multiplier = 2 / (period + 1);
  const result: number[] = [];
  let previous = values[0];
  for (const value of values) {
    previous = result.length === 0 ? value : value * multiplier + previous * (1 - multiplier);
    result.push(previous);
  }
  return result;
}

function standardDeviation(values: number[]) {
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function rsi(values: number[], period: number) {
  if (values.length <= period) return 50;
  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= period; index += 1) {
    const change = values[index] - values[index - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let index = period + 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const relativeStrength = avgGain / avgLoss;
  return 100 - 100 / (1 + relativeStrength);
}

function atr(candles: FuturesCandle[], period: number) {
  if (candles.length < period + 1) return null;
  const ranges = candles.slice(1).map((candle, index) => {
    const previousClose = candles[index].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    );
  });
  return sma(ranges, period);
}

function stochastic(candles: FuturesCandle[], period: number) {
  if (candles.length < period) return 50;
  const slice = candles.slice(-period);
  const highest = Math.max(...slice.map(candle => candle.high));
  const lowest = Math.min(...slice.map(candle => candle.low));
  const latestClose = slice[slice.length - 1].close;
  if (highest === lowest) return 50;
  return ((latestClose - lowest) / (highest - lowest)) * 100;
}

export function calculateTechnicalIndicators(candles: FuturesCandle[]): FuturesTechnicalIndicators {
  const validCandles = candles.filter(candle =>
    [candle.open, candle.high, candle.low, candle.close, candle.volume].every(value => Number.isFinite(value)),
  );
  if (validCandles.length < 50) {
    throw new Error("At least 50 candles are required to calculate futures indicators.");
  }

  const closes = validCandles.map(candle => candle.close);
  const volumes = validCandles.map(candle => candle.volume);
  const latestClose = closes[closes.length - 1];
  const ema20Series = emaSeries(closes, 20);
  const ema50Series = emaSeries(closes, 50);
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const macdSeries = closes.map((_, index) => ema12[index] - ema26[index]);
  const macdSignalSeries = emaSeries(macdSeries, 9);
  const macd = macdSeries[macdSeries.length - 1];
  const macdSignal = macdSignalSeries[macdSignalSeries.length - 1];
  const last20Closes = closes.slice(-20);
  const bollingerMiddle = sma(closes, 20) ?? latestClose;
  const deviation = standardDeviation(last20Closes);
  const bollingerUpper = bollingerMiddle + deviation * 2;
  const bollingerLower = bollingerMiddle - deviation * 2;
  const bollingerWidth = bollingerUpper - bollingerLower;
  const bollingerPercentB = bollingerWidth === 0 ? 50 : ((latestClose - bollingerLower) / bollingerWidth) * 100;
  const atrValue = atr(validCandles, 14) ?? 0;
  const averageVolume20 = sma(volumes, 20) ?? volumes[volumes.length - 1];
  const volume20Ratio = averageVolume20 === 0 ? 100 : (volumes[volumes.length - 1] / averageVolume20) * 100;
  const rsi14 = rsi(closes, 14);
  const stochastic14 = stochastic(validCandles, 14);
  const ema20 = ema20Series[ema20Series.length - 1];
  const ema50 = ema50Series[ema50Series.length - 1];
  const macdHistogram = macd - macdSignal;

  let score = 50;
  score += ema20 > ema50 ? 18 : -18;
  score += clamp((rsi14 - 50) * 0.45, -16, 16);
  score += macdHistogram > 0 ? 12 : -12;
  score += clamp((stochastic14 - 50) * 0.18, -8, 8);
  score += clamp((volume20Ratio - 100) * 0.08, -6, 6);
  score = round(clamp(score, 0, 100), 1);

  return {
    latestClose: round(latestClose, 8),
    ema20: round(ema20, 8),
    ema50: round(ema50, 8),
    rsi14: round(rsi14, 2),
    macd: round(macd, 8),
    macdSignal: round(macdSignal, 8),
    macdHistogram: round(macdHistogram, 8),
    bollingerMiddle: round(bollingerMiddle, 8),
    bollingerUpper: round(bollingerUpper, 8),
    bollingerLower: round(bollingerLower, 8),
    bollingerPercentB: round(clamp(bollingerPercentB, 0, 100), 2),
    atrPercent: round(latestClose === 0 ? 0 : (atrValue / latestClose) * 100, 2),
    stochastic14: round(stochastic14, 2),
    volume20Ratio: round(volume20Ratio, 2),
    score,
    bias: score >= 60 ? "bullish" : score <= 40 ? "bearish" : "neutral",
  };
}

export function summarizeFuturesRows(rows: FuturesMarketRow[]): FuturesSummary {
  const sortedByChange = [...rows].sort((a, b) => b.change24hPercent - a.change24hPercent);
  const sortedByVolume = [...rows].sort((a, b) => b.volume24hUsd - a.volume24hUsd);
  const sortedByFunding = [...rows]
    .filter(row => row.fundingRate !== null)
    .sort((a, b) => Math.abs(b.fundingRate ?? 0) - Math.abs(a.fundingRate ?? 0));
  const totalVolume24hUsd = rows.reduce((sum, row) => sum + row.volume24hUsd, 0);
  const latest = rows
    .map(row => row.lastUpdated)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  return {
    totalSymbols: rows.length,
    totalVolume24hUsd: round(totalVolume24hUsd, 2),
    positiveCount: rows.filter(row => row.change24hPercent > 0).length,
    negativeCount: rows.filter(row => row.change24hPercent < 0).length,
    averageChange24hPercent: rows.length
      ? round(rows.reduce((sum, row) => sum + row.change24hPercent, 0) / rows.length, 2)
      : 0,
    topGainer: sortedByChange[0] ?? null,
    topLoser: sortedByChange.at(-1) ?? null,
    volumeLeader: sortedByVolume[0] ?? null,
    fundingExtreme: sortedByFunding[0] ?? null,
    lastUpdated: latest,
  };
}
