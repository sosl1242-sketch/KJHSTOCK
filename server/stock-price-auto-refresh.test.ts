import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/dataApi", () => ({
  callDataApi: vi.fn(),
}));

vi.mock("./db", () => ({
  listStocks: vi.fn(),
  updateStockPrice: vi.fn(),
}));

import { callDataApi } from "./_core/dataApi";
import { listStocks, updateStockPrice } from "./db";
import { fetchKoreanStockPrice, getKoreaMarketRefreshPolicy, refreshStaleStoredStockPrices } from "./stockPrice";

describe("stock price auto refresh policy", () => {
  beforeEach(() => {
    vi.mocked(callDataApi).mockReset();
    vi.mocked(listStocks).mockReset();
    vi.mocked(updateStockPrice).mockReset();
  });

  it("uses a 60 second stale window during regular Korean market hours", () => {
    const policy = getKoreaMarketRefreshPolicy(new Date("2026-05-11T01:00:00.000Z"));

    expect(policy.session).toBe("regular");
    expect(policy.staleMs).toBe(60_000);
    expect(policy.batchSize).toBeGreaterThan(1);
    expect(policy.sessionLabel).toContain("60초");
  });

  it("uses a lower frequency cache check outside regular market hours", () => {
    const policy = getKoreaMarketRefreshPolicy(new Date("2026-05-10T01:00:00.000Z"));

    expect(policy.session).toBe("closed");
    expect(policy.staleMs).toBe(30 * 60 * 1000);
    expect(policy.batchSize).toBeLessThan(40);
  });

  it("retries transient price API failures before reporting failure", async () => {
    vi.mocked(callDataApi)
      .mockRejectedValueOnce(new Error("temporary upstream timeout"))
      .mockResolvedValueOnce({
        chart: { result: [{ meta: { regularMarketPrice: 55500 }, indicators: { quote: [{ close: [55000, 55500] }] } }] },
      });

    const result = await fetchKoreanStockPrice("005930", "KS", { maxAttempts: 3, retryDelayMs: 0 });

    expect(result).toEqual({ price: 55500, symbol: "005930.KS", attempts: 2 });
    expect(callDataApi).toHaveBeenCalledTimes(2);
    expect(callDataApi).toHaveBeenLastCalledWith("YahooFinance/get_stock_chart", expect.objectContaining({
      query: expect.objectContaining({ symbol: "005930.KS", interval: "1d", range: "5d" }),
    }));
  });

  it("reports the retry count when all market suffix attempts fail", async () => {
    vi.mocked(callDataApi).mockRejectedValue(new Error("upstream unavailable"));

    await expect(fetchKoreanStockPrice("005930", "KS", { maxAttempts: 2, retryDelayMs: 0 }))
      .rejects
      .toThrow("재시도 4회 실패");
    expect(callDataApi).toHaveBeenCalledTimes(4);
  });

  it("refreshes the oldest stale stored stocks first in small batches", async () => {
    const now = new Date("2026-05-11T01:00:00.000Z");
    vi.mocked(listStocks).mockResolvedValue([
      {
        id: 1,
        marketRank: 2,
        name: "최근종목",
        code: "000001",
        sector: "ai_semiconductor_value_chain",
        marketSuffix: "KS",
        currentPrice: 1000,
        annualEps: 100,
        earningsYield: 10,
        per: 10,
        pbr: null,
        marketCapHundredMillionKrw: null,
        latestOperatingProfitHundredMillionKrw: null,
        dataSource: "YahooFinance:000001.KS",
        lastPriceFetchedAt: new Date(now.getTime() - 10_000),
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 2,
        marketRank: 1,
        name: "가장오래된종목",
        code: "000002",
        sector: "ai_semiconductor_value_chain",
        marketSuffix: "KS",
        currentPrice: 2000,
        annualEps: 200,
        earningsYield: 10,
        per: 10,
        pbr: null,
        marketCapHundredMillionKrw: null,
        latestOperatingProfitHundredMillionKrw: null,
        dataSource: "manual",
        lastPriceFetchedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 3,
        marketRank: 3,
        name: "오래된종목",
        code: "000003",
        sector: "ai_semiconductor_value_chain",
        marketSuffix: "KQ",
        currentPrice: 3000,
        annualEps: 300,
        earningsYield: 10,
        per: 10,
        pbr: null,
        marketCapHundredMillionKrw: null,
        latestOperatingProfitHundredMillionKrw: null,
        dataSource: "manual",
        lastPriceFetchedAt: new Date(now.getTime() - 120_000),
        createdAt: now,
        updatedAt: now,
      },
    ]);
    vi.mocked(callDataApi).mockResolvedValue({
      chart: { result: [{ meta: { regularMarketPrice: 2222 }, indicators: { quote: [{ close: [2100, 2222] }] } }] },
    });
    vi.mocked(updateStockPrice).mockResolvedValue({ id: 2, code: "000002", currentPrice: 2222 } as Awaited<ReturnType<typeof updateStockPrice>>);

    const summary = await refreshStaleStoredStockPrices({ now, staleMs: 60_000, batchSize: 1 });

    expect(summary.session).toBe("regular");
    expect(summary.staleCount).toBe(2);
    expect(summary.attemptedCount).toBe(1);
    expect(summary.successCount).toBe(1);
    expect(summary.skippedCount).toBe(1);
    expect(summary.results[0]?.attempts).toBe(1);
    expect(callDataApi).toHaveBeenCalledWith("YahooFinance/get_stock_chart", expect.objectContaining({
      query: expect.objectContaining({ symbol: "000002.KS", interval: "1d", range: "5d" }),
    }));
    expect(updateStockPrice).toHaveBeenCalledWith(2, 2222, "YahooFinance:000002.KS");
  });
});
