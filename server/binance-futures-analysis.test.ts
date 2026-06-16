import { describe, expect, it } from "vitest";
import {
  applyTickerUpdates,
  buildFuturesRows,
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
  it("builds rows for every trading USD-M perpetual quote asset, not only USDT", () => {
    const rows = buildFuturesRows({
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

    expect(rows.map(row => row.symbol)).toEqual(["BTCUSDT", "ETHUSDC"]);
    expect(rows[0]).toMatchObject({ rank: 1, quoteAsset: "USDT", fundingRate: 0.0001 });
    expect(rows[1]).toMatchObject({ rank: 2, quoteAsset: "USDC", fundingRate: -0.0002 });
  });

  it("merges websocket ticker updates without dropping static market metadata", () => {
    const rows = buildFuturesRows({
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
});
