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

  it("returns expanded US stock table rows with sector and valuation fields", () => {
    const rows = getUsStocksTable();

    expect(rows.length).toBeGreaterThanOrEqual(20);
    expect(rows[0]).toMatchObject({
      ticker: "NVDA",
      exchange: "NASDAQ",
      marketCapUsd: expect.any(Number),
      revenueTtmUsd: expect.any(Number),
      operatingMarginPercent: expect.any(Number),
    });
    expect(rows.every(row => row.ticker.length > 0 && row.sector.length > 0)).toBe(true);
  });

  it("summarizes sector buckets, average valuation and market leaders", () => {
    const summary = getUsStocksSummary();

    expect(summary.totalStocks).toBe(getUsStocksTable().length);
    expect(summary.totalMarketCapUsd).toBeGreaterThan(0);
    expect(summary.totalRevenueTtmUsd).toBeGreaterThan(0);
    expect(summary.avgPeRatio).toBeGreaterThan(0);
    expect(summary.sectors.length).toBeGreaterThan(1);
    expect(summary.indicators).toHaveLength(12);
    expect(summary.highestMarketCap.ticker.length).toBeGreaterThan(0);
  });
});
