import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./yahooFinance", () => ({
  fetchYahooStockChart: vi.fn(),
}));
import { appRouter } from "./routers";
import { calculateEarningsYield } from "./db";
import { extractLatestPrice } from "./stockPrice";
import { fetchYahooStockChart } from "./yahooFinance";
import { calculateRsi, calculateTechnicalIndicators, fetchTechnicalIndicatorDetail, type PriceCandle } from "./technicalIndicators";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(user?: Partial<AuthenticatedUser>): TrpcContext {
  return {
    user: user
      ? {
          id: 1,
          openId: "sample-user",
          email: "sample@example.com",
          name: "Sample User",
          loginMethod: "email",
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
          ...user,
        }
      : undefined,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("calculateEarningsYield", () => {
  it("calculates EPS divided by price as a percentage", () => {
    expect(calculateEarningsYield(5000, 100000)).toBe(5);
    expect(calculateEarningsYield(1250, 25000)).toBe(5);
  });

  it("returns null when price is not positive or inputs are invalid", () => {
    expect(calculateEarningsYield(5000, 0)).toBeNull();
    expect(calculateEarningsYield(Number.NaN, 100000)).toBeNull();
  });
});

describe("technical indicators", () => {
  beforeEach(() => {
    vi.mocked(fetchYahooStockChart).mockReset();
  });

  const candles: PriceCandle[] = Array.from({ length: 60 }, (_, index) => {
    const close = 10000 + index * 120;
    return {
      date: `2026-01-${String((index % 28) + 1).padStart(2, "0")}`,
      open: close - 40,
      high: close + 120,
      low: close - 160,
      close,
      volume: 100000 + index * 1000,
    };
  });

  it("calculates RSI and returns twelve high-low indicators with fair price estimates", () => {
    const detail = calculateTechnicalIndicators(candles);
    const usdDetail = calculateTechnicalIndicators(candles, "USD");

    expect(calculateRsi(candles.map(candle => candle.close))).toBe(100);
    expect(detail.indicators).toHaveLength(12);
    expect(detail.indicators.map(indicator => indicator.key)).toEqual([
      "rsi14",
      "stochastic14",
      "williams14",
      "cci20",
      "mfi14",
      "bollinger20",
      "macdHistogram",
      "sma20Gap",
      "sma60Gap",
      "volume20Ratio",
      "high52Distance",
      "low52Distance",
    ]);
    expect(detail.high52Week).toBe(candles[candles.length - 1].high);
    expect(detail.low52Week).toBe(candles[0].low);
    expect(detail.fairPriceMedian).toBeGreaterThan(0);
    expect(detail.indicators.every(indicator => indicator.fairPriceDisplay.endsWith("원"))).toBe(true);
    const usdFairPrices = usdDetail.indicators.filter(indicator => indicator.fairPrice !== null);
    expect(usdFairPrices.every(indicator => indicator.fairPriceDisplay.startsWith("$"))).toBe(true);
    expect(usdFairPrices.every(indicator => !indicator.fairPriceDisplay.endsWith("원"))).toBe(true);
  });

  it("requests Yahoo chart history with string query parameters and returns price history", async () => {
    const timestamps = candles.map((_, index) => Date.UTC(2026, 0, index + 1) / 1000);
    vi.mocked(fetchYahooStockChart).mockResolvedValueOnce({
      chart: {
        result: [
          {
            timestamp: timestamps,
            meta: { symbol: "005930.KS" },
            indicators: {
              quote: [
                {
                  open: candles.map(candle => candle.open),
                  high: candles.map(candle => candle.high),
                  low: candles.map(candle => candle.low),
                  close: candles.map(candle => candle.close),
                  volume: candles.map(candle => candle.volume),
                },
              ],
            },
          },
        ],
      },
    });

    const detail = await fetchTechnicalIndicatorDetail({ code: "005930", name: "삼성전자", marketSuffix: "KS" });

    expect(fetchYahooStockChart).toHaveBeenCalledWith(expect.objectContaining({
      symbol: "005930.KS",
      region: "KR",
      interval: "1d",
      range: "2y",
      includeAdjustedClose: true,
    }));
    expect(detail.symbol).toBe("005930.KS");
    expect(detail.priceHistory).toHaveLength(candles.length);
    expect(detail.priceHistory[0]).toMatchObject({ date: "2026-01-01", close: candles[0].close });
  });
});

describe("extractLatestPrice", () => {
  it("prefers regular market price from Yahoo chart metadata", () => {
    expect(
      extractLatestPrice({
        chart: {
          result: [
            {
              meta: { regularMarketPrice: 81200 },
              indicators: { quote: [{ close: [79000, 80000] }] },
            },
          ],
        },
      })
    ).toBe(81200);
  });

  it("falls back to the latest positive close value", () => {
    expect(
      extractLatestPrice({
        chart: {
          result: [
            {
              meta: {},
              indicators: { quote: [{ close: [1000, null, 1100, 0] }] },
            },
          ],
        },
      })
    ).toBe(1100);
  });
});

describe("stocks admin permissions", () => {
  it("blocks stock reads for unauthenticated users", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.stocks.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.globalStocks.getTable()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.tradeFi.getTable()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.cryptoFutures.getTable()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.system.health({ timestamp: Date.now() })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("blocks stock editing for normal users", async () => {
    const caller = appRouter.createCaller(createContext({ role: "user" }));

    await expect(
      caller.stocks.save({
        sector: "ai_semiconductor_value_chain",
        name: "삼성전자",
        code: "005930",
        marketSuffix: "KS",
        currentPrice: 70000,
        annualEps: 3000,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
