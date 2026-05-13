import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CRYPTO_FUTURES_METRICS } from "./cryptoFutures";

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

  it("keeps liquidity and funding fields in the Binance futures row contract", () => {
    const source = readFileSync(resolve(process.cwd(), "server/cryptoFutures.ts"), "utf8");

    expect(source).toContain("volume24hUsd");
    expect(source).toContain("fundingRate");
    expect(source).toContain("openInterestToVolumePercent");
    expect(source).toContain('contractType: "PERPETUAL"');
  });

  it("keeps summary calculations tied to the loaded full futures rows", () => {
    const source = readFileSync(resolve(process.cwd(), "server/cryptoFutures.ts"), "utf8");

    expect(source).toContain("totalCoins: rows.length");
    expect(source).toContain("totalVolume24hUsd");
    expect(source).toContain("hottestFunding");
    expect(source).toContain("CRYPTO_FUTURES_METRICS");
  });
});
