import { describe, expect, it } from "vitest";
import { getUsStocksSummary, getUsStocksTable, US_STOCK_METRICS } from "./usStocks";

describe("US stock sector metrics", () => {
  it("uses twelve US equity metrics across fundamentals, valuation and risk", () => {
    expect(US_STOCK_METRICS).toHaveLength(12);
    const labels = US_STOCK_METRICS.map(metric => metric.label).join(" ");

    expect(labels).toContain("시가총액");
    expect(labels).toContain("TTM 매출");
    expect(labels).toContain("영업이익률");
    expect(labels).toContain("PER");
    expect(labels).toContain("Forward PER");
    expect(labels).toContain("베타");
  });

  it("returns expanded US stock table rows with sector, valuation and quote fields", async () => {
    const rows = await getUsStocksTable();

    expect(rows.length).toBeGreaterThanOrEqual(20);
    expect(rows[0]).toMatchObject({
      ticker: "NVDA",
      exchange: "NASDAQ",
      marketCapUsd: expect.any(Number),
      revenueTtmUsd: expect.any(Number),
      operatingMarginPercent: expect.any(Number),
    });
    expect(rows.every(row => row.ticker.length > 0 && row.sector.length > 0)).toBe(true);
    expect(rows.every(row => row.quoteSource === "Stooq" || row.quoteSource === "Fallback")).toBe(true);
    expect(rows.every(row => typeof row.lastUpdated === "string" && row.lastUpdated.length > 0)).toBe(true);
    expect(rows.some(row => row.ticker === "DVLT" && row.name === "Datavault AI")).toBe(true);
  }, 15000);

  it("summarizes sector buckets, average valuation and market leaders", async () => {
    const summary = await getUsStocksSummary();
    const rows = await getUsStocksTable();

    expect(summary.totalStocks).toBe(rows.length);
    expect(summary.totalMarketCapUsd).toBeGreaterThan(0);
    expect(summary.totalRevenueTtmUsd).toBeGreaterThan(0);
    expect(summary.avgPeRatio).toBeGreaterThan(0);
    expect(summary.sectors.length).toBeGreaterThan(1);
    expect(summary.indicators).toHaveLength(12);
    expect(summary.liveQuoteCount).toBeGreaterThanOrEqual(0);
    expect(summary.totalTurnoverUsd).toBeGreaterThanOrEqual(0);
    expect(summary.highestMarketCap.ticker.length).toBeGreaterThan(0);
  }, 15000);
});
