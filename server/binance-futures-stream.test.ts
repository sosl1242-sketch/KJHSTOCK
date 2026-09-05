import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribeAllFuturesTicker } from "../client/src/lib/binanceFuturesClient";
import { buildFuturesRows, type FuturesMarketType } from "../shared/binanceFuturesAnalysis";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  private listeners = new Map<string, Array<(event: { data?: string }) => void>>();

  constructor(readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event: { data?: string }) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  receive(payload: unknown) {
    this.listeners.get("message")?.forEach(listener => listener({ data: JSON.stringify(payload) }));
  }

  close() {
    this.listeners.get("close")?.forEach(listener => listener({}));
  }
}

function makeRow(marketType: FuturesMarketType, symbol: string) {
  return buildFuturesRows({
    marketType,
    symbols: [{ symbol, baseAsset: "BTC", quoteAsset: "USD", contractType: "PERPETUAL", status: "TRADING" }],
    tickers: [{ symbol, lastPrice: "100", highPrice: "110", lowPrice: "90", priceChangePercent: "1", volume: "10", baseVolume: "2", quoteVolume: "1000", closeTime: 1_780_000_000_000 }],
    premiumIndex: [],
    openInterestBySymbol: new Map(),
  })[0];
}

afterEach(() => {
  MockWebSocket.instances = [];
  vi.unstubAllGlobals();
});

describe.each<FuturesMarketType>(["USD-M", "COIN-M"])("%s ticker stream", marketType => {
  it.each(["merged", "legacy"])("keeps %s updates in their own market with correct volume units", mode => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    const original = [
      makeRow("COIN-M", "SHARED"),
      makeRow("USD-M", "SHARED"),
      makeRow("COIN-M", "UNTOUCHED"),
      makeRow("USD-M", "UNTOUCHED"),
    ];
    let rows = original;
    const stop = subscribeAllFuturesTicker(updater => { rows = updater(rows); }, vi.fn());
    const socket = MockWebSocket.instances[marketType === "USD-M" ? 0 : 1];
    const update = {
      s: "SHARED", c: "105", h: "110", l: "90", P: "5", v: "12",
      q: marketType === "COIN-M" ? "4" : "1260", E: 1_780_000_001_000,
    };
    const marketCode = marketType === "USD-M" ? 1 : 2;

    try {
      socket.receive(mode === "legacy" ? [update] : [
        { ...update, st: marketCode },
        { ...update, c: "999", st: marketCode === 1 ? 2 : 1 },
      ]);

      expect(rows.map(row => `${row.marketType}:${row.symbol}`)).toEqual(original.map(row => `${row.marketType}:${row.symbol}`));
      rows.forEach((row, index) => {
        if (row.marketType === marketType && row.symbol === "SHARED") {
          expect(row).toMatchObject({
            price: 105,
            baseVolume24h: marketType === "COIN-M" ? 4 : 12,
            volume24hUsd: marketType === "COIN-M" ? 420 : 1260,
          });
        } else {
          expect(row).toBe(original[index]);
        }
      });
    } finally {
      stop();
    }
  });
});
