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
  lastFundingRate?: string | null;
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
  /** Exchange quote time; empty when the exchange timestamp is unavailable. */
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
  watchPoints: string[];
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

export type FuturesFinalJudgmentTone = "strong_watch" | "selective_watch" | "neutral_watch" | "risk_first";

export type FuturesFinalJudgmentReport = {
  generatedAt: string | null;
  label: string;
  tone: FuturesFinalJudgmentTone;
  score: number;
  headline: string;
  summary: string;
  primarySymbol: string | null;
  primaryMarketType: FuturesMarketType | null;
  evidence: {
    candidateCount: number;
    technicalCount: number;
    averagePriorityScore: number;
    averageTechnicalScore: number | null;
    bullishTechnicalCount: number;
    bearishTechnicalCount: number;
    overboughtCount: number;
    highVolatilityCount: number;
    volumeExpansionCount: number;
    extremeFundingCount: number;
    totalVolume24hUsd: number;
    averageChange24hPercent: number;
  };
  strengths: string[];
  risks: string[];
  actionPlan: string[];
};

export type FuturesSelectedSymbolAnalysisTone = "strong" | "buy" | "watch" | "pullback" | "risk";

export type FuturesSelectedSymbolAnalysis = {
  symbol: string;
  marketType: FuturesMarketType;
  verdict: string;
  tone: FuturesSelectedSymbolAnalysisTone;
  score: number;
  headline: string;
  summary: string;
  levels: {
    current: string;
    support: string;
    riskLine: string;
    fairZone: string;
    resistance: string;
    breakout: string;
  };
  evidence: Array<{
    label: string;
    verdict: string;
    detail: string;
  }>;
  strengths: string[];
  risks: string[];
  scenarios: Array<{
    title: string;
    trigger: string;
    expectation: string;
  }>;
  actionPlan: string[];
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
  /** @deprecated Fetch time cannot establish quote freshness; ticker.closeTime is authoritative. */
  nowIso?: string;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const parseNumber = (value: string | number | null | undefined): number | null => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const numberOrZero = (value: string | number | null | undefined) => parseNumber(value) ?? 0;

const parseFundingRate = (value: string | null | undefined): number | null => {
  if (value == null || value.trim() === "") return null;
  return parseNumber(value);
};

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
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
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

function getBaseVolume24h(marketType: FuturesMarketType, ticker: BinanceFuturesTicker) {
  // COIN-M volume is a contract count; baseVolume is the traded coin quantity.
  return numberOrZero(marketType === "COIN-M" ? ticker.baseVolume : ticker.volume);
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
      const fundingRate = parseFundingRate(premium?.lastFundingRate);
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
        baseVolume24h: getBaseVolume24h(input.marketType, ticker),
        volume24hUsd,
        fundingRate,
        markPrice: parseNumber(premium?.markPrice),
        nextFundingTime: isoFromMillis(premium?.nextFundingTime),
        openInterestUsd,
        openInterestToVolumePercent,
        lastUpdated: isoFromMillis(ticker.closeTime) ?? "",
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
      baseVolume24h: getBaseVolume24h(row.marketType, update),
      volume24hUsd,
      openInterestToVolumePercent,
      lastUpdated: isoFromMillis(update.closeTime) ?? row.lastUpdated,
      signal: signalFromRow(change24hPercent, row.fundingRate, openInterestToVolumePercent),
    };
  });

  return merged;
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
  watchPoints: string[],
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
    watchPoints,
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
  if (items.some(existing => existing.symbol === item.symbol && existing.marketType === item.marketType)) return;
  items.push(item);
}

function alreadyRecommended(items: FuturesWatchReportItem[], row: FuturesMarketRow) {
  return items.some(item => item.symbol === row.symbol && item.marketType === row.marketType);
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
      [
        "다음 15분~1시간 캔들에서 고점 갱신과 거래대금 유지가 같이 나오는지 확인",
        "펀딩비가 빠르게 양수로 확대되면 과열과 롱 비용 부담을 별도로 점검",
      ],
    ));
  }

  const volumeLeader = [...liquidRows].sort(compareByVolume).find(row => !alreadyRecommended(items, row));
  if (volumeLeader) {
    pushUnique(items, makeWatchItem(
      "volume_leader",
      volumeLeader,
      "시장 관심이 가장 크게 몰린 유동성 리더",
      scoreLogVolume(volumeLeader.volume24hUsd) * 8 + Math.abs(volumeLeader.change24hPercent),
      `${volumeLeader.symbol}는 24h 거래대금 ${formatUsd(volumeLeader.volume24hUsd)}로 시장 자금 회전이 가장 큰 축에 있어 방향 전환 신호가 빠르게 나타날 수 있습니다.`,
      "거래대금 1위가 항상 방향성을 뜻하지는 않습니다. 가격 등락률과 펀딩비가 엇갈리면 관망 신호일 수 있습니다.",
      [
        "거래대금 증가가 가격 방향성과 함께 움직이는지 확인",
        "펀딩비와 24h 등락률이 서로 엇갈리면 방향성보다 자금 회전 후보로 분류",
      ],
    ));
  }

  const fundingPressure = [...liquidRows]
    .filter(row => row.fundingRate !== null)
    .sort((a, b) => Math.abs(b.fundingRate ?? 0) - Math.abs(a.fundingRate ?? 0))
    .find(row => !alreadyRecommended(items, row));
  if (fundingPressure) {
    const side = (fundingPressure.fundingRate ?? 0) > 0 ? "롱 비용 부담" : "숏 비용 부담";
    pushUnique(items, makeWatchItem(
      "funding_pressure",
      fundingPressure,
      "펀딩비 압력이 큰 과열 후보",
      Math.abs(fundingPressure.fundingRate ?? 0) * 20000 + scoreLogVolume(fundingPressure.volume24hUsd) * 2,
      `${fundingPressure.symbol}는 펀딩비 ${formatFunding(fundingPressure.fundingRate)}로 ${side}이 두드러지고, 거래대금은 ${formatUsd(fundingPressure.volume24hUsd)}입니다.`,
      "펀딩비 극단값은 추세 지속과 반대 청산 압력을 모두 만들 수 있어 단독 매수·매도 근거로 쓰면 위험합니다.",
      [
        "다음 펀딩 시각 전후로 펀딩비 극단값이 완화되는지 또는 더 벌어지는지 확인",
        "가격이 횡보하는데 펀딩비만 극단이면 청산 압력 후보로만 관찰",
      ],
    ));
  }

  const pullback = [...liquidRows]
    .filter(row => row.change24hPercent < 0)
    .sort((a, b) => (Math.abs(b.change24hPercent) * 1.3 + scoreLogVolume(b.volume24hUsd) * 4) - (Math.abs(a.change24hPercent) * 1.3 + scoreLogVolume(a.volume24hUsd) * 4))
    .find(row => !alreadyRecommended(items, row));
  if (pullback) {
    pushUnique(items, makeWatchItem(
      "pullback_liquidity",
      pullback,
      "큰 하락과 유동성이 겹친 변동성 후보",
      Math.abs(pullback.change24hPercent) * 1.3 + scoreLogVolume(pullback.volume24hUsd) * 4,
      `${pullback.symbol}는 24h ${formatPercent(pullback.change24hPercent)} 하락에도 거래대금 ${formatUsd(pullback.volume24hUsd)}가 붙어 매도 압력과 반등 시도를 함께 관찰할 만합니다.`,
      "하락 중 거래량 증가는 저점 확인이 아니라 추가 청산 흐름일 수 있으므로 저가 갱신 여부를 먼저 봐야 합니다.",
      [
        "저가 갱신이 멈추는지와 반등 캔들 거래대금이 이전 매도 거래대금보다 커지는지 확인",
        "EMA50 아래에서 MACD가 약하면 반등 후보보다 변동성 후보로 유지",
      ],
    ));
  }

  const coinMargin = [...liquidRows]
    .filter(row => row.marketType === "COIN-M")
    .sort(compareByVolume)
    .find(row => !alreadyRecommended(items, row));
  if (coinMargin) {
    pushUnique(items, makeWatchItem(
      "coin_margin_focus",
      coinMargin,
      "COIN-M 시장 대표 관찰 후보",
      scoreLogVolume(coinMargin.volume24hUsd) * 7 + Math.abs(coinMargin.change24hPercent) * 2,
      `${coinMargin.symbol}는 COIN-M ${coinMargin.contractType} 중 거래대금 ${formatUsd(coinMargin.volume24hUsd)}가 가장 커서 USD-M과 다른 담보 시장의 포지션 흐름을 비교하기 좋습니다.`,
      "COIN-M은 담보와 손익 구조가 USD-M과 달라 같은 심볼이라도 변동성 체감과 리스크가 다를 수 있습니다.",
      [
        "같은 기초자산의 USD-M 계약과 24h 등락률 및 펀딩비 차이를 비교",
        "COIN-M 거래대금 증가가 현물성 담보 수요 변화와 같이 나타나는지 확인",
      ],
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

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function buildFuturesFinalJudgmentReport(report: FuturesWatchReport): FuturesFinalJudgmentReport {
  const items = report.items;
  const technicalItems = items.filter(item => item.technical);
  const primary = [...items].sort((a, b) => b.priorityScore - a.priorityScore)[0] ?? null;
  const priorityAverage = round(average(items.map(item => item.priorityScore)), 1);
  const technicalAverage = technicalItems.length
    ? round(average(technicalItems.map(item => item.technical?.score ?? 0)), 1)
    : null;
  const totalVolume24hUsd = round(items.reduce((sum, item) => sum + item.metrics.volume24hUsd, 0), 2);
  const averageChange24hPercent = round(average(items.map(item => item.metrics.change24hPercent)), 2);
  const bullishTechnicalCount = technicalItems.filter(item => item.technical?.bias === "bullish" || (item.technical?.score ?? 0) >= 60).length;
  const bearishTechnicalCount = technicalItems.filter(item => item.technical?.bias === "bearish" || (item.technical?.score ?? 100) <= 40).length;
  const overboughtCount = technicalItems.filter(item => (item.technical?.rsi14 ?? 0) >= 70).length;
  const highVolatilityCount = technicalItems.filter(item => (item.technical?.atrPercent ?? 0) >= 7).length;
  const volumeExpansionCount = technicalItems.filter(item => (item.technical?.volume20Ratio ?? 0) >= 120).length;
  const extremeFundingCount = items.filter(item => Math.abs(item.metrics.fundingRate ?? 0) >= 0.001).length;
  const marketScore = clamp(50 + averageChange24hPercent * 2 + scoreLogVolume(totalVolume24hUsd) * 2, 0, 100);
  const technicalScore = technicalAverage ?? 50;
  const breadthBonus = bullishTechnicalCount * 2 + volumeExpansionCount * 1.5;
  const riskPenalty = bearishTechnicalCount * 3 + overboughtCount * 1.5 + highVolatilityCount * 1.5 + extremeFundingCount;
  const score = round(clamp(priorityAverage * 0.4 + technicalScore * 0.4 + marketScore * 0.2 + breadthBonus - riskPenalty, 0, 100), 1);

  const tone: FuturesFinalJudgmentTone = score >= 70 && bullishTechnicalCount >= bearishTechnicalCount
    ? "strong_watch"
    : score >= 58
      ? "selective_watch"
      : score >= 45
        ? "neutral_watch"
        : "risk_first";
  const labelByTone: Record<FuturesFinalJudgmentTone, string> = {
    strong_watch: "강한 주목",
    selective_watch: "선별 주목",
    neutral_watch: "관망",
    risk_first: "리스크 우선",
  };
  const headlineByTone: Record<FuturesFinalJudgmentTone, string> = {
    strong_watch: "시장 점수와 기술 지표가 같은 방향으로 모여 있습니다.",
    selective_watch: "좋은 후보는 있으나 확인해야 할 리스크가 남아 있습니다.",
    neutral_watch: "방향성이 충분히 쌓일 때까지 관찰이 우선입니다.",
    risk_first: "진입 후보보다 리스크 관리 신호가 더 큽니다.",
  };

  const strengths: string[] = [];
  if (primary) {
    strengths.push(`${primary.symbol}이 우선 점수 ${primary.priorityScore}로 가장 앞섭니다.`);
  }
  if (technicalAverage !== null) {
    strengths.push(`기술 지표 평균 점수는 ${technicalAverage}점이며 강세 판정 ${bullishTechnicalCount}개가 포함됩니다.`);
  }
  if (volumeExpansionCount > 0) {
    strengths.push(`거래량 확장 지표가 ${volumeExpansionCount}개 후보에서 확인됩니다.`);
  }
  if (totalVolume24hUsd > 0) {
    strengths.push(`상위 후보 합산 24h 거래대금은 ${formatUsd(totalVolume24hUsd)}입니다.`);
  }
  if (!strengths.length) {
    strengths.push("아직 최종 판단을 만들 만큼 강한 근거가 부족합니다.");
  }

  const risks: string[] = [];
  if (overboughtCount > 0) {
    risks.push(`과열 신호: RSI 70 이상 후보가 ${overboughtCount}개 있습니다.`);
  }
  if (highVolatilityCount > 0) {
    risks.push(`변동성 리스크: ATR 7% 이상 후보가 ${highVolatilityCount}개 있습니다.`);
  }
  if (extremeFundingCount > 0) {
    risks.push(`펀딩비 쏠림: 절대 펀딩비 0.1% 이상 후보가 ${extremeFundingCount}개 있습니다.`);
  }
  if (technicalItems.length < items.length) {
    risks.push(`기술 지표 미확보 후보가 ${items.length - technicalItems.length}개 있어 판단 신뢰도가 낮아질 수 있습니다.`);
  }
  if (!risks.length) {
    risks.push("뚜렷한 과열 신호는 적지만 실시간 선물 데이터 특성상 급변 가능성은 남아 있습니다.");
  }

  const summary = primary
    ? `${labelByTone[tone]}: ${primary.symbol}을 1순위로 두되, 기술 점수와 과열 리스크를 함께 확인해야 합니다.`
    : "자료 부족: 주목 후보와 기술 지표가 충분히 쌓인 뒤 최종 판단을 갱신합니다.";
  const actionPlan = primary
    ? [
        `1순위 후보는 ${primary.symbol}입니다. 현재가 ${formatPriceUsd(primary.metrics.price)}, 24h ${formatPercent(primary.metrics.change24hPercent)}, 거래대금 ${formatUsd(primary.metrics.volume24hUsd)}를 기준으로 관찰합니다.`,
        technicalAverage !== null
          ? `기술 지표 평균 ${technicalAverage}점이 60점 위를 유지하는지 확인합니다. 50점 아래로 내려가면 관망으로 낮춥니다.`
          : "기술 지표 계산이 끝날 때까지 시장 데이터만으로 추격하지 않습니다.",
        "새 캔들이 고점 돌파와 거래대금 유지를 동시에 보여줄 때만 관심도를 높입니다.",
        "투자 판단 전에는 반드시 본인 기준의 손절가와 포지션 크기를 먼저 정합니다.",
      ]
    : [
        "추천 후보가 충분하지 않으면 새 데이터 갱신 후 다시 판단합니다.",
        "기술 지표 계산이 끝나기 전까지는 관망을 기본값으로 둡니다.",
        "투자 판단 전에는 반드시 본인 기준의 손절가와 포지션 크기를 먼저 정합니다.",
      ];

  return {
    generatedAt: report.generatedAt,
    label: labelByTone[tone],
    tone,
    score,
    headline: headlineByTone[tone],
    summary,
    primarySymbol: primary?.symbol ?? null,
    primaryMarketType: primary?.marketType ?? null,
    evidence: {
      candidateCount: items.length,
      technicalCount: technicalItems.length,
      averagePriorityScore: priorityAverage,
      averageTechnicalScore: technicalAverage,
      bullishTechnicalCount,
      bearishTechnicalCount,
      overboughtCount,
      highVolatilityCount,
      volumeExpansionCount,
      extremeFundingCount,
      totalVolume24hUsd,
      averageChange24hPercent,
    },
    strengths,
    risks,
    actionPlan,
  };
}

function averageFinite(values: number[], fallback: number) {
  const finite = values.filter(value => Number.isFinite(value) && value > 0);
  return finite.length ? average(finite) : fallback;
}

export function buildFuturesSelectedSymbolAnalysis(
  row: FuturesMarketRow,
  indicators: FuturesTechnicalIndicators,
): FuturesSelectedSymbolAnalysis {
  const current = indicators.latestClose || row.price;
  const dayRange = row.high24h - row.low24h;
  const dayPositionPercent = dayRange > 0 ? clamp(((row.price - row.low24h) / dayRange) * 100, 0, 100) : 50;
  const emaTrendUp = indicators.ema20 >= indicators.ema50;
  const priceAboveEma20 = current >= indicators.ema20;
  const macdPositive = indicators.macdHistogram >= 0 && indicators.macd >= indicators.macdSignal;
  const rsiConstructive = indicators.rsi14 >= 52 && indicators.rsi14 < 70;
  const rsiOverheated = indicators.rsi14 >= 70;
  const stochOverheated = indicators.stochastic14 >= 80;
  const bollingerUpperRisk = indicators.bollingerPercentB >= 90;
  const volumeExpanded = indicators.volume20Ratio >= 120;
  const highVolatility = indicators.atrPercent >= 7;
  const activeVolatility = indicators.atrPercent >= 4 && indicators.atrPercent < 7;
  const fundingAbs = Math.abs(row.fundingRate ?? 0);
  const fundingCrowded = fundingAbs >= 0.0005;
  const fundingExtreme = fundingAbs >= 0.001;
  const oiHeavy = (row.openInterestToVolumePercent ?? 0) >= 60;

  const trendAdjustment = emaTrendUp && priceAboveEma20 ? 3 : emaTrendUp || priceAboveEma20 ? 1 : -5;
  const momentumAdjustment = macdPositive ? 2 : -2;
  const rsiAdjustment = rsiConstructive ? 2 : rsiOverheated ? -2 : indicators.rsi14 <= 35 ? -3 : 0;
  const volumeAdjustment = volumeExpanded ? 2 : indicators.volume20Ratio <= 70 ? -2 : 0;
  const fundingPenalty = fundingExtreme ? 5 : fundingCrowded ? 3 : 0;
  const volatilityPenalty = highVolatility ? 4 : activeVolatility ? 1 : 0;
  const dayPositionPenalty = dayPositionPercent >= 85 ? 2 : dayPositionPercent <= 20 ? -1 : 0;
  const score = round(clamp(
    indicators.score
      + trendAdjustment
      + momentumAdjustment
      + rsiAdjustment
      + volumeAdjustment
      - fundingPenalty
      - volatilityPenalty
      - dayPositionPenalty,
    0,
    100,
  ), 1);

  const tone: FuturesSelectedSymbolAnalysisTone = score >= 85 && !fundingExtreme && !highVolatility
    ? "strong"
    : score >= 65 && !highVolatility
      ? "buy"
      : score >= 50
        ? "watch"
        : dayPositionPercent <= 25 && indicators.rsi14 <= 40
          ? "pullback"
          : "risk";
  const verdictByTone: Record<FuturesSelectedSymbolAnalysisTone, string> = {
    strong: "강한 추천",
    buy: "추천 우위",
    watch: "관망",
    pullback: "저점 반등 후보",
    risk: "리스크 우선",
  };
  const verdict = verdictByTone[tone];

  const supportValue = averageFinite([indicators.ema20, indicators.bollingerMiddle, row.low24h], current);
  const riskLineValue = Math.min(
    ...[indicators.ema50, indicators.bollingerLower, row.low24h].filter(value => Number.isFinite(value) && value > 0),
  );
  const fairLowValue = Math.min(indicators.ema20, indicators.bollingerMiddle);
  const fairHighValue = Math.max(indicators.ema20, indicators.bollingerMiddle);
  const resistanceValue = averageFinite([indicators.bollingerUpper, row.high24h], current);
  const breakoutValue = Math.max(row.high24h, indicators.bollingerUpper);

  const fundingText = row.fundingRate === null
    ? "펀딩비 자료가 없어 포지션 쏠림 판단은 제한됩니다."
    : `펀딩비 ${formatFunding(row.fundingRate)}로 ${fundingCrowded ? "포지션 쏠림을 반드시 확인해야 합니다." : "부담은 아직 제한적입니다."}`;
  const positionText = dayPositionPercent >= 80
    ? "24h 고점권"
    : dayPositionPercent <= 20
      ? "24h 저점권"
      : "24h 중립권";
  const summary = `기술 점수 ${indicators.score}, 24h ${formatPercent(row.change24hPercent)}, 거래대금 ${formatUsd(row.volume24hUsd)}, ${positionText} 위치를 함께 보면 ${emaTrendUp && macdPositive ? "추세와 모멘텀은 우호적" : "추세 확인이 아직 필요"}입니다. 다만 ${fundingCrowded || rsiOverheated || highVolatility ? "과열과 리스크 관리가 핵심" : "가격 확인 후 관심도를 높일 수 있는 구조"}입니다.`;

  const evidence: FuturesSelectedSymbolAnalysis["evidence"] = [
    {
      label: "추세",
      verdict: emaTrendUp && priceAboveEma20 ? "상승 추세 우위" : emaTrendUp ? "추세 전환 확인" : "추세 약세",
      detail: `현재가 ${formatPriceUsd(current)}, EMA20 ${formatPriceUsd(indicators.ema20)}, EMA50 ${formatPriceUsd(indicators.ema50)}입니다. ${emaTrendUp ? "단기 평균이 중기 평균 위에 있어 추세 구조는 우호적입니다." : "EMA20이 EMA50 아래라 추세 복원이 먼저 필요합니다."}`,
    },
    {
      label: "모멘텀",
      verdict: macdPositive && rsiConstructive ? "매수 압력 우세" : rsiOverheated || stochOverheated ? "단기 과열 경계" : "모멘텀 확인 필요",
      detail: `RSI ${round(indicators.rsi14, 2)}, Stochastic ${round(indicators.stochastic14, 2)}, MACD Histogram ${round(indicators.macdHistogram, 8)}입니다. ${macdPositive ? "MACD가 양의 방향이라 상승 모멘텀을 지지합니다." : "MACD가 약해 단기 추격은 보수적으로 봅니다."}`,
    },
    {
      label: "거래량",
      verdict: volumeExpanded ? "거래량 확장" : indicators.volume20Ratio <= 70 ? "거래량 부족" : "평균권",
      detail: `20봉 평균 대비 거래량은 ${round(indicators.volume20Ratio, 2)}%, 24h 거래대금은 ${formatUsd(row.volume24hUsd)}입니다. ${volumeExpanded ? "가격 움직임에 실제 참여가 붙은 상태입니다." : "거래량 확인 없이 방향을 확정하기는 어렵습니다."}`,
    },
    {
      label: "가격 위치",
      verdict: bollingerUpperRisk || dayPositionPercent >= 85 ? "고점 추격 경계" : dayPositionPercent <= 25 ? "저점 반등 관찰" : "균형권",
      detail: `24h 범위 내 위치는 ${round(dayPositionPercent, 1)}%, Bollinger %B는 ${round(indicators.bollingerPercentB, 2)}%입니다. ${bollingerUpperRisk ? "상단 밴드에 가까워 분할 접근이 필요합니다." : "밴드 안에서 다음 방향 확인이 가능합니다."}`,
    },
    {
      label: "변동성",
      verdict: highVolatility ? "고위험 변동성" : activeVolatility ? "거래 가능한 변동성" : "낮은 변동성",
      detail: `ATR은 ${round(indicators.atrPercent, 2)}%입니다. ${highVolatility ? "손절폭과 포지션 크기를 줄여야 합니다." : activeVolatility ? "움직임은 충분하지만 과도한 변동성은 아닙니다." : "돌파 확인 전까지 움직임이 작을 수 있습니다."}`,
    },
    {
      label: "펀딩/OI",
      verdict: fundingExtreme || oiHeavy ? "청산 쏠림 경계" : fundingCrowded ? "펀딩 부담" : "쏠림 제한",
      detail: `${fundingText} OI/거래대금은 ${row.openInterestToVolumePercent === null ? "자료 없음" : `${round(row.openInterestToVolumePercent, 2)}%`}입니다.`,
    },
  ];

  const strengths = [
    ...(emaTrendUp && priceAboveEma20 ? ["EMA20과 EMA50 기준 추세 배열이 우호적입니다."] : []),
    ...(macdPositive ? ["MACD가 양의 방향이라 단기 모멘텀이 살아 있습니다."] : []),
    ...(volumeExpanded ? ["평균 대비 거래량이 확장되어 가격 움직임의 신뢰도가 높아졌습니다."] : []),
    ...(row.volume24hUsd >= 1_000_000_000 ? ["24h 거래대금이 큰 편이라 체결 유동성 관찰 가치가 높습니다."] : []),
  ];
  if (!strengths.length) strengths.push("명확한 우위 신호가 부족해 다음 캔들 확인이 중요합니다.");

  const risks = [
    ...(fundingCrowded ? [`펀딩비 ${formatFunding(row.fundingRate)}로 포지션 쏠림과 청산 변동성을 경계해야 합니다.`] : []),
    ...(rsiOverheated || stochOverheated ? ["RSI 또는 Stochastic이 상단권이라 단기 추격 매수는 부담입니다."] : []),
    ...(dayPositionPercent >= 80 ? ["현재가가 24h 고점권에 있어 눌림 없는 진입은 손익비가 나빠질 수 있습니다."] : []),
    ...(highVolatility ? ["ATR이 높아 짧은 시간에 손절폭이 커질 수 있습니다."] : activeVolatility ? ["ATR이 활성 구간이라 포지션 크기를 과하게 잡으면 변동성 부담이 커집니다."] : []),
    ...(oiHeavy ? ["미결제약정이 거래대금 대비 높아 강제 청산 방향 전환에 취약할 수 있습니다."] : []),
  ];
  if (!risks.length) risks.push("뚜렷한 과열 신호는 적지만 선물 시장 특성상 급격한 펀딩비와 변동성 변화는 계속 확인해야 합니다.");

  const scenarios = [
    {
      title: "강세 지속",
      trigger: `${formatPriceUsd(breakoutValue)} 돌파 후 거래량이 20봉 평균 이상으로 유지`,
      expectation: `돌파가 유지되면 ${formatPriceUsd(resistanceValue)} 위 가격 발견 구간을 열 수 있습니다.`,
    },
    {
      title: "눌림 후 재평가",
      trigger: `${formatPriceUsd(supportValue)} 부근까지 조정된 뒤 RSI가 50 위에서 유지`,
      expectation: "추세가 살아 있으면 눌림 매수 후보로 재평가할 수 있습니다.",
    },
    {
      title: "무효화",
      trigger: `${formatPriceUsd(riskLineValue)} 이탈 또는 MACD Histogram 음전환 확대`,
      expectation: "추세 신뢰도가 낮아지므로 관망 또는 리스크 축소가 우선입니다.",
    },
  ];

  const actionPlan = [
    `첫 판단은 ${verdict}입니다. 결론부터 보면 ${row.symbol}은 ${score}점으로 추세·모멘텀·거래량을 동시에 확인해야 합니다.`,
    `${formatPriceUsd(breakoutValue)} 돌파가 거래량 확장과 같이 나오면 관심도를 높입니다.`,
    `${formatPriceUsd(supportValue)} 부근 눌림에서는 EMA20과 RSI 50 유지 여부를 확인합니다.`,
    `${formatPriceUsd(riskLineValue)} 이탈 시에는 분석을 무효화하고 리스크 축소를 우선합니다.`,
    fundingCrowded ? "펀딩비가 완화되기 전까지 과도한 레버리지 추격은 피합니다." : "펀딩비가 급변하면 같은 분석이라도 리스크 등급을 즉시 재평가합니다.",
  ];

  return {
    symbol: row.symbol,
    marketType: row.marketType,
    verdict,
    tone,
    score,
    headline: `결론: ${row.symbol}은 ${verdict}입니다. ${summary}`,
    summary,
    levels: {
      current: formatPriceUsd(current),
      support: formatPriceUsd(supportValue),
      riskLine: formatPriceUsd(riskLineValue),
      fairZone: `${formatPriceUsd(fairLowValue)} ~ ${formatPriceUsd(fairHighValue)}`,
      resistance: formatPriceUsd(resistanceValue),
      breakout: formatPriceUsd(breakoutValue),
    },
    evidence,
    strengths,
    risks,
    scenarios,
    actionPlan,
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
      `- 관찰 체크: ${item.watchPoints.join(" / ")}`,
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

  const finalJudgment = buildFuturesFinalJudgmentReport(report);
  lines.push(
    "",
    "## 최종 종합판단",
    "",
    `- 최종 판정: ${finalJudgment.label}`,
    `- 종합 점수: ${finalJudgment.score}`,
    `- 1순위 후보: ${finalJudgment.primarySymbol ?? "자료 부족"}`,
    `- 후보 수: ${finalJudgment.evidence.candidateCount}`,
    `- 기술 지표 확보: ${finalJudgment.evidence.technicalCount}/${finalJudgment.evidence.candidateCount}`,
    `- 평균 기술 점수: ${finalJudgment.evidence.averageTechnicalScore ?? "대기"}`,
    `- 합산 24h 거래대금: ${formatUsd(finalJudgment.evidence.totalVolume24hUsd)}`,
    `- 평균 24h 등락률: ${formatPercent(finalJudgment.evidence.averageChange24hPercent)}`,
    `- 핵심 요약: ${finalJudgment.summary}`,
    "",
    "### 근거",
    ...finalJudgment.strengths.map(strength => `- ${strength}`),
    "",
    "### 리스크",
    ...finalJudgment.risks.map(risk => `- ${risk}`),
    "",
    "### 실행 체크",
    ...finalJudgment.actionPlan.map(action => `- ${action}`),
  );

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
