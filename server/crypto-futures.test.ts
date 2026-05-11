import { describe, expect, it } from "vitest";
import { CRYPTO_FUTURES_METRICS, getCryptoFuturesSummary, getCryptoFuturesTable } from "./cryptoFutures";

describe("crypto futures sector metrics", () => {
  it("uses twelve crypto-native metrics instead of equity valuation labels", () => {
    expect(CRYPTO_FUTURES_METRICS).toHaveLength(12);
    const labels = CRYPTO_FUTURES_METRICS.map(metric => metric.label).join(" ");

    expect(labels).toContain("시가총액");
    expect(labels).toContain("FDV");
    expect(labels).toContain("유통 공급량");
    expect(labels).toContain("펀딩비");
    expect(labels).toContain("미결제약정");
    expect(labels).not.toContain("PER");
    expect(labels).not.toContain("PBR");
    expect(labels).not.toContain("EPS");
  });

  it("returns expanded table rows with derived liquidity and leverage ratios", () => {
    const rows = getCryptoFuturesTable();

    expect(rows.length).toBeGreaterThanOrEqual(12);
    expect(rows[0]).toMatchObject({
      ticker: "BTCUSDT",
      marketCapUsd: expect.any(Number),
      volumeToMarketCapPercent: expect.any(Number),
      openInterestToMarketCapPercent: expect.any(Number),
    });
    expect(rows.every(row => Number.isFinite(row.fundingRate))).toBe(true);
    expect(rows.every(row => Number.isFinite(row.longShortRatio))).toBe(true);
  });

  it("summarizes market cap, volume, open interest, sector buckets and funding pressure", () => {
    const summary = getCryptoFuturesSummary();

    expect(summary.totalCoins).toBe(getCryptoFuturesTable().length);
    expect(summary.totalMarketCapUsd).toBeGreaterThan(0);
    expect(summary.totalVolume24hUsd).toBeGreaterThan(0);
    expect(summary.totalOpenInterestUsd).toBeGreaterThan(0);
    expect(summary.sectors.length).toBeGreaterThan(1);
    expect(summary.indicators).toHaveLength(12);
    expect(summary.hottestFunding.ticker.endsWith("USDT")).toBe(true);
  });
});
