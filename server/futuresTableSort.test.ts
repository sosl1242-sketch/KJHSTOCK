import { describe, expect, it } from "vitest";
import type { FuturesMarketRow } from "../shared/binanceFuturesAnalysis";
import {
  sortFuturesRows,
  type FuturesTableSortKey,
} from "../client/src/lib/futuresTableSort";

function row(
  symbol: string,
  overrides: Partial<FuturesMarketRow> = {}
): FuturesMarketRow {
  return {
    rank: 1,
    marketType: "USD-M",
    assetClass: "crypto",
    symbol,
    pair: symbol,
    baseAsset: "BTC",
    quoteAsset: "USDT",
    contractType: "PERPETUAL",
    price: 100,
    high24h: 110,
    low24h: 90,
    change24hPercent: 0,
    baseVolume24h: 100,
    volume24hUsd: 10_000,
    fundingRate: 0,
    markPrice: 100,
    nextFundingTime: null,
    openInterestUsd: null,
    openInterestToVolumePercent: null,
    lastUpdated: "2026-09-06T00:00:00.000Z",
    signal: "neutral",
    ...overrides,
  };
}

function symbols(rows: FuturesMarketRow[]) {
  return rows.map(item => item.symbol);
}

describe("sortFuturesRows", () => {
  const numericKeys = [
    "rank",
    "price",
    "change24hPercent",
    "baseVolume24h",
    "volume24hUsd",
    "fundingRate",
  ] as const satisfies readonly FuturesTableSortKey[];

  it.each(numericKeys)("sorts raw %s numerically in both directions", key => {
    const rows = [
      row("HIGH", { [key]: 1000 }),
      row("LOW", { [key]: -3.25 }),
      row("ZERO", { [key]: 0 }),
      row("MID", { [key]: 2.5 }),
    ];

    expect(symbols(sortFuturesRows(rows, key, "asc"))).toEqual([
      "LOW",
      "ZERO",
      "MID",
      "HIGH",
    ]);
    expect(symbols(sortFuturesRows(rows, key, "desc"))).toEqual([
      "HIGH",
      "MID",
      "ZERO",
      "LOW",
    ]);
  });

  it("sorts symbol names naturally instead of comparing digit characters", () => {
    const rows = [row("TOKEN10USDT"), row("TOKEN2USDT"), row("TOKEN1USDT")];

    expect(symbols(sortFuturesRows(rows, "symbol", "asc"))).toEqual([
      "TOKEN1USDT",
      "TOKEN2USDT",
      "TOKEN10USDT",
    ]);
    expect(symbols(sortFuturesRows(rows, "symbol", "desc"))).toEqual([
      "TOKEN10USDT",
      "TOKEN2USDT",
      "TOKEN1USDT",
    ]);
  });

  it("uses Korean locale ordering for names", () => {
    expect(
      symbols(
        sortFuturesRows(
          [row("다라"), row("가나"), row("나라")],
          "symbol",
          "asc"
        )
      )
    ).toEqual(["가나", "나라", "다라"]);
  });

  it.each(["asc", "desc"] as const)(
    "keeps missing funding below positive, zero and negative values (%s)",
    direction => {
      const rows = [
        row("NULL", { fundingRate: null }),
        row("NEGATIVE", { fundingRate: -0.001 }),
        row("NAN", { fundingRate: Number.NaN }),
        row("POSITIVE", { fundingRate: 0.001 }),
        row("UNDEFINED", { fundingRate: undefined }),
        row("INFINITY", { fundingRate: Number.POSITIVE_INFINITY }),
        row("ZERO", { fundingRate: 0 }),
      ];
      const sorted = sortFuturesRows(rows, "fundingRate", direction);

      expect(symbols(sorted.slice(0, 3))).toEqual(
        direction === "asc"
          ? ["NEGATIVE", "ZERO", "POSITIVE"]
          : ["POSITIVE", "ZERO", "NEGATIVE"]
      );
      expect(symbols(sorted.slice(3))).toEqual([
        "INFINITY",
        "NAN",
        "NULL",
        "UNDEFINED",
      ]);
    }
  );

  it.each(["asc", "desc"] as const)(
    "keeps invalid numeric market data at the end (%s)",
    direction => {
      const rows = [
        row("BAD", { price: Number.NaN }),
        row("VALID", { price: 10 }),
      ];
      expect(symbols(sortFuturesRows(rows, "price", direction))).toEqual([
        "VALID",
        "BAD",
      ]);
    }
  );

  it.each(["asc", "desc"] as const)(
    "keeps empty names last (%s)",
    direction => {
      const rows = [row(""), row("BTCUSDT"), row("   ")];
      expect(sortFuturesRows(rows, "symbol", direction)[0].symbol).toBe(
        "BTCUSDT"
      );
    }
  );

  it("sorts market and contract columns as text", () => {
    const rows = [
      row("A", { marketType: "USD-M", contractType: "PERPETUAL" }),
      row("B", { marketType: "COIN-M", contractType: "CURRENT_QUARTER" }),
    ];

    for (const key of ["marketType", "contractType"] as const) {
      expect(symbols(sortFuturesRows(rows, key, "asc"))).toEqual(["B", "A"]);
      expect(symbols(sortFuturesRows(rows, key, "desc"))).toEqual(["A", "B"]);
    }
  });

  it("orders signals from bearish to bullish, or the reverse", () => {
    const rows = [
      row("NEUTRAL", { signal: "neutral" }),
      row("BULL", { signal: "bullish" }),
      row("BEAR", { signal: "bearish" }),
    ];

    expect(symbols(sortFuturesRows(rows, "signal", "asc"))).toEqual([
      "BEAR",
      "NEUTRAL",
      "BULL",
    ]);
    expect(symbols(sortFuturesRows(rows, "signal", "desc"))).toEqual([
      "BULL",
      "NEUTRAL",
      "BEAR",
    ]);
  });

  it("resolves tied metrics by symbol and market independently of source order or direction", () => {
    const aUsd = row("A", { marketType: "USD-M" });
    const aCoin = row("A", { marketType: "COIN-M" });
    const b = row("B");
    const expected = [aCoin, aUsd, b];

    for (const direction of ["asc", "desc"] as const) {
      expect(
        sortFuturesRows([b, aUsd, aCoin], "volume24hUsd", direction)
      ).toEqual(expected);
      expect(
        sortFuturesRows([aCoin, b, aUsd], "volume24hUsd", direction)
      ).toEqual(expected);
    }
  });

  it("resolves collator-equivalent spellings consistently across refreshes", () => {
    const rows = [row("TOKEN02"), row("TOKEN2"), row("token2")];

    expect(sortFuturesRows(rows, "symbol", "asc")).toEqual(
      sortFuturesRows([...rows].reverse(), "symbol", "asc")
    );
  });

  it("returns a new array without changing the source or row objects", () => {
    const high = Object.freeze({
      ...row("HIGH", { price: 100 }),
      customValue: "preserved",
    });
    const low = Object.freeze({
      ...row("LOW", { price: 1 }),
      customValue: "also preserved",
    });
    const input = Object.freeze([high, low]);
    const output = sortFuturesRows(input, "price", "asc");

    expect(output).not.toBe(input);
    expect(input).toEqual([high, low]);
    expect(output).toEqual([low, high]);
    expect(output[0]).toBe(low);
    expect(output[0].customValue).toBe("also preserved");
  });
});
