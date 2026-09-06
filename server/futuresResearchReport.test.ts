import { describe, expect, it } from "vitest";
import type { FuturesCandle, FuturesMarketRow } from "../shared/binanceFuturesAnalysis";
import {
  buildFuturesResearchMarkdown,
  buildFuturesResearchReport,
  selectResearchCandidates,
  type ResearchCandlesByKey,
  type ResearchKey,
} from "../shared/futuresResearchReport";

const GENERATED_AT = "2026-09-06T12:00:00.000Z";
const NOW = Date.parse(GENERATED_AT);
const HOUR = 3_600_000;

function row(symbol = "BTCUSDT", overrides: Partial<FuturesMarketRow> = {}): FuturesMarketRow {
  return {
    rank: 1, marketType: "USD-M", assetClass: "crypto", symbol,
    pair: symbol, baseAsset: symbol.replace(/USDT$/, ""), quoteAsset: "USDT", contractType: "PERPETUAL",
    price: 220, high24h: 240, low24h: 180, change24hPercent: 2,
    baseVolume24h: 1_000, volume24hUsd: 10_000_000, fundingRate: 0.0001,
    markPrice: 220, nextFundingTime: "2026-09-06T16:00:00.000Z", openInterestUsd: null,
    openInterestToVolumePercent: null, lastUpdated: GENERATED_AT, signal: "bullish", ...overrides,
  };
}

function candles(hours: number, direction: "up" | "down" | "flat" = "up", endTime = NOW, count = 80): FuturesCandle[] {
  return Array.from({ length: count }, (_, index) => {
    const offset = index * 0.8 + index ** 2 * 0.01;
    const close = direction === "up" ? 100 + offset : direction === "down" ? 400 - offset : 220;
    return { openTime: endTime - (count - index) * hours * HOUR, open: close, high: close + 1,
      low: close - 1, close, volume: index === count - 1 ? 240 : 100 };
  });
}

function completeFrames(target: FuturesMarketRow, direction: "up" | "down" | "flat" = "up"): ResearchCandlesByKey {
  return { [`${target.marketType}:${target.symbol}`]: { "1h": candles(1, direction), "4h": candles(4, direction) } };
}

function report(rows: FuturesMarketRow[], candlesByKey: ResearchCandlesByKey = {}) {
  return buildFuturesResearchReport({ rows, candlesByKey, generatedAt: GENERATED_AT });
}

describe("futures research universe", () => {
  it("handles an empty universe without fabricating a market direction", () => {
    const result = report([]);
    expect(result.candidates).toEqual([]);
    expect(result.overview.stats).toMatchObject({ representativeCount: 0, expectedFrameCount: 0, medianChange24hPercent: null });
    expect(result.overview.breadth.positivePercent).toBeNull();
    expect(result.overview.headline).toContain("없습니다");
    expect(buildFuturesResearchMarkdown(result)).not.toMatch(/NaN|Infinity|undefined/);
  });

  it("excludes invalid prices, amounts, changes, non-dollar quotes and TradeFi", () => {
    const result = report([
      row(), row("NANUSDT", { price: Number.NaN }), row("INFUSDT", { volume24hUsd: Infinity }),
      row("NEGUSDT", { volume24hUsd: -1 }), row("CHANGEUSDT", { change24hPercent: Number.NaN }),
      row("ETHBTC", { quoteAsset: "BTC" }), row("SPYUSDT", { assetClass: "tradefi" }),
    ]);
    expect(result.overview.stats.sourceContractCount).toBe(1);
    expect(result.overview.stats.representativeCount).toBe(1);
    expect(buildFuturesResearchMarkdown(result)).not.toMatch(/NaN|Infinity/);
  });

  it("deduplicates base assets and prefers the most liquid USD-M perpetual", () => {
    const preferred = row("BTCUSDC", { baseAsset: "BTC", quoteAsset: "USDC", volume24hUsd: 20_000_000 });
    const rows = [row(), preferred,
      row("BTCUSD_PERP", { marketType: "COIN-M", quoteAsset: "USD", baseAsset: "BTC", volume24hUsd: 90_000_000 }),
      row("BTCUSDT_DELIVERY", { contractType: "CURRENT_QUARTER", baseAsset: "BTC", volume24hUsd: 80_000_000 }),
      row("ETHUSDT", { volume24hUsd: 5_000_000 }),
    ];
    expect(selectResearchCandidates(rows)[0]).toBe(preferred);
    const result = report(rows);
    expect(result.overview.stats).toMatchObject({ sourceContractCount: 5, representativeCount: 2, representativeVolume24hUsd: 25_000_000, top3VolumeSharePercent: 100 });
    expect(result.overview.breadth.positive).toBe(2);
  });

  it("selects liquid leaders and diverse reasons deterministically, with a hard cap of six", () => {
    const rows = Array.from({ length: 9 }, (_, index) => row(`TOKEN${index}USDT`, {
      volume24hUsd: 100_000_000 - index * 5_000_000, change24hPercent: index === 7 ? 25 : index === 6 ? -15 : 1,
      fundingRate: index === 8 ? -0.002 : 0.0001,
    }));
    const selected = selectResearchCandidates(rows, 100).map(item => item.symbol);
    expect(selected).toEqual(["TOKEN0USDT", "TOKEN1USDT", "TOKEN7USDT", "TOKEN6USDT", "TOKEN8USDT", "TOKEN2USDT"]);
    expect(selectResearchCandidates([...rows].reverse(), 100).map(item => item.symbol)).toEqual(selected);
    expect(selectResearchCandidates(rows, 0)).toEqual([]);
    expect(selectResearchCandidates(rows, 1)).toEqual([rows[0]]);
  });

  it("labels representative breadth and excludes stale tickers from its median", () => {
    const result = report([
      row("AUSDT", { change24hPercent: 2 }), row("BUSDT", { change24hPercent: -4 }),
      row("CUSDT", { change24hPercent: 99, lastUpdated: new Date(NOW - HOUR).toISOString() }),
    ]);
    expect(result.overview.breadth).toMatchObject({ positive: 1, negative: 1, positivePercent: 50 });
    expect(result.overview.breadth.label).toContain("2/3");
    expect(result.overview.stats.medianChange24hPercent).toBe(-1);
    expect(result.overview.riskFlags.join(" ")).toContain("시세가 지연");
  });
});

describe("closed-candle research evidence", () => {
  it("leaves missing and partial timeframes unknown despite a bullish old signal", () => {
    const target = row();
    expect(report([target]).candidates[0]).toMatchObject({ direction: "unknown", coverage: { status: "missing", freshFrames: 0 } });
    const result = report([target], { "USD-M:BTCUSDT": { "1h": candles(1) } }).candidates[0];
    expect(result.direction).toBe("unknown");
    expect(result.coverage).toMatchObject({ status: "partial", freshFrames: 1 });
    expect(result.scenarios[0].status).toBe("unavailable");
  });

  it.each(["up", "down"] as const)("confirms %s only when both fresh timeframes agree", direction => {
    const target = row("BTCUSDT", { price: direction === "up" ? 220 : 280 });
    const candidate = report([target], completeFrames(target, direction)).candidates[0];
    expect(candidate.direction).toBe(direction);
    expect(candidate.coverage).toMatchObject({ status: "complete", freshFrames: 2 });
    expect(candidate.verdict).toContain("거래량 동반");
    expect(candidate.frames.every(frame => frame.metrics?.relativeVolume === 2.4)).toBe(true);
    expect(candidate.scenarios[0].status).toBe("watch");
  });

  it("holds when timeframes conflict and never turns low RSI into a reversal call", () => {
    const candidate = report([row()], { "USD-M:BTCUSDT": { "1h": candles(1, "up"), "4h": candles(4, "down") } }).candidates[0];
    expect(candidate.direction).toBe("mixed");
    expect(candidate.scenarios[0].status).toBe("waiting");
    expect(candidate.risks.join(" ")).toContain("단독 매도·반등 신호가 아닙니다");
  });

  it("uses the previous twenty bars for volume and withholds confirmation without expansion", () => {
    const data = completeFrames(row());
    data["USD-M:BTCUSDT"]!["1h"]!.at(-1)!.volume = 100;
    const candidate = report([row()], data).candidates[0];
    expect(candidate.direction).toBe("up");
    expect(candidate.verdict).toContain("참여 확인 대기");
    expect(candidate.frames[0].metrics?.relativeVolume).toBe(1);
    expect(candidate.scenarios[0].status).toBe("waiting");
  });

  it("keeps a zero historical volume denominator unknown", () => {
    const data = completeFrames(row());
    for (const frame of ["1h", "4h"] as const) data["USD-M:BTCUSDT"]![frame]!.forEach(candle => { candle.volume = 0; });
    const candidate = report([row()], data).candidates[0];
    expect(candidate.frames.every(frame => frame.metrics?.relativeVolume === null)).toBe(true);
    expect(candidate.verdict).not.toContain("거래량 동반");
  });

  it("excludes open and future candles and exposes the actual last close timestamp", () => {
    const data = completeFrames(row());
    data["USD-M:BTCUSDT"]!["1h"]!.push({ openTime: NOW, open: 9999, high: 10000, low: 9998, close: 9999, volume: 999999 });
    const frame = report([row()], data).candidates[0].frames[0];
    expect(frame.barCount).toBe(80);
    expect(frame.lastClosedAt).toBe(GENERATED_AT);
    expect(frame.metrics!.close).toBeLessThan(300);
    expect(frame.direction).toBe("up");
  });

  it("rejects malformed OHLCV and requires sixty consecutive closed bars", () => {
    const data = completeFrames(row());
    data["USD-M:BTCUSDT"]!["1h"]!.at(-2)!.high = 1;
    data["USD-M:BTCUSDT"]!["4h"] = candles(4, "up", NOW, 59);
    const candidate = report([row()], data).candidates[0];
    expect(candidate.direction).toBe("unknown");
    expect(candidate.frames.map(frame => frame.status)).toEqual(["insufficient", "insufficient"]);
    expect(candidate.frames[0].barCount).toBe(1);
    expect(candidate.frames.every(frame => frame.metrics === null)).toBe(true);
  });

  it("treats old frames and stale live prices as unknown even when historical trends agree", () => {
    const data: ResearchCandlesByKey = { "USD-M:BTCUSDT": { "1h": candles(1, "up", NOW - 3 * HOUR), "4h": candles(4) } };
    const candidate = report([row()], data).candidates[0];
    expect(candidate.frames[0]).toMatchObject({ status: "stale", direction: "unknown" });
    expect(candidate.direction).toBe("unknown");
    expect(candidate.coverage.status).toBe("stale");
    const stale = row("BTCUSDT", { lastUpdated: new Date(NOW - HOUR).toISOString() });
    expect(report([stale], completeFrames(stale)).candidates[0].direction).toBe("unknown");
  });

  it("does not seed indicators from disconnected historical candles", () => {
    const target = row();
    const baseline = report([target], completeFrames(target)).candidates[0];
    const data = completeFrames(target);
    for (const [frame, hours] of [["1h", 1], ["4h", 4]] as const) {
      data["USD-M:BTCUSDT"]![frame]!.unshift({
        openTime: NOW - 100 * hours * HOUR, open: 1e10, high: 1e10 + 1,
        low: 1e10 - 1, close: 1e10, volume: 1e10,
      });
    }
    const candidate = report([target], data).candidates[0];
    expect(candidate.frames).toEqual(baseline.frames);
    expect(candidate.direction).toBe("up");
    expect(candidate.frames.every(frame => frame.barCount === 80)).toBe(true);
  });

  it("keeps flat RSI neutral without fabricating bullishness", () => {
    const candidate = report([row()], completeFrames(row(), "flat")).candidates[0];
    expect(candidate.direction).toBe("mixed");
    expect(candidate.frames[0].metrics?.rsi14).toBe(50);
  });

  it("waits when the live price already passed a trigger and invalidates opposite breaches", () => {
    const above = row("BTCUSDT", { price: 500 });
    const passed = report([above], completeFrames(above)).candidates[0].scenarios[0];
    expect(passed.status).toBe("waiting");
    expect(passed.condition).toContain("이미 통과");
    const below = row("BTCUSDT", { price: 50 });
    const invalidCandidate = report([below], completeFrames(below)).candidates[0];
    const invalid = invalidCandidate.scenarios[0];
    expect(invalid.status).toBe("invalidated");
    expect(invalid.condition).toContain("무효화");
    expect(invalidCandidate.verdict).toContain("관찰 무효");
  });

  it("interprets funding as a decimal settlement rate without a fixed interval or probability", () => {
    const targets = [row("AUSDT", { fundingRate: 0.001 }), row("BUSDT", { fundingRate: -0.002 }), row("CUSDT", { fundingRate: NaN })];
    const result = report(targets);
    expect(result.overview.stats).toMatchObject({ fundingCoveredCount: 2, extremeFundingCount: 2 });
    const funding = result.candidates[0].evidence.find(item => item.label === "펀딩 정산 비율")!;
    expect(funding.value).toBe("0.1%");
    expect(funding.detail).toContain("롱의 지급");
    expect(result.candidates[1].risks.join(" ")).toContain("숏 비용");
    const markdown = buildFuturesResearchMarkdown(result);
    expect(markdown).not.toMatch(/NaN|Infinity|undefined/);
    expect(markdown).toContain("고정 8시간·일간·연간 수익률로 환산하지 않습니다");
  });

  it("withholds a range when extreme wicks would create a nonpositive boundary", () => {
    const data = completeFrames(row());
    data["USD-M:BTCUSDT"]!["1h"]!.at(-2)!.low = 0.001;
    const candidate = report([row()], data).candidates[0];
    expect(candidate.scenarios[0].status).toBe("unavailable");
    expect(candidate.verdict).toContain("범위 재설정");
    expect(candidate.scenarios[0].condition).not.toContain("$0");
  });

  it("does not mutate rows or candle arrays and reproduces snapshots at the same time", () => {
    const target = row();
    const data = completeFrames(target);
    const key: ResearchKey = "USD-M:BTCUSDT";
    data[key]!["1h"]!.reverse();
    const original = JSON.stringify({ target, data });
    const first = report([target], data);
    expect(report([target], data)).toEqual(first);
    expect(JSON.stringify({ target, data })).toBe(original);
  });
});
