import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { calculateEarningsYield } from "./db";
import { extractLatestPrice } from "./stockPrice";
import { calculateRsi, calculateTechnicalIndicators, type PriceCandle } from "./technicalIndicators";
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
          loginMethod: "manus",
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
    res: {
      clearCookie: () => undefined,
    } as TrpcContext["res"],
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

  it("calculates RSI and returns ten high-low indicators", () => {
    const detail = calculateTechnicalIndicators(candles);

    expect(calculateRsi(candles.map(candle => candle.close))).toBe(100);
    expect(detail.indicators).toHaveLength(10);
    expect(detail.indicators.map(indicator => indicator.key)).toEqual([
      "rsi14",
      "stochastic14",
      "williams14",
      "cci20",
      "mfi14",
      "bollinger20",
      "macdHistogram",
      "sma20Gap",
      "high52Distance",
      "low52Distance",
    ]);
    expect(detail.high52Week).toBe(candles[candles.length - 1].high);
    expect(detail.low52Week).toBe(candles[0].low);
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
