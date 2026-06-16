export type BinanceFuturesSymbol = {
  symbol: string;
  pair?: string;
  baseAsset: string;
  quoteAsset: string;
  contractType: string;
  status: string;
};

export type BinanceFuturesTicker = {
  symbol: string;
  lastPrice: string;
  highPrice: string;
  lowPrice: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
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

export type FuturesMarketRow = {
  rank: number;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  contractType: "PERPETUAL";
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

function compareByVolume(a: FuturesMarketRow, b: FuturesMarketRow) {
  return b.volume24hUsd - a.volume24hUsd || a.symbol.localeCompare(b.symbol);
}

export function buildFuturesRows(input: BuildFuturesRowsInput): FuturesMarketRow[] {
  const tradablePerpetuals = new Map(
    input.symbols
      .filter(item => item.status === "TRADING")
      .filter(item => item.contractType === "PERPETUAL")
      .filter(item => !item.symbol.includes("_"))
      .map(item => [item.symbol, item]),
  );
  const premiumBySymbol = new Map(input.premiumIndex.map(item => [item.symbol, item]));

  const rows = input.tickers
    .filter(ticker => tradablePerpetuals.has(ticker.symbol))
    .map((ticker): FuturesMarketRow => {
      const symbolInfo = tradablePerpetuals.get(ticker.symbol);
      if (!symbolInfo) throw new Error(`Missing exchange info for ${ticker.symbol}`);
      const premium = premiumBySymbol.get(ticker.symbol);
      const volume24hUsd = numberOrZero(ticker.quoteVolume);
      const fundingRate = parseNumber(premium?.lastFundingRate);
      const openInterestUsd = input.openInterestBySymbol.get(ticker.symbol) ?? null;
      const openInterestToVolumePercent =
        openInterestUsd !== null && volume24hUsd > 0 ? round((openInterestUsd / volume24hUsd) * 100, 2) : null;
      const change24hPercent = round(numberOrZero(ticker.priceChangePercent), 2);

      return {
        rank: 0,
        symbol: ticker.symbol,
        baseAsset: symbolInfo.baseAsset,
        quoteAsset: symbolInfo.quoteAsset,
        contractType: "PERPETUAL",
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
    const volume24hUsd = numberOrZero(update.quoteVolume);
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
