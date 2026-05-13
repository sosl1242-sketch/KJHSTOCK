import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const homeSource = readFileSync(join(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const indicatorSource = readFileSync(join(process.cwd(), "server/technicalIndicators.ts"), "utf8");

describe("technical indicator detail contract", () => {
  it("keeps the high-low assistant panel at twelve indicators", () => {
    expect(homeSource).toContain("고점·저점 판단 보조지표 12개");
    expect(indicatorSource).toContain("sma60Gap");
    expect(indicatorSource).toContain("volume20Ratio");
  });

  it("shows per-indicator estimated fair prices and the median fair price badge", () => {
    expect(homeSource).toContain("예상 적정주가");
    expect(homeSource).toContain("적정주가 중간값");
    expect(indicatorSource).toContain("fairPriceMedian");
    expect(indicatorSource).toContain("fairPriceBasis");
  });
});
