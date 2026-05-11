import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("technical indicator detail drilldown UI contract", () => {
  const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

  it("keeps card-click drilldown copy and state wiring for detailed explanations", () => {
    expect(homeSource).toContain("selectedIndicatorKey");
    expect(homeSource).toContain("보조지표 상세 해설");
    expect(homeSource).toContain("상세 해설·근거 차트 보기");
    expect(homeSource).toContain("의미, 판단 기준, 현재 해석, 주의점");
  });

  it("renders the technical evidence charts required for moving averages, Bollinger bands, MACD, and volume", () => {
    expect(homeSource).toContain("가격·이동평균·볼린저밴드 근거");
    expect(homeSource).toContain("bollingerUpper");
    expect(homeSource).toContain("bollingerLower");
    expect(homeSource).toContain("sma20");
    expect(homeSource).toContain("sma60");
    expect(homeSource).toContain("MACD·거래량 보조 근거");
    expect(homeSource).toContain("macdHistogram");
    expect(homeSource).toContain("volumeRatio");
  });

  it("keeps 60 second market price auto tracking controls and status copy", () => {
    expect(homeSource).toContain("PRICE_AUTO_REFETCH_MS = 60_000");
    expect(homeSource).toContain("autoRefreshStatus");
    expect(homeSource).toContain("서버 60초 자동 추적 활성");
    expect(homeSource).toContain("화면 60초 재조회");
    expect(homeSource).toContain("최근 반영");
  });

  it("keeps guide coverage for all 12 currently supported indicator keys", () => {
    const indicatorKeys = [
      "rsi14",
      "stochastic14",
      "williams14",
      "cci20",
      "mfi14",
      "bollinger20",
      "macdHistogram",
      "sma20Gap",
      "sma60Gap",
      "volume20Ratio",
      "high52Distance",
      "low52Distance",
    ];

    for (const key of indicatorKeys) {
      expect(homeSource).toContain(`${key}: {`);
    }
  });
});
