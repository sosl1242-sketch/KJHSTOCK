import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Activity, ArrowDown, ArrowUp, ArrowUpDown, BarChart3, Database, Eye, Loader2, RefreshCcw, Save, Search, ShieldCheck, Sparkles, Trash2, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

type SectorKey =
  | "ai_semiconductor_value_chain"
  | "power_infra_machinery"
  | "battery_mobility"
  | "shipbuilding_defense_aerospace"
  | "finance_brokerage_insurance"
  | "platform_telecom_content"
  | "bio_healthcare"
  | "consumer_retail_travel"
  | "chemicals_materials_steel"
  | "holding_multi_industry"
  | "industrial_business_services";

type ActiveSector = SectorKey | "all";

type SortDirection = "desc" | "asc";
type SortKey = "marketRank" | "name" | "code" | "sector" | "marketSuffix" | "currentPrice" | "annualEps" | "earningsYield" | "per" | "pbr" | "marketCapHundredMillionKrw" | "latestOperatingProfitHundredMillionKrw" | "connectionStatus" | "lastPriceFetchedAt";
type PriceChartFrame = "daily" | "weekly" | "monthly";

const TABLE_PAGE_SIZE = 25;
const KOREA_MARKET_CAP_LIMIT = 300;
const SUMMARY_SORT_KEYS = new Set<SortKey>(["per", "pbr", "marketCapHundredMillionKrw", "latestOperatingProfitHundredMillionKrw"]);
const PRICE_AUTO_REFETCH_MS = 1000 * 60 * 3;

type StockForm = {
  id?: number;
  sector: SectorKey;
  name: string;
  code: string;
  marketSuffix: "KS" | "KQ";
  currentPrice: string;
  annualEps: string;
};

type BulkRefreshFailure = {
  id: number;
  code: string;
  success: false;
  error: string;
};

const sectors: Array<{ key: SectorKey; label: string; shortLabel: string; description: string }> = [
  { key: "ai_semiconductor_value_chain", label: "AI·반도체 밸류체인", shortLabel: "AI·반도체", description: "메모리, 전자, AI 인프라, IT 부품 중심의 대형주 밸류체인을 묶었습니다." },
  { key: "power_infra_machinery", label: "전력·인프라·기계", shortLabel: "전력·기계", description: "전력기기, 건설기계, 인프라 장비처럼 설비투자 사이클과 연결된 종목군입니다." },
  { key: "battery_mobility", label: "배터리·모빌리티", shortLabel: "배터리·차", description: "완성차, 자동차 부품, 2차전지 셀·소재를 한 번에 비교합니다." },
  { key: "shipbuilding_defense_aerospace", label: "조선·방산·항공", shortLabel: "조선·방산", description: "수주 산업, 방산, 항공우주 및 중공업 계열의 이익수익률을 추적합니다." },
  { key: "finance_brokerage_insurance", label: "금융·증권·보험", shortLabel: "금융", description: "은행, 보험, 증권, 지주 금융사를 배당·이익 관점으로 비교합니다." },
  { key: "platform_telecom_content", label: "플랫폼·통신·콘텐츠", shortLabel: "플랫폼", description: "인터넷 플랫폼, 통신, 게임, 미디어·콘텐츠 기업을 묶었습니다." },
  { key: "bio_healthcare", label: "바이오·헬스케어", shortLabel: "바이오", description: "제약, 바이오, 의료기기, 헬스케어 대형주의 EPS/주가를 확인합니다." },
  { key: "consumer_retail_travel", label: "소비재·유통·여행", shortLabel: "소비", description: "음식료, 화장품, 유통, 호텔·레저, 항공 등 내수·소비 민감 종목군입니다." },
  { key: "chemicals_materials_steel", label: "화학·소재·철강", shortLabel: "소재", description: "정유, 화학, 철강, 비철, 소재 산업의 가격 대비 이익을 비교합니다." },
  { key: "holding_multi_industry", label: "지주·복합산업", shortLabel: "지주", description: "지주회사와 복합 사업 포트폴리오를 가진 대형주를 별도로 분류했습니다." },
  { key: "industrial_business_services", label: "산업재·비즈니스 서비스", shortLabel: "산업서비스", description: "물류, 건설, 보안, IT서비스 등 기업 활동을 지원하는 종목군입니다." },
];

const DEFAULT_SECTOR: SectorKey = "ai_semiconductor_value_chain";

const allSectorMeta = {
  key: "all" as const,
  label: "국내주식 전체",
  shortLabel: "국내 전체",
  description: "국내 대표 종목 전체를 자체 테마와 함께 한 번에 비교합니다.",
};

const emptyForm = (sector: SectorKey): StockForm => ({
  sector,
  name: "",
  code: "",
  marketSuffix: "KS",
  currentPrice: "0",
  annualEps: "0",
});

const formatNumber = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("ko-KR", { maximumFractionDigits: 2 }) : "-";

const formatPercent = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? `${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}%` : "-";

const formatMultiple = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? `${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}배` : "-";

const formatHundredMillionKrw = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  if (Math.abs(value) >= 10000) {
    const trillion = value / 10000;
    return `${trillion.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}조원`;
  }
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}억원`;
};

const formatSignedPercent = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}%`;
};

const formatDateTime = (value: Date | string | null | undefined) => {
  if (!value) return "미갱신";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "미갱신";
  return date.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const getConnectionLabel = (dataSource: string, currentPrice: number, annualEps: number) => {
  if (dataSource.startsWith("NaverFinance")) return currentPrice > 0 && annualEps !== 0 ? "기본 연동" : "EPS 확인 필요";
  if (dataSource.startsWith("YahooFinance")) return "현재가 갱신";
  return currentPrice > 0 ? "수동 입력" : "미연동";
};

const getSectorLabel = (sectorKey: string) => sectors.find(sector => sector.key === sectorKey)?.shortLabel ?? sectorKey;

const getMarketLabel = (marketSuffix: string) => (marketSuffix === "KQ" ? "KOSDAQ" : "KOSPI");


type IndicatorScale = {
  min: number;
  max: number;
  low: number;
  high: number;
  unit?: string;
};

type IndicatorDetailGuide = {
  meaning: string;
  thresholds: string;
  caution: string;
  chartFocus: string;
  scale?: IndicatorScale;
};

type IndicatorMethodGuide = {
  category: string;
  calculation: string;
  dataRequirement: string;
  currentReadingFocus: string;
};

type IndicatorEvidenceRow = {
  date: string;
  fullDate: string;
  close: number;
  high: number;
  low: number;
  volume: number;
  sma20: number | null;
  sma60: number | null;
  bollingerUpper: number | null;
  bollingerLower: number | null;
  macdHistogram: number | null;
  volumeRatio: number | null;
};

const indicatorDetailGuides: Record<string, IndicatorDetailGuide> = {
  rsi14: {
    meaning: "최근 상승폭과 하락폭의 균형을 0~100으로 환산해 단기 과열·침체를 보는 대표 모멘텀 지표입니다.",
    thresholds: "일반적으로 70 이상은 단기 과열, 30 이하는 단기 침체, 50 부근은 중립권으로 해석합니다.",
    caution: "강한 추세장에서는 RSI가 과열·침체권에 오래 머무를 수 있으므로 이동평균선과 가격 추세를 함께 확인해야 합니다.",
    chartFocus: "가격이 20일·60일 이동평균선에서 얼마나 떨어져 있는지와 RSI의 중립선 회귀 가능성을 함께 봅니다.",
    scale: { min: 0, max: 100, low: 30, high: 70 },
  },
  stochastic14: {
    meaning: "최근 14거래일 고저 범위 안에서 현재 종가가 어느 위치에 있는지 보여주는 빠른 오실레이터입니다.",
    thresholds: "80% 이상은 단기 상단권, 20% 이하는 단기 하단권으로 보는 경우가 많습니다.",
    caution: "횡보장에서는 유용하지만 강한 추세장에서는 잦은 신호가 발생할 수 있어 볼린저밴드 위치와 같이 확인하는 편이 안전합니다.",
    chartFocus: "최근 가격이 볼린저밴드 상·하단 중 어디에 가까운지와 스토캐스틱 위치를 비교합니다.",
    scale: { min: 0, max: 100, low: 20, high: 80, unit: "%" },
  },
  williams14: {
    meaning: "스토캐스틱과 유사하지만 -100~0 범위로 표시되는 역방향 과열·침체 지표입니다.",
    thresholds: "-20 이상은 고점권, -80 이하는 저점권 가능성을 참고합니다.",
    caution: "값의 방향이 일반 퍼센트 지표와 반대처럼 보일 수 있으므로 0에 가까울수록 상단권이라는 점에 유의해야 합니다.",
    chartFocus: "52주 고저 범위와 최근 볼린저밴드 위치를 함께 보며 단기 고점·저점 신호를 검증합니다.",
    scale: { min: -100, max: 0, low: -80, high: -20, unit: "%" },
  },
  cci20: {
    meaning: "전형가격이 최근 평균에서 얼마나 벗어났는지 표준화해 추세 과열과 평균회귀 가능성을 살핍니다.",
    thresholds: "+100 이상은 상방 모멘텀 과열, -100 이하는 하방 과매도 가능성을 주로 봅니다.",
    caution: "CCI는 변동성이 큰 종목에서 급격히 흔들릴 수 있어 거래량 배율과 추세선 방향을 같이 확인해야 합니다.",
    chartFocus: "20일 이동평균선과 가격 괴리를 확인해 CCI가 평균회귀 신호인지 추세 지속 신호인지 구분합니다.",
    scale: { min: -200, max: 200, low: -100, high: 100 },
  },
  mfi14: {
    meaning: "가격 변화와 거래량을 함께 반영해 매수·매도 자금흐름의 과열 여부를 추정합니다.",
    thresholds: "80 이상은 자금 유입 과열, 20 이하는 자금 유출 과도 구간으로 참고합니다.",
    caution: "거래량 급증 이벤트가 있으면 일시적으로 과장될 수 있어 거래량 20일 배율과 뉴스를 함께 확인해야 합니다.",
    chartFocus: "거래량 배율과 가격 추세가 같은 방향으로 움직이는지 확인해 자금흐름 신호의 신뢰도를 봅니다.",
    scale: { min: 0, max: 100, low: 20, high: 80 },
  },
  bollinger20: {
    meaning: "20일 볼린저밴드 안에서 현재가가 하단 0%, 상단 100% 중 어디에 있는지 환산한 위치 지표입니다.",
    thresholds: "90% 이상은 밴드 상단 접근, 10% 이하는 밴드 하단 접근으로 봅니다.",
    caution: "밴드 돌파는 과열뿐 아니라 추세 시작일 수도 있으므로 MACD와 이동평균선 기울기를 함께 확인해야 합니다.",
    chartFocus: "가격, 볼린저밴드 상·하단, 20일 이동평균선을 한 차트에서 비교합니다.",
    scale: { min: 0, max: 100, low: 10, high: 90, unit: "%" },
  },
  macdHistogram: {
    meaning: "12일·26일 지수이동평균의 차이와 9일 시그널선의 차이를 막대로 나타내 상승·하락 모멘텀 변화를 봅니다.",
    thresholds: "0선 위는 상승 모멘텀, 0선 아래는 하락 모멘텀으로 해석하며 막대의 확대·축소 방향이 중요합니다.",
    caution: "MACD는 후행성이 있으므로 단기 급등락 직후에는 RSI·스토캐스틱보다 늦게 반응할 수 있습니다.",
    chartFocus: "MACD 히스토그램이 0선을 기준으로 확대되는지 축소되는지와 가격 추세를 함께 봅니다.",
  },
  sma20Gap: {
    meaning: "현재가가 20일 이동평균선에서 얼마나 위아래로 떨어져 있는지 보는 단기 이격도입니다.",
    thresholds: "+12% 이상은 단기 과열, -12% 이하는 단기 과매도 가능성을 참고합니다.",
    caution: "실적·뉴스에 의한 재평가 구간에서는 이격이 장기간 유지될 수 있으므로 재무지표와 병행해야 합니다.",
    chartFocus: "가격과 20일 이동평균선의 간격이 확대·축소되는지를 직접 확인합니다.",
    scale: { min: -30, max: 30, low: -12, high: 12, unit: "%" },
  },
  sma60Gap: {
    meaning: "현재가가 중기 추세선인 60일 이동평균선 대비 얼마나 벌어졌는지 보여줍니다.",
    thresholds: "+18% 이상은 중기 과열, -18% 이하는 중기 침체 가능성을 참고합니다.",
    caution: "중기 추세 전환 초기에는 이격도가 크게 보일 수 있어 20일선과 60일선의 배열을 함께 봐야 합니다.",
    chartFocus: "20일선과 60일선의 배열, 가격의 중기 추세선 회귀 가능성을 확인합니다.",
    scale: { min: -40, max: 40, low: -18, high: 18, unit: "%" },
  },
  volume20Ratio: {
    meaning: "최근 거래량이 직전 20거래일 평균 대비 얼마나 확대·축소됐는지 보여줍니다.",
    thresholds: "140% 이상은 거래 증가, 220% 이상은 거래 과열, 60% 이하는 거래 침체로 참고합니다.",
    caution: "거래량만으로 방향을 판단할 수 없으므로 가격 상승·하락과 동반되는지 반드시 함께 확인해야 합니다.",
    chartFocus: "거래량 20일 배율이 100% 기준선을 얼마나 벗어났는지와 가격 반응을 함께 봅니다.",
    scale: { min: 0, max: 250, low: 60, high: 140, unit: "%" },
  },
  high52Distance: {
    meaning: "현재가가 조회 가능 기간의 고점에서 얼마나 떨어져 있는지 보여주는 고점권 점검 지표입니다.",
    thresholds: "0%에 가까울수록 고점에 접근한 상태이며, -5% 이내는 고점권으로 별도 확인합니다.",
    caution: "신고가 돌파 종목은 고점 대비 이격만으로 고평가를 단정하기 어렵고 추세·실적 확인이 필요합니다.",
    chartFocus: "최근 가격이 52주 고점선에 얼마나 가까운지와 이동평균 지지 여부를 함께 확인합니다.",
    scale: { min: -60, max: 0, low: -35, high: -5, unit: "%" },
  },
  low52Distance: {
    meaning: "현재가가 조회 가능 기간의 저점 대비 얼마나 위에 있는지 보여주는 저점권 점검 지표입니다.",
    thresholds: "8% 이하이면 저점권에 가까운 상태로 보고, 반등 후보인지 추가 점검합니다.",
    caution: "저점 근접은 반등 기회일 수도 있지만 구조적 악재의 결과일 수 있어 재무 안정성과 뉴스를 함께 봐야 합니다.",
    chartFocus: "최근 가격이 52주 저점선에서 얼마나 반등했는지와 거래량 회복 여부를 같이 확인합니다.",
    scale: { min: 0, max: 120, low: 8, high: 60, unit: "%" },
  },
};


const indicatorMethodGuides: Record<string, IndicatorMethodGuide> = {
  rsi14: {
    category: "모멘텀·과열/침체 오실레이터",
    calculation: "최근 14거래일의 평균 상승폭과 평균 하락폭을 비교해 RS를 구한 뒤 RSI = 100 - 100 / (1 + RS)로 환산합니다.",
    dataRequirement: "일별 종가가 필요하며, 이 화면에서는 YahooFinance 가격 이력의 종가 변화폭을 사용합니다.",
    currentReadingFocus: "현재값이 50 위인지, 70 과열권 또는 30 침체권에 가까운지와 최근 가격이 20일선 위아래 어디에 있는지를 함께 봅니다.",
  },
  stochastic14: {
    category: "가격 위치·단기 추세 오실레이터",
    calculation: "%K = (현재 종가 - 최근 14거래일 최저가) / (최근 14거래일 최고가 - 최저가) × 100으로 계산합니다.",
    dataRequirement: "최근 14거래일의 고가, 저가, 종가가 필요하며, 가격 범위 안에서 종가 위치를 측정합니다.",
    currentReadingFocus: "상단권에 머무르는지, 하단권에서 반등하는지, 볼린저밴드 위치와 같은 방향인지 확인합니다.",
  },
  williams14: {
    category: "가격 위치·역방향 과열/침체 오실레이터",
    calculation: "%R = (최근 14거래일 최고가 - 현재 종가) / (최근 14거래일 최고가 - 최저가) × -100으로 계산합니다.",
    dataRequirement: "최근 14거래일의 고가, 저가, 종가가 필요하며, 0에 가까울수록 상단권입니다.",
    currentReadingFocus: "-20 이상이면 고점권, -80 이하이면 저점권 접근으로 보고 52주 고저점 위치와 같이 해석합니다.",
  },
  cci20: {
    category: "추세 이격·평균회귀 지표",
    calculation: "전형가격(고가+저가+종가)/3이 20일 평균 전형가격에서 얼마나 벗어났는지를 평균편차로 나눠 표준화합니다.",
    dataRequirement: "최근 20거래일 이상의 고가, 저가, 종가가 필요하며 변동성이 클수록 값이 크게 움직입니다.",
    currentReadingFocus: "+100/-100 기준선을 넘어선 상태가 단기 과열인지, 새 추세의 시작인지 거래량과 같이 확인합니다.",
  },
  mfi14: {
    category: "거래량 가중 자금흐름 오실레이터",
    calculation: "전형가격 × 거래량으로 자금흐름을 계산하고, 14거래일 양의 흐름과 음의 흐름 비율을 0~100으로 환산합니다.",
    dataRequirement: "고가, 저가, 종가, 거래량이 모두 필요하며, 거래량 급증일의 영향이 크게 반영됩니다.",
    currentReadingFocus: "RSI와 방향이 같은지, 가격 상승이 실제 거래량 동반 자금 유입인지 확인합니다.",
  },
  bollinger20: {
    category: "변동성 밴드·가격 위치 지표",
    calculation: "20일 이동평균을 중심선으로 두고 표준편차 2배 상·하단을 만든 뒤, 현재가가 하단 0%와 상단 100% 사이 어디에 있는지 계산합니다.",
    dataRequirement: "20거래일 이상의 종가가 필요하며, 표준편차가 커지면 밴드 폭도 넓어집니다.",
    currentReadingFocus: "상단 접근이 과열인지 추세 돌파인지, 하단 접근이 반등 후보인지 하락 추세 지속인지 MACD와 함께 봅니다.",
  },
  macdHistogram: {
    category: "추세 모멘텀·후행 확인 지표",
    calculation: "12일 EMA와 26일 EMA 차이인 MACD에서 9일 EMA 시그널선을 뺀 값을 히스토그램으로 표시합니다.",
    dataRequirement: "충분한 종가 이력이 필요하며, EMA 특성상 최신 가격에 더 큰 가중치를 둡니다.",
    currentReadingFocus: "0선 위아래뿐 아니라 막대가 확대되는지 축소되는지로 상승·하락 모멘텀 변화를 확인합니다.",
  },
  sma20Gap: {
    category: "단기 이동평균 이격도",
    calculation: "(현재 종가 - 20일 단순이동평균) / 20일 단순이동평균 × 100으로 계산합니다.",
    dataRequirement: "최근 20거래일 이상의 종가가 필요하며, 단기 가격 과열과 평균회귀 가능성을 봅니다.",
    currentReadingFocus: "현재가가 단기 추세선에서 지나치게 멀어졌는지, 다시 20일선으로 돌아갈 가능성이 있는지 확인합니다.",
  },
  sma60Gap: {
    category: "중기 이동평균 이격도",
    calculation: "(현재 종가 - 60일 단순이동평균) / 60일 단순이동평균 × 100으로 계산합니다.",
    dataRequirement: "최근 60거래일 이상의 종가가 필요하며, 중기 추세선 대비 위치를 측정합니다.",
    currentReadingFocus: "20일선과 60일선 배열, 중기 추세 유지 여부, 과도한 상승·하락 후 되돌림 가능성을 봅니다.",
  },
  volume20Ratio: {
    category: "거래활동·수급 강도 지표",
    calculation: "현재 거래량 / 직전 20거래일 평균 거래량 × 100으로 계산합니다.",
    dataRequirement: "현재일 거래량과 직전 20거래일 거래량이 필요하며, 가격 방향과 함께 해석해야 합니다.",
    currentReadingFocus: "거래량이 평균 대비 늘었는지 줄었는지, 가격 상승·하락과 동행하는지 확인합니다.",
  },
  high52Distance: {
    category: "52주 고점 대비 위치 지표",
    calculation: "(현재 종가 - 조회 가능 기간의 52주 고점) / 52주 고점 × 100으로 계산합니다.",
    dataRequirement: "최대 1년 내외의 고가·종가 이력이 필요하며, 0%에 가까울수록 고점에 접근한 상태입니다.",
    currentReadingFocus: "고점 돌파 직전인지, 고점 대비 조정폭이 충분한지, 추세 강도와 함께 판단합니다.",
  },
  low52Distance: {
    category: "52주 저점 대비 반등 위치 지표",
    calculation: "(현재 종가 - 조회 가능 기간의 52주 저점) / 52주 저점 × 100으로 계산합니다.",
    dataRequirement: "최대 1년 내외의 저가·종가 이력이 필요하며, 값이 낮을수록 저점 부근입니다.",
    currentReadingFocus: "저점권 반등 후보인지, 구조적 하락으로 저점 근처에 머무는지 거래량 회복과 같이 확인합니다.",
  },
};

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const averageValues = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

const rollingAverage = (values: number[], endIndex: number, period: number) => {
  if (endIndex + 1 < period) return null;
  return averageValues(values.slice(endIndex + 1 - period, endIndex + 1));
};

const rollingStandardDeviation = (values: number[], endIndex: number, period: number) => {
  const mean = rollingAverage(values, endIndex, period);
  if (mean === null) return null;
  const slice = values.slice(endIndex + 1 - period, endIndex + 1);
  const variance = averageValues(slice.map(value => (value - mean) ** 2));
  return variance === null ? null : Math.sqrt(variance);
};

const emaSeriesAligned = (values: number[], period: number) => {
  const output: Array<number | null> = Array(values.length).fill(null);
  if (values.length < period) return output;
  const multiplier = 2 / (period + 1);
  let previous = averageValues(values.slice(0, period));
  if (previous === null) return output;
  output[period - 1] = previous;
  for (let index = period; index < values.length; index += 1) {
    previous = (values[index] - previous) * multiplier + previous;
    output[index] = previous;
  }
  return output;
};

const buildIndicatorEvidenceRows = (candles: Array<{ date: string; close: number; high: number; low: number; volume: number }>): IndicatorEvidenceRow[] => {
  const closes = candles.map(candle => candle.close);
  const ema12 = emaSeriesAligned(closes, 12);
  const ema26 = emaSeriesAligned(closes, 26);
  const macdLine = closes.map((_, index) => (ema12[index] !== null && ema26[index] !== null ? (ema12[index] as number) - (ema26[index] as number) : null));
  const macdIndexes = macdLine.map((value, index) => (value === null ? null : index)).filter((value): value is number => value !== null);
  const macdValues = macdIndexes.map(index => macdLine[index] as number);
  const signalValues = emaSeriesAligned(macdValues, 9);
  const macdHistogramByIndex = new Map<number, number>();
  macdIndexes.forEach((originalIndex, macdIndex) => {
    const signal = signalValues[macdIndex];
    const macd = macdLine[originalIndex];
    if (signal !== null && macd !== null) macdHistogramByIndex.set(originalIndex, macd - signal);
  });

  return candles.map((candle, index) => {
    const sma20 = rollingAverage(closes, index, 20);
    const sma60 = rollingAverage(closes, index, 60);
    const standardDeviation20 = rollingStandardDeviation(closes, index, 20);
    const previousVolumes = index >= 20 ? candles.slice(index - 20, index).map(item => item.volume).filter(value => Number.isFinite(value) && value > 0) : [];
    const previousVolumeAverage = previousVolumes.length === 20 ? averageValues(previousVolumes) : null;
    return {
      date: candle.date.slice(5),
      fullDate: candle.date,
      close: candle.close,
      high: candle.high,
      low: candle.low,
      volume: candle.volume,
      sma20,
      sma60,
      bollingerUpper: sma20 !== null && standardDeviation20 !== null ? sma20 + 2 * standardDeviation20 : null,
      bollingerLower: sma20 !== null && standardDeviation20 !== null ? sma20 - 2 * standardDeviation20 : null,
      macdHistogram: macdHistogramByIndex.get(index) ?? null,
      volumeRatio: previousVolumeAverage ? (candle.volume / previousVolumeAverage) * 100 : null,
    };
  });
};

const indicatorGaugePosition = (value: number | null, scale?: IndicatorScale) => {
  if (value === null || !Number.isFinite(value)) return null;
  if (!scale) {
    const dynamicMax = Math.max(Math.abs(value) * 2, 1);
    return clampNumber(((value + dynamicMax) / (dynamicMax * 2)) * 100, 0, 100);
  }
  return clampNumber(((value - scale.min) / (scale.max - scale.min)) * 100, 0, 100);
};

const renderIndicatorGauge = (value: number | null, guide?: IndicatorDetailGuide, compact = false) => {
  const position = indicatorGaugePosition(value, guide?.scale);
  const lowPosition = guide?.scale ? indicatorGaugePosition(guide.scale.low, guide.scale) : 50;
  const highPosition = guide?.scale ? indicatorGaugePosition(guide.scale.high, guide.scale) : 50;
  return (
    <div className={compact ? "mt-3" : "mt-4"}>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-white/70 ring-1 ring-slate-200/70">
        <div className="absolute inset-y-0 left-0 bg-blue-200/80" style={{ width: `${lowPosition ?? 0}%` }} />
        <div className="absolute inset-y-0 bg-emerald-200/80" style={{ left: `${lowPosition ?? 0}%`, width: `${Math.max((highPosition ?? 100) - (lowPosition ?? 0), 0)}%` }} />
        <div className="absolute inset-y-0 right-0 bg-rose-200/80" style={{ width: `${Math.max(100 - (highPosition ?? 100), 0)}%` }} />
        {position !== null ? <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-950 shadow" style={{ left: `${position}%` }} /> : null}
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

export default function Home() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [selectedSector, setSelectedSector] = useState<ActiveSector>("all");
  const [sortState, setSortState] = useState<{ key: SortKey; direction: SortDirection } | null>({ key: "marketRank", direction: "asc" });
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshFailures, setRefreshFailures] = useState<BulkRefreshFailure[]>([]);
  const [form, setForm] = useState<StockForm>(() => emptyForm(DEFAULT_SECTOR));

  const queryInput = useMemo(() => (selectedSector === "all" ? {} : { sector: selectedSector }), [selectedSector]);
  const utils = trpc.useUtils();
  const stocksQuery = trpc.stocks.list.useQuery(queryInput, {
    refetchInterval: PRICE_AUTO_REFETCH_MS,
    refetchIntervalInBackground: true,
    staleTime: 1000 * 60 * 3,
  });
  const autoRefreshStatus = trpc.stocks.autoRefreshStatus.useQuery(undefined, {
    enabled: isAdmin,
    refetchInterval: PRICE_AUTO_REFETCH_MS,
    retry: false,
  });
  const [selectedStock, setSelectedStock] = useState<NonNullable<typeof stocksQuery.data>[number] | null>(null);
  const [priceChartFrame, setPriceChartFrame] = useState<PriceChartFrame>("daily");
  const [selectedIndicatorKey, setSelectedIndicatorKey] = useState<string | null>(null);
  const financialDetail = trpc.stocks.financialDetail.useQuery(
    {
      code: selectedStock?.code ?? "000000",
      name: selectedStock?.name,
      marketSuffix: (selectedStock?.marketSuffix as "KS" | "KQ" | undefined) ?? "KS",
    },
    { enabled: Boolean(selectedStock), retry: 1 }
  );
  const technicalIndicators = trpc.stocks.technicalIndicators.useQuery(
    {
      code: selectedStock?.code ?? "000000",
      name: selectedStock?.name,
      marketSuffix: (selectedStock?.marketSuffix as "KS" | "KQ" | undefined) ?? "KS",
    },
    { enabled: Boolean(selectedStock), retry: 1, staleTime: 1000 * 60 * 5 }
  );
  const saveStock = trpc.stocks.save.useMutation({
    onSuccess: async () => {
      toast.success("종목 데이터가 저장되었습니다.");
      setForm(emptyForm(selectedSector === "all" ? DEFAULT_SECTOR : selectedSector));
      await utils.stocks.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const deleteStock = trpc.stocks.delete.useMutation({
    onSuccess: async () => {
      toast.success("종목이 삭제되었습니다.");
      await utils.stocks.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const refreshPrice = trpc.stocks.refreshPrice.useMutation({
    onSuccess: async () => {
      setRefreshFailures([]);
      toast.success("현재 주가를 갱신했습니다.");
      await utils.stocks.list.invalidate();
    },
    onError: error => toast.error(`${error.message} 관리자는 현재가를 수동으로 수정할 수 있습니다.`),
  });
  const refreshAll = trpc.stocks.refreshAllPrices.useMutation({
    onSuccess: async results => {
      const failedResults = results.filter((result): result is BulkRefreshFailure => !result.success);
      setRefreshFailures(failedResults);
      if (failedResults.length) {
        toast.warning(`현재가 갱신 완료, ${failedResults.length}건은 외부 API 실패로 수동 확인이 필요합니다.`);
      } else {
        toast.success("모든 현재가를 갱신했습니다.");
      }
      await utils.stocks.list.invalidate();
    },
    onError: error => toast.error(`${error.message} 관리자는 현재가를 수동으로 수정할 수 있습니다.`),
  });
  const selectedSectorMeta = selectedSector === "all" ? allSectorMeta : sectors.find(sector => sector.key === selectedSector) ?? sectors[0];
  const rows = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    const scopedRows = selectedSector === "all"
      ? (stocksQuery.data ?? []).filter(row => typeof row.marketRank === "number" && row.marketRank >= 1 && row.marketRank <= KOREA_MARKET_CAP_LIMIT)
      : stocksQuery.data ?? [];
    const list = keyword
      ? scopedRows.filter(row => `${row.name} ${row.code} ${getMarketLabel(row.marketSuffix)} ${getSectorLabel(row.sector)} ${row.dataSource}`.toLowerCase().includes(keyword))
      : scopedRows;
    if (!sortState || SUMMARY_SORT_KEYS.has(sortState.key)) return list;

    const getSortValue = (row: (typeof list)[number]) => {
      switch (sortState.key) {
        case "name": return row.name;
        case "code": return row.code;
        case "sector": return getSectorLabel(row.sector);
        case "marketSuffix": return getMarketLabel(row.marketSuffix);
        case "currentPrice": return row.currentPrice;
        case "annualEps": return row.annualEps;
        case "earningsYield": return row.earningsYield ?? Number.NEGATIVE_INFINITY;
        case "connectionStatus": return getConnectionLabel(row.dataSource, row.currentPrice, row.annualEps);
        case "lastPriceFetchedAt": return row.lastPriceFetchedAt ? new Date(row.lastPriceFetchedAt).getTime() : Number.NEGATIVE_INFINITY;
        case "marketRank":
        default: return row.marketRank ?? Number.POSITIVE_INFINITY;
      }
    };

    return [...list].sort((a, b) => {
      const aValue = getSortValue(a);
      const bValue = getSortValue(b);
      if (typeof aValue === "string" || typeof bValue === "string") {
        const compared = String(aValue ?? "").localeCompare(String(bValue ?? ""), "ko-KR");
        return sortState.direction === "asc" ? compared : -compared;
      }
      const compared = Number(aValue) - Number(bValue);
      return sortState.direction === "asc" ? compared : -compared;
    });
  }, [stocksQuery.data, searchText, selectedSector, sortState]);

  const totalPages = Math.max(1, Math.ceil(rows.length / TABLE_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedRows = useMemo(() => {
    const startIndex = (safePage - 1) * TABLE_PAGE_SIZE;
    return rows.slice(startIndex, startIndex + TABLE_PAGE_SIZE);
  }, [rows, safePage]);
  const summaryInput = useMemo(() => ({
    stocks: pagedRows.map(row => ({
      code: row.code,
      name: row.name,
      marketSuffix: row.marketSuffix as "KS" | "KQ",
    })),
  }), [pagedRows]);
  const financialSummaries = trpc.stocks.financialSummaries.useQuery(summaryInput, {
    enabled: pagedRows.length > 0,
    retry: 0,
    staleTime: 1000 * 60 * 60 * 6,
  });
  const summaryByCode = useMemo(() => new Map((financialSummaries.data ?? []).map(summary => [summary.code, summary])), [financialSummaries.data]);
  const pagedDisplayRows = useMemo(() => {
    if (!sortState || !SUMMARY_SORT_KEYS.has(sortState.key)) return pagedRows;

    const getSummarySortValue = (row: (typeof pagedRows)[number]) => {
      const summary = summaryByCode.get(row.code.padStart(6, "0"));
      if (!summary?.success) return null;
      switch (sortState.key) {
        case "per": return summary.per;
        case "pbr": return summary.pbr;
        case "marketCapHundredMillionKrw": return summary.marketCapHundredMillionKrw;
        case "latestOperatingProfitHundredMillionKrw": return summary.latestOperatingProfitHundredMillionKrw;
        default: return null;
      }
    };

    return [...pagedRows].sort((a, b) => {
      const aValue = getSummarySortValue(a);
      const bValue = getSummarySortValue(b);
      const aMissing = aValue === null || !Number.isFinite(aValue);
      const bMissing = bValue === null || !Number.isFinite(bValue);
      if (aMissing && bMissing) return (a.marketRank ?? 999999) - (b.marketRank ?? 999999);
      if (aMissing) return 1;
      if (bMissing) return -1;
      const compared = Number(aValue) - Number(bValue);
      return sortState.direction === "asc" ? compared : -compared;
    });
  }, [pagedRows, sortState, summaryByCode]);
  const priceChartFrameLabels: Record<PriceChartFrame, string> = { daily: "일봉", weekly: "주봉", monthly: "월봉" };
  const priceChartData = useMemo(() => {
    const history = technicalIndicators.data?.priceHistory ?? [];
    if (priceChartFrame === "daily") {
      return history.slice(-126).map(candle => ({
        date: candle.date.slice(5),
        fullDate: candle.date,
        close: candle.close,
        high: candle.high,
        low: candle.low,
        volume: candle.volume,
      }));
    }

    const grouped = new Map<string, { date: string; fullDate: string; close: number; high: number; low: number; volume: number }>();
    history.forEach(candle => {
      const date = new Date(`${candle.date}T00:00:00Z`);
      const key = priceChartFrame === "weekly"
        ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - ((date.getUTCDay() + 6) % 7))).toISOString().slice(0, 10)
        : candle.date.slice(0, 7);
      const existing = grouped.get(key);
      grouped.set(key, {
        date: priceChartFrame === "weekly" ? key.slice(5) : key,
        fullDate: candle.date,
        close: candle.close,
        high: existing ? Math.max(existing.high, candle.high) : candle.high,
        low: existing ? Math.min(existing.low, candle.low) : candle.low,
        volume: (existing?.volume ?? 0) + candle.volume,
      });
    });
    const aggregated = Array.from(grouped.values()).sort((a, b) => a.fullDate.localeCompare(b.fullDate));
    return priceChartFrame === "weekly" ? aggregated.slice(-104) : aggregated.slice(-36);
  }, [technicalIndicators.data?.priceHistory, priceChartFrame]);


  const technicalEvidenceData = useMemo(() => buildIndicatorEvidenceRows(technicalIndicators.data?.priceHistory ?? []).slice(-120), [technicalIndicators.data?.priceHistory]);
  const selectedIndicatorDetail = useMemo(() => {
    if (!selectedIndicatorKey || !technicalIndicators.data) return null;
    return technicalIndicators.data.indicators.find(indicator => indicator.key === selectedIndicatorKey) ?? null;
  }, [selectedIndicatorKey, technicalIndicators.data]);
  const selectedIndicatorGuide = selectedIndicatorDetail ? indicatorDetailGuides[selectedIndicatorDetail.key] : undefined;
  const selectedIndicatorMethod = selectedIndicatorDetail ? indicatorMethodGuides[selectedIndicatorDetail.key] : undefined;

  const chartData = useMemo(() => {
    if (selectedSector === "all") {
      return sectors.map(sector => ({
        name: sector.shortLabel,
        value: rows.filter(row => row.sector === sector.key).length,
        per: null,
        pbr: null,
        operatingProfit: null,
        metricLabel: "종목 수",
        marketRank: null as number | null,
        code: sector.key,
      })).filter(item => item.value > 0);
    }

    const successfulSummaryByCode = new Map(
      (financialSummaries.data ?? [])
        .filter(summary => summary.success)
        .map(summary => [summary.code, summary])
    );

    return pagedRows
      .slice(0, 20)
      .map(row => {
        const summary = successfulSummaryByCode.get(row.code.padStart(6, "0"));
        const marketCap = summary && "marketCapHundredMillionKrw" in summary && typeof summary.marketCapHundredMillionKrw === "number"
          ? summary.marketCapHundredMillionKrw
          : null;
        const per = summary && "per" in summary ? summary.per : null;
        const pbr = summary && "pbr" in summary ? summary.pbr : null;
        const operatingProfit = summary && "latestOperatingProfitHundredMillionKrw" in summary ? summary.latestOperatingProfitHundredMillionKrw : null;
        return {
          name: row.name,
          value: marketCap ?? row.currentPrice,
          per,
          pbr,
          operatingProfit,
          metricLabel: marketCap ? "시가총액" : "현재가",
          marketRank: row.marketRank ?? null,
          code: row.code,
        };
      })
      .filter(item => item.value > 0)
      .sort((a, b) => {
        if (a.metricLabel === "시가총액" && b.metricLabel === "시가총액") return b.value - a.value;
        return (a.marketRank ?? Number.POSITIVE_INFINITY) - (b.marketRank ?? Number.POSITIVE_INFINITY);
      });
  }, [financialSummaries.data, pagedRows, rows, selectedSector]);

   const linkedCount = rows.filter(row => row.dataSource !== "manual" && row.currentPrice > 0).length;
  const validEarningsYields = rows
    .map(row => row.earningsYield)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const averageEarningsYield = validEarningsYields.length
    ? validEarningsYields.reduce((sum, value) => sum + value, 0) / validEarningsYields.length
    : null;
  const updateForm = (key: keyof StockForm, value: string) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const handleSectorChange = (sector: ActiveSector) => {
    setSelectedSector(sector);
    setCurrentPage(1);
    setForm(emptyForm(sector === "all" ? DEFAULT_SECTOR : sector));
  };

  const handleEdit = (stock: NonNullable<typeof stocksQuery.data>[number]) => {
    setForm({
      id: stock.id,
      sector: stock.sector as SectorKey,
      name: stock.name,
      code: stock.code,
      marketSuffix: stock.marketSuffix as "KS" | "KQ",
      currentPrice: String(stock.currentPrice),
      annualEps: String(stock.annualEps),
    });
  };

   const handleSave = () => {
    saveStock.mutate({
      id: form.id,
      sector: form.sector,
      name: form.name.trim(),
      code: form.code.trim(),
      marketSuffix: form.marketSuffix,
      currentPrice: Number(form.currentPrice),
      annualEps: Number(form.annualEps),
    });
  };
  const cycleSort = (key: SortKey) => {
    setSortState(current => {
      if (!current || current.key !== key) return { key, direction: "desc" };
      if (current.direction === "desc") return { key, direction: "asc" };
      return null;
    });
    setCurrentPage(1);
  };
  const sortLabels: Record<SortKey, string> = {
    marketRank: "순위",
    name: "종목명",
    code: "종목코드",
    sector: "테마",
    marketSuffix: "시장",
    currentPrice: "현재가",
    annualEps: "EPS",
    earningsYield: "EPS/주가",
    per: "PER",
    pbr: "PBR",
    marketCapHundredMillionKrw: "시가총액",
    latestOperatingProfitHundredMillionKrw: "영업이익",
    connectionStatus: "연동 상태",
    lastPriceFetchedAt: "갱신시각",
  };
  const renderSortIcon = (key: SortKey) => {
    if (sortState?.key !== key) return <ArrowUpDown className="h-3.5 w-3.5 text-slate-300" />;
    return sortState.direction === "desc" ? <ArrowDown className="h-3.5 w-3.5 text-slate-950" /> : <ArrowUp className="h-3.5 w-3.5 text-slate-950" />;
  };
  const sortableHeader = (label: string, key: SortKey, align: "left" | "right" = "left") => (
    <button
      type="button"
      onClick={() => cycleSort(key)}
      className={`inline-flex w-full items-center gap-1.5 rounded-xl px-2 py-1 text-xs font-black text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 ${align === "right" ? "justify-end" : "justify-start"}`}
      title={`${label} 기준 내림차순 → 오름차순 → 정렬취소`}
    >
      <span>{label}</span>
      {renderSortIcon(key)}
    </button>
  );
  const currentSortLabel = sortState ? `${sortLabels[sortState.key]} ${sortState.direction === "desc" ? "내림차순" : "오름차순"}` : "정렬취소: 기본 표시순";
  const lastClientRefreshText = stocksQuery.dataUpdatedAt ? formatDateTime(new Date(stocksQuery.dataUpdatedAt)) : "대기 중";
  const serverAutoRefreshText = !isAdmin
    ? "화면 3분 자동 조회"
    : autoRefreshStatus.isLoading
      ? "Vercel Cron 확인 중"
      : autoRefreshStatus.data?.enabled
        ? "Vercel Cron 보안 설정됨"
        : "CRON_SECRET 미설정";
  const indicatorStatusClass = (status: string) => {
    if (status === "overheated" || status === "watch_high") return "border-rose-200 bg-rose-50 text-rose-800";
    if (status === "oversold" || status === "watch_low") return "border-blue-200 bg-blue-50 text-blue-800";
    return "border-slate-200 bg-slate-50 text-slate-700";
  };
  const priceChartPanel = !selectedStock ? null : (
    <div className="rounded-[2rem] border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-black text-slate-950"><BarChart3 className="h-5 w-5 text-blue-500" /> 가격 차트</h3>
          <p className="mt-1 text-sm text-slate-500">야후 가격 이력 기준으로 일봉·주봉·월봉 종가 흐름을 전환해 확인합니다.</p>
        </div>
        <Tabs value={priceChartFrame} onValueChange={(value) => setPriceChartFrame(value as PriceChartFrame)}>
          <TabsList className="rounded-full bg-slate-100 p-1">
            <TabsTrigger value="daily" className="rounded-full px-4">일</TabsTrigger>
            <TabsTrigger value="weekly" className="rounded-full px-4">주</TabsTrigger>
            <TabsTrigger value="monthly" className="rounded-full px-4">월</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {technicalIndicators.isLoading ? (
        <div className="mt-4 flex min-h-64 items-center justify-center rounded-3xl bg-slate-50 text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 가격 차트를 불러오는 중입니다.
        </div>
      ) : technicalIndicators.error ? (
        <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          가격 차트 데이터를 가져오지 못했습니다. {technicalIndicators.error.message}
        </div>
      ) : priceChartData.length ? (
        <div className="mt-4 h-72 rounded-3xl bg-slate-50 p-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={priceChartData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="stockPriceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} minTickGap={20} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(value) => `${Number(value).toLocaleString("ko-KR")}`} width={74} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(value, name) => [typeof value === "number" ? `${value.toLocaleString("ko-KR")}원` : value, name === "close" ? "종가" : name]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate ? `${payload[0].payload.fullDate} · ${priceChartFrameLabels[priceChartFrame]}` : priceChartFrameLabels[priceChartFrame]}
                contentStyle={{ borderRadius: 18, border: "1px solid #e2e8f0", boxShadow: "0 20px 60px rgba(15, 23, 42, 0.12)" }}
              />
              <Area type="monotone" dataKey="close" stroke="#2563eb" strokeWidth={3} fill="url(#stockPriceGradient)" dot={false} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-4 rounded-3xl bg-slate-50 p-6 text-sm text-slate-500">표시할 가격 이력이 없습니다.</div>
      )}
    </div>
  );
  const technicalPanel = !selectedStock ? null : (
    <div className="rounded-[2rem] border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-black text-slate-950"><Activity className="h-5 w-5 text-blue-500" /> 고점·저점 판단 보조지표 12개</h3>
          <p className="mt-1 text-sm text-slate-500">최근 가격 이력 기반의 참고 지표입니다. 투자 판단은 재무·수급·뉴스를 함께 확인하세요.</p>
        </div>
        {technicalIndicators.data ? (
          <Badge variant="outline" className="rounded-full bg-slate-50">
            {technicalIndicators.data.indicators.length}개 지표 · 종가 {formatNumber(technicalIndicators.data.latestClose ?? 0)}원 · 적정주가 중간값 {technicalIndicators.data.fairPriceMedian ? `${formatNumber(technicalIndicators.data.fairPriceMedian)}원` : "자료 없음"}
          </Badge>
        ) : null}
      </div>
      {technicalIndicators.isLoading ? (
        <div className="mt-4 flex min-h-32 items-center justify-center rounded-3xl bg-slate-50 text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 보조지표를 계산하는 중입니다.
        </div>
      ) : technicalIndicators.error ? (
        <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          보조지표 계산에 실패했습니다. {technicalIndicators.error.message} 외부 가격 이력이 부족하거나 일시적으로 응답하지 않을 수 있습니다.
        </div>
      ) : technicalIndicators.data ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {technicalIndicators.data.indicators.map(indicator => {
              const guide = indicatorDetailGuides[indicator.key];
              const isSelected = selectedIndicatorKey === indicator.key;
              return (
                <button
                  key={indicator.key}
                  type="button"
                  onClick={() => setSelectedIndicatorKey(indicator.key)}
                  aria-pressed={isSelected}
                  className={`rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 ${indicatorStatusClass(indicator.status)} ${isSelected ? "ring-2 ring-slate-950" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black">{indicator.label}</p>
                      <p className="mt-1 text-xs opacity-80">{indicator.statusLabel}</p>
                    </div>
                    <p className="whitespace-nowrap text-lg font-black">{indicator.displayValue}</p>
                  </div>
                  {renderIndicatorGauge(indicator.value, guide, true)}
                  <p className="mt-3 text-xs font-semibold leading-5">{indicator.interpretation}</p>
                  <div className="mt-3 rounded-2xl bg-white/55 p-3 text-xs leading-5 text-slate-700">
                    <div className="flex items-center justify-between gap-2 font-black">
                      <span>예상 적정주가</span>
                      <span>{indicator.fairPriceDisplay}</span>
                    </div>
                    <p className="mt-1 opacity-80">{indicator.fairPriceBasis}</p>
                  </div>
                  <span className="mt-3 inline-flex rounded-full bg-white/65 px-3 py-1 text-[11px] font-black text-slate-600 ring-1 ring-slate-200">상세 해설·근거 차트 보기</span>
                </button>
              );
            })}
          </div>
          {selectedIndicatorDetail ? (
            <div className="mt-4 rounded-3xl border border-blue-100 bg-blue-50/80 p-4 text-sm text-blue-950" id="technical-indicator-detail">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-black">보조지표 상세 분석창 열림 · {selectedIndicatorDetail.label}</p>
                  <p className="mt-1 text-xs leading-5 text-blue-800">선택한 지표의 종류, 계산 방식, 현재 종목 해석, 게이지와 근거 차트를 별도 창에서 확인합니다.</p>
                </div>
                <Button type="button" size="sm" variant="outline" className="w-fit rounded-full bg-white" onClick={() => setSelectedIndicatorKey(null)}>상세창 닫기</Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              각 보조지표 카드를 클릭하면 의미, 판단 기준, 현재 해석, 주의점과 함께 지표 종류, 계산 방식, 가격·이동평균·볼린저밴드·MACD 근거 차트가 상세 분석창으로 열립니다.
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">출처: {technicalIndicators.data.source} · 조회 시각: {formatDateTime(technicalIndicators.data.fetchedAt)}</p>
        </>
      ) : null}
    </div>
  );

  const indicatorDetailDialog = selectedIndicatorDetail ? (
    <Dialog open={Boolean(selectedStock && selectedIndicatorDetail)} onOpenChange={(open) => { if (!open) setSelectedIndicatorKey(null); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-0 bg-slate-50 text-slate-950 sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-3 text-2xl font-black">
            <Activity className="h-6 w-6 text-blue-500" />
            보조지표 상세 해설 · {selectedIndicatorDetail.label}
          </DialogTitle>
          <DialogDescription>
            의미, 판단 기준, 현재 해석, 주의점에 더해 지표 종류와 계산 방식을 함께 보여주는 현재 종목 기준 상세 분석창입니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Indicator Drilldown</p>
                <h4 className="mt-1 text-xl font-black text-slate-950">{selectedStock?.name ?? "현재 종목"}의 {selectedIndicatorDetail.label} 분석</h4>
                <p className="mt-2 text-sm leading-6 text-slate-600">{selectedIndicatorGuide?.meaning ?? selectedIndicatorDetail.interpretation}</p>
              </div>
              <Badge className="w-fit rounded-full bg-slate-950 text-white hover:bg-slate-950">현재 {selectedIndicatorDetail.displayValue} · {selectedIndicatorDetail.statusLabel}</Badge>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <p className="text-xs font-black text-slate-500">지표 종류</p>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-800">{selectedIndicatorMethod?.category ?? "가격 이력 기반 보조지표"}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <p className="text-xs font-black text-slate-500">현재값</p>
                <p className="mt-2 text-xl font-black text-slate-950">{selectedIndicatorDetail.displayValue}</p>
                <p className="mt-1 text-xs text-slate-500">{selectedIndicatorDetail.statusLabel}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <p className="text-xs font-black text-slate-500">예상 적정주가</p>
                <p className="mt-2 text-xl font-black text-slate-950">{selectedIndicatorDetail.fairPriceDisplay}</p>
                <p className="mt-1 text-xs text-slate-500">종가 {formatNumber(technicalIndicators.data?.latestClose ?? selectedStock?.currentPrice ?? 0)}원 기준</p>
              </div>
            </div>

            <div className="mt-4 rounded-3xl bg-blue-50 p-4 ring-1 ring-blue-100">
              <p className="text-xs font-black text-blue-700">현재 종목에 대한 상세 분석</p>
              <p className="mt-2 text-sm leading-6 text-blue-950">{selectedStock?.name ?? "현재 종목"}은(는) {selectedIndicatorDetail.label} 기준 현재 {selectedIndicatorDetail.statusLabel} 구간에 있습니다. {selectedIndicatorDetail.interpretation} {selectedIndicatorDetail.fairPriceBasis} 이 평가는 최근 가격 이력에서 계산된 참고 신호이므로 재무지표, 업종 수급, 뉴스와 함께 교차 확인해야 합니다.</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <p className="text-sm font-black text-slate-950">어떻게 얻는 지표인가?</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{selectedIndicatorMethod?.calculation ?? "최근 가격 이력에서 현재값과 기준선을 계산합니다."}</p>
              <p className="mt-3 text-xs font-black text-slate-500">필요 데이터</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">{selectedIndicatorMethod?.dataRequirement ?? "종가, 고가, 저가, 거래량 등 가격 이력 데이터가 필요합니다."}</p>
            </div>
            <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <p className="text-sm font-black text-slate-950">해석 기준과 주의점</p>
              <p className="mt-2 text-sm leading-6 text-slate-700"><span className="font-black">판단 기준:</span> {selectedIndicatorGuide?.thresholds ?? "중립 기준선과 최근 가격 추세의 괴리를 함께 확인합니다."}</p>
              <p className="mt-2 text-sm leading-6 text-slate-700"><span className="font-black">주의점:</span> {selectedIndicatorGuide?.caution ?? "단일 지표만으로 매수·매도를 결정하지 말고 재무·수급·뉴스를 함께 확인해야 합니다."}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black text-slate-950">현재값 위치 게이지</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{selectedIndicatorMethod?.currentReadingFocus ?? selectedIndicatorGuide?.chartFocus ?? "최근 가격 이력에서 계산한 기준선과 현재값을 함께 비교합니다."}</p>
            </div>
            <p className="text-sm font-black text-slate-900">{selectedIndicatorDetail.displayValue}</p>
          </div>
          {renderIndicatorGauge(selectedIndicatorDetail.value, selectedIndicatorGuide)}
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-slate-950">가격·이동평균·볼린저밴드 근거</p>
                <p className="mt-1 text-xs text-slate-500">최근 120거래일 기준 종가, 20일선, 60일선, 볼린저 상·하단입니다.</p>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={technicalEvidenceData} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} minTickGap={20} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="price" tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(value) => `${Number(value).toLocaleString("ko-KR")}`} width={74} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(value, name) => {
                      const labelMap: Record<string, string> = { close: "종가", sma20: "20일선", sma60: "60일선", bollingerUpper: "볼린저 상단", bollingerLower: "볼린저 하단" };
                      return [typeof value === "number" ? `${value.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}원` : value, labelMap[String(name)] ?? String(name)];
                    }}
                    labelFormatter={(_label, payload: any) => payload?.[0]?.payload?.fullDate ?? ""}
                    contentStyle={{ borderRadius: 18, border: "1px solid #e2e8f0", boxShadow: "0 20px 60px rgba(15, 23, 42, 0.12)" }}
                  />
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
            <div className="mb-3">
              <p className="text-sm font-black text-slate-950">MACD·거래량 보조 근거</p>
              <p className="mt-1 text-xs text-slate-500">모멘텀은 0선, 거래량은 100% 기준선을 중심으로 확인합니다.</p>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={technicalEvidenceData} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} minTickGap={20} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="macd" tick={{ fontSize: 11, fill: "#64748b" }} width={56} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="volume" orientation="right" tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(value) => `${Number(value).toFixed(0)}%`} width={58} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(value, name) => {
                      if (typeof value !== "number") return [value, name];
                      if (name === "volumeRatio") return [`${value.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}%`, "거래량 20일 배율"];
                      return [value.toLocaleString("ko-KR", { maximumFractionDigits: 2 }), "MACD 히스토그램"];
                    }}
                    labelFormatter={(_label, payload: any) => payload?.[0]?.payload?.fullDate ?? ""}
                    contentStyle={{ borderRadius: 18, border: "1px solid #e2e8f0", boxShadow: "0 20px 60px rgba(15, 23, 42, 0.12)" }}
                  />
                  <ReferenceLine yAxisId="macd" y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                  <ReferenceLine yAxisId="volume" y={100} stroke="#cbd5e1" strokeDasharray="3 3" />
                  <Bar yAxisId="macd" dataKey="macdHistogram" radius={[4, 4, 0, 0]} fill="#2563eb" opacity={0.7} />
                  <Line yAxisId="volume" type="monotone" dataKey="volumeRatio" stroke="#f97316" strokeWidth={2} dot={false} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <p className="text-xs leading-5 text-slate-500">출처: {technicalIndicators.data?.source ?? "YahooFinance"} · 조회 시각: {formatDateTime(technicalIndicators.data?.fetchedAt)} · 이 상세 분석은 기술적 보조지표 참고 자료이며 투자 판단을 대체하지 않습니다.</p>
      </DialogContent>
    </Dialog>
  ) : null;

  return (
    <div className="relative min-h-[calc(100vh-3rem)] overflow-hidden rounded-[2rem] bg-[#f7f9fb] p-4 text-slate-950 md:p-8">
      <div className="pointer-events-none absolute right-[-5rem] top-[-5rem] h-64 w-64 rounded-[4rem] bg-blue-200/60 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-6rem] left-[18%] h-72 w-72 rounded-full bg-rose-200/70 blur-3xl" />

      <section className="relative z-10 mb-8 grid gap-6 xl:grid-cols-[1.45fr_0.55fr]">
        <div className="rounded-[2rem] bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] ring-1 ring-white sm:p-8">
          <Badge className="mb-5 bg-slate-950 text-white hover:bg-slate-950">Domestic Stock Sector Dashboard</Badge>
          <h1 className="max-w-5xl break-keep text-3xl font-black leading-[1.12] tracking-[-0.03em] text-slate-950 sm:text-4xl lg:text-5xl">
            국내주식 섹터분석
          </h1>
          <p className="mt-5 max-w-3xl text-base font-light leading-7 text-slate-500 md:text-lg">
            국내 대표 종목을 자체 산업·비즈니스 테마로 재분류하고, 종목 클릭 시 PER, PBR, 시가총액, 영업이익, EPS, EPS/주가(%), 최근 분기별 실적과 RSI 등 대표 보조지표를 한 화면에서 확인하도록 정리했습니다.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              onClick={() => { setSortState(null); setCurrentPage(1); }}
              variant="outline"
              className="rounded-full border-slate-200 bg-white/80 px-5"
            >
              <ArrowUpDown className="mr-2 h-4 w-4" />
              정렬 초기화 · {currentSortLabel}
            </Button>
            <Button
              variant="outline"
              disabled={!isAdmin || refreshAll.isPending}
              onClick={() => refreshAll.mutate()}
              className="rounded-full border-slate-200 bg-white/70 px-5"
            >
              {refreshAll.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              전체 현재가 갱신
            </Button>
            <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-900">
              <span className="inline-flex items-center gap-2">
                <Activity className={`h-3.5 w-3.5 ${stocksQuery.isFetching ? "animate-pulse" : ""}`} />
                {serverAutoRefreshText} · 화면 3분 재조회 · 최근 반영 {lastClientRefreshText}
              </span>
            </div>
            <div className="relative min-w-[240px] flex-1 md:flex-none">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchText}
                onChange={event => { setSearchText(event.target.value); setCurrentPage(1); }}
                placeholder="종목명·코드·테마·출처 검색"
                className="rounded-full border-slate-200 bg-white/80 pl-10"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <Card className="rounded-[2rem] border-0 bg-slate-950 text-white shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="h-5 w-5 text-blue-200" />
                {selectedSectorMeta.label}
              </CardTitle>
              <CardDescription className="text-slate-300">{selectedSectorMeta.description}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="text-sm text-slate-400">종목 수</p>
                <p className="text-2xl font-black leading-tight sm:text-3xl">{rows.length}</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="text-sm text-slate-400">연동 종목</p>
                <p className="text-2xl font-black leading-tight sm:text-3xl">{linkedCount}</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="text-sm text-slate-400">평균 EPS/주가</p>
                <p className="text-2xl font-black leading-tight sm:text-3xl">{Number.isFinite(averageEarningsYield ?? Number.NaN) ? formatPercent(averageEarningsYield) : "-"}</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="text-sm text-slate-400">상세 지표</p>
                <div className="mt-2 flex flex-wrap gap-2 text-sm font-black text-white">
                  <span className="rounded-full bg-white/10 px-3 py-1">PER</span>
                  <span className="rounded-full bg-white/10 px-3 py-1">PBR</span>
                  <span className="rounded-full bg-white/10 px-3 py-1">RSI</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-[2rem] border-0 bg-white/80 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-slate-500" /> 권한 및 데이터 상태
              </CardTitle>
              <CardDescription>
                {isAdmin ? "오너 권한으로 수동 편집과 현재가 갱신이 가능합니다." : "일반 사용자는 조회 전용입니다. 데이터 출처와 갱신 시각은 테이블에서 확인할 수 있습니다."} 관리 미리보기는 최신 작업 화면이고, 공개 주소는 마지막으로 Publish한 체크포인트가 보입니다. 수정 직후 공개 화면이 예전처럼 보이면 새 체크포인트에서 Publish를 누르고 Ctrl+Shift+R로 새로고침하세요.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      <section className="relative z-10 space-y-6">
        <Tabs value={selectedSector} onValueChange={value => handleSectorChange(value as ActiveSector)}>
          <TabsList className="h-auto flex-wrap rounded-[1.5rem] bg-white/80 p-2 shadow-sm">
            <TabsTrigger value="all" className="rounded-full px-4 py-2 data-[state=active]:bg-slate-950 data-[state=active]:text-white">
              {allSectorMeta.shortLabel}
            </TabsTrigger>
            {sectors.map(sector => (
              <TabsTrigger key={sector.key} value={sector.key} className="rounded-full px-4 py-2 data-[state=active]:bg-slate-950 data-[state=active]:text-white">
                {sector.shortLabel}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <Card className="rounded-[2rem] border-0 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl font-black tracking-tight">
                <BarChart3 className="h-6 w-6 text-blue-500" /> {selectedSector === "all" ? "테마별 구성 차트" : `${selectedSectorMeta.shortLabel} 대표 종목 20개 차트`}
              </CardTitle>
              <CardDescription>{selectedSector === "all" ? `시총 기준 최대 ${KOREA_MARKET_CAP_LIMIT}개 종목을 자체 테마별 종목 수로 비교합니다.` : "선택한 세부 테마 안에서 시가총액을 우선 사용하고, 아직 수집 전이면 현재가 기준으로 대표 종목을 최대 20개까지 비교합니다."}</CardDescription>
            </CardHeader>
            <CardContent className={selectedSector === "all" ? "h-[420px]" : "h-[620px]"}>
              {stocksQuery.isLoading ? (
                <div className="flex h-full items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> 데이터를 불러오는 중입니다.</div>
              ) : chartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 32, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#475569", fontSize: 12 }} width={132} interval={0} tickLine={false} axisLine={false} />
                    <Tooltip
                      formatter={(value: number, _name, item) => {
                        const payload = item.payload as { metricLabel?: string; per?: number | null; pbr?: number | null; operatingProfit?: number | null; marketRank?: number | null; code?: string };
                        const metricLabel = payload.metricLabel ?? "지표";
                        const mainValue = metricLabel === "시가총액"
                          ? formatHundredMillionKrw(value)
                          : metricLabel === "현재가"
                            ? `${formatNumber(value)}원`
                            : `${value}개`;
                        const detail = metricLabel === "종목 수"
                          ? `${mainValue}`
                          : `${mainValue} · 순위 ${payload.marketRank ?? "-"} · PER ${formatMultiple(payload.per)} · PBR ${formatMultiple(payload.pbr)} · 영업이익 ${formatHundredMillionKrw(payload.operatingProfit)}`;
                        return [detail, metricLabel];
                      }}
                      labelFormatter={label => `${label}`}
                    />
                    <Bar dataKey="value" radius={[0, 12, 12, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={index % 2 === 0 ? "#93c5fd" : "#f9a8d4"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-500">{selectedSector === "all" ? "표시할 테마 데이터가 없습니다." : "표시할 대표 종목 데이터가 없습니다."}</div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-0 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-black">
                <Database className="h-5 w-5 text-rose-400" /> 오너 편집 패널
              </CardTitle>
              <CardDescription>국내주식은 시총 기준 최대 {KOREA_MARKET_CAP_LIMIT}개까지 관리하며, 현재가는 오너가 수동 보정할 수 있습니다. PER, PBR, 분기 실적은 종목 클릭 시 각각 네이버 금융에서 조회합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>테마</Label>
                  <Select disabled={!isAdmin} value={form.sector} onValueChange={value => updateForm("sector", value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{sectors.map(sector => <SelectItem key={sector.key} value={sector.key}>{sector.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>시장</Label>
                  <Select disabled={!isAdmin} value={form.marketSuffix} onValueChange={value => updateForm("marketSuffix", value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KS">KOSPI(.KS)</SelectItem>
                      <SelectItem value="KQ">KOSDAQ(.KQ)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label>종목명</Label><Input disabled={!isAdmin} value={form.name} onChange={event => updateForm("name", event.target.value)} placeholder="예: 삼성전자" /></div>
              <div className="space-y-2"><Label>종목코드</Label><Input disabled={!isAdmin} value={form.code} onChange={event => updateForm("code", event.target.value)} placeholder="예: 005930" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>현재 주가</Label><Input disabled={!isAdmin} type="number" value={form.currentPrice} onChange={event => updateForm("currentPrice", event.target.value)} /></div>
                <div className="space-y-2"><Label>EPS(참고)</Label><Input disabled={!isAdmin} type="number" value={form.annualEps} onChange={event => updateForm("annualEps", event.target.value)} /></div>
              </div>
              <div className="flex gap-2">
                <Button disabled={!isAdmin || saveStock.isPending} onClick={handleSave} className="flex-1 bg-slate-950 hover:bg-slate-800">
                  {saveStock.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  저장
                </Button>
                <Button disabled={!isAdmin} variant="outline" onClick={() => setForm(emptyForm(selectedSector === "all" ? DEFAULT_SECTOR : selectedSector))}>초기화</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {refreshFailures.length > 0 ? (
          <Card className="rounded-[2rem] border border-amber-200 bg-amber-50/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-black text-amber-950">현재가 자동 수집 확인 필요</CardTitle>
              <CardDescription className="text-amber-800">
                외부 API에서 가격을 찾지 못한 종목이 있습니다. 아래 실패 사유를 확인한 뒤, 오너 편집 패널에서 현재가를 수동으로 수정하거나 개별 갱신을 다시 시도할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm text-amber-900 md:grid-cols-2">
              {refreshFailures.slice(0, 8).map(failure => (
                <div key={`${failure.id}-${failure.code}`} className="rounded-2xl bg-white/70 p-3">
                  <span className="font-black">{failure.code}</span> · {failure.error}
                </div>
              ))}
              {refreshFailures.length > 8 ? <div className="rounded-2xl bg-white/70 p-3 font-medium">외 {refreshFailures.length - 8}건은 서버 결과에서 확인이 필요합니다.</div> : null}
            </CardContent>
          </Card>
        ) : null}

        <Card className="overflow-hidden rounded-[2rem] border-0 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
          <CardHeader>
            <CardTitle className="text-2xl font-black tracking-tight">국내 시총 상위 {KOREA_MARKET_CAP_LIMIT} 종목 테이블</CardTitle>
            <CardDescription>헤더를 클릭하면 내림차순 → 오름차순 → 정렬취소 순서로 전환됩니다. 현재 페이지 25개 종목은 PER, PBR, 시가총액, 최근 영업이익 요약값을 먼저 불러오며, 외부 자료가 일시적으로 지연되면 행 클릭 상세조회에서 다시 확인할 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent className="max-w-full overflow-x-auto">
            <div className="mb-3 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-medium text-slate-500">
              현재 정렬: <span className="font-black text-slate-900">{currentSortLabel}</span> · 최신 화면 표식: 시총 기준 최대 {KOREA_MARKET_CAP_LIMIT}개, PER 별도, PBR 별도, RSI. 폭이 좁은 화면과 크롬 확대 상태에서는 표 영역만 좌우로 밀어 보세요. 공개 사이트가 이전 EPS 화면으로 보이면 Ctrl+Shift+R로 강력 새로고침하세요.
            </div>
            <table className="w-full min-w-[1380px] border-separate border-spacing-y-2 text-left text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className="px-2 py-2">{sortableHeader("순위", "marketRank")}</th>
                  <th className="px-2 py-2">{sortableHeader("종목명", "name")}</th>
                  <th className="px-2 py-2">{sortableHeader("종목코드", "code")}</th>
                  <th className="px-2 py-2">{sortableHeader("자체 테마", "sector")}</th>
                  <th className="px-2 py-2">{sortableHeader("시장", "marketSuffix")}</th>
                  <th className="px-2 py-2">{sortableHeader("현재 주가", "currentPrice", "right")}</th>
                  <th className="px-2 py-2">{sortableHeader("EPS", "annualEps", "right")}</th>
                  <th className="px-2 py-2">{sortableHeader("EPS/주가", "earningsYield", "right")}</th>
                  <th className="px-2 py-2">{sortableHeader("PER", "per", "right")}</th>
                  <th className="px-2 py-2">{sortableHeader("PBR", "pbr", "right")}</th>
                  <th className="px-2 py-2">{sortableHeader("시가총액", "marketCapHundredMillionKrw", "right")}</th>
                  <th className="px-2 py-2">{sortableHeader("영업이익", "latestOperatingProfitHundredMillionKrw", "right")}</th>
                  <th className="px-2 py-2">{sortableHeader("연동 상태", "connectionStatus")}</th>
                  <th className="px-2 py-2">{sortableHeader("마지막 갱신", "lastPriceFetchedAt")}</th>
                  <th className="px-4 py-2 text-right font-medium">관리</th>
                </tr>
              </thead>
              <tbody>
                {pagedDisplayRows.map(row => {
                  const summary = summaryByCode.get(row.code.padStart(6, "0"));
                  const summaryLoading = financialSummaries.isLoading || financialSummaries.isFetching;
                  return (
                    <tr key={row.id} className="cursor-pointer rounded-2xl bg-slate-50/80 shadow-sm transition hover:bg-blue-50/80" onClick={() => setSelectedStock(row)}>
                    <td className="rounded-l-2xl px-4 py-3 text-slate-500">{row.marketRank ?? "-"}</td>
                    <td className="px-4 py-3 font-bold text-slate-950">{row.name}</td>
                    <td className="px-4 py-3 text-slate-500">{row.code}.{row.marketSuffix}</td>
                    <td className="px-4 py-3"><Badge variant="secondary" className="rounded-full bg-blue-50 text-blue-700">{getSectorLabel(row.sector)}</Badge></td>
                    <td className="px-4 py-3 text-slate-500">{getMarketLabel(row.marketSuffix)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(row.currentPrice)}원</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatNumber(row.annualEps)}원</td>
                    <td className="px-4 py-3 text-right">
                      <Badge className="rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-50">{formatPercent(row.earningsYield)}</Badge>
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-slate-700" title={summary && !summary.success ? summary.error : undefined}>
                      {summary?.success ? <span className="font-black text-slate-950">{formatMultiple(summary.per)}</span> : summaryLoading ? <span className="text-slate-400">조회 중</span> : summary && !summary.success ? <button type="button" className="rounded-full bg-slate-100 px-2 py-1 text-slate-600 transition hover:bg-blue-50 hover:text-blue-700" onClick={(event) => { event.stopPropagation(); setSelectedStock(row); }} aria-label={`${row.name} PER 상세 재무지표 다시 조회`}>상세 조회</button> : <span className="text-slate-400">대기</span>}
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-slate-700" title={summary && !summary.success ? summary.error : undefined}>
                      {summary?.success ? <span className="font-black text-slate-950">{formatMultiple(summary.pbr)}</span> : summaryLoading ? <span className="text-slate-400">조회 중</span> : summary && !summary.success ? <button type="button" className="rounded-full bg-slate-100 px-2 py-1 text-slate-600 transition hover:bg-blue-50 hover:text-blue-700" onClick={(event) => { event.stopPropagation(); setSelectedStock(row); }} aria-label={`${row.name} PBR 상세 재무지표 다시 조회`}>상세 조회</button> : <span className="text-slate-400">대기</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-700" title={summary && !summary.success ? summary.error : undefined}>
                      {summary?.success ? (
                        <p className="font-black text-slate-950 whitespace-nowrap">{formatHundredMillionKrw(summary.marketCapHundredMillionKrw)}</p>
                      ) : summaryLoading ? <span className="text-slate-400">조회 중</span> : summary && !summary.success ? <button type="button" className="rounded-full bg-slate-100 px-2 py-1 text-slate-600 transition hover:bg-blue-50 hover:text-blue-700" onClick={(event) => { event.stopPropagation(); setSelectedStock(row); }} aria-label={`${row.name} 시가총액 상세 다시 조회`}>상세 조회</button> : <span className="text-slate-400">대기</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-700" title={summary && !summary.success ? summary.error : undefined}>
                      {summary?.success ? (
                        <p className="font-semibold whitespace-nowrap">{formatHundredMillionKrw(summary.latestOperatingProfitHundredMillionKrw)}</p>
                      ) : summaryLoading ? <span className="text-slate-400">조회 중</span> : summary && !summary.success ? <button type="button" className="rounded-full bg-slate-100 px-2 py-1 text-slate-600 transition hover:bg-blue-50 hover:text-blue-700" onClick={(event) => { event.stopPropagation(); setSelectedStock(row); }} aria-label={`${row.name} 영업이익 상세 다시 조회`}>상세 조회</button> : <span className="text-slate-400">대기</span>}
                    </td>
                    <td className="px-4 py-3"><Badge variant="outline" className="rounded-full bg-white">{getConnectionLabel(row.dataSource, row.currentPrice, row.annualEps)}</Badge></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(row.lastPriceFetchedAt)}</td>
                    <td className="rounded-r-2xl px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); setSelectedStock(row); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" disabled={!isAdmin || refreshPrice.isPending} onClick={(event) => { event.stopPropagation(); refreshPrice.mutate({ id: row.id, code: row.code, marketSuffix: row.marketSuffix as "KS" | "KQ" }); }}>
                          <RefreshCcw className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" disabled={!isAdmin} onClick={(event) => { event.stopPropagation(); handleEdit(row); }}>수정</Button>
                        <Button size="sm" variant="destructive" disabled={!isAdmin} onClick={(event) => { event.stopPropagation(); deleteStock.mutate({ id: row.id }); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <p>표시 범위: {rows.length ? `${(safePage - 1) * TABLE_PAGE_SIZE + 1}-${Math.min(safePage * TABLE_PAGE_SIZE, rows.length)}` : "0"} / {rows.length}개 · EPS/주가(%)는 EPS ÷ 1주 가격 × 100으로 계산합니다.</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setCurrentPage(page => Math.max(1, page - 1))}>이전</Button>
                <span className="min-w-20 text-center font-semibold text-slate-900">{safePage} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}>다음</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Dialog open={Boolean(selectedStock)} onOpenChange={(open) => { if (!open) { setSelectedStock(null); setSelectedIndicatorKey(null); } }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto border-0 bg-white text-slate-950 sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-3 text-2xl font-black">
              <TrendingUp className="h-6 w-6 text-blue-500" />
              {selectedStock?.name ?? "종목"} 재무 상세
            </DialogTitle>
            <DialogDescription>
              네이버 금융 기준 기본 지표 12개와 최근 분기별 실적을 확인하고, 야후 가격 이력 기반 RSI·스토캐스틱·52주 고저점 이격도 등 보조지표를 함께 봅니다.
            </DialogDescription>
          </DialogHeader>

          {!selectedStock ? null : financialDetail.isLoading ? (
            <div className="flex min-h-56 items-center justify-center rounded-3xl bg-slate-50 text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 재무 상세 정보를 불러오는 중입니다.
            </div>
          ) : financialDetail.error ? (
            <div className="space-y-5">
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
                <p className="font-semibold">재무지표 자동 수집에 실패했습니다.</p>
                <p className="mt-2">{financialDetail.error.message} 네이버 금융 페이지 구조 변경, 일시적 차단, 외부 응답 지연이 원인일 수 있습니다.</p>
                <p className="mt-2">수동 확인이 필요하면 네이버 금융에서 종목코드 <span className="font-black">{selectedStock.code}</span>를 검색한 뒤, 종목분석의 주요재무정보 표에서 PER, PBR, 시가총액, 분기별 매출·영업이익·순이익을 확인하세요.</p>
                <a className="mt-3 inline-flex rounded-full bg-white px-4 py-2 text-sm font-bold text-amber-900 underline" href={`https://finance.naver.com/item/main.naver?code=${selectedStock.code}`} target="_blank" rel="noreferrer">네이버 금융 원문 열기</a>
              </div>
              {priceChartPanel}
              {technicalPanel}
            </div>
          ) : financialDetail.data ? (
            <div className="space-y-5">
              <div>
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-950">상단 핵심 카드 12개</h3>
                    <p className="text-sm text-slate-500">회사 크기, 가격 부담, 자본 효율, 재무 안정성, 주주환원, 성장성을 한 번에 비교합니다.</p>
                  </div>
                  <Badge variant="outline" className="w-fit rounded-full bg-slate-50">기본형 12개</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {[
                    { label: "시가총액", value: formatHundredMillionKrw(financialDetail.data.marketCapHundredMillionKrw), reason: "회사 크기" },
                    { label: "PER", value: formatMultiple(financialDetail.data.per), reason: "이익 대비 가격" },
                    { label: "PBR", value: formatMultiple(financialDetail.data.pbr), reason: "자산 대비 가격" },
                    { label: "ROE", value: formatPercent(financialDetail.data.roe), reason: "자본 효율" },
                    { label: "EPS", value: selectedStock ? `${formatNumber(selectedStock.annualEps)}원` : "-", reason: "주당순이익" },
                    { label: "BPS", value: financialDetail.data.bps === null ? "자료 없음" : `${formatNumber(financialDetail.data.bps)}원`, reason: "주당순자산" },
                    { label: "영업이익률", value: formatPercent(financialDetail.data.operatingProfitMargin), reason: "본업 수익성" },
                    { label: "부채비율", value: formatPercent(financialDetail.data.debtRatio), reason: "재무 안정성" },
                    { label: "순차입금", value: formatHundredMillionKrw(financialDetail.data.netBorrowingsHundredMillionKrw), reason: "실질 빚" },
                    { label: "배당수익률", value: formatPercent(financialDetail.data.dividendYield), reason: "주주환원" },
                    { label: "매출 성장률 YoY", value: formatSignedPercent(financialDetail.data.revenueGrowthYoY), reason: "성장성" },
                    { label: "영업이익 성장률 YoY", value: formatSignedPercent(financialDetail.data.operatingProfitGrowthYoY), reason: "이익 성장성" },
                  ].map(card => (
                    <div key={card.label} className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs font-semibold text-slate-500">{card.label}</p>
                        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-slate-500 ring-1 ring-slate-100">{card.reason}</span>
                      </div>
                      <p className="mt-3 break-keep text-xl font-black text-slate-950">{card.value === "-" ? "자료 없음" : card.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto rounded-3xl border border-slate-100">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">분기</th>
                      <th className="px-4 py-3 text-right font-semibold">매출</th>
                      <th className="px-4 py-3 text-right font-semibold">영업이익</th>
                      <th className="px-4 py-3 text-right font-semibold">순이익</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financialDetail.data.quarterly.length ? financialDetail.data.quarterly.map(row => (
                      <tr key={row.period} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-bold text-slate-900">{row.period}</td>
                        <td className="px-4 py-3 text-right">{formatHundredMillionKrw(row.revenue)}</td>
                        <td className="px-4 py-3 text-right">{formatHundredMillionKrw(row.operatingProfit)}</td>
                        <td className="px-4 py-3 text-right">{formatHundredMillionKrw(row.netIncome)}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">최근 분기 실적 표를 찾지 못했습니다.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {priceChartPanel}
              {technicalPanel}
              <p className="text-xs leading-5 text-slate-500">출처: {financialDetail.data.source} · 조회 시각: {formatDateTime(financialDetail.data.fetchedAt)}{financialDetail.data.note ? ` · ${financialDetail.data.note}` : ""}</p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      {indicatorDetailDialog}
    </div>
  );
}
