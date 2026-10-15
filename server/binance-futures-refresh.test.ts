import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAllFuturesRows, fetchFuturesMarketSnapshot } from "../client/src/lib/binanceFuturesClient";

afterEach(() => vi.unstubAllGlobals());

function mockApi({ failCoin = false, failAll = false, delisted = false } = {}) {
  const requests: RequestInit[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    requests.push(init);
    if (failAll || (failCoin && url.includes("dapi.binance.com"))) throw new TypeError("fetch failed");
    const symbol = url.includes("dapi.binance.com") ? "BTCUSD_PERP" : "NEWUSDT";
    const body = url.includes("exchangeInfo") ? { symbols: [{
      symbol, baseAsset: "NEW", quoteAsset: "USDT", contractType: "PERPETUAL", status: delisted ? "SETTLING" : "TRADING",
    }] } : url.includes("ticker/24hr") ? [{ symbol, lastPrice: "2", highPrice: "3", lowPrice: "1", priceChangePercent: "5", volume: "10", quoteVolume: "20", baseVolume: "10", closeTime: Date.now() }] : [];
    return new Response(JSON.stringify(body));
  }));
  return requests;
}

describe("live contract catalogue refresh", () => {
  it("includes newly listed symbols without a static allowlist and bypasses cached responses", async () => {
    const requests = mockApi();
    const snapshot = await fetchFuturesMarketSnapshot();
    expect(snapshot.rows.map(row => row.symbol)).toContain("NEWUSDT");
    expect(snapshot.refreshedMarkets).toEqual(["USD-M", "COIN-M"]);
    expect(requests).toHaveLength(6);
    expect(requests.every(request => request.cache === "no-store" && request.signal)).toBe(true);
  });

  it("removes contracts no longer trading", async () => {
    mockApi({ delisted: true });
    expect((await fetchFuturesMarketSnapshot()).rows).toEqual([]);
  });

  it("returns the healthy market and identifies the failed market", async () => {
    mockApi({ failCoin: true });
    const snapshot = await fetchFuturesMarketSnapshot();
    expect(snapshot.rows.map(row => row.symbol)).toEqual(["NEWUSDT"]);
    expect(snapshot.refreshedMarkets).toEqual(["USD-M"]);
    expect(snapshot.marketErrors).toEqual(["COIN-M: fetch failed"]);
  });

  it("fails truthfully when both markets fail", async () => {
    mockApi({ failAll: true });
    await expect(fetchFuturesMarketSnapshot()).rejects.toThrow("USD-M: fetch failed / COIN-M: fetch failed");
  });

  it("does not present a partial catalogue as a complete research universe", async () => {
    mockApi({ failCoin: true });
    await expect(fetchAllFuturesRows()).rejects.toThrow("COIN-M: fetch failed");
  });

  it("does not turn caller cancellation into a partial success", async () => {
    mockApi();
    const controller = new AbortController();
    controller.abort(new Error("cancelled"));
    await expect(fetchFuturesMarketSnapshot(controller.signal)).rejects.toThrow("cancelled");
  });
});
