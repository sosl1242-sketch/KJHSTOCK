from pathlib import Path

root = Path('/home/ubuntu/korea-stock-sector-analyzer')
tech_path = root / 'server' / 'technicalIndicators.ts'
home_path = root / 'client' / 'src' / 'pages' / 'Home.tsx'
stocks_test_path = root / 'server' / 'stocks.test.ts'
contract_test_path = root / 'server' / 'technical-indicators-contract.test.ts'

tech = tech_path.read_text()
tech = tech.replace(
"""export type TechnicalIndicator = {
  key: string;
  label: string;
  value: number | null;
  displayValue: string;
  status: \"overheated\" | \"oversold\" | \"neutral\" | \"watch_high\" | \"watch_low\";
  statusLabel: string;
  interpretation: string;
};
""",
"""export type TechnicalIndicator = {
  key: string;
  label: string;
  value: number | null;
  displayValue: string;
  status: \"overheated\" | \"oversold\" | \"neutral\" | \"watch_high\" | \"watch_low\";
  statusLabel: string;
  interpretation: string;
  fairPrice: number | null;
  fairPriceDisplay: string;
  fairPriceBasis: string;
};
"""
)
tech = tech.replace(
"""  latestClose: number | null;
  high52Week: number | null;
  low52Week: number | null;
  indicators: TechnicalIndicator[];
""",
"""  latestClose: number | null;
  high52Week: number | null;
  low52Week: number | null;
  fairPriceMedian: number | null;
  indicators: TechnicalIndicator[];
"""
)
tech = tech.replace(
"""function buildIndicator(
  key: string,
  label: string,
  value: number | null,
  displayValue: string,
  status: TechnicalIndicator[\"status\"],
  statusLabel: string,
  interpretation: string,
): TechnicalIndicator {
  return { key, label, value, displayValue, status, statusLabel, interpretation };
}
""",
"""type FairPriceEstimate = {
  fairPrice: number | null;
  basis: string;
};

function formatFairPrice(value: number | null) {
  return value === null ? \"자료 없음\" : `${value.toLocaleString(\"ko-KR\")}원`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const medianValue = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  return round(medianValue, 0);
}

function boundedFairPrice(latestClose: number | null, candidate: number | null, basis: string): FairPriceEstimate {
  if (!latestClose || !candidate || !Number.isFinite(candidate) || candidate <= 0) return { fairPrice: null, basis };
  const bounded = clamp(candidate, latestClose * 0.75, latestClose * 1.25);
  return { fairPrice: round(bounded, 0), basis };
}

function oscillatorFairPrice(latestClose: number | null, value: number | null, target: number, scale: number, basis: string, limit = 0.25): FairPriceEstimate {
  if (!latestClose || value === null || !Number.isFinite(value)) return { fairPrice: null, basis };
  const adjustment = clamp((target - value) / scale, -limit, limit);
  return { fairPrice: round(latestClose * (1 + adjustment), 0), basis };
}

function directFairPrice(candidate: number | null, basis: string): FairPriceEstimate {
  return !candidate || !Number.isFinite(candidate) || candidate <= 0 ? { fairPrice: null, basis } : { fairPrice: round(candidate, 0), basis };
}

function buildIndicator(
  key: string,
  label: string,
  value: number | null,
  displayValue: string,
  status: TechnicalIndicator[\"status\"],
  statusLabel: string,
  interpretation: string,
  fairPriceEstimate: FairPriceEstimate,
): TechnicalIndicator {
  return {
    key,
    label,
    value,
    displayValue,
    status,
    statusLabel,
    interpretation,
    fairPrice: fairPriceEstimate.fairPrice,
    fairPriceDisplay: formatFairPrice(fairPriceEstimate.fairPrice),
    fairPriceBasis: fairPriceEstimate.basis,
  };
}
"""
)
tech = tech.replace(
"""function calculateSmaGap(closes: number[], period = 20) {
  if (closes.length < period) return null;
  const latest = closes[closes.length - 1];
  const average = closes.slice(-period).reduce((sum, value) => sum + value, 0) / period;
  return round(((latest - average) / average) * 100);
}
""",
"""function calculateSmaGap(closes: number[], period = 20) {
  if (closes.length < period) return null;
  const latest = closes[closes.length - 1];
  const average = closes.slice(-period).reduce((sum, value) => sum + value, 0) / period;
  return round(((latest - average) / average) * 100);
}

function calculateVolumeRatio(candles: PriceCandle[], period = 20) {
  if (candles.length < period + 1) return null;
  const latestVolume = candles[candles.length - 1].volume;
  const previousVolumes = candles.slice(-(period + 1), -1).map(candle => candle.volume).filter(value => Number.isFinite(value) && value > 0);
  if (previousVolumes.length < period || latestVolume <= 0) return null;
  const average = previousVolumes.reduce((sum, value) => sum + value, 0) / previousVolumes.length;
  return round((latestVolume / average) * 100);
}
"""
)
old_block = """  const bollinger = calculateBollingerPosition(closes);
  const macd = calculateMacdHistogram(closes);
  const smaGap = calculateSmaGap(closes);
  const highDistance = latestClose && high52Week ? round(((latestClose - high52Week) / high52Week) * 100) : null;
  const lowDistance = latestClose && low52Week ? round(((latestClose - low52Week) / low52Week) * 100) : null;

  const rsiStatus = statusForUpperLower(rsi, 70, 30);
  const stochasticStatus = statusForUpperLower(stochastic, 80, 20);
  const williamsStatus = statusForUpperLower(williams, -20, -80);
  const cciStatus = statusForUpperLower(cci, 100, -100);
  const mfiStatus = statusForUpperLower(mfi, 80, 20);
  const bollingerStatus = statusForUpperLower(bollinger, 90, 10);
  const macdStatus = macd === null
    ? { status: \"neutral\" as const, label: \"데이터 부족\" }
    : macd > 0 ? { status: \"watch_high\" as const, label: \"상승 모멘텀\" } : { status: \"watch_low\" as const, label: \"하락 모멘텀\" };
  const smaGapStatus = statusForUpperLower(smaGap, 12, -12);
  const highStatus = highDistance === null
    ? { status: \"neutral\" as const, label: \"데이터 부족\" }
    : highDistance >= -5 ? { status: \"watch_high\" as const, label: \"고점권\" } : { status: \"neutral\" as const, label: \"고점 여유\" };
  const lowStatus = lowDistance === null
    ? { status: \"neutral\" as const, label: \"데이터 부족\" }
    : lowDistance <= 8 ? { status: \"watch_low\" as const, label: \"저점권\" } : { status: \"neutral\" as const, label: \"저점 이격\" };

  const indicators: TechnicalIndicator[] = [
    buildIndicator(\"rsi14\", \"RSI 14\", rsi, formatValue(rsi), rsiStatus.status, rsiStatus.label, \"70 이상은 단기 과열, 30 이하는 단기 침체로 해석하는 대표 모멘텀 지표입니다.\"),
    buildIndicator(\"stochastic14\", \"스토캐스틱 %K\", stochastic, formatValue(stochastic, \"%\"), stochasticStatus.status, stochasticStatus.label, \"최근 14거래일 고저 범위 안에서 현재가가 상단·하단 어디에 있는지 보여줍니다.\"),
    buildIndicator(\"williams14\", \"Williams %R\", williams, formatValue(williams, \"%\"), williamsStatus.status, williamsStatus.label, \"-20 이상은 고점권, -80 이하는 저점권 가능성을 보는 역방향 과열·침체 지표입니다.\"),
    buildIndicator(\"cci20\", \"CCI 20\", cci, formatValue(cci), cciStatus.status, cciStatus.label, \"+100 이상은 강한 상단 모멘텀, -100 이하는 하단 과매도 가능성을 참고합니다.\"),
    buildIndicator(\"mfi14\", \"MFI 14\", mfi, formatValue(mfi), mfiStatus.status, mfiStatus.label, \"가격과 거래량을 함께 반영한 자금흐름 지표로, RSI의 거래량 보강형으로 볼 수 있습니다.\"),
    buildIndicator(\"bollinger20\", \"볼린저 위치\", bollinger, formatValue(bollinger, \"%\"), bollingerStatus.status, bollingerStatus.label, \"20일 볼린저밴드 안에서 현재가 위치를 0~100%로 환산해 상단·하단 근접도를 보여줍니다.\"),
    buildIndicator(\"macdHistogram\", \"MACD 히스토그램\", macd, formatValue(macd), macdStatus.status, macdStatus.label, \"12·26일 EMA와 9일 시그널 차이로 상승·하락 모멘텀의 방향을 점검합니다.\"),
    buildIndicator(\"sma20Gap\", \"20일선 이격도\", smaGap, formatValue(smaGap, \"%\"), smaGapStatus.status, smaGapStatus.label, \"현재가가 20일 이동평균에서 얼마나 떨어져 있는지 보여주는 단기 고저점 보조지표입니다.\"),
    buildIndicator(\"high52Distance\", \"52주 고점 대비\", highDistance, formatValue(highDistance, \"%\"), highStatus.status, highStatus.label, \"0%에 가까울수록 52주 고점에 접근한 상태입니다.\"),
    buildIndicator(\"low52Distance\", \"52주 저점 대비\", lowDistance, formatValue(lowDistance, \"%\"), lowStatus.status, lowStatus.label, \"값이 낮을수록 52주 저점에 가까운 상태이며 반등 후보 점검에 활용합니다.\"),
  ];

  return { latestClose, high52Week, low52Week, indicators };
"""
new_block = """  const bollinger = calculateBollingerPosition(closes);
  const macd = calculateMacdHistogram(closes);
  const smaGap = calculateSmaGap(closes);
  const sma60Gap = calculateSmaGap(closes, 60);
  const volumeRatio = calculateVolumeRatio(candles);
  const high52Distance = latestClose && high52Week ? round(((latestClose - high52Week) / high52Week) * 100) : null;
  const low52Distance = latestClose && low52Week ? round(((latestClose - low52Week) / low52Week) * 100) : null;

  const rsiStatus = statusForUpperLower(rsi, 70, 30);
  const stochasticStatus = statusForUpperLower(stochastic, 80, 20);
  const williamsStatus = statusForUpperLower(williams, -20, -80);
  const cciStatus = statusForUpperLower(cci, 100, -100);
  const mfiStatus = statusForUpperLower(mfi, 80, 20);
  const bollingerStatus = statusForUpperLower(bollinger, 90, 10);
  const macdStatus = macd === null
    ? { status: \"neutral\" as const, label: \"데이터 부족\" }
    : macd > 0 ? { status: \"watch_high\" as const, label: \"상승 모멘텀\" } : { status: \"watch_low\" as const, label: \"하락 모멘텀\" };
  const smaGapStatus = statusForUpperLower(smaGap, 12, -12);
  const sma60GapStatus = statusForUpperLower(sma60Gap, 18, -18);
  const volumeRatioStatus = volumeRatio === null
    ? { status: \"neutral\" as const, label: \"데이터 부족\" }
    : volumeRatio >= 220 ? { status: \"overheated\" as const, label: \"거래 과열\" }
      : volumeRatio >= 140 ? { status: \"watch_high\" as const, label: \"돌파 동반\" }
        : volumeRatio <= 60 ? { status: \"watch_low\" as const, label: \"거래 침체\" }
          : { status: \"neutral\" as const, label: \"보통\" };
  const highStatus = highDistance === null
    ? { status: \"neutral\" as const, label: \"데이터 부족\" }
    : highDistance >= -5 ? { status: \"watch_high\" as const, label: \"고점권\" } : { status: \"neutral\" as const, label: \"고점 여유\" };
  const lowStatus = lowDistance === null
    ? { status: \"neutral\" as const, label: \"데이터 부족\" }
    : lowDistance <= 8 ? { status: \"watch_low\" as const, label: \"저점권\" } : { status: \"neutral\" as const, label: \"저점 이격\" };

  const indicators: TechnicalIndicator[] = [
    buildIndicator(\"rsi14\", \"RSI 14\", rsi, formatValue(rsi), rsiStatus.status, rsiStatus.label, \"70 이상은 단기 과열, 30 이하는 단기 침체로 해석하는 대표 모멘텀 지표입니다.\", oscillatorFairPrice(latestClose, rsi, 50, 100, \"RSI가 중립선 50에 회귀한다고 가정한 참고 가격입니다.\")),
    buildIndicator(\"stochastic14\", \"스토캐스틱 %K\", stochastic, formatValue(stochastic, \"%\"), stochasticStatus.status, stochasticStatus.label, \"최근 14거래일 고저 범위 안에서 현재가가 상단·하단 어디에 있는지 보여줍니다.\", oscillatorFairPrice(latestClose, stochastic, 50, 125, \"스토캐스틱이 중립권 50%로 되돌아온다고 가정했습니다.\")),
    buildIndicator(\"williams14\", \"Williams %R\", williams, formatValue(williams, \"%\"), williamsStatus.status, williamsStatus.label, \"-20 이상은 고점권, -80 이하는 저점권 가능성을 보는 역방향 과열·침체 지표입니다.\", oscillatorFairPrice(latestClose, williams, -50, 125, \"Williams %R이 중립권 -50%에 수렴한다고 가정했습니다.\")),
    buildIndicator(\"cci20\", \"CCI 20\", cci, formatValue(cci), cciStatus.status, cciStatus.label, \"+100 이상은 강한 상단 모멘텀, -100 이하는 하단 과매도 가능성을 참고합니다.\", oscillatorFairPrice(latestClose, cci, 0, 500, \"CCI가 과열·침체가 아닌 0선으로 회귀한다고 가정했습니다.\")),
    buildIndicator(\"mfi14\", \"MFI 14\", mfi, formatValue(mfi), mfiStatus.status, mfiStatus.label, \"가격과 거래량을 함께 반영한 자금흐름 지표로, RSI의 거래량 보강형으로 볼 수 있습니다.\", oscillatorFairPrice(latestClose, mfi, 50, 100, \"MFI가 자금흐름 중립선 50에 회귀한다고 가정했습니다.\")),
    buildIndicator(\"bollinger20\", \"볼린저 위치\", bollinger, formatValue(bollinger, \"%\"), bollingerStatus.status, bollingerStatus.label, \"20일 볼린저밴드 안에서 현재가 위치를 0~100%로 환산해 상단·하단 근접도를 보여줍니다.\", oscillatorFairPrice(latestClose, bollinger, 50, 125, \"볼린저밴드 중앙값 근처로 회귀한다고 가정했습니다.\")),
    buildIndicator(\"macdHistogram\", \"MACD 히스토그램\", macd, formatValue(macd), macdStatus.status, macdStatus.label, \"12·26일 EMA와 9일 시그널 차이로 상승·하락 모멘텀의 방향을 점검합니다.\", boundedFairPrice(latestClose, latestClose && macd !== null ? latestClose - macd * 2 : null, \"MACD 히스토그램이 0에 수렴한다고 가정한 보정 가격입니다.\")),
    buildIndicator(\"sma20Gap\", \"20일선 이격도\", smaGap, formatValue(smaGap, \"%\"), smaGapStatus.status, smaGapStatus.label, \"현재가가 20일 이동평균에서 얼마나 떨어져 있는지 보여주는 단기 고저점 보조지표입니다.\", boundedFairPrice(latestClose, latestClose && smaGap !== null ? latestClose / (1 + smaGap / 100) : null, \"현재가가 20일 이동평균선으로 되돌아간다고 가정했습니다.\")),
    buildIndicator(\"sma60Gap\", \"60일선 이격도\", sma60Gap, formatValue(sma60Gap, \"%\"), sma60GapStatus.status, sma60GapStatus.label, \"중기 추세선인 60일 이동평균 대비 이격으로 과도한 상승·하락 폭을 함께 점검합니다.\", boundedFairPrice(latestClose, latestClose && sma60Gap !== null ? latestClose / (1 + sma60Gap / 100) : null, \"현재가가 60일 이동평균선으로 회귀한다고 가정했습니다.\")),
    buildIndicator(\"volume20Ratio\", \"거래량 20일 배율\", volumeRatio, formatValue(volumeRatio, \"%\"), volumeRatioStatus.status, volumeRatioStatus.label, \"최근 거래량이 직전 20거래일 평균 대비 얼마나 확대·축소됐는지 보며 돌파와 침체를 보조 판단합니다.\", oscillatorFairPrice(latestClose, volumeRatio, 100, 500, \"거래량이 직전 20일 평균 수준으로 정상화된다고 가정했습니다.\", 0.12)),
    buildIndicator(\"high52Distance\", \"52주 고점 대비\", highDistance, formatValue(highDistance, \"%\"), highStatus.status, highStatus.label, \"0%에 가까울수록 52주 고점에 접근한 상태입니다.\", directFairPrice(high52Week ? high52Week * 0.85 : null, \"52주 고점에서 15% 완충을 둔 참고 가격입니다.\")),
    buildIndicator(\"low52Distance\", \"52주 저점 대비\", lowDistance, formatValue(lowDistance, \"%\"), lowStatus.status, lowStatus.label, \"값이 낮을수록 52주 저점에 가까운 상태이며 반등 후보 점검에 활용합니다.\", directFairPrice(low52Week ? low52Week * 1.35 : null, \"52주 저점에서 35% 반등한 기준 참고 가격입니다.\")),
  ];
  const fairPriceMedian = median(indicators.map(indicator => indicator.fairPrice).filter((value): value is number => value !== null));

  return { latestClose, high52Week, low52Week, fairPriceMedian, indicators };
"""
if old_block not in tech:
    raise SystemExit('technicalIndicators.ts calculation block not found')
tech = tech.replace(old_block, new_block)
tech = tech.replace(
"""          high52Week: round(calculated.high52Week, 0),
          low52Week: round(calculated.low52Week, 0),
          indicators: calculated.indicators,
""",
"""          high52Week: round(calculated.high52Week, 0),
          low52Week: round(calculated.low52Week, 0),
          fairPriceMedian: round(calculated.fairPriceMedian, 0),
          indicators: calculated.indicators,
"""
)
tech_path.write_text(tech)

home = home_path.read_text()
home = home.replace('고점·저점 판단 보조지표 10개', '고점·저점 판단 보조지표 12개')
home = home.replace(
"""        {technicalIndicators.data ? <Badge variant=\"outline\" className=\"rounded-full bg-slate-50\">{technicalIndicators.data.indicators.length}개 지표 · 종가 {formatNumber(technicalIndicators.data.latestClose ?? 0)}원</Badge> : null}
""",
"""        {technicalIndicators.data ? (
          <Badge variant=\"outline\" className=\"rounded-full bg-slate-50\">
            {technicalIndicators.data.indicators.length}개 지표 · 종가 {formatNumber(technicalIndicators.data.latestClose ?? 0)}원 · 적정주가 중간값 {technicalIndicators.data.fairPriceMedian ? `${formatNumber(technicalIndicators.data.fairPriceMedian)}원` : \"자료 없음\"}
          </Badge>
        ) : null}
"""
)
home = home.replace(
"""                <p className=\"mt-3 text-xs font-semibold leading-5\">{indicator.interpretation}</p>
""",
"""                <p className=\"mt-3 text-xs font-semibold leading-5\">{indicator.interpretation}</p>
                <div className=\"mt-3 rounded-2xl bg-white/55 p-3 text-xs leading-5 text-slate-700\">
                  <div className=\"flex items-center justify-between gap-2 font-black\">
                    <span>예상 적정주가</span>
                    <span>{indicator.fairPriceDisplay}</span>
                  </div>
                  <p className=\"mt-1 opacity-80\">{indicator.fairPriceBasis}</p>
                </div>
"""
)
home_path.write_text(home)

stocks = stocks_test_path.read_text()
stocks = stocks.replace('calculates RSI and returns ten high-low indicators', 'calculates RSI and returns twelve high-low indicators with fair price estimates')
stocks = stocks.replace('expect(detail.indicators).toHaveLength(10);', 'expect(detail.indicators).toHaveLength(12);')
stocks = stocks.replace(
"""      \"sma20Gap\",
      \"high52Distance\",
      \"low52Distance\",
""",
"""      \"sma20Gap\",
      \"sma60Gap\",
      \"volume20Ratio\",
      \"high52Distance\",
      \"low52Distance\",
"""
)
stocks = stocks.replace(
"""    expect(detail.high52Week).toBe(candles[candles.length - 1].high);
    expect(detail.low52Week).toBe(candles[0].low);
""",
"""    expect(detail.high52Week).toBe(candles[candles.length - 1].high);
    expect(detail.low52Week).toBe(candles[0].low);
    expect(detail.fairPriceMedian).toBeGreaterThan(0);
    expect(detail.indicators.every(indicator => indicator.fairPriceDisplay.endsWith(\"원\"))).toBe(true);
"""
)
stocks_test_path.write_text(stocks)

contract_test_path.write_text("""import { describe, expect, it } from \"vitest\";
import { readFileSync } from \"node:fs\";
import { join } from \"node:path\";

const homeSource = readFileSync(join(process.cwd(), \"client/src/pages/Home.tsx\"), \"utf8\");
const indicatorSource = readFileSync(join(process.cwd(), \"server/technicalIndicators.ts\"), \"utf8\");

describe(\"technical indicator detail contract\", () => {
  it(\"keeps the high-low assistant panel at twelve indicators\", () => {
    expect(homeSource).toContain(\"고점·저점 판단 보조지표 12개\");
    expect(indicatorSource).toContain(\"sma60Gap\");
    expect(indicatorSource).toContain(\"volume20Ratio\");
  });

  it(\"shows per-indicator estimated fair prices and the median fair price badge\", () => {
    expect(homeSource).toContain(\"예상 적정주가\");
    expect(homeSource).toContain(\"적정주가 중간값\");
    expect(indicatorSource).toContain(\"fairPriceMedian\");
    expect(indicatorSource).toContain(\"fairPriceBasis\");
  });
});
""")
