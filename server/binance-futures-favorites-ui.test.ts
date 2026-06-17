import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Binance futures favorites UI contract", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/pages/BinanceFutures.tsx"), "utf8");

  it("persists selected futures symbols in browser localStorage", () => {
    expect(source).toContain('FAVORITES_STORAGE_KEY = "kjhstock-binance-futures-favorites"');
    expect(source).toContain("parseFavoriteKeys");
    expect(source).toContain("serializeFavoriteKeys");
    expect(source).toContain("window.localStorage.getItem(FAVORITES_STORAGE_KEY)");
    expect(source).toContain("window.localStorage.setItem(FAVORITES_STORAGE_KEY");
  });

  it("keeps favorite filtering stable while live rows update", () => {
    expect(source).toContain("favoriteOnly");
    expect(source).toContain("favoriteKeySet.has(rowSelectionKey(row))");
    expect(source).toContain("event.stopPropagation()");
    expect(source).toContain("즐겨찾기만");
    expect(source).toContain("Star");
  });

  it("renders a quick favorite strip for returning users", () => {
    expect(source).toContain("favoriteRows");
    expect(source).toContain("즐겨찾기 종목");
    expect(source).toContain("onSelectFavorite");
    expect(source).toContain("aria-pressed={favorited}");
  });
});
