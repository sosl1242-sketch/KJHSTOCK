import { TRPCError } from "@trpc/server";
import { callDataApi } from "./_core/dataApi";

export type MarketSuffix = "KS" | "KQ";

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      meta?: {
        symbol?: string;
        regularMarketPrice?: number;
        previousClose?: number;
      };
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

export type PriceCandle = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type TechnicalIndicator = {
  key: string;
  label: string;
  value: number | null;
  displayValue: string;
  status: "overheated" | "neutral" | "oversold" | "watch_high" | "watch_low";
  statusLabel: string;
  interpretation: string;
  fairPrice: number | null;
  fairPriceDisplay: string;
  fairPriceBasis: string;
};

export type TechnicalIndicatorDetail = {
  code: string;
  name?: string;
  marketSuffix: MarketSuffix;
  symbol: string;
  latestClose: number | null;
  high52Week: number | null;
  low52Week: number | null;
  fairPriceMedian: number | null;
  indicators: TechnicalIndicator[];
  priceHistory: PriceCandle[];
  source: "YahooFinance";
  fetchedAt: string;
  note?: string;
};

const round = (value: number | null | undefined, digits = 2) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const formatValue = (value: number | null, suffix = "") => {
  if (value === null) return "-";
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}${suffix}`;
};

const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

function sma(values: number[], period: number) {
  if (values.length < period) return null;
  return average(values.slice(-period));
}

function emaSeries(values: number[], period: number) {
  if (values.length < period) return [];
  const multiplier = 2 / (period + 1);
  const result: number[] = [];
  let previous = average(values.slice(0, period));
  if (previous === null) return [];
  result.push(previous);
  for (let index = period; index < values.length; index += 1) {
    previous = (values[index] - previous) * multiplier + previous;
    result.push(previous);
  }
  return result;
}

export function calculateRsi(closes: number[], period = 14) {
  if (closes.length <= period) return null;
  const changes = closes.slice(1).map((close, index) => close - closes[index]);
  const initial = changes.slice(0, period);
  let avgGain = initial.reduce((sum, change) => sum + Math.max(change, 0), 0) / period;
  let avgLoss = initial.reduce((sum, change) => sum + Math.max(-change, 0), 0) / period;

  for (const change of changes.slice(period)) {
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return round(100 - 100 / (1 + rs));
}

function calculateStochasticK(candles: PriceCandle[], period = 14) {
  if (candles.length < period) return null;
  const slice = candles.slice(-period);
  const highestHigh = Math.max(...slice.map(candle => candle.high));
  const lowestLow = Math.min(...slice.map(candle => candle.low));
  const latestClose = candles[candles.length - 1]?.close;
  if (!Number.isFinite(highestHigh) || !Number.isFinite(lowestLow) || highestHigh === lowestLow) return null;
  return round(((latestClose - lowestLow) / (highestHigh - lowestLow)) * 100);
}

function calculateWilliamsR(candles: PriceCandle[], period = 14) {
  const stochastic = calculateStochasticK(candles, period);
  return stochastic === null ? null : round(stochastic - 100);
}

function calculateCci(candles: PriceCandle[], period = 20) {
  if (candles.length < period) return null;
  const slice = candles.slice(-period);
  const typicalPrices = slice.map(candle => (candle.high + candle.low + candle.close) / 3);
  const typicalAverage = average(typicalPrices);
  if (typicalAverage === null) return null;
  const meanDeviation = average(typicalPrices.map(price => Math.abs(price - typicalAverage)));
  if (!meanDeviation) return null;
  const latestTypical = typicalPrices[typicalPrices.length - 1];
  return round((latestTypical - typicalAverage) / (0.015 * meanDeviation));
}

function calculateMfi(candles: PriceCandle[], period = 14) {
  if (candles.length <= period) return null;
  const slice = candles.slice(-(period + 1));
  let positiveFlow = 0;
  let negativeFlow = 0;

  for (let index = 1; index < slice.length; index += 1) {
    const previousTypical = (slice[index - 1].high + slice[index - 1].low + slice[index - 1].close) / 3;
    const currentTypical = (slice[index].high + slice[index].low + slice[index].close) / 3;
    const moneyFlow = currentTypical * slice[index].volume;
    if (currentTypical > previousTypical) positiveFlow += moneyFlow;
    if (currentTypical < previousTypical) negativeFlow += moneyFlow;
  }

  if (negativeFlow === 0) return positiveFlow > 0 ? 100 : null;
  return round(100 - 100 / (1 + positiveFlow / negativeFlow));
}

function calculateBollingerPosition(closes: number[], period = 20) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const mean = average(slice);
  if (mean === null) return null;
  const variance = average(slice.map(value => (value - mean) ** 2));
  if (variance === null) return null;
  const standardDeviation = Math.sqrt(variance);
  const upper = mean + 2 * standardDeviation;
  const lower = mean - 2 * standardDeviation;
  const latest = closes[closes.length - 1];
  if (upper === lower) return null;
  return round(((latest - lower) / (upper - lower)) * 100);
}

function calculateMacdHistogram(closes: number[]) {
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  if (!ema12.length || !ema26.length) return null;
  const offset = ema12.length - ema26.length;
  const macdLine = ema26.map((ema26Value, index) => ema12[index + offset] - ema26Value);
  const signal = emaSeries(macdLine, 9);
  if (!signal.length) return null;
  const alignedMacd = macdLine.slice(-signal.length);
  return round(alignedMacd[alignedMacd.length - 1] - signal[signal.length - 1]);
}

function calculateSmaGap(closes: number[], period = 20) {
  const movingAverage = sma(closes, period);
  const latest = closes[closes.length - 1];
  if (movingAverage === null || movingAverage === 0) return null;
  return round(((latest - movingAverage) / movingAverage) * 100);
}

function calculateVolumeRatio(candles: PriceCandle[], period = 20) {
  if (candles.length < period + 1) return null;
  const latestVolume = candles[candles.length - 1].volume;
  const previousVolumes = candles.slice(-(period + 1), -1).map(candle => candle.volume).filter(value => Number.isFinite(value) && value > 0);
  if (previousVolumes.length < period || latestVolume <= 0) return null;
  const previousAverage = average(previousVolumes);
  if (!previousAverage) return null;
  return round((latestVolume / previousAverage) * 100);
}

type FairPriceEstimate = {
  fairPrice: number | null;
  basis: string;
};

function formatFairPrice(value: number | null) {
  return value === null ? "자료 없음" : `${value.toLocaleString("ko-KR")}원`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const medianValue = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  return round(medianValue, 0);
}

function boundedFairPrice(latestClose: number | null, candidate: number | null, basis: string): FairPriceEstimate {
  if (!latestClose || !candidate || !Number.isFinite(candidate) || candidate <= 0) return { fairPrice: null, basis };
  const bounded = clamp(candidate, latestClose * 0.75, latestClose * 1.25);
  return { fairPrice: round(bounded, 0), basis };
}

function oscillatorFairPrice(latestClose: number | null, value: number | null, target: number, scale: number, basis: string, limit = 0.25): FairPriceEstimate {
  if (!latestClose || value === null || !Number.isFinite(value)) return { fairPrice: null, basis };
  const adjustment = clamp((target - value) / scale, -limit, limit);
  return { fairPrice: round(latestClose * (1 + adjustment), 0), basis };
}

function directFairPrice(candidate: number | null, basis: string): FairPriceEstimate {
  return !candidate || !Number.isFinite(candidate) || candidate <= 0 ? { fairPrice: null, basis } : { fairPrice: round(candidate, 0), basis };
}

function statusForUpperLower(value: number | null, upper: number, lower: number, reverse = false) {
  if (value === null) return { status: "neutral" as const, label: "데이터 부족" };
  if (!reverse) {
    if (value >= upper) return { status: "overheated" as const, label: "상단 과열" };
    if (value <= lower) return { status: "oversold" as const, label: "하단 침체" };
  } else {
    if (value >= upper) return { status: "oversold" as const, label: "저점 근접" };
    if (value <= lower) return { status: "overheated" as const, label: "고점 근접" };
  }
  return { status: "neutral" as const, label: "중립" };
}

function buildIndicator(
  key: string,
  label: string,
  value: number | null,
  displayValue: string,
  status: TechnicalIndicator["status"],
  statusLabel: string,
  interpretation: string,
  fairPriceEstimate: FairPriceEstimate,
): TechnicalIndicator {
  return {
    key,
    label,
    value,
    displayValue,
    status,
    statusLabel,
    interpretation,
    fairPrice: fairPriceEstimate.fairPrice,
    fairPriceDisplay: formatFairPrice(fairPriceEstimate.fairPrice),
    fairPriceBasis: fairPriceEstimate.basis,
  };
}

export function calculateTechnicalIndicators(candles: PriceCandle[]) {
  const closes = candles.map(candle => candle.close).filter(value => Number.isFinite(value));
  const latestClose = closes[closes.length - 1] ?? null;
  const high52Week = candles.length ? Math.max(...candles.map(candle => candle.high)) : null;
  const low52Week = candles.length ? Math.min(...candles.map(candle => candle.low)) : null;
  const rsi = calculateRsi(closes);
  const stochastic = calculateStochasticK(candles);
  const williams = calculateWilliamsR(candles);
  const cci = calculateCci(candles);
  const mfi = calculateMfi(candles);
  const bollinger = calculateBollingerPosition(closes);
  const macd = calculateMacdHistogram(closes);
  const smaGap = calculateSmaGap(closes);
  const sma60Gap = calculateSmaGap(closes, 60);
  const volumeRatio = calculateVolumeRatio(candles);
  const high52Distance = latestClose && high52Week ? round(((latestClose - high52Week) / high52Week) * 100) : null;
  const low52Distance = latestClose && low52Week ? round(((latestClose - low52Week) / low52Week) * 100) : null;

  const rsiStatus = statusForUpperLower(rsi, 70, 30);
  const stochasticStatus = statusForUpperLower(stochastic, 80, 20);
  const williamsStatus = statusForUpperLower(williams, -20, -80);
  const cciStatus = statusForUpperLower(cci, 100, -100);
  const mfiStatus = statusForUpperLower(mfi, 80, 20);
  const bollingerStatus = statusForUpperLower(bollinger, 90, 10);
  const macdStatus = macd === null
    ? { status: "neutral" as const, label: "데이터 부족" }
    : macd > 0 ? { status: "watch_high" as const, label: "상승 모멘텀" } : { status: "watch_low" as const, label: "하락 모멘텀" };
  const smaGapStatus = statusForUpperLower(smaGap, 12, -12);
  const sma60GapStatus = statusForUpperLower(sma60Gap, 18, -18);
  const volumeRatioStatus = volumeRatio === null
    ? { status: "neutral" as const, label: "데이터 부족" }
    : volumeRatio >= 220 ? { status: "overheated" as const, label: "거래 과열" }
      : volumeRatio >= 140 ? { status: "watch_high" as const, label: "돌파 동반" }
        : volumeRatio <= 60 ? { status: "watch_low" as const, label: "거래 침체" }
          : { status: "neutral" as const, label: "보통" };
const highStatus = high52Distance === null
    ? { status: "neutral" as const, label: "데이터 부족" }
    : high52Distance >= -5 ? { status: "overheated" as const, label: "고점권" } : { status: "neutral" as const, label: "고점 이격" };
  const lowStatus = low52Distance === null
    ? { status: "neutral" as const, label: "데이터 부족" }
    : low52Distance <= 8 ? { status: "watch_low" as const, label: "저점권" } : { status: "neutral" as const, label: "저점 이격" };

  const indicators: TechnicalIndicator[] = [
    buildIndicator("rsi14", "RSI 14", rsi, formatValue(rsi), rsiStatus.status, rsiStatus.label, "70 이상은 단기 과열, 30 이하는 단기 침체로 해석하는 대표 모멘텀 지표입니다.", oscillatorFairPrice(latestClose, rsi, 50, 100, "RSI가 중립선 50에 회귀한다고 가정한 참고 가격입니다.")),
    buildIndicator("stochastic14", "스토캐스틱 %K", stochastic, formatValue(stochastic, "%"), stochasticStatus.status, stochasticStatus.label, "최근 14거래일 고저 범위 안에서 현재가가 상단·하단 어디에 있는지 보여줍니다.", oscillatorFairPrice(latestClose, stochastic, 50, 125, "스토캐스틱이 중립권 50%로 되돌아온다고 가정했습니다.")),
    buildIndicator("williams14", "Williams %R", williams, formatValue(williams, "%"), williamsStatus.status, williamsStatus.label, "-20 이상은 고점권, -80 이하는 저점권 가능성을 보는 역방향 과열·침체 지표입니다.", oscillatorFairPrice(latestClose, williams, -50, 125, "Williams %R이 중립권 -50%에 수렴한다고 가정했습니다.")),
    buildIndicator("cci20", "CCI 20", cci, formatValue(cci), cciStatus.status, cciStatus.label, "+100 이상은 강한 상단 모멘텀, -100 이하는 하단 과매도 가능성을 참고합니다.", oscillatorFairPrice(latestClose, cci, 0, 500, "CCI가 과열·침체가 아닌 0선으로 회귀한다고 가정했습니다.")),
    buildIndicator("mfi14", "MFI 14", mfi, formatValue(mfi), mfiStatus.status, mfiStatus.label, "가격과 거래량을 함께 반영한 자금흐름 지표로, RSI의 거래량 보강형으로 볼 수 있습니다.", oscillatorFairPrice(latestClose, mfi, 50, 100, "MFI가 자금흐름 중립선 50에 회귀한다고 가정했습니다.")),
    buildIndicator("bollinger20", "볼린저 위치", bollinger, formatValue(bollinger, "%"), bollingerStatus.status, bollingerStatus.label, "20일 볼린저밴드 안에서 현재가 위치를 0~100%로 환산해 상단·하단 근접도를 보여줍니다.", oscillatorFairPrice(latestClose, bollinger, 50, 125, "볼린저밴드 중앙값 근처로 회귀한다고 가정했습니다.")),
    buildIndicator("macdHistogram", "MACD 히스토그램", macd, formatValue(macd), macdStatus.status, macdStatus.label, "12·26일 EMA와 9일 시그널 차이로 상승·하락 모멘텀의 방향을 점검합니다.", boundedFairPrice(latestClose, latestClose && macd !== null ? latestClose - macd * 2 : null, "MACD 히스토그램이 0에 수렴한다고 가정한 보정 가격입니다.")),
    buildIndicator("sma20Gap", "20일선 이격도", smaGap, formatValue(smaGap, "%"), smaGapStatus.status, smaGapStatus.label, "현재가가 20일 이동평균에서 얼마나 떨어져 있는지 보여주는 단기 고저점 보조지표입니다.", boundedFairPrice(latestClose, latestClose && smaGap !== null ? latestClose / (1 + smaGap / 100) : null, "현재가가 20일 이동평균선으로 되돌아간다고 가정했습니다.")),
    buildIndicator("sma60Gap", "60일선 이격도", sma60Gap, formatValue(sma60Gap, "%"), sma60GapStatus.status, sma60GapStatus.label, "중기 추세선인 60일 이동평균 대비 이격으로 과도한 상승·하락 폭을 함께 점검합니다.", boundedFairPrice(latestClose, latestClose && sma60Gap !== null ? latestClose / (1 + sma60Gap / 100) : null, "현재가가 60일 이동평균선으로 회귀한다고 가정했습니다.")),
    buildIndicator("volume20Ratio", "거래량 20일 배율", volumeRatio, formatValue(volumeRatio, "%"), volumeRatioStatus.status, volumeRatioStatus.label, "최근 거래량이 직전 20거래일 평균 대비 얼마나 확대·축소됐는지 보며 돌파와 침체를 보조 판단합니다.", oscillatorFairPrice(latestClose, volumeRatio, 100, 500, "거래량이 직전 20일 평균 수준으로 정상화된다고 가정했습니다.", 0.12)),
    buildIndicator("high52Distance", "52주 고점 대비", high52Distance, formatValue(high52Distance, "%"), highStatus.status, highStatus.label, "0%에 가까울수록 52주 고점에 접근한 상태입니다.", directFairPrice(high52Week ? high52Week * 0.85 : null, "52주 고점에서 15% 완충을 둔 참고 가격입니다.")),
    buildIndicator("low52Distance", "52주 저점 대비", low52Distance, formatValue(low52Distance, "%"), lowStatus.status, lowStatus.label, "값이 낮을수록 52주 저점에 가까운 상태이며 반등 후보 점검에 활용합니다.", directFairPrice(low52Week ? low52Week * 1.35 : null, "52주 저점에서 35% 반등한 기준 참고 가격입니다.")),
  ];
  const fairPriceMedian = median(indicators.map(indicator => indicator.fairPrice).filter((value): value is number => value !== null));

  return { latestClose, high52Week, low52Week, fairPriceMedian, indicators };
}

function parseCandles(payload: unknown) {
  const result = (payload as YahooChartResponse).chart?.result?.[0];
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

  return {
    symbol: result?.meta?.symbol,
    candles,
  };
}

export async function fetchTechnicalIndicatorDetail(input: { code: string; name?: string; marketSuffix: MarketSuffix }): Promise<TechnicalIndicatorDetail> {
  const code = input.code.padStart(6, "0");
  const suffixes: MarketSuffix[] = Array.from(new Set<MarketSuffix>([input.marketSuffix, input.marketSuffix === "KS" ? "KQ" : "KS"]));
  let lastError: unknown;

  for (const suffix of suffixes) {
    const symbol = `${code}.${suffix}`;
    try {
      const payload = await callDataApi("YahooFinance/get_stock_chart", {
        query: {
          symbol,
          region: "KR",
          interval: "1d",
          range: "2y",
          includeAdjustedClose: "true",
        },
      });
      const parsed = parseCandles(payload);
      if (parsed.candles.length >= 30) {
        const calculated = calculateTechnicalIndicators(parsed.candles);
        return {
          code,
          name: input.name,
          marketSuffix: suffix,
          symbol: parsed.symbol ?? symbol,
          latestClose: round(calculated.latestClose, 0),
          high52Week: round(calculated.high52Week, 0),
          low52Week: round(calculated.low52Week, 0),
          fairPriceMedian: round(calculated.fairPriceMedian, 0),
          indicators: calculated.indicators,
          priceHistory: parsed.candles,
          source: "YahooFinance",
          fetchedAt: new Date().toISOString(),
          note: parsed.candles.length < 220 ? "거래 이력이 1년보다 짧아 52주 지표는 조회 가능한 기간 기준입니다." : undefined,
        };
      }
      lastError = new Error(`${symbol}의 유효한 일봉 데이터가 부족합니다.`);
    } catch (error) {
      lastError = error;
    }
  }

  const reason = lastError instanceof Error ? lastError.message : "알 수 없는 오류";
  throw new TRPCError({
    code: "BAD_GATEWAY",
    message: `${code} 종목의 보조지표를 계산할 주가 이력을 가져오지 못했습니다. ${reason}`,
  });
}


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
