import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Activity, ArrowDown, ArrowUp, ArrowUpDown, BarChart3, Bitcoin, Loader2, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// ─── 타입 ─────────────────────────────────────────────────────────────────────
type CryptoSector = "TradeFi" | "Energy" | "L1" | "L2" | "AI" | "DeFi" | "Meme" | "Exchange" | "Payments" | "Infrastructure" | "Other";
type CryptoRow = {
  rank: number; ticker: string; name: string; baseAsset: string; sector: CryptoSector; contractType: "PERPETUAL";
  price: number; high24h: number; low24h: number; change24hPercent: number; change7dPercent: number | null;
  marketCapUsd: number | null; fdvUsd: number | null; circulatingSupply: number | null;
  baseVolume24h: number; volume24hUsd: number; fundingRate: number; markPrice: number | null;
  nextFundingTime: string | null; openInterestUsd: number | null; volumeToMarketCapPercent: number | null;
  openInterestToMarketCapPercent: number | null; openInterestToVolumePercent: number | null;
  volatility30dPercent: number | null; longShortRatio: number | null; lastUpdated: string;
};
type SortKey = "rank" | "ticker" | "sector" | "price" | "high24h" | "low24h" | "change24hPercent" | "change7dPercent"
  | "marketCapUsd" | "fdvUsd" | "circulatingSupply" | "baseVolume24h" | "volume24hUsd" | "volumeToMarketCapPercent"
  | "fundingRate" | "markPrice" | "nextFundingTime" | "openInterestUsd" | "openInterestToMarketCapPercent"
  | "openInterestToVolumePercent" | "volatility30dPercent" | "longShortRatio" | "contractType" | "lastUpdated";
type SortDirection = "asc" | "desc";
type PriceChartFrame = "daily" | "weekly" | "monthly";

// ─── 포맷 헬퍼 ───────────────────────────────────────────────────────────────
const fmtUsd = (v: number | null | undefined) => {
  if (typeof v !== "number" || !Number.isFinite(v)) return "-";
  if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}T`;
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}M`;
  return `$${v.toLocaleString("ko-KR", { maximumFractionDigits: 4 })}`;
};
const fmtPrice = (v: number | null | undefined) => {
  if (typeof v !== "number" || !Number.isFinite(v)) return "-";
  if (v >= 1000) return `$${v.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}`;
  if (v >= 1) return `$${v.toLocaleString("ko-KR", { maximumFractionDigits: 4 })}`;
  return `$${v.toFixed(6)}`;
};
const fmtPct = (v: number | null | undefined, d = 2) => {
  if (typeof v !== "number" || !Number.isFinite(v)) return "-";
  return `${v > 0 ? "+" : ""}${v.toLocaleString("ko-KR", { maximumFractionDigits: d })}%`;
};
const fmtFunding = (v: number | null | undefined) => typeof v === "number" && Number.isFinite(v) ? `${(v * 100).toFixed(4)}%` : "-";
const fmtDt = (v: string | null | undefined) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};
const fmtNum = (v: number | null | undefined, d = 2) => typeof v === "number" && Number.isFinite(v) ? v.toLocaleString("ko-KR", { maximumFractionDigits: d }) : "-";

// ─── 레이블 ───────────────────────────────────────────────────────────────────
const sectorLabels: Record<CryptoSector, string> = { TradeFi: "TradeFi", Energy: "에너지", L1: "L1", L2: "L2", AI: "AI", DeFi: "DeFi", Meme: "밈", Exchange: "거래소", Payments: "결제", Infrastructure: "인프라", Other: "기타" };
const sortLabels: Record<SortKey, string> = {
  rank: "순위", ticker: "티커", sector: "섹터", price: "가격", high24h: "24h 고가", low24h: "24h 저가",
  change24hPercent: "24h 등락률", change7dPercent: "7d 등락률", marketCapUsd: "시가총액", fdvUsd: "FDV",
  circulatingSupply: "유통 공급량", baseVolume24h: "24h 거래량", volume24hUsd: "24h 거래대금",
  volumeToMarketCapPercent: "거래/시총", fundingRate: "펀딩비", markPrice: "마크가격",
  nextFundingTime: "다음 펀딩", openInterestUsd: "미결제약정", openInterestToMarketCapPercent: "OI/시총",
  openInterestToVolumePercent: "OI/거래대금", volatility30dPercent: "30d 변동성",
  longShortRatio: "롱/숏 비율", contractType: "계약유형", lastUpdated: "마지막 갱신",
};

// ─── 선물 지표 가이드 ─────────────────────────────────────────────────────────
const metricGuides: Record<string, { category: string; meaning: string; standard: string; caution: string }> = {
  volume24hUsd: { category: "유동성", meaning: "24시간 거래대금은 Binance USDT 무기한 선물에서 실제로 회전한 명목 거래 규모입니다.", standard: "전체 USDT 무기한 선물을 거래대금 기준으로 정렬하면 현재 파생시장 관심이 집중된 종목을 빠르게 볼 수 있습니다.", caution: "거래대금 급증은 이벤트성일 수 있어 펀딩비와 미결제약정 변화를 함께 확인해야 합니다." },
  change24hPercent: { category: "단기 모멘텀", meaning: "24시간 등락률은 하루 동안의 가격 방향성과 단기 상대 강도를 보여줍니다.", standard: "거래대금 상위권에서 상승률이 높으면 수급이 동반된 모멘텀으로 볼 수 있습니다.", caution: "급등 직후에는 펀딩비 과열과 청산 변동성이 커질 수 있습니다." },
  fundingRate: { category: "선물 수급", meaning: "펀딩비는 롱과 숏 중 어느 쪽 포지션 비용이 더 큰지 보여줍니다.", standard: "양수는 롱 비용 부담, 음수는 숏 비용 부담으로 해석합니다.", caution: "추세가 강하면 높은 펀딩비가 바로 반전 신호가 아닐 수 있습니다." },
  openInterestUsd: { category: "레버리지", meaning: "미결제약정은 아직 닫히지 않은 선물 포지션의 추정 명목 규모입니다.", standard: "가격 상승과 OI 증가가 동시에 나타나면 레버리지 참여가 늘어난 상태입니다.", caution: "OI가 높으면 급격한 청산 연쇄가 발생할 수 있습니다." },
  openInterestToVolumePercent: { category: "레버리지 부담", meaning: "OI/거래대금은 하루 거래대금 대비 쌓여 있는 포지션 부담을 보여줍니다.", standard: "값이 높을수록 단기 거래 회전 대비 포지션 누적 부담이 큽니다.", caution: "거래대금이 일시적으로 낮아도 값이 높게 보일 수 있습니다." },
  price: { category: "가격", meaning: "최근 체결 가격은 모든 선물 지표의 기준 가격입니다.", standard: "24시간 고가·저가와 함께 보면 현재 위치가 상단인지 하단인지 판단할 수 있습니다.", caution: "선물 가격은 현물과 일시적으로 괴리될 수 있습니다." },
  high24h: { category: "가격 범위", meaning: "24시간 고가는 최근 하루 매수세가 도달한 상단입니다.", standard: "현재가가 고가에 가까우면 단기 강세가 유지되는 상태일 수 있습니다.", caution: "돌파 실패 이후에는 고가가 단기 저항선으로 작용할 수 있습니다." },
  low24h: { category: "가격 범위", meaning: "24시간 저가는 최근 하루 매도세가 도달한 하단입니다.", standard: "현재가가 저가에서 멀어질수록 단기 반등 강도가 커진 것으로 볼 수 있습니다.", caution: "저가 이탈 시 손절·청산 물량이 확대될 수 있습니다." },
  baseVolume24h: { category: "거래량", meaning: "기초자산 수량 기준 거래량은 실제 계약 수량의 회전 정도입니다.", standard: "가격이 낮은 코인은 명목 거래대금과 함께 기초자산 거래량도 확인하면 좋습니다.", caution: "코인별 가격 단위가 달라 단순 수량 비교는 왜곡될 수 있습니다." },
  markPrice: { category: "정산 기준", meaning: "마크가격은 펀딩과 청산 계산에 쓰이는 기준 가격입니다.", standard: "최근가와 마크가격 괴리가 커지면 단기 과열이나 유동성 왜곡을 의심할 수 있습니다.", caution: "거래소 산식에 따라 일시적으로 체결가와 차이가 날 수 있습니다." },
  nextFundingTime: { category: "펀딩 일정", meaning: "다음 펀딩 시각은 롱·숏 비용 정산이 예정된 시간입니다.", standard: "펀딩 직전에는 포지션 조정으로 변동성이 커질 수 있습니다.", caution: "정산 시각 자체가 방향성을 보장하지는 않습니다." },
  contractType: { category: "계약", meaning: "현재 화면은 USDT 무기한 선물 계약만 대상으로 합니다.", standard: "같은 계약 유형끼리 비교해야 거래대금, 펀딩비, OI 해석이 일관됩니다.", caution: "COIN-M 선물이나 분기물은 별도 기준으로 봐야 합니다." },
};
const metricOrder: SortKey[] = ["volume24hUsd", "change24hPercent", "fundingRate", "openInterestUsd", "openInterestToVolumePercent", "price", "high24h", "low24h", "baseVolume24h", "markPrice", "nextFundingTime", "contractType"];

// ─── 기술적 보조지표 가이드 ───────────────────────────────────────────────────
type IndicatorScale = { min: number; max: number; low: number; high: number; unit?: string };
type IndicatorDetailGuide = { meaning: string; thresholds: string; caution: string; chartFocus: string; scale?: IndicatorScale };
type IndicatorMethodGuide = { category: string; calculation: string; dataRequirement: string; currentReadingFocus: string };

const indicatorDetailGuides: Record<string, IndicatorDetailGuide> = {
  rsi14: { meaning: "최근 상승폭과 하락폭의 균형을 0~100으로 환산해 단기 과열·침체를 보는 대표 모멘텀 지표입니다.", thresholds: "70 이상은 단기 과열, 30 이하는 단기 침체, 50 부근은 중립권으로 해석합니다.", caution: "강한 추세장에서는 RSI가 과열·침체권에 오래 머무를 수 있으므로 이동평균선과 가격 추세를 함께 확인해야 합니다.", chartFocus: "가격이 20일·60일 이동평균선에서 얼마나 떨어져 있는지와 RSI의 중립선 회귀 가능성을 함께 봅니다.", scale: { min: 0, max: 100, low: 30, high: 70 } },
  stochastic14: { meaning: "최근 14거래일 고저 범위 안에서 현재 종가가 어느 위치에 있는지 보여주는 빠른 오실레이터입니다.", thresholds: "80% 이상은 단기 상단권, 20% 이하는 단기 하단권으로 보는 경우가 많습니다.", caution: "횡보장에서는 유용하지만 강한 추세장에서는 잦은 신호가 발생할 수 있어 볼린저밴드 위치와 같이 확인하는 편이 안전합니다.", chartFocus: "최근 가격이 볼린저밴드 상·하단 중 어디에 가까운지와 스토캐스틱 위치를 비교합니다.", scale: { min: 0, max: 100, low: 20, high: 80, unit: "%" } },
  williams14: { meaning: "스토캐스틱과 유사하지만 -100~0 범위로 표시되는 역방향 과열·침체 지표입니다.", thresholds: "-20 이상은 고점권, -80 이하는 저점권 가능성을 참고합니다.", caution: "값의 방향이 일반 퍼센트 지표와 반대처럼 보일 수 있으므로 0에 가까울수록 상단권이라는 점에 유의해야 합니다.", chartFocus: "52주 고저 범위와 최근 볼린저밴드 위치를 함께 보며 단기 고점·저점 신호를 검증합니다.", scale: { min: -100, max: 0, low: -80, high: -20, unit: "%" } },
  cci20: { meaning: "전형가격이 최근 평균에서 얼마나 벗어났는지 표준화해 추세 과열과 평균회귀 가능성을 살핍니다.", thresholds: "+100 이상은 상방 모멘텀 과열, -100 이하는 하방 과매도 가능성을 주로 봅니다.", caution: "CCI는 변동성이 큰 종목에서 급격히 흔들릴 수 있어 거래량 배율과 추세선 방향을 같이 확인해야 합니다.", chartFocus: "20일 이동평균선과 가격 괴리를 확인해 CCI가 평균회귀 신호인지 추세 지속 신호인지 구분합니다.", scale: { min: -200, max: 200, low: -100, high: 100 } },
  mfi14: { meaning: "가격 변화와 거래량을 함께 반영해 매수·매도 자금흐름의 과열 여부를 추정합니다.", thresholds: "80 이상은 자금 유입 과열, 20 이하는 자금 유출 과도 구간으로 참고합니다.", caution: "거래량 급증 이벤트가 있으면 일시적으로 과장될 수 있어 거래량 20일 배율과 뉴스를 함께 확인해야 합니다.", chartFocus: "거래량 배율과 가격 추세가 같은 방향으로 움직이는지 확인해 자금흐름 신호의 신뢰도를 봅니다.", scale: { min: 0, max: 100, low: 20, high: 80 } },
  bollinger20: { meaning: "20일 볼린저밴드 안에서 현재가가 하단 0%, 상단 100% 중 어디에 있는지 환산한 위치 지표입니다.", thresholds: "90% 이상은 밴드 상단 접근, 10% 이하는 밴드 하단 접근으로 봅니다.", caution: "밴드 돌파는 과열뿐 아니라 추세 시작일 수도 있으므로 MACD와 이동평균선 기울기를 함께 확인해야 합니다.", chartFocus: "가격, 볼린저밴드 상·하단, 20일 이동평균선을 한 차트에서 비교합니다.", scale: { min: 0, max: 100, low: 10, high: 90, unit: "%" } },
  macdHistogram: { meaning: "12일·26일 지수이동평균의 차이와 9일 시그널선의 차이를 막대로 나타내 상승·하락 모멘텀 변화를 봅니다.", thresholds: "0선 위는 상승 모멘텀, 0선 아래는 하락 모멘텀으로 해석하며 막대의 확대·축소 방향이 중요합니다.", caution: "MACD는 후행성이 있으므로 단기 급등락 직후에는 RSI·스토캐스틱보다 늦게 반응할 수 있습니다.", chartFocus: "MACD 히스토그램이 0선을 기준으로 확대되는지 축소되는지와 가격 추세를 함께 봅니다." },
  sma20Gap: { meaning: "현재가가 20일 이동평균선에서 얼마나 위아래로 떨어져 있는지 보는 단기 이격도입니다.", thresholds: "+12% 이상은 단기 과열, -12% 이하는 단기 과매도 가능성을 참고합니다.", caution: "실적·뉴스에 의한 재평가 구간에서는 이격이 장기간 유지될 수 있으므로 재무지표와 병행해야 합니다.", chartFocus: "가격과 20일 이동평균선의 간격이 확대·축소되는지를 직접 확인합니다.", scale: { min: -30, max: 30, low: -12, high: 12, unit: "%" } },
  sma60Gap: { meaning: "현재가가 중기 추세선인 60일 이동평균선 대비 얼마나 벌어졌는지 보여줍니다.", thresholds: "+18% 이상은 중기 과열, -18% 이하는 중기 침체 가능성을 참고합니다.", caution: "중기 추세 전환 초기에는 이격도가 크게 보일 수 있어 20일선과 60일선의 배열을 함께 봐야 합니다.", chartFocus: "20일선과 60일선의 배열, 가격의 중기 추세선 회귀 가능성을 확인합니다.", scale: { min: -40, max: 40, low: -18, high: 18, unit: "%" } },
  volume20Ratio: { meaning: "현재 거래량이 최근 20거래일 평균 대비 몇 배인지 보여주는 수급 강도 지표입니다.", thresholds: "200% 이상은 거래 급증, 50% 이하는 거래 위축 구간으로 참고합니다.", caution: "거래량 급증은 방향성을 보장하지 않으므로 가격 방향과 함께 해석해야 합니다.", chartFocus: "거래량 배율과 MACD 히스토그램 방향이 일치하는지 확인합니다.", scale: { min: 0, max: 300, low: 50, high: 200, unit: "%" } },
  high52Distance: { meaning: "현재가가 52주 고점 대비 얼마나 아래에 있는지 보여줍니다.", thresholds: "0%에 가까울수록 고점 부근, -20% 이하는 조정 구간으로 참고합니다.", caution: "고점 돌파 직전인지, 고점 대비 조정폭이 충분한지, 추세 강도와 함께 판단합니다.", chartFocus: "52주 고저 범위와 현재 가격 위치를 함께 확인합니다.", scale: { min: -60, max: 0, low: -30, high: -5, unit: "%" } },
  low52Distance: { meaning: "현재가가 52주 저점 대비 얼마나 위에 있는지 보여줍니다.", thresholds: "값이 낮을수록 저점 부근이며 반등 후보로 볼 수 있습니다.", caution: "저점권 반등 후보인지, 구조적 하락으로 저점 근처에 머무는지 거래량 회복과 같이 확인합니다.", chartFocus: "저점 이후 거래량 회복과 가격 반등 강도를 함께 봅니다.", scale: { min: 0, max: 100, low: 5, high: 30, unit: "%" } },
};
const indicatorMethodGuides: Record<string, IndicatorMethodGuide> = {
  rsi14: { category: "모멘텀·과열/침체 오실레이터", calculation: "최근 14거래일의 평균 상승폭과 평균 하락폭을 비교해 RS를 구한 뒤 RSI = 100 - 100 / (1 + RS)로 환산합니다.", dataRequirement: "일별 종가가 필요하며, 이 화면에서는 Binance 선물 일봉 종가 변화폭을 사용합니다.", currentReadingFocus: "현재값이 50 위인지, 70 과열권 또는 30 침체권에 가까운지와 최근 가격이 20일선 위아래 어디에 있는지를 함께 봅니다." },
  stochastic14: { category: "가격 위치·단기 추세 오실레이터", calculation: "%K = (현재 종가 - 최근 14거래일 최저가) / (최근 14거래일 최고가 - 최저가) × 100으로 계산합니다.", dataRequirement: "최근 14거래일의 고가, 저가, 종가가 필요하며, 가격 범위 안에서 종가 위치를 측정합니다.", currentReadingFocus: "상단권에 머무르는지, 하단권에서 반등하는지, 볼린저밴드 위치와 같은 방향인지 확인합니다." },
  williams14: { category: "가격 위치·역방향 과열/침체 오실레이터", calculation: "%R = (최근 14거래일 최고가 - 현재 종가) / (최근 14거래일 최고가 - 최저가) × -100으로 계산합니다.", dataRequirement: "최근 14거래일의 고가, 저가, 종가가 필요하며, 0에 가까울수록 상단권입니다.", currentReadingFocus: "-20 이상이면 고점권, -80 이하이면 저점권 접근으로 보고 52주 고저점 위치와 같이 해석합니다." },
  cci20: { category: "추세 이격·평균회귀 지표", calculation: "전형가격(고가+저가+종가)/3이 20일 평균 전형가격에서 얼마나 벗어났는지를 평균편차로 나눠 표준화합니다.", dataRequirement: "최근 20거래일 이상의 고가, 저가, 종가가 필요하며 변동성이 클수록 값이 크게 움직입니다.", currentReadingFocus: "+100/-100 기준선을 넘어선 상태가 단기 과열인지, 새 추세의 시작인지 거래량과 같이 확인합니다." },
  mfi14: { category: "거래량 가중 자금흐름 오실레이터", calculation: "전형가격 × 거래량으로 자금흐름을 계산하고, 14거래일 양의 흐름과 음의 흐름 비율을 0~100으로 환산합니다.", dataRequirement: "고가, 저가, 종가, 거래량이 모두 필요하며, 거래량 급증일의 영향이 크게 반영됩니다.", currentReadingFocus: "RSI와 방향이 같은지, 가격 상승이 실제 거래량 동반 자금 유입인지 확인합니다." },
  bollinger20: { category: "변동성 밴드·가격 위치 지표", calculation: "20일 이동평균을 중심선으로 두고 표준편차 2배 상·하단을 만든 뒤, 현재가가 하단 0%와 상단 100% 사이 어디에 있는지 계산합니다.", dataRequirement: "20거래일 이상의 종가가 필요하며, 표준편차가 커지면 밴드 폭도 넓어집니다.", currentReadingFocus: "상단 접근이 과열인지 추세 돌파인지, 하단 접근이 반등 후보인지 하락 추세 지속인지 MACD와 함께 봅니다." },
  macdHistogram: { category: "추세 모멘텀·후행 확인 지표", calculation: "12일 EMA와 26일 EMA 차이인 MACD에서 9일 EMA 시그널선을 뺀 값을 히스토그램으로 표시합니다.", dataRequirement: "충분한 종가 이력이 필요하며, EMA 특성상 최신 가격에 더 큰 가중치를 둡니다.", currentReadingFocus: "0선 위아래뿐 아니라 막대가 확대되는지 축소되는지로 상승·하락 모멘텀 변화를 확인합니다." },
  sma20Gap: { category: "단기 이동평균 이격도", calculation: "(현재 종가 - 20일 단순이동평균) / 20일 단순이동평균 × 100으로 계산합니다.", dataRequirement: "최근 20거래일 이상의 종가가 필요하며, 단기 가격 과열과 평균회귀 가능성을 봅니다.", currentReadingFocus: "현재가가 단기 추세선에서 지나치게 멀어졌는지, 다시 20일선으로 돌아갈 가능성이 있는지 확인합니다." },
  sma60Gap: { category: "중기 이동평균 이격도", calculation: "(현재 종가 - 60일 단순이동평균) / 60일 단순이동평균 × 100으로 계산합니다.", dataRequirement: "최근 60거래일 이상의 종가가 필요하며, 중기 추세선 대비 위치를 측정합니다.", currentReadingFocus: "20일선과 60일선 배열, 중기 추세 유지 여부, 과도한 상승·하락 후 되돌림 가능성을 봅니다." },
  volume20Ratio: { category: "거래활동·수급 강도 지표", calculation: "현재 거래량 / 직전 20거래일 평균 거래량 × 100으로 계산합니다.", dataRequirement: "현재일 거래량과 직전 20거래일 거래량이 필요하며, 가격 방향과 함께 해석해야 합니다.", currentReadingFocus: "거래량이 평균 대비 늘었는지 줄었는지, 가격 상승·하락과 동행하는지 확인합니다." },
  high52Distance: { category: "52주 고점 대비 위치 지표", calculation: "(현재 종가 - 조회 가능 기간의 52주 고점) / 52주 고점 × 100으로 계산합니다.", dataRequirement: "최대 1년 내외의 고가·종가 이력이 필요하며, 0%에 가까울수록 고점에 접근한 상태입니다.", currentReadingFocus: "고점 돌파 직전인지, 고점 대비 조정폭이 충분한지, 추세 강도와 함께 판단합니다." },
  low52Distance: { category: "52주 저점 대비 반등 위치 지표", calculation: "(현재 종가 - 조회 가능 기간의 52주 저점) / 52주 저점 × 100으로 계산합니다.", dataRequirement: "최대 1년 내외의 저가·종가 이력이 필요하며, 값이 낮을수록 저점 부근입니다.", currentReadingFocus: "저점권 반등 후보인지, 구조적 하락으로 저점 근처에 머무는지 거래량 회복과 같이 확인합니다." },
};

// ─── 근거 차트 계산 ───────────────────────────────────────────────────────────
const avg = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
const rollAvg = (vals: number[], end: number, period: number) => end + 1 < period ? null : avg(vals.slice(end + 1 - period, end + 1));
const rollStd = (vals: number[], end: number, period: number) => {
  const m = rollAvg(vals, end, period); if (m === null) return null;
  const v = avg(vals.slice(end + 1 - period, end + 1).map(x => (x - m) ** 2));
  return v === null ? null : Math.sqrt(v);
};
const emaSeries = (vals: number[], period: number) => {
  const out: Array<number | null> = Array(vals.length).fill(null);
  if (vals.length < period) return out;
  const k = 2 / (period + 1); let prev = avg(vals.slice(0, period))!;
  out[period - 1] = prev;
  for (let i = period; i < vals.length; i++) { prev = (vals[i] - prev) * k + prev; out[i] = prev; }
  return out;
};
const buildEvidenceRows = (candles: Array<{ date: string; close: number; high: number; low: number; volume: number }>) => {
  const closes = candles.map(c => c.close);
  const ema12 = emaSeries(closes, 12); const ema26 = emaSeries(closes, 26);
  const macdLine = closes.map((_, i) => ema12[i] !== null && ema26[i] !== null ? (ema12[i] as number) - (ema26[i] as number) : null);
  const macdIdxs = macdLine.map((v, i) => v === null ? null : i).filter((v): v is number => v !== null);
  const signalVals = emaSeries(macdIdxs.map(i => macdLine[i] as number), 9);
  const histMap = new Map<number, number>();
  macdIdxs.forEach((origIdx, mi) => { const s = signalVals[mi]; const m = macdLine[origIdx]; if (s !== null && m !== null) histMap.set(origIdx, m - s); });
  return candles.map((c, i) => {
    const sma20 = rollAvg(closes, i, 20); const sma60 = rollAvg(closes, i, 60); const std20 = rollStd(closes, i, 20);
    const prevVols = i >= 20 ? candles.slice(i - 20, i).map(x => x.volume).filter(v => Number.isFinite(v) && v > 0) : [];
    const prevVolAvg = prevVols.length === 20 ? avg(prevVols) : null;
    return {
      date: c.date.slice(5), fullDate: c.date, close: c.close, high: c.high, low: c.low, volume: c.volume,
      sma20, sma60,
      bollingerUpper: sma20 !== null && std20 !== null ? sma20 + 2 * std20 : null,
      bollingerLower: sma20 !== null && std20 !== null ? sma20 - 2 * std20 : null,
      macdHistogram: histMap.get(i) ?? null,
      volumeRatio: prevVolAvg ? (c.volume / prevVolAvg) * 100 : null,
    };
  });
};

// ─── 게이지 ───────────────────────────────────────────────────────────────────
const gaugePos = (v: number | null, scale?: IndicatorScale) => {
  if (v === null || !Number.isFinite(v)) return null;
  if (!scale) { const dMax = Math.max(Math.abs(v) * 2, 1); return Math.min(100, Math.max(0, ((v + dMax) / (dMax * 2)) * 100)); }
  return Math.min(100, Math.max(0, ((v - scale.min) / (scale.max - scale.min)) * 100));
};
const renderGauge = (v: number | null, guide?: IndicatorDetailGuide, compact = false) => {
  const pos = gaugePos(v, guide?.scale);
  const lowPos = guide?.scale ? gaugePos(guide.scale.low, guide.scale) : 50;
  const highPos = guide?.scale ? gaugePos(guide.scale.high, guide.scale) : 50;
  return (
    <div className={compact ? "mt-3" : "mt-4"}>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-white/70 ring-1 ring-slate-200/70">
        <div className="absolute inset-y-0 left-0 bg-blue-200/80" style={{ width: `${lowPos ?? 0}%` }} />
        <div className="absolute inset-y-0 bg-emerald-200/80" style={{ left: `${lowPos ?? 0}%`, width: `${Math.max((highPos ?? 100) - (lowPos ?? 0), 0)}%` }} />
        <div className="absolute inset-y-0 right-0 bg-rose-200/80" style={{ width: `${Math.max(100 - (highPos ?? 100), 0)}%` }} />
        {pos !== null ? <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-950 shadow" style={{ left: `${pos}%` }} /> : null}
      </div>
      {!compact && guide?.scale ? (
        <div className="mt-2 flex justify-between text-[11px] font-bold text-slate-500">
          <span>{guide.scale.min}{guide.scale.unit ?? ""}</span>
          <span>저점 기준 {guide.scale.low}{guide.scale.unit ?? ""}</span>
          <span>고점 기준 {guide.scale.high}{guide.scale.unit ?? ""}</span>
          <span>{guide.scale.max}{guide.scale.unit ?? ""}</span>
        </div>
      ) : null}
    </div>
  );
};
const statusCls = (status: string) => {
  if (status === "overheated" || status === "watch_high") return "border-rose-200 bg-rose-50 text-rose-800";
  if (status === "oversold" || status === "watch_low") return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
};
const CHART_COLORS = ["#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#10b981", "#06b6d4", "#f97316", "#6366f1", "#84cc16"];

const formatMetricValue = (row: CryptoRow, key: string) => {
  const v = row[key as keyof CryptoRow];
  if (["volume24hUsd", "marketCapUsd", "fdvUsd", "openInterestUsd"].includes(key)) return fmtUsd(v as number | null);
  if (["price", "high24h", "low24h", "markPrice"].includes(key)) return fmtPrice(v as number | null);
  if (["change24hPercent", "change7dPercent"].includes(key)) return fmtPct(v as number | null);
  if (key === "fundingRate") return fmtFunding(v as number | null);
  if (key === "nextFundingTime") return fmtDt(v as string | null);
  if (key === "baseVolume24h") return fmtNum(v as number | null, 0);
  if (typeof v === "number") return fmtNum(v);
  return `${v ?? "-"}`;
};

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function CryptoSectors() {
  const [searchText, setSearchText] = useState("");
  const [selectedSector, setSelectedSector] = useState<CryptoSector | "all">("all");
  const [sortState, setSortState] = useState<{ key: SortKey; direction: SortDirection } | null>({ key: "volume24hUsd", direction: "desc" });
  const [selectedCoin, setSelectedCoin] = useState<CryptoRow | null>(null);
  const [selectedMetricKey, setSelectedMetricKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"futures" | "technical">("futures");
  const [priceChartFrame, setPriceChartFrame] = useState<PriceChartFrame>("daily");
  const [selectedIndicatorKey, setSelectedIndicatorKey] = useState<string | null>(null);

  const cryptoTable = trpc.cryptoFutures.getTable.useQuery(undefined, {
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });
  const coins = useMemo<CryptoRow[]>(() => (
    cryptoTable.data?.success === true ? cryptoTable.data.coins as CryptoRow[] : []
  ), [cryptoTable.data]);
  const isLoading = cryptoTable.isLoading || cryptoTable.isFetching;
  const fetchError = cryptoTable.error?.message
    ?? (cryptoTable.data?.success === false ? cryptoTable.data.error : null);
  const lastUpdated = useMemo(() => {
    if (cryptoTable.data?.success === true && cryptoTable.data.lastUpdated) return cryptoTable.data.lastUpdated;
    return coins
      .map(row => row.lastUpdated)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;
  }, [coins, cryptoTable.data]);

  // 보조지표는 서버 tRPC 유지 (서버에서 Binance kline 호출)
  const technicalIndicators = trpc.cryptoFutures.technicalIndicators.useQuery(
    { symbol: selectedCoin?.ticker ?? "BTCUSDT", name: selectedCoin?.name },
    { enabled: Boolean(selectedCoin), retry: 1, staleTime: 1000 * 60 * 5 }
  );
  const technicalDetail = technicalIndicators.data?.success === true ? technicalIndicators.data.detail : null;
  const technicalErrorMessage = technicalIndicators.error?.message
    ?? (technicalIndicators.data?.success === false ? technicalIndicators.data.error : null);

  const sectors = useMemo(() => Array.from(new Set(coins.map(c => c.sector))), [coins]);
  const filteredRows = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const scoped = coins.filter(c => {
      const matchSector = selectedSector === "all" || c.sector === selectedSector;
      const matchSearch = !q || `${c.ticker} ${c.name} ${c.baseAsset} ${c.sector}`.toLowerCase().includes(q);
      return matchSector && matchSearch;
    });
    if (!sortState) return scoped;
    return [...scoped].sort((a, b) => {
      const av = a[sortState.key]; const bv = b[sortState.key];
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av ?? "").localeCompare(String(bv ?? ""), "ko-KR");
      return sortState.direction === "asc" ? cmp : -cmp;
    });
  }, [coins, searchText, selectedSector, sortState]);

  const sectorChartData = useMemo(() => {
    const sectorMap = new Map<CryptoSector, { volume: number; count: number }>();
    coins.forEach(c => {
      const cur = sectorMap.get(c.sector) ?? { volume: 0, count: 0 };
      sectorMap.set(c.sector, { volume: cur.volume + c.volume24hUsd, count: cur.count + 1 });
    });
    return Array.from(sectorMap.entries())
      .sort((a, b) => b[1].volume - a[1].volume)
      .map(([sector, d]) => ({ name: sectorLabels[sector], value: d.volume, count: d.count }));
  }, [coins]);

  const setSort = (key: SortKey) => setSortState(cur => {
    if (!cur || cur.key !== key) return { key, direction: "desc" };
    if (cur.direction === "desc") return { key, direction: "asc" };
    return null;
  });
  const sortIcon = (key: SortKey) => {
    if (sortState?.key !== key) return <ArrowUpDown className="h-3.5 w-3.5 text-slate-300" />;
    return sortState.direction === "desc" ? <ArrowDown className="h-3.5 w-3.5 text-slate-950" /> : <ArrowUp className="h-3.5 w-3.5 text-slate-950" />;
  };
  const sortHdr = (label: string, key: SortKey, align: "left" | "right" = "left") => (
    <button type="button" className={`inline-flex items-center gap-1 whitespace-nowrap font-semibold transition hover:text-slate-950 ${align === "right" ? "justify-end text-right" : ""}`} onClick={() => setSort(key)}>{label}{sortIcon(key)}</button>
  );

  const refetchAll = () => { void cryptoTable.refetch(); };

  const priceChartData = useMemo(() => {
    const history = technicalDetail?.priceHistory ?? [];
    if (priceChartFrame === "daily") return history.slice(-126).map(c => ({ date: c.date.slice(5), fullDate: c.date, close: c.close }));
    const grouped = new Map<string, { date: string; fullDate: string; close: number }>();
    history.forEach(c => {
      const d = new Date(`${c.date}T00:00:00Z`);
      const key = priceChartFrame === "weekly"
        ? new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7))).toISOString().slice(0, 10)
        : c.date.slice(0, 7);
      grouped.set(key, { date: priceChartFrame === "weekly" ? key.slice(5) : key, fullDate: c.date, close: c.close });
    });
    const agg = Array.from(grouped.values()).sort((a, b) => a.fullDate.localeCompare(b.fullDate));
    return priceChartFrame === "weekly" ? agg.slice(-104) : agg.slice(-36);
  }, [technicalDetail?.priceHistory, priceChartFrame]);

  const evidenceData = useMemo(() => buildEvidenceRows(technicalDetail?.priceHistory ?? []).slice(-120), [technicalDetail?.priceHistory]);

  const selIndicator = useMemo(() => {
    if (!selectedIndicatorKey || !technicalDetail) return null;
    return technicalDetail.indicators.find(i => i.key === selectedIndicatorKey) ?? null;
  }, [selectedIndicatorKey, technicalDetail]);
  const selGuide = selIndicator ? indicatorDetailGuides[selIndicator.key] : undefined;
  const selMethod = selIndicator ? indicatorMethodGuides[selIndicator.key] : undefined;
  const frameLabels: Record<PriceChartFrame, string> = { daily: "일봉", weekly: "주봉", monthly: "월봉" };

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-[#f7f9fb] p-4 text-slate-950 md:p-8">
      <section className="space-y-6">
        {/* 헤더 */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge className="mb-3 bg-slate-950 text-white hover:bg-slate-950">Crypto Futures Sector Dashboard</Badge>
            <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-4xl">크립토 선물 섹터 분석</h1>
            <p className="mt-2 text-sm text-slate-500">Binance USDT 무기한 선물 전체 종목 · Supabase 캐시 기반 펀딩비·거래대금·OI · 서버 기반 12개 기술적 보조지표 · 장기 차트{lastUpdated ? ` · 갱신 ${fmtDt(lastUpdated)}` : ""}</p>
          </div>
          <Button variant="outline" size="sm" className="w-fit rounded-full" onClick={refetchAll} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />새로고침
          </Button>
        </div>

        {fetchError ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            코인 캐시를 불러오지 못했습니다. {fetchError}
          </div>
        ) : null}

        {isLoading && coins.length === 0 ? (
          <div className="flex min-h-40 items-center justify-center rounded-[2rem] bg-white text-sm font-semibold text-slate-500 shadow-sm">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Supabase 코인 캐시를 불러오는 중입니다.
          </div>
        ) : null}

        {/* 섹터 요약 카드 */}
        {coins.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="rounded-[1.5rem] border-0 shadow-sm"><CardContent className="p-5"><p className="text-xs font-semibold text-slate-500">분석 코인</p><p className="mt-2 text-3xl font-black">{coins.length}</p></CardContent></Card>
            <Card className="rounded-[1.5rem] border-0 shadow-sm"><CardContent className="p-5"><p className="text-xs font-semibold text-slate-500">24h 총 거래대금</p><p className="mt-2 text-2xl font-black">{fmtUsd(coins.reduce((s, c) => s + c.volume24hUsd, 0))}</p></CardContent></Card>
            <Card className="rounded-[1.5rem] border-0 shadow-sm"><CardContent className="p-5"><p className="text-xs font-semibold text-slate-500">총 미결제약정</p><p className="mt-2 text-2xl font-black">{fmtUsd(coins.reduce((s, c) => s + (c.openInterestUsd ?? 0), 0))}</p></CardContent></Card>
            <Card className="rounded-[1.5rem] border-0 shadow-sm"><CardContent className="p-5"><p className="text-xs font-semibold text-slate-500">평균 펀딩비</p><p className="mt-2 text-2xl font-black text-amber-600">{fmtFunding(coins.length > 0 ? coins.reduce((s, c) => s + (c.fundingRate ?? 0), 0) / coins.length : null)}</p></CardContent></Card>
          </div>
        ) : null}

        {/* 섹터 차트 */}
        {sectorChartData.length > 0 ? (
          <Card className="rounded-[2rem] border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-black"><Bitcoin className="h-5 w-5 text-amber-500" /> 섹터별 24h 거래대금 분포</CardTitle>
              <CardDescription>Binance USDT 무기한 선물 섹터별 24시간 거래대금 합산 기준입니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sectorChartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={v => fmtUsd(v as number)} width={80} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v) => [fmtUsd(v as number), "24h 거래대금"]} contentStyle={{ borderRadius: 18, border: "1px solid #e2e8f0" }} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>{sectorChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* 필터 */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="h-9 rounded-full pl-9 pr-4 text-sm" placeholder="티커·종목명 검색" value={searchText} onChange={e => setSearchText(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setSelectedSector("all")} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${selectedSector === "all" ? "bg-slate-950 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>전체</button>
            {sectors.map(s => <button key={s} type="button" onClick={() => setSelectedSector(s)} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${selectedSector === s ? "bg-amber-500 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-amber-50"}`}>{sectorLabels[s]}</button>)}
          </div>
        </div>

        {/* 테이블 */}
        <Card className="rounded-[2rem] border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-black"><BarChart3 className="h-5 w-5 text-amber-500" /> USDT 무기한 선물 전체 종목</CardTitle>
            <CardDescription>{filteredRows.length}개 종목 표시 중 · 행 클릭 시 상세 분석창 열림</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full border-separate border-spacing-y-1 px-4 pb-4 text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-4 py-2">{sortHdr("순위", "rank")}</th>
                  <th className="px-4 py-2">{sortHdr("티커", "ticker")}</th>
                  <th className="px-4 py-2">{sortHdr("섹터", "sector")}</th>
                  {(["가격|price","24h 고|high24h","24h 저|low24h","24h 등락|change24hPercent","7d 등락|change7dPercent","시가총액|marketCapUsd","24h 거래대금|volume24hUsd","24h 거래량|baseVolume24h","펀딩비|fundingRate","마크가격|markPrice","미결제약정|openInterestUsd","OI/거래대금|openInterestToVolumePercent","다음 펀딩|nextFundingTime","갱신|lastUpdated"] as const).map(s => { const [l, k] = s.split("|") as [string, SortKey]; return <th key={k} className="px-2 py-2 text-right">{sortHdr(l, k, "right")}</th>; })}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(row => (
                  <tr key={row.ticker} className="cursor-pointer rounded-2xl bg-slate-50/80 shadow-sm transition hover:bg-amber-50/80" onClick={() => { setSelectedCoin(row); setSelectedMetricKey(null); setActiveTab("futures"); setSelectedIndicatorKey(null); }}>
                    <td className="rounded-l-2xl px-4 py-3 text-slate-500">{row.rank}</td>
                    <td className="px-4 py-3 font-black text-slate-950">{row.baseAsset}</td>
                    <td className="px-4 py-3"><Badge variant="secondary" className="rounded-full bg-amber-50 text-amber-700">{sectorLabels[row.sector]}</Badge></td>
                    <td className="px-2 py-3 text-right font-semibold">{fmtPrice(row.price)}</td>
                    <td className="px-2 py-3 text-right text-slate-700">{fmtPrice(row.high24h)}</td>
                    <td className="px-2 py-3 text-right text-slate-700">{fmtPrice(row.low24h)}</td>
                    <td className="px-2 py-3 text-right"><Badge className={`rounded-full ${row.change24hPercent >= 0 ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50" : "bg-red-50 text-red-700 hover:bg-red-50"}`}>{fmtPct(row.change24hPercent)}</Badge></td>
                    <td className="px-2 py-3 text-right text-slate-700">{fmtPct(row.change7dPercent)}</td>
                    <td className="px-2 py-3 text-right font-black text-slate-950">{fmtUsd(row.marketCapUsd)}</td>
                    <td className="px-2 py-3 text-right font-semibold text-slate-900">{fmtUsd(row.volume24hUsd)}</td>
                    <td className="px-2 py-3 text-right text-slate-700">{fmtNum(row.baseVolume24h, 0)}</td>
                    <td className="px-2 py-3 text-right"><Badge className={`rounded-full ${row.fundingRate > 0 ? "bg-rose-50 text-rose-700 hover:bg-rose-50" : row.fundingRate < 0 ? "bg-blue-50 text-blue-700 hover:bg-blue-50" : "bg-slate-50 text-slate-700 hover:bg-slate-50"}`}>{fmtFunding(row.fundingRate)}</Badge></td>
                    <td className="px-2 py-3 text-right text-slate-700">{fmtPrice(row.markPrice)}</td>
                    <td className="px-2 py-3 text-right font-semibold text-slate-900">{fmtUsd(row.openInterestUsd)}</td>
                    <td className="px-2 py-3 text-right text-slate-700">{typeof row.openInterestToVolumePercent === "number" ? `${row.openInterestToVolumePercent.toFixed(1)}%` : "-"}</td>
                    <td className="px-2 py-3 text-right text-slate-500">{fmtDt(row.nextFundingTime)}</td>
                    <td className="rounded-r-2xl px-2 py-3 text-right text-slate-500">{fmtDt(row.lastUpdated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredRows.length ? <div className="py-12 text-center text-sm text-slate-500">검색 조건에 맞는 종목이 없습니다.</div> : null}
          </CardContent>
        </Card>

        {/* ─── 코인 상세 모달 ─── */}
        <Dialog open={Boolean(selectedCoin)} onOpenChange={open => { if (!open) { setSelectedCoin(null); setSelectedMetricKey(null); setSelectedIndicatorKey(null); } }}>
          <DialogContent className="max-h-[90vh] overflow-y-auto border-0 bg-white text-slate-950 sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-3 text-2xl font-black">
                <Bitcoin className="h-6 w-6 text-amber-500" />{selectedCoin?.name ?? "코인"} 선물 상세 분석
              </DialogTitle>
              <DialogDescription>{selectedCoin?.ticker} · {selectedCoin?.sector ? sectorLabels[selectedCoin.sector] : ""} · Binance USDT 무기한 선물</DialogDescription>
            </DialogHeader>
            {selectedCoin ? (
              <div className="space-y-5">
                <Tabs value={activeTab} onValueChange={v => { setActiveTab(v as "futures" | "technical"); setSelectedIndicatorKey(null); }}>
                  <TabsList className="rounded-full bg-slate-100 p-1">
                    <TabsTrigger value="futures" className="rounded-full px-5">선물 지표 12개</TabsTrigger>
                    <TabsTrigger value="technical" className="rounded-full px-5">기술적 보조지표 + 장기 차트</TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* 선물 지표 탭 */}
                {activeTab === "futures" ? (
                  <>
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div><h3 className="text-lg font-black">선물 핵심 지표 12개</h3><p className="mt-1 text-sm text-slate-500">각 카드를 클릭하면 의미·판단 기준·주의점을 확인합니다.</p></div>
                        <Badge className="rounded-full bg-slate-950 text-white hover:bg-slate-950">Supabase 캐시</Badge>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                        {metricOrder.map(key => {
                          const guide = metricGuides[key];
                          return (
                            <button type="button" key={key} className="rounded-3xl bg-slate-50 p-4 text-left transition hover:bg-amber-50 hover:ring-2 hover:ring-amber-100" onClick={() => setSelectedMetricKey(key)}>
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-black text-slate-500">{sortLabels[key as SortKey]}</p>
                                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-slate-500 ring-1 ring-slate-200">{guide?.category}</span>
                              </div>
                              <p className="mt-4 text-2xl font-black text-slate-950">{formatMetricValue(selectedCoin, key)}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div><h3 className="flex items-center gap-2 text-lg font-black"><BarChart3 className="h-5 w-5 text-amber-500" /> 최근 90일 가격 흐름</h3><p className="mt-1 text-sm text-slate-500">최근 90거래일 일봉 종가 기반 실제 가격 흐름입니다. 장기 차트는 기술적 보조지표 탭에서 확인하세요.</p></div>
                        <Badge variant="secondary" className="rounded-full">24h {fmtPct(selectedCoin.change24hPercent)}</Badge>
                      </div>
                      <div className="h-56">
                        {technicalIndicators.isLoading ? (
                          <div className="flex h-full items-center justify-center text-sm text-slate-400">가격 이력 로딩 중...</div>
                        ) : (() => {
                          const hist90 = (technicalDetail?.priceHistory ?? []).slice(-90).map(c => ({ date: c.date.slice(5), fullDate: c.date, price: c.close }));
                          if (!hist90.length) return <div className="flex h-full items-center justify-center text-sm text-slate-400">{technicalErrorMessage ?? "표시할 가격 이력이 없습니다."}</div>;
                          // Y축 범위 동적 계산
                          const prices = hist90.map(h => h.price).filter(p => typeof p === "number" && p > 0);
                          const minPrice = Math.min(...prices);
                          const maxPrice = Math.max(...prices);
                          const priceDiff = maxPrice - minPrice;
                          const padding = priceDiff > 0 ? priceDiff * 0.1 : Math.max(minPrice * 0.1, 1);
                          const yDomain = [Math.max(0, minPrice - padding), maxPrice + padding];
                          return (
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={hist90} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
                                <defs><linearGradient id="cryptoDetailPriceGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.28} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} /></linearGradient></defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} interval={Math.floor(hist90.length / 6)} />
                                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} tickFormatter={v => fmtPrice(Number(v))} width={80} tickLine={false} axisLine={false} domain={yDomain} />
                                <Tooltip formatter={v => [fmtPrice(Number(v)), "종가"]} labelFormatter={(_l, payload: any) => payload?.[0]?.payload?.fullDate ?? _l} contentStyle={{ borderRadius: 14, border: "1px solid #e2e8f0" }} />
                                <Area type="monotone" dataKey="price" stroke="#d97706" strokeWidth={3} fill="url(#cryptoDetailPriceGrad)" dot={false} />
                              </AreaChart>
                            </ResponsiveContainer>
                          );
                        })()}
                      </div>
                    </div>
                  </>
                ) : null}

                {/* 기술적 보조지표 탭 */}
                {activeTab === "technical" ? (
                  <div className="space-y-5">
                    {/* 장기 가격 차트 */}
                    <div className="rounded-[2rem] border border-slate-100 bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <h3 className="flex items-center gap-2 text-lg font-black"><BarChart3 className="h-5 w-5 text-amber-500" /> 장기 가격 차트</h3>
                          <p className="mt-1 text-sm text-slate-500">Binance 선물 3년 이력 · 일봉(6개월)·주봉(2년)·월봉(3년) 전환</p>
                        </div>
                        <Tabs value={priceChartFrame} onValueChange={v => setPriceChartFrame(v as PriceChartFrame)}>
                          <TabsList className="rounded-full bg-slate-100 p-1">
                            <TabsTrigger value="daily" className="rounded-full px-4">일</TabsTrigger>
                            <TabsTrigger value="weekly" className="rounded-full px-4">주</TabsTrigger>
                            <TabsTrigger value="monthly" className="rounded-full px-4">월</TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>
                      {technicalIndicators.isLoading ? (
                        <div className="mt-4 flex min-h-64 items-center justify-center rounded-3xl bg-slate-50 text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 가격 차트를 불러오는 중입니다.</div>
                      ) : technicalErrorMessage ? (
                        <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">가격 차트 데이터를 가져오지 못했습니다. {technicalErrorMessage}</div>
                      ) : priceChartData.length ? (
                        <div className="mt-4 h-72 rounded-3xl bg-slate-50 p-3">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={priceChartData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                              <defs><linearGradient id="cryptoLongPriceGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#d97706" stopOpacity={0.25} /><stop offset="95%" stopColor="#d97706" stopOpacity={0.02} /></linearGradient></defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} minTickGap={20} tickLine={false} axisLine={false} />
                              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={v => fmtPrice(Number(v))} width={80} tickLine={false} axisLine={false} />
                              <Tooltip formatter={(v, n) => [typeof v === "number" ? fmtPrice(v) : v, n === "close" ? "종가" : n]} labelFormatter={(_l, payload: any) => payload?.[0]?.payload?.fullDate ? `${payload[0].payload.fullDate} · ${frameLabels[priceChartFrame]}` : frameLabels[priceChartFrame]} contentStyle={{ borderRadius: 18, border: "1px solid #e2e8f0" }} />
                              <Area type="monotone" dataKey="close" stroke="#d97706" strokeWidth={3} fill="url(#cryptoLongPriceGrad)" dot={false} activeDot={{ r: 4 }} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      ) : <div className="mt-4 rounded-3xl bg-slate-50 p-6 text-sm text-slate-500">표시할 가격 이력이 없습니다.</div>}
                    </div>

                    {/* 12개 보조지표 카드 */}
                    <div className="rounded-[2rem] border border-slate-100 bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <h3 className="flex items-center gap-2 text-lg font-black"><Activity className="h-5 w-5 text-amber-500" /> 고점·저점 판단 보조지표 12개</h3>
                          <p className="mt-1 text-sm text-slate-500">최근 가격 이력 기반의 참고 지표입니다. 투자 판단은 펀딩비·수급·뉴스를 함께 확인하세요.</p>
                        </div>
                        {technicalDetail ? (
                          <Badge variant="outline" className="rounded-full bg-slate-50">
                            {technicalDetail.indicators.length}개 지표 · 종가 {fmtPrice(technicalDetail.latestClose)} · 적정가 중간값 {technicalDetail.fairPriceMedian ? fmtPrice(technicalDetail.fairPriceMedian) : "자료 없음"}
                          </Badge>
                        ) : null}
                      </div>
                      {technicalIndicators.isLoading ? (
                        <div className="mt-4 flex min-h-32 items-center justify-center rounded-3xl bg-slate-50 text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 보조지표를 계산하는 중입니다.</div>
                      ) : technicalErrorMessage ? (
                        <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">보조지표 계산에 실패했습니다. {technicalErrorMessage}</div>
                      ) : technicalDetail ? (
                        <>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {technicalDetail.indicators.map(ind => {
                              const guide = indicatorDetailGuides[ind.key];
                              const isSel = selectedIndicatorKey === ind.key;
                              return (
                                <button key={ind.key} type="button" onClick={() => setSelectedIndicatorKey(ind.key)} aria-pressed={isSel}
                                  className={`rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 ${statusCls(ind.status)} ${isSel ? "ring-2 ring-slate-950" : ""}`}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div><p className="text-sm font-black">{ind.label}</p><p className="mt-1 text-xs opacity-80">{ind.statusLabel}</p></div>
                                    <p className="whitespace-nowrap text-lg font-black">{ind.displayValue}</p>
                                  </div>
                                  {renderGauge(ind.value, guide, true)}
                                  <p className="mt-3 text-xs font-semibold leading-5">{ind.interpretation}</p>
                                  <div className="mt-3 rounded-2xl bg-white/55 p-3 text-xs leading-5 text-slate-700">
                                    <div className="flex items-center justify-between gap-2 font-black"><span>예상 적정가</span><span>{ind.fairPriceDisplay}</span></div>
                                    <p className="mt-1 opacity-80">{ind.fairPriceBasis}</p>
                                  </div>
                                  <span className="mt-3 inline-flex rounded-full bg-white/65 px-3 py-1 text-[11px] font-black text-slate-600 ring-1 ring-slate-200">상세 해설·근거 차트 보기</span>
                                </button>
                              );
                            })}
                          </div>
                          {selIndicator ? (
                            <div className="mt-4 rounded-3xl border border-amber-100 bg-amber-50/80 p-4 text-sm text-amber-950">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div><p className="font-black">보조지표 상세 분석창 열림 · {selIndicator.label}</p><p className="mt-1 text-xs leading-5 text-amber-800">지표 종류, 계산 방식, 현재 종목 해석, 게이지와 근거 차트를 별도 창에서 확인합니다.</p></div>
                                <Button type="button" size="sm" variant="outline" className="w-fit rounded-full bg-white" onClick={() => setSelectedIndicatorKey(null)}>상세창 닫기</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-4 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">각 보조지표 카드를 클릭하면 의미, 판단 기준, 현재 해석, 주의점과 함께 계산 방식, 가격·이동평균·볼린저밴드·MACD 근거 차트가 상세 분석창으로 열립니다.</div>
                          )}
                          <p className="mt-3 text-xs text-slate-500">출처: {technicalDetail.source} · 조회 시각: {fmtDt(technicalDetail.fetchedAt)}</p>
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* ─── 선물 지표 상세 해설 모달 ─── */}
        <Dialog open={Boolean(selectedCoin && selectedMetricKey)} onOpenChange={open => { if (!open) setSelectedMetricKey(null); }}>
          <DialogContent className="max-h-[88vh] overflow-y-auto border-0 bg-slate-50 text-slate-950 sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-3 text-2xl font-black"><Activity className="h-6 w-6 text-amber-500" />지표 상세 해설 · {selectedMetricKey ? sortLabels[selectedMetricKey as SortKey] : ""}</DialogTitle>
              <DialogDescription>{selectedCoin?.name} 기준 현재값, 의미, 판단 기준, 주의점을 분리해서 보여줍니다.</DialogDescription>
            </DialogHeader>
            {selectedCoin && selectedMetricKey ? (() => {
              const guide = metricGuides[selectedMetricKey];
              return (
                <div className="space-y-4">
                  <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-100">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><p className="text-xs font-black text-amber-700">{guide?.category ?? "크립토 지표"}</p><h4 className="mt-1 text-xl font-black">{selectedCoin.name}의 {sortLabels[selectedMetricKey as SortKey]} 분석</h4></div>
                      <Badge className="rounded-full bg-slate-950 text-white hover:bg-slate-950">현재 {formatMetricValue(selectedCoin, selectedMetricKey)}</Badge>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-700">{guide?.meaning}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-100"><p className="text-xs font-black text-slate-500">판단 기준</p><p className="mt-2 text-sm leading-6 text-slate-700">{guide?.standard}</p></div>
                    <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-100"><p className="text-xs font-black text-slate-500">주의점</p><p className="mt-2 text-sm leading-6 text-slate-700">{guide?.caution}</p></div>
                  </div>
                  <p className="text-xs leading-5 text-slate-500">현재 데이터는 Binance Futures 공개 API 기준입니다.</p>
                </div>
              );
            })() : null}
          </DialogContent>
        </Dialog>

        {/* ─── 기술적 보조지표 상세 해설 모달 ─── */}
        {selIndicator ? (
          <Dialog open={Boolean(selectedCoin && selIndicator)} onOpenChange={open => { if (!open) setSelectedIndicatorKey(null); }}>
            <DialogContent className="max-h-[90vh] overflow-y-auto border-0 bg-slate-50 text-slate-950 sm:max-w-6xl">
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-3 text-2xl font-black"><Activity className="h-6 w-6 text-amber-500" />보조지표 상세 해설 · {selIndicator.label}</DialogTitle>
                <DialogDescription>의미, 판단 기준, 현재 해석, 주의점에 더해 지표 종류와 계산 방식을 함께 보여주는 현재 종목 기준 상세 분석창입니다.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-100">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Indicator Drilldown</p>
                      <h4 className="mt-1 text-xl font-black">{selectedCoin?.name ?? "현재 종목"}의 {selIndicator.label} 분석</h4>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{selGuide?.meaning ?? selIndicator.interpretation}</p>
                    </div>
                    <Badge className="w-fit rounded-full bg-slate-950 text-white hover:bg-slate-950">현재 {selIndicator.displayValue} · {selIndicator.statusLabel}</Badge>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100"><p className="text-xs font-black text-slate-500">지표 종류</p><p className="mt-2 text-sm font-bold leading-6 text-slate-800">{selMethod?.category ?? "가격 이력 기반 보조지표"}</p></div>
                    <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100"><p className="text-xs font-black text-slate-500">현재값</p><p className="mt-2 text-xl font-black text-slate-950">{selIndicator.displayValue}</p><p className="mt-1 text-xs text-slate-500">{selIndicator.statusLabel}</p></div>
                    <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100"><p className="text-xs font-black text-slate-500">예상 적정가</p><p className="mt-2 text-xl font-black text-slate-950">{selIndicator.fairPriceDisplay}</p><p className="mt-1 text-xs text-slate-500">종가 {fmtPrice(technicalDetail?.latestClose)} 기준</p></div>
                  </div>
                  <div className="mt-4 rounded-3xl bg-amber-50 p-4 ring-1 ring-amber-100">
                    <p className="text-xs font-black text-amber-700">현재 종목에 대한 상세 분석</p>
                    <p className="mt-2 text-sm leading-6 text-amber-950">{selectedCoin?.name ?? "현재 종목"}은(는) {selIndicator.label} 기준 현재 {selIndicator.statusLabel} 구간에 있습니다. {selIndicator.interpretation} {selIndicator.fairPriceBasis} 이 평가는 최근 가격 이력에서 계산된 참고 신호이므로 펀딩비, 수급, 뉴스와 함께 교차 확인해야 합니다.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-100">
                    <p className="text-sm font-black text-slate-950">어떻게 얻는 지표인가?</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{selMethod?.calculation ?? "최근 가격 이력에서 현재값과 기준선을 계산합니다."}</p>
                    <p className="mt-3 text-xs font-black text-slate-500">필요 데이터</p>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{selMethod?.dataRequirement ?? "종가, 고가, 저가, 거래량 등 가격 이력 데이터가 필요합니다."}</p>
                  </div>
                  <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-100">
                    <p className="text-sm font-black text-slate-950">해석 기준과 주의점</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700"><span className="font-black">판단 기준:</span> {selGuide?.thresholds ?? "중립 기준선과 최근 가격 추세의 괴리를 함께 확인합니다."}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700"><span className="font-black">주의점:</span> {selGuide?.caution ?? "단일 지표만으로 매수·매도를 결정하지 말고 펀딩비·수급·뉴스를 함께 확인해야 합니다."}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-100">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div><p className="text-sm font-black text-slate-950">현재값 위치 게이지</p><p className="mt-1 text-xs leading-5 text-slate-500">{selMethod?.currentReadingFocus ?? selGuide?.chartFocus ?? "최근 가격 이력에서 계산한 기준선과 현재값을 함께 비교합니다."}</p></div>
                  <p className="text-sm font-black text-slate-900">{selIndicator.displayValue}</p>
                </div>
                {renderGauge(selIndicator.value, selGuide)}
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-100">
                  <div className="mb-3"><p className="text-sm font-black text-slate-950">가격·이동평균·볼린저밴드 근거</p><p className="mt-1 text-xs text-slate-500">최근 120거래일 기준 종가, 20일선, 60일선, 볼린저 상·하단입니다.</p></div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={evidenceData} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} minTickGap={20} tickLine={false} axisLine={false} />
                        <YAxis yAxisId="price" tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={v => fmtPrice(Number(v))} width={80} tickLine={false} axisLine={false} />
                        <Tooltip formatter={(v, n) => { const lm: Record<string, string> = { close: "종가", sma20: "20일선", sma60: "60일선", bollingerUpper: "볼린저 상단", bollingerLower: "볼린저 하단" }; return [typeof v === "number" ? fmtPrice(v) : v, lm[String(n)] ?? String(n)]; }} labelFormatter={(_l, payload: any) => payload?.[0]?.payload?.fullDate ?? ""} contentStyle={{ borderRadius: 18, border: "1px solid #e2e8f0" }} />
                        <Line yAxisId="price" type="monotone" dataKey="bollingerUpper" stroke="#fb7185" strokeDasharray="4 4" dot={false} strokeWidth={1.5} connectNulls />
                        <Line yAxisId="price" type="monotone" dataKey="bollingerLower" stroke="#60a5fa" strokeDasharray="4 4" dot={false} strokeWidth={1.5} connectNulls />
                        <Line yAxisId="price" type="monotone" dataKey="sma60" stroke="#a78bfa" dot={false} strokeWidth={2} connectNulls />
                        <Line yAxisId="price" type="monotone" dataKey="sma20" stroke="#f59e0b" dot={false} strokeWidth={2} connectNulls />
                        <Line yAxisId="price" type="monotone" dataKey="close" stroke="#0f172a" dot={false} strokeWidth={2.8} connectNulls />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-100">
                  <div className="mb-3"><p className="text-sm font-black text-slate-950">MACD·거래량 보조 근거</p><p className="mt-1 text-xs text-slate-500">모멘텀은 0선, 거래량은 100% 기준선을 중심으로 확인합니다.</p></div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={evidenceData} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} minTickGap={20} tickLine={false} axisLine={false} />
                        <YAxis yAxisId="macd" tick={{ fontSize: 11, fill: "#64748b" }} width={56} tickLine={false} axisLine={false} />
                        <YAxis yAxisId="volume" orientation="right" tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={v => `${Number(v).toFixed(0)}%`} width={58} tickLine={false} axisLine={false} />
                        <Tooltip formatter={(v, n) => { if (typeof v !== "number") return [v, n]; if (n === "volumeRatio") return [`${v.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}%`, "거래량 20일 배율"]; return [v.toLocaleString("ko-KR", { maximumFractionDigits: 2 }), "MACD 히스토그램"]; }} labelFormatter={(_l, payload: any) => payload?.[0]?.payload?.fullDate ?? ""} contentStyle={{ borderRadius: 18, border: "1px solid #e2e8f0" }} />
                        <ReferenceLine yAxisId="macd" y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                        <ReferenceLine yAxisId="volume" y={100} stroke="#cbd5e1" strokeDasharray="3 3" />
                        <Bar yAxisId="macd" dataKey="macdHistogram" radius={[4, 4, 0, 0]} fill="#f59e0b" opacity={0.7} />
                        <Line yAxisId="volume" type="monotone" dataKey="volumeRatio" stroke="#f97316" strokeWidth={2} dot={false} connectNulls />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              <p className="text-xs leading-5 text-slate-500">출처: {technicalDetail?.source ?? "Binance"} · 조회 시각: {fmtDt(technicalDetail?.fetchedAt)} · 이 상세 분석은 기술적 보조지표 참고 자료이며 투자 판단을 대체하지 않습니다.</p>
            </DialogContent>
          </Dialog>
        ) : null}
      </section>
    </div>
  );
}
