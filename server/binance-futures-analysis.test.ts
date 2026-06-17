import { describe, expect, it } from "vitest";
import {
  applyTickerUpdates,
  buildFuturesFinalJudgmentReport,
  buildFuturesRows,
  buildFuturesWatchReport,
  buildFuturesWatchReportMarkdown,
  calculateTechnicalIndicators,
  summarizeFuturesRows,
type BinanceFuturesTicker,
  type FuturesCandle,
} from "../shared/binanceFuturesAnalysis";

function ticker(symbol: string, overrides: Partial<BinanceFuturesTicker> = {}): BinanceFuturesTicker {
  return {
    symbol,
    lastPrice: "100",
    highPrice: "110",
    lowPrice: "90",
    priceChangePercent: "2.5",
    volume: "1000",
    quoteVolume: "100000",
    closeTime: 1_780_000_000_000,
    ...overrides,
  };
}

function risingCandles(length = 80): FuturesCandle[] {
  return Array.from({ length }, (_, index) => {
    const close = 100 + index * 1.5;
    return {
      openTime: 1_700_000_000_000 + index * 86_400_000,
      open: close - 0.8,
      high: close + 1.2,
      low: close - 1.6,
      close,
      volume: 1_000 + index * 12,
    };
  });
}

describe("binance futures analysis", () => {
  it("builds rows for every trading USD-M futures contract, not only USDT perpetuals", () => {
    const rows = buildFuturesRows({
      marketType: "USD-M",
      symbols: [
        { symbol: "BTCUSDT", baseAsset: "BTC", quoteAsset: "USDT", contractType: "PERPETUAL", status: "TRADING" },
        { symbol: "ETHUSDC", baseAsset: "ETH", quoteAsset: "USDC", contractType: "PERPETUAL", status: "TRADING" },
        { symbol: "BTCUSDT_260626", baseAsset: "BTC", quoteAsset: "USDT", contractType: "CURRENT_QUARTER", status: "TRADING" },
        { symbol: "OLDUSDT", baseAsset: "OLD", quoteAsset: "USDT", contractType: "PERPETUAL", status: "BREAK" },
      ],
      tickers: [
        ticker("BTCUSDT", { quoteVolume: "5000000", priceChangePercent: "4.2" }),
        ticker("ETHUSDC", { quoteVolume: "3000000", priceChangePercent: "-1.1" }),
        ticker("BTCUSDT_260626", { quoteVolume: "9000000" }),
        ticker("OLDUSDT", { quoteVolume: "7000000" }),
      ],
      premiumIndex: [
        { symbol: "BTCUSDT", markPrice: "101", lastFundingRate: "0.0001", nextFundingTime: 1_780_001_000_000 },
        { symbol: "ETHUSDC", markPrice: "99", lastFundingRate: "-0.0002", nextFundingTime: 1_780_001_000_000 },
      ],
      openInterestBySymbol: new Map([
        ["BTCUSDT", 1_250_000],
        ["ETHUSDC", 750_000],
      ]),
      nowIso: "2026-06-17T00:00:00.000Z",
    });

    expect(rows.map(row => row.symbol)).toEqual(["BTCUSDT_260626", "BTCUSDT", "ETHUSDC"]);
    expect(rows[0]).toMatchObject({ rank: 1, marketType: "USD-M", quoteAsset: "USDT", contractType: "CURRENT_QUARTER" });
    expect(rows[1]).toMatchObject({ rank: 2, marketType: "USD-M", quoteAsset: "USDT", fundingRate: 0.0001, assetClass: "crypto" });
    expect(rows[2]).toMatchObject({ rank: 3, marketType: "USD-M", quoteAsset: "USDC", fundingRate: -0.0002 });
  });

  it("builds COIN-M perpetual and delivery rows with USD notional volume", () => {
    const rows = buildFuturesRows({
      marketType: "COIN-M",
      symbols: [
        { symbol: "BTCUSD_PERP", pair: "BTCUSD", baseAsset: "BTC", quoteAsset: "USD", contractType: "PERPETUAL", contractStatus: "TRADING" },
        { symbol: "BTCUSD_260626", pair: "BTCUSD", baseAsset: "BTC", quoteAsset: "USD", contractType: "CURRENT_QUARTER", contractStatus: "TRADING" },
        { symbol: "ETHUSD_PERP", pair: "ETHUSD", baseAsset: "ETH", quoteAsset: "USD", contractType: "PERPETUAL", contractStatus: "TRADING" },
      ],
      tickers: [
        ticker("BTCUSD_PERP", { lastPrice: "65000", baseVolume: "100", quoteVolume: undefined }),
        ticker("BTCUSD_260626", { lastPrice: "65200", baseVolume: "10", quoteVolume: undefined }),
        ticker("ETHUSD_PERP", { lastPrice: "1800", baseVolume: "1000", quoteVolume: undefined }),
      ],
      premiumIndex: [{ symbol: "BTCUSD_PERP", markPrice: "65010", lastFundingRate: "0.0003", nextFundingTime: 1_780_001_000_000 }],
      openInterestBySymbol: new Map(),
      nowIso: "2026-06-17T00:00:00.000Z",
    });

    expect(rows.map(row => row.symbol)).toEqual(["BTCUSD_PERP", "ETHUSD_PERP", "BTCUSD_260626"]);
    expect(rows[0]).toMatchObject({
      marketType: "COIN-M",
      pair: "BTCUSD",
      contractType: "PERPETUAL",
      volume24hUsd: 6_500_000,
    });
    expect(rows[2]).toMatchObject({
      contractType: "CURRENT_QUARTER",
      volume24hUsd: 652_000,
    });
  });

  it("merges websocket ticker updates without dropping static market metadata", () => {
    const rows = buildFuturesRows({
      marketType: "USD-M",
      symbols: [{ symbol: "BTCUSDT", baseAsset: "BTC", quoteAsset: "USDT", contractType: "PERPETUAL", status: "TRADING" }],
      tickers: [ticker("BTCUSDT", { lastPrice: "100", quoteVolume: "100000" })],
      premiumIndex: [],
      openInterestBySymbol: new Map([["BTCUSDT", 42_000]]),
      nowIso: "2026-06-17T00:00:00.000Z",
    });

    const updated = applyTickerUpdates(rows, [
      { symbol: "BTCUSDT", lastPrice: "105.5", highPrice: "108", lowPrice: "95", priceChangePercent: "5.5", volume: "1200", quoteVolume: "126600", closeTime: 1_781_632_100_000 },
    ]);

    expect(updated[0]).toMatchObject({
      symbol: "BTCUSDT",
      baseAsset: "BTC",
      price: 105.5,
      change24hPercent: 5.5,
      volume24hUsd: 126_600,
      openInterestUsd: 42_000,
    });
    expect(updated[0].lastUpdated).toBe("2026-06-16T17:48:20.000Z");
  });

  it("recalculates COIN-M websocket volume from base volume and last price", () => {
    const rows = buildFuturesRows({
      marketType: "COIN-M",
      symbols: [{ symbol: "BTCUSD_PERP", pair: "BTCUSD", baseAsset: "BTC", quoteAsset: "USD", contractType: "PERPETUAL", contractStatus: "TRADING" }],
      tickers: [ticker("BTCUSD_PERP", { lastPrice: "65000", baseVolume: "100", quoteVolume: undefined })],
      premiumIndex: [],
      openInterestBySymbol: new Map(),
      nowIso: "2026-06-17T00:00:00.000Z",
    });

    const updated = applyTickerUpdates(rows, [
      { symbol: "BTCUSD_PERP", lastPrice: "66000", highPrice: "67000", lowPrice: "64000", priceChangePercent: "2", volume: "120000", baseVolume: "120", quoteVolume: undefined, closeTime: 1_781_632_100_000 },
    ]);

    expect(updated[0]).toMatchObject({
      marketType: "COIN-M",
      price: 66000,
      volume24hUsd: 7_920_000,
    });
  });

  it("calculates trend, momentum, volatility and volume indicators from candles", () => {
    const detail = calculateTechnicalIndicators(risingCandles());

    expect(detail.latestClose).toBeGreaterThan(200);
    expect(detail.ema20).toBeGreaterThan(detail.ema50);
    expect(detail.rsi14).toBeGreaterThan(70);
    expect(detail.macdHistogram).toBeGreaterThan(0);
    expect(detail.bollingerPercentB).toBeGreaterThan(50);
    expect(detail.atrPercent).toBeGreaterThan(0);
    expect(detail.volume20Ratio).toBeGreaterThan(100);
    expect(detail.bias).toBe("bullish");
    expect(detail.score).toBeGreaterThanOrEqual(70);
  });

  it("summarizes live futures rows for dashboard header cards", () => {
    const rows = buildFuturesRows({
      marketType: "USD-M",
      symbols: [
        { symbol: "BTCUSDT", baseAsset: "BTC", quoteAsset: "USDT", contractType: "PERPETUAL", status: "TRADING" },
        { symbol: "ETHUSDC", baseAsset: "ETH", quoteAsset: "USDC", contractType: "PERPETUAL", status: "TRADING" },
      ],
      tickers: [
        ticker("BTCUSDT", { quoteVolume: "1000", priceChangePercent: "10" }),
        ticker("ETHUSDC", { quoteVolume: "3000", priceChangePercent: "-5" }),
      ],
      premiumIndex: [],
      openInterestBySymbol: new Map(),
      nowIso: "2026-06-17T00:00:00.000Z",
    });

    const summary = summarizeFuturesRows(rows);

    expect(summary.totalSymbols).toBe(2);
    expect(summary.totalVolume24hUsd).toBe(4_000);
    expect(summary.positiveCount).toBe(1);
    expect(summary.negativeCount).toBe(1);
    expect(summary.topGainer?.symbol).toBe("BTCUSDT");
    expect(summary.volumeLeader?.symbol).toBe("ETHUSDC");
  });

  it("builds a watch report with ranked symbols, reasons and risk notes", () => {
    const rows = buildFuturesRows({
      marketType: "USD-M",
      symbols: [
        { symbol: "MOMOUSDT", baseAsset: "MOMO", quoteAsset: "USDT", contractType: "PERPETUAL", status: "TRADING" },
        { symbol: "FLOWUSDT", baseAsset: "FLOW", quoteAsset: "USDT", contractType: "PERPETUAL", status: "TRADING" },
        { symbol: "FUNDUSDT", baseAsset: "FUND", quoteAsset: "USDT", contractType: "PERPETUAL", status: "TRADING" },
        { symbol: "DROPUSDT", baseAsset: "DROP", quoteAsset: "USDT", contractType: "PERPETUAL", status: "TRADING" },
      ],
      tickers: [
        ticker("MOMOUSDT", { lastPrice: "10", quoteVolume: "900000000", priceChangePercent: "14" }),
        ticker("FLOWUSDT", { lastPrice: "5", quoteVolume: "1200000000", priceChangePercent: "2" }),
        ticker("FUNDUSDT", { lastPrice: "2", quoteVolume: "500000000", priceChangePercent: "3" }),
        ticker("DROPUSDT", { lastPrice: "1", quoteVolume: "700000000", priceChangePercent: "-18" }),
      ],
      premiumIndex: [
        { symbol: "MOMOUSDT", markPrice: "10", lastFundingRate: "0.0001", nextFundingTime: 1_780_001_000_000 },
        { symbol: "FUNDUSDT", markPrice: "2", lastFundingRate: "0.0016", nextFundingTime: 1_780_001_000_000 },
        { symbol: "DROPUSDT", markPrice: "1", lastFundingRate: "-0.0003", nextFundingTime: 1_780_001_000_000 },
      ],
      openInterestBySymbol: new Map(),
      nowIso: "2026-06-17T00:00:00.000Z",
    });

    const report = buildFuturesWatchReport(rows);

    expect(report.generatedAt).toBe("2026-06-17T00:00:00.000Z");
    expect(report.items.length).toBeGreaterThanOrEqual(4);
    expect(report.items.map(item => item.category)).toContain("momentum_liquidity");
    expect(report.items.map(item => item.category)).toContain("funding_pressure");
    expect(report.items.map(item => item.category)).toContain("pullback_liquidity");
    expect(report.items[0]).toMatchObject({
      symbol: expect.any(String),
      title: expect.any(String),
      why: expect.any(String),
      risk: expect.any(String),
      watchPoints: expect.arrayContaining([expect.any(String)]),
      priorityScore: expect.any(Number),
    });
    expect(report.items.every(item => item.why.length > 20 && item.risk.length > 10 && item.watchPoints.length >= 2)).toBe(true);
  });

  it("keeps recommended symbols unique across report categories", () => {
    const rows = buildFuturesRows({
      marketType: "USD-M",
      symbols: [
        { symbol: "MOMOUSDT", baseAsset: "MOMO", quoteAsset: "USDT", contractType: "PERPETUAL", status: "TRADING" },
        { symbol: "FLOWUSDT", baseAsset: "FLOW", quoteAsset: "USDT", contractType: "PERPETUAL", status: "TRADING" },
        { symbol: "FUNDUSDT", baseAsset: "FUND", quoteAsset: "USDT", contractType: "PERPETUAL", status: "TRADING" },
        { symbol: "DROPUSDT", baseAsset: "DROP", quoteAsset: "USDT", contractType: "PERPETUAL", status: "TRADING" },
      ],
      tickers: [
        ticker("MOMOUSDT", { lastPrice: "10", quoteVolume: "2000000000", priceChangePercent: "40" }),
        ticker("FLOWUSDT", { lastPrice: "5", quoteVolume: "1500000000", priceChangePercent: "2" }),
        ticker("FUNDUSDT", { lastPrice: "2", quoteVolume: "500000000", priceChangePercent: "3" }),
        ticker("DROPUSDT", { lastPrice: "1", quoteVolume: "700000000", priceChangePercent: "-18" }),
      ],
      premiumIndex: [
        { symbol: "MOMOUSDT", markPrice: "10", lastFundingRate: "0.0001", nextFundingTime: 1_780_001_000_000 },
        { symbol: "FUNDUSDT", markPrice: "2", lastFundingRate: "0.0016", nextFundingTime: 1_780_001_000_000 },
        { symbol: "DROPUSDT", markPrice: "1", lastFundingRate: "-0.0003", nextFundingTime: 1_780_001_000_000 },
      ],
      openInterestBySymbol: new Map(),
      nowIso: "2026-06-17T00:00:00.000Z",
    });

    const report = buildFuturesWatchReport(rows);
    const reportKeys = report.items.map(item => `${item.marketType}:${item.symbol}`);

    expect(new Set(reportKeys).size).toBe(reportKeys.length);
    expect(report.items.find(item => item.category === "momentum_liquidity")?.symbol).toBe("MOMOUSDT");
    expect(report.items.find(item => item.category === "volume_leader")?.symbol).toBe("FLOWUSDT");
  });

  it("keeps TradeFi futures out of the crypto watch report", () => {
    const rows = buildFuturesRows({
      marketType: "USD-M",
      symbols: [
        { symbol: "SPYUSDT", baseAsset: "SPY", quoteAsset: "USDT", contractType: "TRADIFI_PERPETUAL", status: "TRADING" },
        { symbol: "BTCUSDT", baseAsset: "BTC", quoteAsset: "USDT", contractType: "PERPETUAL", status: "TRADING" },
        { symbol: "BRUSDT", baseAsset: "BR", quoteAsset: "USDT", contractType: "PERPETUAL", status: "TRADING" },
      ],
      tickers: [
        ticker("SPYUSDT", { quoteVolume: "9000000000", priceChangePercent: "25" }),
        ticker("BTCUSDT", { quoteVolume: "1000000000", priceChangePercent: "2" }),
        ticker("BRUSDT", { quoteVolume: "200000000", priceChangePercent: "30" }),
      ],
      premiumIndex: [],
      openInterestBySymbol: new Map(),
      nowIso: "2026-06-17T00:00:00.000Z",
    });

    const report = buildFuturesWatchReport(rows);

    expect(rows.find(row => row.symbol === "SPYUSDT")).toMatchObject({ assetClass: "tradefi" });
    expect(report.items.map(item => item.symbol)).not.toContain("SPYUSDT");
    expect(report.items.map(item => item.symbol)).toContain("BRUSDT");
  });

  it("formats the watch report as portable markdown with reasons and risk notes", () => {
    const rows = buildFuturesRows({
      marketType: "USD-M",
      symbols: [
        { symbol: "BRUSDT", baseAsset: "BR", quoteAsset: "USDT", contractType: "PERPETUAL", status: "TRADING" },
        { symbol: "ETHUSDT", baseAsset: "ETH", quoteAsset: "USDT", contractType: "PERPETUAL", status: "TRADING" },
      ],
      tickers: [
        ticker("BRUSDT", { quoteVolume: "200000000", priceChangePercent: "30" }),
        ticker("ETHUSDT", { quoteVolume: "9000000000", priceChangePercent: "2" }),
      ],
      premiumIndex: [{ symbol: "BRUSDT", markPrice: "100", lastFundingRate: "0.0002", nextFundingTime: 1_780_001_000_000 }],
      openInterestBySymbol: new Map(),
      nowIso: "2026-06-17T00:00:00.000Z",
    });

    const report = buildFuturesWatchReport(rows);
    const markdown = buildFuturesWatchReportMarkdown({
      ...report,
      items: report.items.map((item, index) => index === 0
        ? {
            ...item,
            technical: {
              score: 72.5,
              bias: "bullish",
              rsi14: 61.25,
              ema20: 101.5,
              ema50: 98.2,
              macdHistogram: 0.01234567,
              atrPercent: 4.8,
              volume20Ratio: 145.2,
            },
          }
        : item),
    });

    expect(markdown).toContain("# Binance Futures Watch Report");
    expect(markdown).toContain("BRUSDT");
    expect(markdown).toContain("왜 주목");
    expect(markdown).toContain("리스크");
    expect(markdown).toContain("관찰 체크");
    expect(markdown).toContain("기술 점수: 72.5 (강세)");
    expect(markdown).toContain("RSI 14: 61.25");
    expect(markdown).toContain("MACD Histogram: 0.01234567");
    expect(markdown).toContain("투자 조언이 아니며");
  });

  it("keeps sub-cent prices readable in the markdown report", () => {
    const markdown = buildFuturesWatchReportMarkdown({
      generatedAt: "2026-06-17T00:00:00.000Z",
      items: [{
        category: "funding_pressure",
        title: "펀딩비 압력이 큰 과열 후보",
        symbol: "SPELLUSDT",
        marketType: "USD-M",
        contractType: "PERPETUAL",
        priorityScore: 100,
        why: "펀딩비가 극단적으로 벌어져 포지션 비용 압력을 확인할 필요가 있습니다.",
        risk: "초저가 계약은 호가 단위와 청산 변동성이 커질 수 있습니다.",
        watchPoints: [
          "다음 펀딩 시각 전후로 펀딩비 극단값이 완화되는지 확인",
          "가격이 횡보하는데 펀딩비만 극단인지 확인",
        ],
        metrics: {
          change24hPercent: 2.22,
          volume24hUsd: 6_630_000,
          fundingRate: -0.007033,
          price: 0.0001335,
        },
        technical: {
          score: 77.6,
          bias: "bullish",
          rsi14: 57.06,
          ema20: 0.0001354,
          ema50: 0.0001321,
          macdHistogram: 0.00000042,
          atrPercent: 2.08,
          volume20Ratio: 3,
        },
      }],
    });

    expect(markdown).toContain("가격: $0.0001335");
    expect(markdown).toContain("EMA 20/50: $0.0001354 / $0.0001321");
    expect(markdown).not.toContain("가격: $0\n");
    expect(markdown).not.toContain("EMA 20/50: $0 / $0");
  });

  it("builds a final aggregate judgment from all report candidates and technical snapshots", () => {
    const finalJudgment = buildFuturesFinalJudgmentReport({
      generatedAt: "2026-06-17T00:00:00.000Z",
      items: [
        {
          category: "momentum_liquidity",
          title: "거래대금이 동반된 상승 모멘텀",
          symbol: "ALPHAUSDT",
          marketType: "USD-M",
          contractType: "PERPETUAL",
          priorityScore: 88,
          why: "24h 상승과 거래대금이 동시에 붙었습니다.",
          risk: "단기 과열 가능성은 확인해야 합니다.",
          watchPoints: ["고점 돌파 유지", "거래대금 유지"],
          metrics: { change24hPercent: 8.2, volume24hUsd: 1_500_000_000, fundingRate: 0.0002, price: 12.4 },
          technical: {
            score: 78,
            bias: "bullish",
            rsi14: 66,
            ema20: 12.1,
            ema50: 11.3,
            macdHistogram: 0.18,
            atrPercent: 4.2,
            volume20Ratio: 168,
          },
        },
        {
          category: "volume_leader",
          title: "시장 관심이 크게 몰린 유동성 리더",
          symbol: "BETAUSDT",
          marketType: "USD-M",
          contractType: "PERPETUAL",
          priorityScore: 72,
          why: "거래대금 기준 상위권입니다.",
          risk: "방향성이 둔화될 수 있습니다.",
          watchPoints: ["가격 방향 확인", "펀딩비 확인"],
          metrics: { change24hPercent: 3.1, volume24hUsd: 2_200_000_000, fundingRate: 0.0004, price: 44.8 },
          technical: {
            score: 68,
            bias: "bullish",
            rsi14: 58,
            ema20: 44.1,
            ema50: 43,
            macdHistogram: 0.09,
            atrPercent: 3.8,
            volume20Ratio: 132,
          },
        },
        {
          category: "funding_pressure",
          title: "펀딩비 과열 후보",
          symbol: "GAMMAUSDT",
          marketType: "USD-M",
          contractType: "PERPETUAL",
          priorityScore: 61,
          why: "펀딩비가 높아 포지션 쏠림이 있습니다.",
          risk: "청산 변동성이 커질 수 있습니다.",
          watchPoints: ["펀딩비 완화", "가격 추세 유지"],
          metrics: { change24hPercent: -1.4, volume24hUsd: 700_000_000, fundingRate: 0.0017, price: 2.1 },
          technical: {
            score: 47,
            bias: "neutral",
            rsi14: 72,
            ema20: 2.08,
            ema50: 2.09,
            macdHistogram: -0.01,
            atrPercent: 7.8,
            volume20Ratio: 91,
          },
        },
      ],
    });

    expect(finalJudgment.primarySymbol).toBe("ALPHAUSDT");
    expect(finalJudgment.label).toBe("강한 주목");
    expect(finalJudgment.score).toBeGreaterThanOrEqual(70);
    expect(finalJudgment.evidence.averageTechnicalScore).toBe(64.3);
    expect(finalJudgment.evidence.bullishTechnicalCount).toBe(2);
    expect(finalJudgment.strengths.join(" ")).toContain("ALPHAUSDT");
    expect(finalJudgment.risks.join(" ")).toContain("과열");
    expect(finalJudgment.actionPlan.length).toBeGreaterThanOrEqual(3);
  });

  it("adds the final aggregate judgment to the bottom of the markdown report", () => {
    const markdown = buildFuturesWatchReportMarkdown({
      generatedAt: "2026-06-17T00:00:00.000Z",
      items: [{
        category: "momentum_liquidity",
        title: "거래대금이 동반된 상승 모멘텀",
        symbol: "ALPHAUSDT",
        marketType: "USD-M",
        contractType: "PERPETUAL",
        priorityScore: 88,
        why: "24h 상승과 거래대금이 동시에 붙었습니다.",
        risk: "단기 과열 가능성은 확인해야 합니다.",
        watchPoints: ["고점 돌파 유지", "거래대금 유지"],
        metrics: { change24hPercent: 8.2, volume24hUsd: 1_500_000_000, fundingRate: 0.0002, price: 12.4 },
        technical: {
          score: 78,
          bias: "bullish",
          rsi14: 66,
          ema20: 12.1,
          ema50: 11.3,
          macdHistogram: 0.18,
          atrPercent: 4.2,
          volume20Ratio: 168,
        },
      }],
    });

    expect(markdown).toContain("## 최종 종합판단");
    expect(markdown).toContain("- 최종 판정: 강한 주목");
    expect(markdown).toContain("- 1순위 후보: ALPHAUSDT");
    expect(markdown.trim().endsWith("투자 판단 전에는 반드시 본인 기준의 손절가와 포지션 크기를 먼저 정합니다.")).toBe(true);
  });
});
