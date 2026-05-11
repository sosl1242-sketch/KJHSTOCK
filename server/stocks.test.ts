import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { calculateEarningsYield } from "./db";
import { extractLatestPrice } from "./stockPrice";
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
        sector: "semiconductor",
        name: "삼성전자",
        code: "005930",
        marketSuffix: "KS",
        currentPrice: 70000,
        annualEps: 3000,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
