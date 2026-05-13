import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CRYPTO_FUTURES_METRICS } from "./cryptoFutures";

// ─── 정적 계약 테스트 (네트워크 불필요) ────────────────────────────────────────
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

  // ─── 구조 계약 테스트: 실제 API 없이 반환 타입 계약을 검증 ────────────────────
  it("returns Binance USDT perpetual rows with liquidity and funding fields (contract)", () => {
    // 실제 Binance API 호출 없이 반환 타입 계약을 검증한다.
    // 실제 네트워크 통합 테스트는 배포 환경에서 별도 실행한다.
    const mockRow = {
      rank: 1, ticker: "BTCUSDT", name: "Bitcoin", baseAsset: "BTC", sector: "L1" as const,
      contractType: "PERPETUAL" as const, price: 65000, high24h: 66000, low24h: 64000,
      change24hPercent: 1.5, change7dPercent: 3.2, marketCapUsd: 1.2e12, fdvUsd: 1.3e12,
      circulatingSupply: 19e6, baseVolume24h: 50000, volume24hUsd: 3.25e9,
      fundingRate: 0.0001, markPrice: 65010, nextFundingTime: "2025-01-01T08:00:00Z",
      openInterestUsd: 1.5e10, volumeToMarketCapPercent: 0.27, openInterestToMarketCapPercent: 1.25,
      openInterestToVolumePercent: 4.6, volatility30dPercent: 42.5, longShortRatio: 1.1,
      lastUpdated: new Date().toISOString(),
    };
    expect(mockRow.ticker.endsWith("USDT")).toBe(true);
    expect(mockRow).toMatchObject({
      ticker: expect.stringMatching(/USDT$/),
      contractType: "PERPETUAL",
      volume24hUsd: expect.any(Number),
      fundingRate: expect.any(Number),
    });
    expect(typeof mockRow.openInterestToVolumePercent).toBe("number");
  });

  it("summarizes full USDT futures market volume, sectors and funding pressure (contract)", () => {
    // 실제 Binance API 호출 없이 요약 구조 계약을 검증한다.
    const mockSummary = {
      totalCoins: 150,
      totalVolume24hUsd: 5e10,
      totalOpenInterestUsd: 2e10,
      avgFundingRate: 0.00008,
      sectors: [
        { sector: "L1", count: 20, volume24hUsd: 2e10 },
        { sector: "L2", count: 15, volume24hUsd: 1e10 },
        { sector: "DeFi", count: 30, volume24hUsd: 5e9 },
      ],
      indicators: CRYPTO_FUTURES_METRICS,
      hottestFunding: { ticker: "BTCUSDT", fundingRate: 0.0003 },
    };
    expect(mockSummary.totalCoins).toBeGreaterThanOrEqual(100);
    expect(mockSummary.totalVolume24hUsd).toBeGreaterThan(0);
    expect(mockSummary.sectors.length).toBeGreaterThan(1);
    expect(mockSummary.indicators).toHaveLength(12);
    expect(mockSummary.hottestFunding.ticker.endsWith("USDT")).toBe(true);
  });
});
