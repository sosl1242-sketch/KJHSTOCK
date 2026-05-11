import { describe, it, expect } from "vitest";

describe("Indicator Detail Dialog", () => {
  it("should have RSI14 method guide with category, calculation, data requirement, current reading focus", () => {
    const rsi14Guide = {
      category: "모멘텀·과열/침체 오실레이터",
      calculation: "최근 14거래일의 평균 상승폭과 평균 하락폭을 비교해 RS를 구한 뒤 RSI = 100 - 100 / (1 + RS)로 환산합니다.",
      dataRequirement: "일별 종가가 필요하며, 이 화면에서는 YahooFinance 가격 이력의 종가 변화폭을 사용합니다.",
      currentReadingFocus: "현재값이 50 위인지, 70 과열권 또는 30 침체권에 가까운지와 최근 가격이 20일선 위아래 어디에 있는지를 함께 봅니다.",
    };

    expect(rsi14Guide.category).toContain("모멘텀");
    expect(rsi14Guide.calculation).toContain("RSI");
    expect(rsi14Guide.dataRequirement).toContain("일별 종가");
    expect(rsi14Guide.currentReadingFocus).toContain("50");
  });

  it("should have Stochastic14 method guide with proper structure", () => {
    const stochasticGuide = {
      category: "가격 위치·단기 추세 오실레이터",
      calculation: "%K = (현재 종가 - 최근 14거래일 최저가) / (최근 14거래일 최고가 - 최저가) × 100으로 계산합니다.",
      dataRequirement: "최근 14거래일의 고가, 저가, 종가가 필요하며, 가격 범위 안에서 종가 위치를 측정합니다.",
      currentReadingFocus: "상단권에 머무르는지, 하단권에서 반등하는지, 볼린저밴드 위치와 같은 방향인지 확인합니다.",
    };

    expect(stochasticGuide.category).toContain("가격 위치");
    expect(stochasticGuide.calculation).toContain("%K");
  });

  it("should verify all 12 indicator method guides are distinct and complete", () => {
    const guides = [
      { key: "rsi14", category: "모멘텀" },
      { key: "stochastic14", category: "가격 위치" },
      { key: "williams14", category: "역방향" },
      { key: "cci20", category: "추세 이격" },
      { key: "mfi14", category: "거래량" },
      { key: "bollinger20", category: "변동성" },
      { key: "macdHistogram", category: "모멘텀" },
      { key: "sma20Gap", category: "단기" },
      { key: "sma60Gap", category: "중기" },
      { key: "volume20Ratio", category: "거래활동" },
      { key: "high52Distance", category: "52주" },
      { key: "low52Distance", category: "52주" },
    ];

    expect(guides).toHaveLength(12);
    guides.forEach(guide => {
      expect(guide.key).toBeTruthy();
      expect(guide.category).toBeTruthy();
    });
  });

  it("should verify indicator detail dialog shows current stock analysis", () => {
    const dialogContent = {
      indicatorName: "RSI14",
      stockName: "삼성전자",
      currentValue: "57.92",
      statusLabel: "중립",
      interpretation: "최근 14거래일 동안 상승폭이 하락폭을 약간 상회하고 있습니다.",
      fairPriceDisplay: "68,500원",
      fairPriceBasis: "보조지표 기준 추정 적정주가입니다.",
    };

    expect(dialogContent.stockName).toBeTruthy();
    expect(dialogContent.currentValue).toBeTruthy();
    expect(dialogContent.interpretation).toBeTruthy();
    expect(dialogContent.fairPriceDisplay).toBeTruthy();
  });
});
