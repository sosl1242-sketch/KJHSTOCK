import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CRYPTO_FUTURES_METRICS, getCryptoFuturesSummary, getCryptoFuturesTable } from "./cryptoFutures";

describe("crypto futures sector metrics", () => {
  it("uses twelve crypto-native futures metrics instead of equity valuation labels", () => {
    expect(CRYPTO_FUTURES_METRICS).toHaveLength(12);
    const labels = CRYPTO_FUTURES_METRICS.map(metric => metric.label).join(" ");

    expect(labels).toContain("24h 거래대금");
    expect(labels).toContain("펀딩비");
    expect(labels).toContain("미결제약정");
    expect(labels).toContain("OI/거래대금");
    expect(labels).not.toContain("PER");
    expect(labels).not.toContain("PBR");
    expect(labels).not.toContain("EPS");
  });

  it("does not cap the Binance USDT perpetual universe to a top-100 slice", () => {
    const source = readFileSync(resolve(process.cwd(), "server/cryptoFutures.ts"), "utf8");

    expect(source).toContain('quoteAsset === "USDT"');
    expect(source).toContain('contractType === "PERPETUAL"');
    expect(source).not.toContain("slice(0, 100)");
    expect(source).not.toContain("TOP_N");
  });

  it("returns Binance USDT perpetual rows with liquidity and funding fields", async () => {
    const rows = await getCryptoFuturesTable();

    expect(rows.length).toBeGreaterThanOrEqual(100);
    expect(rows.every(row => row.ticker.endsWith("USDT"))).toBe(true);
    expect(rows[0]).toMatchObject({
      ticker: expect.stringMatching(/USDT$/),
      contractType: "PERPETUAL",
      volume24hUsd: expect.any(Number),
      fundingRate: expect.any(Number),
    });
    expect(rows.some(row => typeof row.openInterestToVolumePercent === "number")).toBe(true);
  }, 30000);

  it("summarizes full USDT futures market volume, sectors and funding pressure", async () => {
    const rows = await getCryptoFuturesTable();
    const summary = await getCryptoFuturesSummary();

    expect(summary.totalCoins).toBe(rows.length);
    expect(summary.totalCoins).toBeGreaterThanOrEqual(100);
    expect(summary.totalVolume24hUsd).toBeGreaterThan(0);
    expect(summary.sectors.length).toBeGreaterThan(1);
    expect(summary.indicators).toHaveLength(12);
    expect(summary.hottestFunding.ticker.endsWith("USDT")).toBe(true);
  }, 30000);
});
