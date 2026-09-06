import { describe, expect, it } from "vitest";
import { ALL_COIN_PROFILES, COIN_PROFILE_ALIASES, coinSummaryText, getCoinProfile } from "../shared/coinProfiles";

describe("source-backed coin purpose profiles", () => {
  it("keeps every complete Korean description within the requested 300 characters", () => {
    expect(ALL_COIN_PROFILES.length).toBeGreaterThan(0);
    for (const profile of ALL_COIN_PROFILES) {
      expect(profile.summary, profile.asset).toMatch(/[가-힣]/);
      expect(Array.from(profile.summary).length, profile.asset).toBeLessThanOrEqual(300);
      expect(profile.summary.trim(), profile.asset).toBe(profile.summary);
      expect(profile.name.trim(), profile.asset).not.toBe("");
      expect(profile.category.trim(), profile.asset).not.toBe("");
      expect(profile.summary, profile.asset).not.toMatch(/<[^>]*>|—|–/);
    }
  });

  it("has exactly one identity per asset and explicit HTTPS provenance", () => {
    expect(new Set(ALL_COIN_PROFILES.map(profile => profile.asset)).size).toBe(ALL_COIN_PROFILES.length);
    for (const profile of ALL_COIN_PROFILES) {
      expect(profile.asset).toMatch(/^[A-Z0-9]+$/);
      const url = new URL(profile.sourceUrl);
      expect(url.protocol, profile.asset).toBe("https:");
      expect(url.username + url.password, profile.asset).toBe("");
      expect(profile.verifiedAt, profile.asset).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isFinite(Date.parse(profile.verifiedAt)), profile.asset).toBe(true);
    }
  });

  it("resolves by the underlying asset rather than the contract quote or expiry", () => {
    expect(getCoinProfile({ assetClass: "crypto", baseAsset: " btc " })?.asset).toBe("BTC");
    expect(getCoinProfile({ assetClass: "crypto", baseAsset: "ETH" })?.asset).toBe("ETH");
    expect(getCoinProfile({ assetClass: "crypto", baseAsset: "BTCUSDT" })).toBeUndefined();
    expect(getCoinProfile({ assetClass: "crypto", baseAsset: "BTCUSD_260925" })).toBeUndefined();
  });

  it("does not present a crypto identity for TradeFi, unknown assets or no selection", () => {
    expect(getCoinProfile(undefined)).toBeUndefined();
    expect(getCoinProfile({ assetClass: "tradefi", baseAsset: "BTC" })).toBeUndefined();
    expect(getCoinProfile({ assetClass: "crypto", baseAsset: "UNKNOWNASSET" })).toBeUndefined();
    expect(getCoinProfile({ assetClass: "crypto", baseAsset: "" })).toBeUndefined();
  });

  it("does not strip digits or merge similarly named and migrated projects", () => {
    expect(getCoinProfile({ assetClass: "crypto", baseAsset: "1INCH" })?.asset).toBe("1INCH");
    for (const asset of ["INCH", "1000BTC", "LUNA", "LUNC", "RNDR", "MATIC", "AGIX", "OCEAN"]) {
      expect(getCoinProfile({ assetClass: "crypto", baseAsset: asset }), asset).toBeUndefined();
    }
  });

  it("only resolves explicit denomination aliases to existing profiles", () => {
    for (const [alias, asset] of Object.entries(COIN_PROFILE_ALIASES)) {
      const direct = getCoinProfile({ assetClass: "crypto", baseAsset: asset });
      expect(direct, alias).toBeDefined();
      expect(getCoinProfile({ assetClass: "crypto", baseAsset: alias })).toBe(direct);
    }
  });

  it("preserves complete in-limit summaries and handles Unicode without split surrogate pairs", () => {
    expect(coinSummaryText("프로젝트의 용도와 토큰 역할입니다.")).toBe("프로젝트의 용도와 토큰 역할입니다.");
    const result = coinSummaryText("가🪙".repeat(200));
    expect(Array.from(result).length).toBe(300);
    expect(result).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
    expect(result.endsWith("…")).toBe(true);
  });
});
