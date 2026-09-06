import type { FuturesCandle, FuturesMarketRow, FuturesMarketType } from "./binanceFuturesAnalysis";

export type ResearchKey = `${FuturesMarketType}:${string}`;
export type ResearchTimeframe = "1h" | "4h";
export type ResearchDirection = "up" | "down" | "mixed" | "unknown";
export type ResearchCandlesByKey = Partial<Record<ResearchKey, Partial<Record<ResearchTimeframe, FuturesCandle[]>>>>;

export type ResearchFrameSummary = {
  timeframe: ResearchTimeframe;
  status: "ready" | "missing" | "insufficient" | "stale";
  direction: "up" | "down" | "sideways" | "unknown";
  barCount: number;
  lastClosedAt: string | null;
  summary: string;
  metrics: {
    close: number; ema20: number; ema50: number; macdHistogram: number;
    rsi14: number; atr: number; relativeVolume: number | null;
    rangeLow: number; rangeHigh: number;
  } | null;
};

export type ResearchCandidate = {
  key: ResearchKey;
  row: FuturesMarketRow;
  verdict: string;
  direction: ResearchDirection;
  evidence: Array<{ label: string; value: string; detail: string }>;
  risks: string[];
  scenarios: Array<{
    title: string;
    status: "watch" | "waiting" | "invalidated" | "unavailable";
    condition: string;
    invalidation: string;
  }>;
  frames: ResearchFrameSummary[];
  coverage: {
    status: "complete" | "partial" | "missing" | "stale";
    freshFrames: number; availableFrames: number; expectedFrames: number; detail: string;
  };
};

export type FuturesResearchReport = {
  generatedAt: string;
  overview: {
    regime: string; headline: string; summary: string;
    stats: {
      representativeCount: number; sourceContractCount: number; representativeVolume24hUsd: number;
      candidateCount: number; freshFrameCount: number; expectedFrameCount: number;
      top3VolumeSharePercent: number | null; fundingCoveredCount: number;
      extremeFundingCount: number; medianChange24hPercent: number | null; sourceLastUpdated: string | null;
    };
    breadth: { positive: number; negative: number; unchanged: number; positivePercent: number | null; label: string };
    riskFlags: string[];
  };
  candidates: ResearchCandidate[];
  method: string[];
};

export const FUTURES_RESEARCH_SOURCES = [
  { title: "Binance 24시간 통계 · 캔들 · 펀딩 주기", url: "https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data" },
  { title: "Binance COIN-M 거래량 정의", url: "https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data" },
] as const;

const HOUR = 3_600_000;
const FRAME_MS: Record<ResearchTimeframe, number> = { "1h": HOUR, "4h": 4 * HOUR };
const FRAMES: ResearchTimeframe[] = ["1h", "4h"];
const STABLE_QUOTES = new Set(["USD", "USDT", "USDC", "FDUSD", "BUSD", "TUSD", "USDP", "USD1"]);
const EXTREME_FUNDING = 0.001;
const VOLUME_CONFIRMATION = 1.2;
const keyOf = (row: FuturesMarketRow): ResearchKey => `${row.marketType}:${row.symbol}`;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const mean = (values: number[]) => values.reduce((sum, value) => sum + value / values.length, 0);
const numberText = (value: number, digits = 2) => Number.isFinite(value) ? value.toLocaleString("ko-KR", { maximumFractionDigits: digits }) : "확인 불가";
const priceText = (value: number) => `$${finite(value) && value > 0 && value < 0.000001 ? value.toExponential(4) : numberText(value, value < 1 ? 8 : 2)}`;
const percentText = (value: number) => `${value > 0 ? "+" : ""}${numberText(value)}%`;
const usdText = (value: number) => value >= 1e9 ? `$${numberText(value / 1e9)}B` : value >= 1e6 ? `$${numberText(value / 1e6)}M` : priceText(value);
const timestamp = (value: string) => Date.parse(value);
const freshTicker = (row: FuturesMarketRow, now: number) => {
  const time = timestamp(row.lastUpdated);
  return finite(time) && time <= now + 60_000 && now - time <= 15 * 60_000;
};

function eligibleRows(rows: FuturesMarketRow[]) {
  return rows.filter(row => row.assetClass === "crypto" && row.baseAsset.trim() && row.symbol.trim()
    && STABLE_QUOTES.has(row.quoteAsset.toUpperCase())
    && finite(row.price) && row.price > 0 && finite(row.volume24hUsd) && row.volume24hUsd >= 0
    && finite(row.change24hPercent));
}

function byLiquidity(a: FuturesMarketRow, b: FuturesMarketRow) {
  return b.volume24hUsd - a.volume24hUsd || keyOf(a).localeCompare(keyOf(b), "en");
}

function representatives(rows: FuturesMarketRow[]) {
  const groups = new Map<string, FuturesMarketRow[]>();
  for (const row of eligibleRows(rows)) {
    const asset = row.baseAsset.toUpperCase();
    groups.set(asset, [...(groups.get(asset) ?? []), row]);
  }
  return Array.from(groups.values()).map(group => {
    const preferred = group.filter(row => row.marketType === "USD-M" && row.contractType === "PERPETUAL" && row.volume24hUsd > 0);
    return [...(preferred.length ? preferred : group)].sort(byLiquidity)[0];
  }).sort(byLiquidity);
}

/** Fixed, diverse watch coverage: liquid leaders, momentum, pullback and funding. */
export function selectResearchCandidates(rows: FuturesMarketRow[], limit = 6): FuturesMarketRow[] {
  const count = finite(limit) ? Math.max(0, Math.min(6, Math.floor(limit))) : 6;
  const pool = representatives(rows).filter(row => row.volume24hUsd > 0).slice(0, 50);
  const selected: FuturesMarketRow[] = [];
  const add = (row?: FuturesMarketRow) => {
    if (row && selected.length < count && !selected.some(item => item.baseAsset.toUpperCase() === row.baseAsset.toUpperCase())) selected.push(row);
  };
  pool.slice(0, 2).forEach(add);
  add([...pool].filter(row => row.change24hPercent > 0).sort((a, b) => b.change24hPercent - a.change24hPercent || byLiquidity(a, b))[0]);
  add([...pool].filter(row => row.change24hPercent < 0).sort((a, b) => a.change24hPercent - b.change24hPercent || byLiquidity(a, b))[0]);
  add([...pool].filter(row => row.contractType === "PERPETUAL" && finite(row.fundingRate) && Math.abs(row.fundingRate) >= EXTREME_FUNDING)
    .sort((a, b) => Math.abs(b.fundingRate!) - Math.abs(a.fundingRate!) || byLiquidity(a, b))[0]);
  pool.forEach(add);
  return selected;
}

function ema(values: number[], period: number) {
  const alpha = 2 / (period + 1);
  const output = [values[0]];
  for (let i = 1; i < values.length; i++) output.push(output[i - 1] + alpha * (values[i] - output[i - 1]));
  return output;
}

function rsi14(closes: number[]) {
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= 14; i++) {
    gain += Math.max(0, closes[i] - closes[i - 1]) / 14;
    loss += Math.max(0, closes[i - 1] - closes[i]) / 14;
  }
  for (let i = 15; i < closes.length; i++) {
    gain = gain * 13 / 14 + Math.max(0, closes[i] - closes[i - 1]) / 14;
    loss = loss * 13 / 14 + Math.max(0, closes[i - 1] - closes[i]) / 14;
  }
  return gain === 0 && loss === 0 ? 50 : loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}

function frameSummary(timeframe: ResearchTimeframe, input: FuturesCandle[] | undefined, now: number): ResearchFrameSummary {
  const duration = FRAME_MS[timeframe];
  const valid = (input ?? []).filter(candle => [candle.openTime, candle.open, candle.high, candle.low, candle.close, candle.volume].every(finite)
    && candle.openTime >= 0 && candle.openTime + duration <= now
    && candle.low > 0 && candle.high >= Math.max(candle.open, candle.close)
    && candle.low <= Math.min(candle.open, candle.close) && candle.high >= candle.low && candle.volume >= 0);
  const ordered = Array.from(new Map(valid.map(candle => [candle.openTime, candle])).values()).sort((a, b) => a.openTime - b.openTime);
  let suffixStart = Math.max(0, ordered.length - 1);
  while (suffixStart > 0 && ordered[suffixStart].openTime - ordered[suffixStart - 1].openTime === duration) suffixStart--;
  // EMA and RSI warm-up must not cross a missing candle, even far back in history.
  const bars = ordered.slice(suffixStart);
  const last = bars.at(-1);
  const lastClosedAt = last ? new Date(last.openTime + duration).toISOString() : null;
  const base: ResearchFrameSummary = { timeframe, status: "missing", direction: "unknown", barCount: bars.length, lastClosedAt, summary: "유효한 마감봉이 없습니다.", metrics: null };
  if (!last) return base;
  if (bars.length < 60) {
    return { ...base, status: "insufficient", summary: `연속 마감봉 60개가 필요합니다. 유효 ${bars.length}개; 누락 구간은 추정하지 않습니다.` };
  }
  const closes = bars.map(candle => candle.close);
  const ema20 = ema(closes, 20).at(-1)!;
  const ema50 = ema(closes, 50).at(-1)!;
  const fast = ema(closes, 12);
  const slow = ema(closes, 26);
  const macd = fast.map((value, index) => value - slow[index]);
  const macdHistogram = macd.at(-1)! - ema(macd, 9).at(-1)!;
  const previousVolume = mean(bars.slice(-21, -1).map(candle => candle.volume));
  const relativeVolume = previousVolume > 0 ? last.volume / previousVolume : null;
  const atr = mean(bars.slice(-14).map((candle, index) => {
    const previousClose = bars[bars.length - 15 + index].close;
    return Math.max(candle.high - candle.low, Math.abs(candle.high - previousClose), Math.abs(candle.low - previousClose));
  }));
  const metrics = { close: last.close, ema20, ema50, macdHistogram, rsi14: rsi14(closes), atr,
    relativeVolume, rangeLow: Math.min(...bars.slice(-20).map(candle => candle.low)), rangeHigh: Math.max(...bars.slice(-20).map(candle => candle.high)) };
  if (Object.values(metrics).some(value => value !== null && !finite(value))) return { ...base, status: "insufficient", summary: "수치 범위를 벗어난 봉으로 지표 계산을 보류합니다." };
  if (now - (last.openTime + duration) > duration * 1.5) return { ...base, metrics, status: "stale", summary: "마지막 마감봉이 오래되어 현재 방향 판단을 보류합니다." };
  const direction = last.close > ema20 && ema20 > ema50 && macdHistogram > 0 ? "up"
    : last.close < ema20 && ema20 < ema50 && macdHistogram < 0 ? "down" : "sideways";
  const trend = direction === "up" ? "가격·EMA·MACD 상승 정렬" : direction === "down" ? "가격·EMA·MACD 하락 정렬" : "가격·EMA·MACD 방향 혼재";
  return { ...base, metrics, status: "ready", direction, summary: `${trend}. 직전 20봉 대비 거래량 ${relativeVolume === null ? "확인 불가" : `${numberText(relativeVolume)}배`}.` };
}

function candidateReport(row: FuturesMarketRow, candles: ResearchCandlesByKey, now: number): ResearchCandidate {
  const key = keyOf(row);
  const frames = FRAMES.map(frame => frameSummary(frame, candles[key]?.[frame], now));
  const fresh = frames.filter(frame => frame.status === "ready");
  const available = frames.filter(frame => frame.metrics !== null);
  const tickerFresh = freshTicker(row, now);
  const direction: ResearchDirection = fresh.length !== 2 || !tickerFresh ? "unknown"
    : fresh.every(frame => frame.direction === "up") ? "up"
    : fresh.every(frame => frame.direction === "down") ? "down" : "mixed";
  const confirmedVolume = fresh.length === 2 && fresh.every(frame => frame.metrics!.relativeVolume !== null && frame.metrics!.relativeVolume! >= VOLUME_CONFIRMATION);
  const coverage: ResearchCandidate["coverage"] = {
    status: fresh.length === 2 && tickerFresh ? "complete" : frames.some(frame => frame.status === "stale") || !tickerFresh ? "stale" : fresh.length ? "partial" : "missing",
    freshFrames: fresh.length, availableFrames: available.length, expectedFrames: 2,
    detail: `최신 마감봉 ${fresh.length}/2 시간대 · ${tickerFresh ? "시세 15분 이내" : "시세 갱신 필요"}`,
  };
  let verdict = direction === "unknown" ? "자료 보완 후 판단"
    : direction === "mixed" ? "시간대 방향 혼재 · 관찰 대기"
    : `${direction === "up" ? "상승" : "하락"} 정렬 · ${confirmedVolume ? "거래량 동반" : "참여 확인 대기"}`;
  const funding = row.contractType === "PERPETUAL" && finite(row.fundingRate) ? row.fundingRate : null;
  const evidence: ResearchCandidate["evidence"] = [
    { label: "24시간 움직임", value: `${percentText(row.change24hPercent)} · ${usdText(row.volume24hUsd)}`, detail: "UTC 하루가 아닌 최근 24시간 이동 구간의 등락률과 대표 계약 거래대금입니다." },
    ...frames.map(frame => ({ label: `${frame.timeframe} 마감봉`, value: frame.status === "ready" ? frame.direction === "up" ? "상승 정렬" : frame.direction === "down" ? "하락 정렬" : "혼재" : "확인 대기", detail: frame.summary })),
    { label: "펀딩 정산 비율", value: funding === null ? "확인 불가 / 적용 없음" : `${numberText(funding * 100, 4)}%`, detail: funding === null ? "누락된 값을 0%로 간주하지 않습니다." : `${funding > 0 ? "양수는 롱의 지급, 숏의 수취" : funding < 0 ? "음수는 숏의 지급, 롱의 수취" : "현재 제공 비율은 0%"}를 뜻합니다. 계약별 정산 간격을 확인해야 하며 일간 수익률로 환산하지 않습니다.` },
  ];
  const risks: string[] = [];
  if (coverage.status !== "complete") risks.push(`${coverage.detail}. 누락·지연된 시간대는 방향 근거에서 제외했습니다.`);
  if (direction === "mixed") risks.push("1h와 4h가 같은 방향을 확인하지 못했습니다. 한 시간대만으로 추세를 확정하지 않습니다.");
  if (!confirmedVolume) risks.push("두 시간대 모두 직전 20봉 평균의 1.2배 이상 거래량을 확인해야 참여 확장으로 분류합니다.");
  for (const frame of fresh) {
    const metrics = frame.metrics!;
    if (metrics.rsi14 >= 70 || metrics.rsi14 <= 30) risks.push(`${frame.timeframe} RSI ${numberText(metrics.rsi14)}: ${metrics.rsi14 >= 70 ? "과열" : "침체"} 구간입니다. 단독 매도·반등 신호가 아닙니다.`);
    if (metrics.atr / metrics.close >= 0.05) risks.push(`${frame.timeframe} 평균 변동폭이 종가의 5% 이상입니다. 레벨 이탈 폭도 커질 수 있습니다.`);
  }
  if (funding !== null && Math.abs(funding) >= EXTREME_FUNDING) risks.push(`정산 비율 절댓값이 0.1% 이상으로 ${funding > 0 ? "롱" : "숏"} 비용 압력이 큽니다. 실제 정산 간격은 별도 확인이 필요합니다.`);
  if (row.marketType === "COIN-M") risks.push("COIN-M 거래대금은 기초자산 거래량 × 현재가의 추정치입니다.");

  const scenarios: ResearchCandidate["scenarios"] = [];
  const reference = frames.find(frame => frame.timeframe === "1h" && frame.status === "ready")?.metrics;
  if ((direction === "up" || direction === "down") && reference) {
    const upper = reference.rangeHigh + reference.atr * 0.25;
    const lower = reference.rangeLow - reference.atr * 0.25;
    if (!finite(upper) || !finite(lower) || lower <= 0 || upper <= lower) {
      verdict = "관찰 범위 재설정 대기";
      scenarios.push({ title: "변동 범위 재확인", status: "unavailable",
        condition: "최근 변동폭으로 양수인 관찰 경계를 정할 수 없습니다. 새 마감봉으로 고저 범위가 안정된 뒤 다시 계산합니다.",
        invalidation: "유효한 상·하단 경계를 확보하기 전에는 방향 관찰 조건을 적용하지 않습니다." });
    } else {
    const up = direction === "up";
    const trigger = up ? upper : lower;
    const invalidation = up ? lower : upper;
    const invalidated = up ? row.price <= invalidation : row.price >= invalidation;
    const alreadyBeyond = up ? row.price >= trigger : row.price <= trigger;
    if (invalidated) verdict = "기존 관찰 무효 · 새 마감 대기";
    scenarios.push({
      title: `${up ? "상승" : "하락"} 방향 지속 관찰`,
      status: invalidated ? "invalidated" : alreadyBeyond || !confirmedVolume ? "waiting" : "watch",
      condition: invalidated ? `현재가 ${priceText(row.price)}가 반대 경계 ${priceText(invalidation)}를 이미 넘어 기존 관찰 조건을 무효화합니다. 새 마감봉으로 범위를 다시 계산합니다.`
        : alreadyBeyond ? `현재가 ${priceText(row.price)}가 관찰 경계 ${priceText(trigger)}를 이미 통과했습니다. 추가 돌파를 예고하지 않고 새 1h 마감과 경계 재확인, 두 시간대 거래량 확장을 기다립니다.`
        : `${priceText(trigger)} ${up ? "위" : "아래"}에서 다음 1h 봉이 마감하고, 1h·4h 방향 정렬과 각각 거래량 1.2배 이상이 함께 유지되는지 확인합니다.`,
      invalidation: `현재가가 ${priceText(invalidation)} ${up ? "아래" : "위"}를 이탈하거나 두 시간대 방향이 엇갈리면 이 관찰 조건을 폐기하고 다음 1h 마감을 재확인합니다.`,
    });
    }
  } else {
    scenarios.push({ title: "근거 정렬 대기", status: direction === "unknown" ? "unavailable" : "waiting",
      condition: direction === "unknown" ? "최신 시세와 1h·4h 연속 마감봉 각 60개를 확보한 뒤 다시 판단합니다." : "1h·4h의 가격·EMA20/50·MACD가 같은 방향을 가리키고 거래량이 동반될 때만 방향 관찰 조건을 만듭니다.",
      invalidation: "자료가 누락되거나 지연되면 이전 판단을 이어 쓰지 않습니다." });
  }
  return { key, row, verdict, direction, evidence, risks, scenarios, frames, coverage };
}

export function buildFuturesResearchReport(input: { rows: FuturesMarketRow[]; candlesByKey: ResearchCandlesByKey; generatedAt?: string }): FuturesResearchReport {
  const parsedTime = input.generatedAt === undefined ? Date.now() : Date.parse(input.generatedAt);
  if (!finite(parsedTime)) throw new Error("A valid generatedAt timestamp is required.");
  const generatedAt = new Date(parsedTime).toISOString();
  const universe = representatives(input.rows);
  const freshRows = universe.filter(row => freshTicker(row, parsedTime));
  const candidates = selectResearchCandidates(input.rows).map(row => candidateReport(row, input.candlesByKey, parsedTime));
  const positive = freshRows.filter(row => row.change24hPercent > 0).length;
  const negative = freshRows.filter(row => row.change24hPercent < 0).length;
  const unchanged = freshRows.length - positive - negative;
  const positivePercent = freshRows.length ? positive / freshRows.length * 100 : null;
  const totalVolume = universe.reduce((sum, row) => sum + row.volume24hUsd, 0);
  const fundingRows = universe.filter(row => row.contractType === "PERPETUAL" && finite(row.fundingRate));
  const changes = freshRows.map(row => row.change24hPercent).sort((a, b) => a - b);
  const middle = Math.floor(changes.length / 2);
  const median = changes.length ? changes.length % 2 ? changes[middle] : mean([changes[middle - 1], changes[middle]]) : null;
  const freshFrameCount = candidates.reduce((sum, candidate) => sum + candidate.coverage.freshFrames, 0);
  const expectedFrameCount = candidates.length * 2;
  const regime = freshRows.length < 3 ? "관찰 표본 부족" : positive / freshRows.length >= 0.6 ? "24시간 상승 종목 우세" : negative / freshRows.length >= 0.6 ? "24시간 하락 종목 우세" : "24시간 방향 혼재";
  const riskFlags: string[] = [];
  if (freshRows.length < universe.length) riskFlags.push(`${universe.length - freshRows.length}개 대표 계약의 시세가 지연되어 등락 분포에서 제외했습니다.`);
  if (freshFrameCount < expectedFrameCount) riskFlags.push(`후보 마감봉 근거 ${freshFrameCount}/${expectedFrameCount} 시간대 확보. 미확보·지연 시간대는 추정하지 않습니다.`);
  if (universe.length < 3) riskFlags.push("대표 계약 표본이 3개 미만이므로 시장 전체 방향으로 일반화하지 않습니다.");
  const extremeFundingCount = fundingRows.filter(row => Math.abs(row.fundingRate!) >= EXTREME_FUNDING).length;
  if (extremeFundingCount) riskFlags.push(`${extremeFundingCount}개 대표 계약의 펀딩 정산 비율 절댓값이 0.1% 이상입니다.`);
  const sourceTimes = universe.map(row => timestamp(row.lastUpdated)).filter(time => finite(time) && time <= parsedTime + 60_000);
  return {
    generatedAt,
    overview: {
      regime, headline: universe.length ? `${regime} · 후보 ${candidates.length}개를 마감봉으로 확인` : "유효한 가상자산 대표 계약이 없습니다.",
      summary: `기초자산별 대표 계약 ${universe.length}개 중 최신 시세 ${freshRows.length}개에서 상승 ${positive}개, 하락 ${negative}개입니다. 합산 거래대금 ${usdText(totalVolume)}은 선택된 대표 계약만의 규모이며 전체 거래소 합계가 아닙니다.`,
      stats: { representativeCount: universe.length, sourceContractCount: eligibleRows(input.rows).length, representativeVolume24hUsd: finite(totalVolume) ? totalVolume : 0,
        candidateCount: candidates.length, freshFrameCount, expectedFrameCount,
        top3VolumeSharePercent: totalVolume > 0 && finite(totalVolume) ? universe.slice(0, 3).reduce((sum, row) => sum + row.volume24hUsd / totalVolume * 100, 0) : null,
        fundingCoveredCount: fundingRows.length, extremeFundingCount, medianChange24hPercent: median,
        sourceLastUpdated: sourceTimes.length ? new Date(Math.max(...sourceTimes)).toISOString() : null },
      breadth: { positive, negative, unchanged, positivePercent, label: `최신 시세 대표 계약 ${freshRows.length}/${universe.length}개 · 최근 24시간 등락 분포` },
      riskFlags,
    },
    candidates,
    method: [
      "가상자산·달러/스테이블코인 호가 계약만 사용합니다. 같은 기초자산은 거래대금이 있는 USD-M 무기한 계약 중 최대 거래대금 계약을 우선하고, 없으면 가장 유동적인 계약 1개로 대표합니다. 스테이블코인은 1달러 근사입니다.",
      "대표 계약 유동성 상위 50개에서 거래대금 상위 2개, 상승·하락 변동 후보, 절댓값 0.1% 이상 펀딩 후보를 겹치지 않게 고르고 남은 자리는 유동성 순으로 채웁니다. 최대 6개이며 등락률만의 순위가 아닙니다.",
      "24시간 통계는 이동 구간입니다. 등락 분포·중앙값은 15분 이내 시세만 사용하며 거래대금·집중도·펀딩 통계는 대표 계약 스냅샷을 사용합니다. COIN-M 금액은 현재가 환산 추정치입니다.",
      "생성 시각 이전에 마감한 유효 OHLCV만 사용합니다. 마지막 누락 구간 이후 연속된 봉만으로 지표를 계산하며 최소 60봉이 필요합니다. 마지막 마감 후 해당 간격의 1.5배가 지나면 지연 자료로 분류합니다.",
      "종가 > EMA20 > EMA50 및 MACD(12,26,9) 히스토그램 양수일 때 상승, 반대 조건이면 하락입니다. 1h와 4h가 모두 확인되어야 방향을 제시하고 두 시간대 각각 직전 20봉 평균 거래량의 1.2배 이상을 참여 확인 기준으로 사용합니다.",
      "RSI14의 70/30은 과열·침체 맥락만 제공합니다. 관찰 경계는 1h 최근 20개 마감봉 고저가에 14봉 평균 실제 변동폭(ATR)의 0.25배를 더하거나 뺀 값이며 가격 목표가가 아닙니다.",
      "펀딩은 제공된 정산 비율입니다. 양수는 롱 지급, 음수는 숏 지급을 뜻합니다. 계약별 정산 간격을 확인하지 않았으므로 고정 8시간·일간·연간 수익률로 환산하지 않습니다.",
      "명시된 고정 계산 규칙에 따른 관찰 자료이며 예측 확률을 제공하지 않습니다. 각 조건의 충족 여부와 자료 갱신 시각을 함께 확인해야 합니다.",
      ...FUTURES_RESEARCH_SOURCES.map(source => `${source.title}: ${source.url}`),
    ],
  };
}

export function buildFuturesResearchMarkdown(report: FuturesResearchReport): string {
  const lines = ["# KJHSTOCK 시장 근거 리포트", "", `생성 시각: ${report.generatedAt}`, "", `## ${report.overview.headline}`, "", report.overview.summary,
    `- ${report.overview.breadth.label}`, `- 마감봉 근거: ${report.overview.stats.freshFrameCount}/${report.overview.stats.expectedFrameCount} 시간대`,
    ...report.overview.riskFlags.map(risk => `- 확인 사항: ${risk}`)];
  for (const candidate of report.candidates) {
    lines.push("", `## ${candidate.row.symbol} · ${candidate.row.marketType}`, "", `**${candidate.verdict}**`, candidate.coverage.detail,
      ...candidate.evidence.map(item => `- ${item.label}: ${item.value} / ${item.detail}`),
      ...candidate.frames.map(frame => `- ${frame.timeframe} 마지막 마감: ${frame.lastClosedAt ?? "없음"} · 유효 ${frame.barCount}봉 · ${frame.summary}`),
      ...candidate.risks.map(risk => `- 주의: ${risk}`));
    for (const scenario of candidate.scenarios) lines.push(`- ${scenario.title}: ${scenario.condition}`, `  - 무효화: ${scenario.invalidation}`);
  }
  lines.push("", "## 계산 기준과 출처", "", ...report.method.map(item => `- ${item}`));
  return lines.join("\n");
}
