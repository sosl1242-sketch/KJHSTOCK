import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("TradeFi stock and ETF assets", () => {
  it("keeps stock and ETF proxies separate from Binance futures rows", () => {
    const source = readFileSync(resolve(process.cwd(), "server/tradeFiAssets.ts"), "utf8");

    expect(source).toContain('"MSTR"');
    expect(source).toContain('"QQQ"');
    expect(source).toContain('"SPY"');
    expect(source).toContain('"DVLT"');
    expect(source).toContain('"Commodity ETF"');
    expect(source).toContain('"Stooq"');
  });
});
