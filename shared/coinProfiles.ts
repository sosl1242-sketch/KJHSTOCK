import type { FuturesMarketRow } from "./binanceFuturesAnalysis";
import { COIN_PROFILE_CATALOG, type CoinProfile } from "./coinProfileCatalog";
import { EXTENDED_COIN_PROFILES } from "./coinProfileCatalogExtended";
import { COMMUNITY_COIN_PROFILES } from "./coinProfileCatalogCommunity";
import { RESEARCH_COIN_PROFILES_A } from "./coinProfileCatalogResearchA";
import { RESEARCH_COIN_PROFILES_B } from "./coinProfileCatalogResearchB";
import { RESEARCH_COIN_PROFILES_C } from "./coinProfileCatalogResearchC";
import { RESEARCH_COIN_PROFILES_D } from "./coinProfileCatalogResearchD";
import { RESEARCH_COIN_PROFILES_E } from "./coinProfileCatalogResearchE";

export const ALL_COIN_PROFILES: readonly CoinProfile[] = [
  ...COIN_PROFILE_CATALOG, ...EXTENDED_COIN_PROFILES, ...COMMUNITY_COIN_PROFILES,
  ...RESEARCH_COIN_PROFILES_A, ...RESEARCH_COIN_PROFILES_B, ...RESEARCH_COIN_PROFILES_C,
  ...RESEARCH_COIN_PROFILES_D, ...RESEARCH_COIN_PROFILES_E,
];

const profilesByAsset = new Map(ALL_COIN_PROFILES.map(profile => [profile.asset, profile]));

// Explicit exchange denominations only. Never strip numeric prefixes or infer a
// project from a similar ticker: 1INCH is a distinct asset, as are LUNA and LUNC.
// Binance index constituents checked 2026-09-06: each contract includes the
// corresponding Binance spot symbol multiplied by 1000. Evidence in coin-purpose QA.
export const COIN_PROFILE_ALIASES: Readonly<Record<string, string>> = {
  "1000SHIB": "SHIB", "1000PEPE": "PEPE", "1000BONK": "BONK", "1000FLOKI": "FLOKI",
};

export function getCoinProfile(row: Pick<FuturesMarketRow, "baseAsset" | "assetClass"> | undefined): CoinProfile | undefined {
  if (!row || row.assetClass !== "crypto") return undefined;
  const asset = row.baseAsset.trim().toUpperCase();
  return profilesByAsset.get(COIN_PROFILE_ALIASES[asset] ?? asset);
}

/** Keep the display contract even if a future catalogue edit bypasses validation. */
export function coinSummaryText(summary: string): string {
  const text = summary.replace(/\s+/g, " ").trim();
  const characters = Array.from(text);
  return characters.length <= 300 ? text : `${characters.slice(0, 299).join("")}…`;
}
