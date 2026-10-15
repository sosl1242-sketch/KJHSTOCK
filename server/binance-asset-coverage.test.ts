import { describe, expect, it } from "vitest";
import {
  buildFuturesRows, DEFAULT_FUTURES_ASSET_FILTER, matchesFuturesAssetFilter,
  type BinanceFuturesSymbol,
} from "../shared/binanceFuturesAnalysis";

const symbols: BinanceFuturesSymbol[] = [
  { symbol: "BTCUSDT", baseAsset: "BTC", quoteAsset: "USDT", contractType: "PERPETUAL", status: "TRADING", underlyingType: "COIN" },
  { symbol: "KORUUSDT", baseAsset: "KORU", quoteAsset: "USDT", contractType: "TRADIFI_PERPETUAL", status: "TRADING", underlyingType: "EQUITY", underlyingSubType: ["TradFi"] },
  ...["OPENAI", "ANTHROPIC", "MOONSHOT", "OURA"].map(baseAsset => ({
    symbol: `${baseAsset}USDT`, baseAsset, quoteAsset: "USDT", contractType: "TRADIFI_PERPETUAL", status: "TRADING", underlyingType: "PREMARKET", underlyingSubType: ["TradFi", "Pre-IPO"],
  })),
];

function rowsFor(metadata = symbols) {
  return buildFuturesRows({ marketType: "USD-M", symbols: metadata,
    tickers: metadata.map(({ symbol }) => ({ symbol, lastPrice: "10", highPrice: "12", lowPrice: "9", priceChangePercent: "1", volume: "100", quoteVolume: "1000", closeTime: Date.now() })),
    premiumIndex: [], openInterestBySymbol: new Map(),
  });
}

describe("Binance TradFi and Pre-IPO coverage", () => {
  it("includes KORU and all Pre-IPO contracts in the initial unfiltered Sheet", () => {
    const visible = rowsFor().filter(row => matchesFuturesAssetFilter(row, DEFAULT_FUTURES_ASSET_FILTER));
    expect(DEFAULT_FUTURES_ASSET_FILTER).toBe("all");
    expect(visible.map(row => row.symbol).sort()).toEqual(symbols.map(row => row.symbol).sort());
  });

  it("keeps Pre-IPO selectable separately and included within TradFi", () => {
    const rows = rowsFor();
    expect(rows.filter(row => matchesFuturesAssetFilter(row, "preipo"))).toHaveLength(4);
    expect(rows.filter(row => matchesFuturesAssetFilter(row, "tradefi"))).toHaveLength(5);
    expect(rows.filter(row => matchesFuturesAssetFilter(row, "crypto")).map(row => row.symbol)).toEqual(["BTCUSDT"]);
    expect(rows.find(row => row.symbol === "KORUUSDT")?.assetClass).toBe("tradefi");
  });

  it("classifies newly listed assets from metadata without a symbol allowlist", () => {
    const metadata = [
      { ...symbols[0], underlyingType: "PREMARKET" },
      { ...symbols[0], underlyingSubType: ["Pre-IPO"] },
      { ...symbols[0], underlyingType: "KR_EQUITY" },
      { ...symbols[0], underlyingType: "FX" },
      { ...symbols[0], underlyingSubType: ["TradFi"] },
    ];
    expect(metadata.map(symbol => rowsFor([symbol])[0].assetClass)).toEqual(["preipo", "preipo", "tradefi", "tradefi", "tradefi"]);
  });

  it("does not mistake crypto indexes for TradFi or include settled contracts", () => {
    expect(rowsFor([{ ...symbols[0], underlyingType: "INDEX", underlyingSubType: ["Crypto"] }])[0].assetClass).toBe("crypto");
    expect(rowsFor(symbols.map(symbol => ({ ...symbol, status: "SETTLING" })))).toEqual([]);
  });
});
