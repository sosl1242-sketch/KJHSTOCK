import { ResearchReportPanel } from "@/components/ResearchReportPanel";
import { CoinPurpose } from "@/components/CoinPurpose";
import { VisitorChat } from "@/components/VisitorChat";
import { SheetScrollArea } from "@/components/SheetScrollArea";
import { useFuturesResearchReport } from "@/hooks/useFuturesResearchReport";
import "@/styles/market-workspace.css";
import { SortableFuturesHeader } from "@/components/SortableFuturesHeader";
import { sortFuturesRows, type FuturesTableSortKey as SortKey, type FuturesSortDirection as SortDirection } from "@/lib/futuresTableSort";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  fetchAllFuturesRows,
  fetchFuturesTechnicalDetail,
  subscribeAllFuturesTicker,
} from "@/lib/binanceFuturesClient";
import { cn } from "@/lib/utils";
import {
  buildFuturesSelectedSymbolAnalysis,
  summarizeFuturesRows,
  type FuturesBias,
  type FuturesCandle,
  type FuturesMarketRow,
  type FuturesMarketType,
  type FuturesTechnicalIndicators,
  type FuturesSelectedSymbolAnalysis,
} from "@shared/binanceFuturesAnalysis";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bitcoin,
  Clock3,
  DatabaseZap,
  Gauge,
  LineChart as LineChartIcon,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Signal,
  Sparkles,
  Star,
  Target,
  Wifi,
  WifiOff,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type WsStatus = "idle" | "connecting" | "live" | "closed" | "error";

type FuturesSelectionKey = `${FuturesMarketType}:${string}`;
type IndicatorJudgmentTone = "buy" | "watch" | "avoid" | "high" | "low";
type IndicatorJudgment = {
  label: string;
  value: string;
  fairPrice: string;
  verdict: string;
  detail: string;
  tone: IndicatorJudgmentTone;
};
type IndicatorBarRow = {
  label: string;
  value: number;
  displayValue: string;
  fill: string;
};
type StableSymbolChartRow = {
  fullSymbol: string;
};

const MARKET_METADATA_REFRESH_MS = 300_000;
const FAVORITES_STORAGE_KEY = "kjhstock-binance-futures-favorites";
const chartGridStroke = "#e2e8f0";
const chartMutedText = "#64748b";

const sortOptions: Array<{ value: SortKey; label: string; direction: SortDirection }> = [
  { value: "volume24hUsd", label: "거래대금", direction: "desc" },
  { value: "change24hPercent", label: "24h 등락률", direction: "desc" },
  { value: "fundingRate", label: "펀딩비", direction: "desc" },
  { value: "price", label: "가격", direction: "desc" },
  { value: "marketType", label: "마켓", direction: "asc" },
  { value: "symbol", label: "이름", direction: "asc" },
  { value: "baseVolume24h", label: "거래량", direction: "desc" },
  { value: "contractType", label: "계약", direction: "asc" },
  { value: "rank", label: "순위", direction: "asc" },
  { value: "signal", label: "시그널", direction: "desc" },
];


const signalMeta: Record<FuturesBias, { label: string; className: string }> = {
  bullish: { label: "강세", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  neutral: { label: "중립", className: "border-slate-200 bg-slate-50 text-slate-600" },
  bearish: { label: "약세", className: "border-rose-200 bg-rose-50 text-rose-700" },
};

const intervalLabels: Record<string, string> = {
  "15m": "15분",
  "1h": "1시간",
  "4h": "4시간",
  "1d": "1일",
};

function formatUsd(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}T`;
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}M`;
  return `$${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}`;
}

function formatPrice(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  if (value >= 1000) return `$${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}`;
  if (value >= 1) return `$${value.toLocaleString("ko-KR", { maximumFractionDigits: 4 })}`;
  return `$${value.toFixed(6)}`;
}

function formatPercent(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value > 0 ? "+" : ""}${value.toLocaleString("ko-KR", { maximumFractionDigits: digits })}%`;
}

function formatFunding(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(4)}%`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function wsLabel(status: WsStatus) {
  if (status === "live") return "실시간";
  if (status === "connecting") return "연결 중";
  if (status === "error") return "오류";
  if (status === "closed") return "종료";
  return "대기";
}


function buildChartRows(candles: FuturesCandle[]) {
  return candles.slice(-120).map(candle => ({
    time: new Date(candle.openTime).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit" }),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  }));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function compactChartSymbol(symbol: string) {
  return symbol
    .replace(/USDT$/, "")
    .replace(/USDC$/, "")
    .replace(/USD_PERP$/, "")
    .replace(/USD$/, "");
}

function buildVolumeLeaderChartRows(rows: FuturesMarketRow[]) {
  return rows
    .filter(row => row.volume24hUsd > 0)
    .slice()
    .sort((a, b) => b.volume24hUsd - a.volume24hUsd)
    .slice(0, 12)
    .map(row => ({
      symbol: compactChartSymbol(row.symbol),
      fullSymbol: row.symbol,
      volume: row.volume24hUsd,
      change: row.change24hPercent,
      fill: row.change24hPercent >= 0 ? "#10b981" : "#f43f5e",
    }));
}

function buildMomentumChartRows(rows: FuturesMarketRow[]) {
  const gainers = rows
    .filter(row => Number.isFinite(row.change24hPercent))
    .slice()
    .sort((a, b) => b.change24hPercent - a.change24hPercent)
    .slice(0, 6);
  const losers = rows
    .filter(row => Number.isFinite(row.change24hPercent))
    .slice()
    .sort((a, b) => a.change24hPercent - b.change24hPercent)
    .slice(0, 6);

  return [...losers.reverse(), ...gainers].map(row => ({
    symbol: compactChartSymbol(row.symbol),
    fullSymbol: row.symbol,
    change: row.change24hPercent,
    volume: row.volume24hUsd,
    fill: row.change24hPercent >= 0 ? "#059669" : "#e11d48",
  }));
}

function buildFundingPressureChartRows(rows: FuturesMarketRow[]) {
  return rows
    .filter(row => typeof row.fundingRate === "number" && Number.isFinite(row.fundingRate))
    .slice()
    .sort((a, b) => Math.abs((b.fundingRate ?? 0) * 100) - Math.abs((a.fundingRate ?? 0) * 100))
    .slice(0, 12)
    .sort((a, b) => (a.fundingRate ?? 0) - (b.fundingRate ?? 0))
    .map(row => {
      const fundingPercent = (row.fundingRate ?? 0) * 100;
      return {
        symbol: compactChartSymbol(row.symbol),
        fullSymbol: row.symbol,
        funding: fundingPercent,
        fill: fundingPercent >= 0 ? "#0891b2" : "#d97706",
      };
    });
}

function buildSignalDistributionChartRows(rows: FuturesMarketRow[]) {
  return (["bullish", "neutral", "bearish"] as FuturesBias[]).map(signal => {
    const signalRows = rows.filter(row => row.signal === signal);
    const usdM = signalRows.filter(row => row.marketType === "USD-M").length;
    const coinM = signalRows.filter(row => row.marketType === "COIN-M").length;
    const volume = signalRows.reduce((sum, row) => sum + row.volume24hUsd, 0);
    return {
      signal: signalMeta[signal].label,
      usdM,
      coinM,
      total: usdM + coinM,
      volume,
    };
  });
}

function mergeStableChartRows<T extends StableSymbolChartRow>(previousRows: T[], nextRows: T[], limit: number) {
  if (!previousRows.length) return nextRows.slice(0, limit);

  const nextBySymbol = new Map(nextRows.map(row => [row.fullSymbol, row]));
  const usedSymbols = new Set<string>();
  const preservedRows = previousRows
    .map(previousRow => {
      const nextRow = nextBySymbol.get(previousRow.fullSymbol);
      if (!nextRow) return null;
      usedSymbols.add(previousRow.fullSymbol);
      return nextRow;
    })
    .filter((row): row is T => row !== null);
  const appendedRows = nextRows.filter(row => !usedSymbols.has(row.fullSymbol));

  return [...preservedRows, ...appendedRows].slice(0, limit);
}

function chartRowsEqual<T extends Record<string, unknown>>(leftRows: T[], rightRows: T[]) {
  if (leftRows.length !== rightRows.length) return false;
  return leftRows.every((leftRow, index) => JSON.stringify(leftRow) === JSON.stringify(rightRows[index]));
}

function buildIndicatorBarRows(indicators: FuturesTechnicalIndicators): IndicatorBarRow[] {
  return [
    {
      label: "종합",
      value: clamp(indicators.score, 0, 100),
      displayValue: indicatorValue(indicators.score, 1),
      fill: "#0f172a",
    },
    {
      label: "RSI",
      value: clamp(indicators.rsi14, 0, 100),
      displayValue: indicatorValue(indicators.rsi14),
      fill: indicators.rsi14 >= 70 ? "#f59e0b" : indicators.rsi14 <= 30 ? "#06b6d4" : "#6366f1",
    },
    {
      label: "Stoch",
      value: clamp(indicators.stochastic14, 0, 100),
      displayValue: `${indicatorValue(indicators.stochastic14)}%`,
      fill: indicators.stochastic14 >= 80 ? "#f59e0b" : indicators.stochastic14 <= 20 ? "#06b6d4" : "#10b981",
    },
    {
      label: "Boll %B",
      value: clamp(indicators.bollingerPercentB, 0, 100),
      displayValue: `${indicatorValue(indicators.bollingerPercentB)}%`,
      fill: indicators.bollingerPercentB >= 90 ? "#f59e0b" : indicators.bollingerPercentB <= 10 ? "#06b6d4" : "#8b5cf6",
    },
    {
      label: "Vol",
      value: clamp(indicators.volume20Ratio / 2, 0, 100),
      displayValue: `${indicatorValue(indicators.volume20Ratio)}%`,
      fill: indicators.volume20Ratio >= 140 ? "#10b981" : indicators.volume20Ratio <= 70 ? "#f43f5e" : "#64748b",
    },
    {
      label: "ATR",
      value: clamp(indicators.atrPercent * 12, 0, 100),
      displayValue: `${indicatorValue(indicators.atrPercent)}%`,
      fill: indicators.atrPercent >= 7 ? "#d97706" : "#06b6d4",
    },
  ];
}

function rowSelectionKey(row: Pick<FuturesMarketRow, "marketType" | "symbol">): FuturesSelectionKey {
  return `${row.marketType}:${row.symbol}`;
}

function isFavoriteSelectionKey(value: string): value is FuturesSelectionKey {
  return /^(USD-M|COIN-M):[A-Z0-9_]+$/.test(value);
}

function parseFavoriteKeys(value: string | null): FuturesSelectionKey[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    const uniqueKeys: FuturesSelectionKey[] = [];
    const seenKeys = new Set<string>();
    for (const item of parsed) {
      if (typeof item !== "string" || !isFavoriteSelectionKey(item) || seenKeys.has(item)) continue;
      seenKeys.add(item);
      uniqueKeys.push(item);
    }

    return uniqueKeys;
  } catch {
    return [];
  }
}

function serializeFavoriteKeys(keys: FuturesSelectionKey[]) {
  const uniqueKeys: FuturesSelectionKey[] = [];
  const seenKeys = new Set<string>();
  for (const key of keys) {
    if (!isFavoriteSelectionKey(key) || seenKeys.has(key)) continue;
    seenKeys.add(key);
    uniqueKeys.push(key);
  }
  return JSON.stringify(uniqueKeys);
}

function readFavoriteKeysFromStorage() {
  if (typeof window === "undefined") return [];

  try {
    return parseFavoriteKeys(window.localStorage.getItem(FAVORITES_STORAGE_KEY));
  } catch {
    return [];
  }
}

function mergeRowsWithoutLayoutShift(previousRows: FuturesMarketRow[], nextRows: FuturesMarketRow[]) {
  if (!previousRows.length) return nextRows;

  const nextByKey = new Map(nextRows.map(row => [rowSelectionKey(row), row]));
  const usedKeys = new Set<string>();
  const mergedRows = previousRows
    .map(previousRow => {
      const key = rowSelectionKey(previousRow);
      const nextRow = nextByKey.get(key);
      if (!nextRow) return null;
      usedKeys.add(key);
      return {
        ...nextRow,
        rank: previousRow.rank,
      };
    })
    .filter((row): row is FuturesMarketRow => row !== null);

  const appendedRows = nextRows
    .filter(row => !usedKeys.has(rowSelectionKey(row)))
    .map((row, index) => ({
      ...row,
      rank: mergedRows.length + index + 1,
    }));

  return [...mergedRows, ...appendedRows];
}

function SummaryCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof Activity;
}) {
  return (
    <Card className="rounded-lg border-slate-200 bg-white ">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold text-slate-500">{title}</CardTitle>
        <Icon className="h-4 w-4 text-slate-400" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight text-slate-950">{value}</div>
        <p className="mt-1 text-xs font-medium text-slate-500">{detail}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ label, status }: { label: FuturesMarketType; status: WsStatus }) {
  const isLive = status === "live";
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-3 py-1.5",
        isLive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600",
      )}
    >
      {isLive ? <Wifi className="mr-1 h-3.5 w-3.5" /> : <WifiOff className="mr-1 h-3.5 w-3.5" />}
      {label} {wsLabel(status)}
    </Badge>
  );
}

const indicatorToneClass: Record<IndicatorJudgmentTone, string> = {
  buy: "border-emerald-200 bg-emerald-50 text-emerald-800",
  watch: "border-slate-200 bg-slate-50 text-slate-700",
  avoid: "border-rose-200 bg-rose-50 text-rose-800",
  high: "border-amber-200 bg-amber-50 text-amber-800",
  low: "border-cyan-200 bg-cyan-50 text-cyan-800",
};

function IndicatorCard({ indicator }: { indicator: IndicatorJudgment }) {
  return (
    <div className="min-h-[154px] rounded-lg border border-slate-200 bg-white p-3 ">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-slate-500">{indicator.label}</p>
        <Badge variant="outline" className={cn("shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold", indicatorToneClass[indicator.tone])}>
          {indicator.verdict}
        </Badge>
      </div>
      <p className="mt-2 break-words text-lg font-semibold tabular-nums text-slate-950">{indicator.value}</p>
      <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-slate-400">지표 적정가</span>
          <span className="text-sm font-semibold tabular-nums text-slate-950">{indicator.fairPrice}</span>
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{indicator.detail}</p>
    </div>
  );
}

function indicatorValue(value: number, digits = 2) {
  return value.toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

function fairPriceFromOffset(basePrice: number, offset: number) {
  if (!Number.isFinite(basePrice) || basePrice <= 0) return basePrice;
  return basePrice * (1 + offset);
}

function weightedFairPrice(values: Array<{ price: number; weight: number }>) {
  const validValues = values.filter(item => Number.isFinite(item.price) && item.price > 0 && Number.isFinite(item.weight) && item.weight > 0);
  const totalWeight = validValues.reduce((sum, item) => sum + item.weight, 0);
  if (!validValues.length || totalWeight <= 0) return null;
  return validValues.reduce((sum, item) => sum + item.price * item.weight, 0) / totalWeight;
}

function formatFairPrice(value: number | null | undefined) {
  return formatPrice(value);
}

function buildIndicatorJudgments(indicators: FuturesTechnicalIndicators, row: FuturesMarketRow | undefined): IndicatorJudgment[] {
  const latestClose = indicators.latestClose;
  const bollingerWidthPercent = indicators.bollingerMiddle === 0
    ? 0
    : ((indicators.bollingerUpper - indicators.bollingerLower) / indicators.bollingerMiddle) * 100;
  const dayRange = row ? row.high24h - row.low24h : 0;
  const dayPosition = row && dayRange > 0 ? ((row.price - row.low24h) / dayRange) * 100 : 50;
  const dayMidpoint = row && dayRange > 0 ? (row.high24h + row.low24h) / 2 : latestClose;
  const scoreFairPrice = fairPriceFromOffset(latestClose, clamp((indicators.score - 50) / 500, -0.08, 0.08));
  const rsiFairPrice = fairPriceFromOffset(latestClose, clamp((50 - indicators.rsi14) / 300, -0.12, 0.12));
  const emaFairPrice = weightedFairPrice([
    { price: indicators.ema20, weight: 0.65 },
    { price: indicators.ema50, weight: 0.35 },
  ]);
  const macdHistogramFairPrice = fairPriceFromOffset(latestClose, clamp((indicators.macdHistogram / latestClose) * 2, -0.08, 0.08));
  const macdCrossFairPrice = fairPriceFromOffset(latestClose, clamp(((indicators.macd - indicators.macdSignal) / latestClose) * 2, -0.08, 0.08));
  const bollingerFairPrice = weightedFairPrice([
    { price: indicators.bollingerMiddle, weight: 0.7 },
    { price: latestClose, weight: 0.3 },
  ]);
  const volatilityDiscount = clamp((indicators.atrPercent - 3) / 200, -0.03, 0.08);
  const atrFairPrice = fairPriceFromOffset(latestClose, -volatilityDiscount);
  const stochasticFairPrice = fairPriceFromOffset(latestClose, clamp((50 - indicators.stochastic14) / 300, -0.12, 0.12));
  const volumeFairPrice = fairPriceFromOffset(latestClose, clamp((indicators.volume20Ratio - 100) / 1000, -0.06, 0.08));

  const scoreJudgment: IndicatorJudgment = indicators.score >= 65
    ? { label: "종합 점수", value: indicatorValue(indicators.score, 1), fairPrice: formatFairPrice(scoreFairPrice), verdict: "추천", tone: "buy", detail: "여러 지표가 같은 방향으로 기울었습니다." }
    : indicators.score <= 40
      ? { label: "종합 점수", value: indicatorValue(indicators.score, 1), fairPrice: formatFairPrice(scoreFairPrice), verdict: "비추천", tone: "avoid", detail: "추세와 모멘텀 점수가 약합니다." }
      : { label: "종합 점수", value: indicatorValue(indicators.score, 1), fairPrice: formatFairPrice(scoreFairPrice), verdict: "관망", tone: "watch", detail: "방향성이 아직 충분히 선명하지 않습니다." };

  const rsiJudgment: IndicatorJudgment = indicators.rsi14 >= 70
    ? { label: "RSI 14", value: indicatorValue(indicators.rsi14), fairPrice: formatFairPrice(rsiFairPrice), verdict: "고점 경계", tone: "high", detail: "단기 과열권입니다. 추격 진입은 부담입니다." }
    : indicators.rsi14 <= 30
      ? { label: "RSI 14", value: indicatorValue(indicators.rsi14), fairPrice: formatFairPrice(rsiFairPrice), verdict: "저점 후보", tone: "low", detail: "과매도권입니다. 반등 확인이 필요합니다." }
      : indicators.rsi14 >= 55
        ? { label: "RSI 14", value: indicatorValue(indicators.rsi14), fairPrice: formatFairPrice(rsiFairPrice), verdict: "추천", tone: "buy", detail: "매수 압력이 우세한 구간입니다." }
        : indicators.rsi14 <= 45
          ? { label: "RSI 14", value: indicatorValue(indicators.rsi14), fairPrice: formatFairPrice(rsiFairPrice), verdict: "비추천", tone: "avoid", detail: "모멘텀이 약한 구간입니다." }
          : { label: "RSI 14", value: indicatorValue(indicators.rsi14), fairPrice: formatFairPrice(rsiFairPrice), verdict: "관망", tone: "watch", detail: "중립권이라 단독 판단은 어렵습니다." };

  const emaTrend = indicators.ema20 >= indicators.ema50;
  const macdPositive = indicators.macdHistogram >= 0;
  const macdCrossPositive = indicators.macd >= indicators.macdSignal;
  const priceAboveEma20 = latestClose >= indicators.ema20;

  return [
    scoreJudgment,
    rsiJudgment,
    {
      label: "EMA 20 / 50",
      value: `${formatPrice(indicators.ema20)} / ${formatPrice(indicators.ema50)}`,
      fairPrice: formatFairPrice(emaFairPrice),
      verdict: emaTrend ? "추천" : "비추천",
      tone: emaTrend ? "buy" : "avoid",
      detail: emaTrend ? "단기 평균이 중기 평균 위에 있습니다." : "단기 평균이 중기 평균 아래에 있습니다.",
    },
    {
      label: "가격 / EMA20",
      value: `${formatPrice(latestClose)} / ${formatPrice(indicators.ema20)}`,
      fairPrice: formatFairPrice(indicators.ema20),
      verdict: priceAboveEma20 ? "추천" : "비추천",
      tone: priceAboveEma20 ? "buy" : "avoid",
      detail: priceAboveEma20 ? "현재가가 단기 추세선 위입니다." : "현재가가 단기 추세선 아래입니다.",
    },
    {
      label: "MACD Histogram",
      value: indicators.macdHistogram.toLocaleString("ko-KR", { maximumFractionDigits: 6 }),
      fairPrice: formatFairPrice(macdHistogramFairPrice),
      verdict: macdPositive ? "추천" : "비추천",
      tone: macdPositive ? "buy" : "avoid",
      detail: macdPositive ? "상승 모멘텀이 우세합니다." : "하락 모멘텀이 우세합니다.",
    },
    {
      label: "MACD / Signal",
      value: `${indicatorValue(indicators.macd, 6)} / ${indicatorValue(indicators.macdSignal, 6)}`,
      fairPrice: formatFairPrice(macdCrossFairPrice),
      verdict: macdCrossPositive ? "추천" : "비추천",
      tone: macdCrossPositive ? "buy" : "avoid",
      detail: macdCrossPositive ? "MACD가 시그널 위에 있습니다." : "MACD가 시그널 아래에 있습니다.",
    },
    {
      label: "Bollinger %B",
      value: `${indicatorValue(indicators.bollingerPercentB)}%`,
      fairPrice: formatFairPrice(bollingerFairPrice),
      verdict: indicators.bollingerPercentB >= 90 ? "고점 경계" : indicators.bollingerPercentB <= 10 ? "저점 후보" : indicators.bollingerPercentB >= 50 ? "추천" : "비추천",
      tone: indicators.bollingerPercentB >= 90 ? "high" : indicators.bollingerPercentB <= 10 ? "low" : indicators.bollingerPercentB >= 50 ? "buy" : "avoid",
      detail: indicators.bollingerPercentB >= 90 ? "상단 밴드에 가까워 과열을 점검합니다." : indicators.bollingerPercentB <= 10 ? "하단 밴드에 가까워 반등 후보입니다." : "밴드 안의 상대 위치를 확인합니다.",
    },
    {
      label: "Bollinger 폭",
      value: `${indicatorValue(bollingerWidthPercent)}%`,
      fairPrice: formatFairPrice(indicators.bollingerMiddle),
      verdict: bollingerWidthPercent >= 12 ? "고변동" : bollingerWidthPercent <= 4 ? "압축" : "관망",
      tone: bollingerWidthPercent >= 12 ? "high" : bollingerWidthPercent <= 4 ? "watch" : "watch",
      detail: bollingerWidthPercent >= 12 ? "밴드가 넓어 손절폭 관리가 필요합니다." : bollingerWidthPercent <= 4 ? "변동성 압축 후 돌파를 기다립니다." : "평균적인 변동성 구간입니다.",
    },
    {
      label: "ATR %",
      value: `${indicatorValue(indicators.atrPercent)}%`,
      fairPrice: formatFairPrice(atrFairPrice),
      verdict: indicators.atrPercent >= 7 ? "고위험" : indicators.atrPercent <= 2 ? "관망" : "추천",
      tone: indicators.atrPercent >= 7 ? "high" : indicators.atrPercent <= 2 ? "watch" : "buy",
      detail: indicators.atrPercent >= 7 ? "가격 흔들림이 커서 진입 크기를 줄입니다." : indicators.atrPercent <= 2 ? "움직임이 작아 돌파 확인이 필요합니다." : "거래 가능한 변동성입니다.",
    },
    {
      label: "Stochastic 14",
      value: `${indicatorValue(indicators.stochastic14)}%`,
      fairPrice: formatFairPrice(stochasticFairPrice),
      verdict: indicators.stochastic14 >= 80 ? "고점 경계" : indicators.stochastic14 <= 20 ? "저점 후보" : indicators.stochastic14 >= 50 ? "추천" : "비추천",
      tone: indicators.stochastic14 >= 80 ? "high" : indicators.stochastic14 <= 20 ? "low" : indicators.stochastic14 >= 50 ? "buy" : "avoid",
      detail: indicators.stochastic14 >= 80 ? "단기 위치가 상단권입니다." : indicators.stochastic14 <= 20 ? "단기 위치가 하단권입니다." : "단기 위치가 방향 판단을 보조합니다.",
    },
    {
      label: "Volume / 20",
      value: `${indicatorValue(indicators.volume20Ratio)}%`,
      fairPrice: formatFairPrice(volumeFairPrice),
      verdict: indicators.volume20Ratio >= 140 ? "추천" : indicators.volume20Ratio <= 70 ? "비추천" : "관망",
      tone: indicators.volume20Ratio >= 140 ? "buy" : indicators.volume20Ratio <= 70 ? "avoid" : "watch",
      detail: indicators.volume20Ratio >= 140 ? "평균보다 거래량이 붙었습니다." : indicators.volume20Ratio <= 70 ? "거래 참여가 약합니다." : "거래량은 평균권입니다.",
    },
    {
      label: "24h 위치",
      value: `${indicatorValue(dayPosition)}%`,
      fairPrice: formatFairPrice(dayMidpoint),
      verdict: dayPosition >= 85 ? "고점 경계" : dayPosition <= 15 ? "저점 후보" : dayPosition >= 55 ? "추천" : "비추천",
      tone: dayPosition >= 85 ? "high" : dayPosition <= 15 ? "low" : dayPosition >= 55 ? "buy" : "avoid",
      detail: dayPosition >= 85 ? "24h 고가권에 가까워 추격을 경계합니다." : dayPosition <= 15 ? "24h 저가권에 가까워 반등 여부를 봅니다." : "24h 범위 안의 위치를 확인합니다.",
    },
  ];
}

function MarketChartPanel({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 ">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <BarChart3 className="h-4 w-4 text-slate-500" />
            {title}
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
        </div>
      </div>
      <div className="h-64">{children}</div>
    </section>
  );
}

function EmptyChartState() {
  return (
    <div className="flex h-full items-center justify-center rounded-lg bg-slate-50 text-sm font-semibold text-slate-500">
      데이터 대기
    </div>
  );
}

function MarketVisualBoard({ rows }: { rows: FuturesMarketRow[] }) {
  const volumeRows = useMemo(() => buildVolumeLeaderChartRows(rows), [rows]);
  const momentumRows = useMemo(() => buildMomentumChartRows(rows), [rows]);
  const fundingRows = useMemo(() => buildFundingPressureChartRows(rows), [rows]);
  const signalRows = useMemo(() => buildSignalDistributionChartRows(rows), [rows]);
  const [stableVolumeRows, setStableVolumeRows] = useState(volumeRows);
  const [stableMomentumRows, setStableMomentumRows] = useState(momentumRows);
  const [stableFundingRows, setStableFundingRows] = useState(fundingRows);

  useEffect(() => {
    setStableVolumeRows(previousRows => {
      const mergedRows = mergeStableChartRows(previousRows, volumeRows, 12);
      return chartRowsEqual(previousRows, mergedRows) ? previousRows : mergedRows;
    });
  }, [volumeRows]);

  useEffect(() => {
    setStableMomentumRows(previousRows => {
      const mergedRows = mergeStableChartRows(previousRows, momentumRows, 12);
      return chartRowsEqual(previousRows, mergedRows) ? previousRows : mergedRows;
    });
  }, [momentumRows]);

  useEffect(() => {
    setStableFundingRows(previousRows => {
      const mergedRows = mergeStableChartRows(previousRows, fundingRows, 12);
      return chartRowsEqual(previousRows, mergedRows) ? previousRows : mergedRows;
    });
  }, [fundingRows]);

  return (
    <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
      <MarketChartPanel title="거래대금 상위 12" detail="24h 달러 거래대금 기준입니다. 막대 색은 24h 방향입니다.">
        {stableVolumeRows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stableVolumeRows} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="symbol" tick={{ fontSize: 10, fill: chartMutedText }} tickLine={false} axisLine={false} interval={0} angle={-28} textAnchor="end" height={48} />
              <YAxis tick={{ fontSize: 10, fill: chartMutedText }} tickFormatter={value => formatUsd(Number(value))} width={58} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(value, name) => {
                  if (name === "volume") return [formatUsd(Number(value)), "거래대금"];
                  return [String(value), String(name)];
                }}
                labelFormatter={(_label, payload: any) => payload?.[0]?.payload?.fullSymbol ?? ""}
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
              />
              <Bar dataKey="volume" radius={[5, 5, 0, 0]} isAnimationActive={false}>
                {stableVolumeRows.map(row => (
                  <Cell key={row.fullSymbol} fill={row.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState />
        )}
      </MarketChartPanel>

      <MarketChartPanel title="24h 모멘텀 양극단" detail="상승률 상위 6개와 하락률 하위 6개를 동시에 비교합니다.">
        {stableMomentumRows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stableMomentumRows} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="symbol" tick={{ fontSize: 10, fill: chartMutedText }} tickLine={false} axisLine={false} interval={0} angle={-28} textAnchor="end" height={48} />
              <YAxis tick={{ fontSize: 10, fill: chartMutedText }} tickFormatter={value => `${Number(value).toFixed(0)}%`} width={44} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(value, name) => {
                  if (name === "change") return [formatPercent(Number(value)), "24h"];
                  return [String(value), String(name)];
                }}
                labelFormatter={(_label, payload: any) => payload?.[0]?.payload?.fullSymbol ?? ""}
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
              />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
              <Bar dataKey="change" radius={[5, 5, 0, 0]} isAnimationActive={false}>
                {stableMomentumRows.map(row => (
                  <Cell key={row.fullSymbol} fill={row.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState />
        )}
      </MarketChartPanel>

      <MarketChartPanel title="펀딩비 압력" detail="절대값이 큰 펀딩비 종목입니다. 0선에서 멀수록 포지션 비용 압력이 큽니다.">
        {stableFundingRows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stableFundingRows} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="symbol" tick={{ fontSize: 10, fill: chartMutedText }} tickLine={false} axisLine={false} interval={0} angle={-28} textAnchor="end" height={48} />
              <YAxis tick={{ fontSize: 10, fill: chartMutedText }} tickFormatter={value => `${Number(value).toFixed(2)}%`} width={54} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(value, name) => {
                  if (name === "funding") return [`${Number(value).toFixed(4)}%`, "펀딩비"];
                  return [String(value), String(name)];
                }}
                labelFormatter={(_label, payload: any) => payload?.[0]?.payload?.fullSymbol ?? ""}
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
              />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
              <Bar dataKey="funding" radius={[5, 5, 0, 0]} isAnimationActive={false}>
                {stableFundingRows.map(row => (
                  <Cell key={row.fullSymbol} fill={row.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState />
        )}
      </MarketChartPanel>

      <MarketChartPanel title="시그널 분포" detail="강세·중립·약세 계약 수를 USD-M과 COIN-M으로 나눠 봅니다.">
        {signalRows.some(row => row.total > 0) ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={signalRows} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="signal" tick={{ fontSize: 11, fill: chartMutedText }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: chartMutedText }} width={44} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(value, name) => {
                  if (name === "usdM") return [Number(value).toLocaleString("ko-KR"), "USD-M"];
                  if (name === "coinM") return [Number(value).toLocaleString("ko-KR"), "COIN-M"];
                  return [String(value), String(name)];
                }}
                labelFormatter={label => `${label} 시그널`}
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
              />
              <Bar dataKey="usdM" stackId="signal" fill="#06b6d4" radius={[0, 0, 4, 4]} isAnimationActive={false} />
              <Bar dataKey="coinM" stackId="signal" fill="#8b5cf6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState />
        )}
      </MarketChartPanel>
    </section>
  );
}

const selectedAnalysisToneClass: Record<FuturesSelectedSymbolAnalysis["tone"], string> = {
  strong: "border-emerald-200 bg-emerald-50 text-emerald-800",
  buy: "border-cyan-200 bg-cyan-50 text-cyan-800",
  watch: "border-slate-200 bg-slate-50 text-slate-700",
  pullback: "border-indigo-200 bg-indigo-50 text-indigo-800",
  risk: "border-rose-200 bg-rose-50 text-rose-800",
};

function SelectedSymbolAnalysisPanel({ analysis }: { analysis: FuturesSelectedSymbolAnalysis }) {
  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 ">
      <div className="rounded-lg bg-slate-950 p-4 text-white">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Selected Symbol Thesis</p>
            <h4 className="mt-1 text-lg font-semibold">종목 종합분석</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={cn("rounded-md border-white/15 bg-white px-2 py-1 text-xs font-semibold", selectedAnalysisToneClass[analysis.tone])}>
              {analysis.verdict}
            </Badge>
            <Badge className="rounded-md bg-white text-slate-950 hover:bg-white">종합 {analysis.score}</Badge>
          </div>
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-white">{analysis.headline}</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[
          ["현재가", analysis.levels.current],
          ["지지", analysis.levels.support],
          ["무효화", analysis.levels.riskLine],
          ["적정 구간", analysis.levels.fairZone],
          ["저항", analysis.levels.resistance],
          ["돌파", analysis.levels.breakout],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md bg-slate-50 p-2.5">
            <p className="text-[11px] font-semibold text-slate-400">{label}</p>
            <p className="mt-1 break-words text-sm font-semibold text-slate-950">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-2">
        {analysis.evidence.map(item => (
          <div key={item.label} className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500">{item.label}</p>
              <Badge variant="outline" className="shrink-0 rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                {item.verdict}
              </Badge>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">{item.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        <div className="rounded-md border border-emerald-100 bg-emerald-50 p-3">
          <p className="text-xs font-semibold text-emerald-900">강점</p>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-emerald-950">
            {analysis.strengths.map(item => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-md border border-rose-100 bg-rose-50 p-3">
          <p className="text-xs font-semibold text-rose-900">리스크</p>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-rose-950">
            {analysis.risks.map(item => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-rose-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-500">가격 시나리오</p>
        <div className="mt-2 grid gap-2">
          {analysis.scenarios.map(item => (
            <div key={item.title} className="rounded-md bg-white p-2.5">
              <p className="text-xs font-semibold text-slate-950">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{item.trigger}</p>
              <p className="mt-1 text-xs leading-5 text-slate-700">{item.expectation}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-md bg-slate-950 p-3 text-white">
        <p className="flex items-center gap-2 text-xs font-semibold">
          <Target className="h-3.5 w-3.5 text-cyan-300" />
          실행 체크
        </p>
        <ol className="mt-2 space-y-2 text-xs leading-5 text-slate-200">
          {analysis.actionPlan.map((item, index) => (
            <li key={item} className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white text-[10px] font-semibold text-slate-950">{index + 1}</span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function TechnicalPanel({
  row,
  interval,
  onIntervalChange,
  loading,
  error,
  indicators,
  candles,
}: {
  row: FuturesMarketRow | undefined;
  interval: string;
  onIntervalChange: (value: string) => void;
  loading: boolean;
  error: string | null;
  indicators: FuturesTechnicalIndicators | null;
  candles: FuturesCandle[];
}) {
  const chartRows = useMemo(() => buildChartRows(candles), [candles]);
  const indicatorJudgments = useMemo(() => indicators ? buildIndicatorJudgments(indicators, row) : [], [indicators, row]);
  const indicatorBars = useMemo(() => indicators ? buildIndicatorBarRows(indicators) : [], [indicators]);
  const selectedAnalysis = useMemo(
    () => row && indicators ? buildFuturesSelectedSymbolAnalysis(row, indicators) : null,
    [indicators, row],
  );
  const latestChartClose = chartRows[chartRows.length - 1]?.close;
  const bias = indicators?.bias ?? row?.signal ?? "neutral";

  return (
    <aside className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 ">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">선택한 계약</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">{row?.symbol ?? "선택 없음"}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {row ? `${row.marketType} · ${row.pair} · ${row.contractType}` : "Binance Futures"}
            </p>
          </div>
          <Badge variant="outline" className={cn("rounded-md px-2 py-1", signalMeta[bias].className)}>
            {signalMeta[bias].label}
          </Badge>
        </div>

        <CoinPurpose row={row} />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">현재가</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{formatPrice(row?.price)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">24h</p>
            <p className={cn("mt-1 text-lg font-semibold", (row?.change24hPercent ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700")}>
              {formatPercent(row?.change24hPercent)}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">거래대금</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{formatUsd(row?.volume24hUsd)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">펀딩비</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{formatFunding(row?.fundingRate)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 ">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-slate-950">
              <Gauge className="h-4 w-4 text-cyan-700" />
              기술적 지표
            </h3>
            <p className="mt-1 text-xs text-slate-500">12개 지표별 추천·비추천·고점·저점 판단과 지표 적정가</p>
          </div>
          <div className="flex items-center gap-2">
            {loading && indicators ? (
              <Badge variant="outline" className="rounded-md bg-slate-50 text-slate-600">
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                값 갱신 중
              </Badge>
            ) : null}
            <Select value={interval} onValueChange={onIntervalChange}>
              <SelectTrigger aria-label="차트 시간 간격" className="h-9 w-28 rounded-md bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(intervalLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading && !indicators ? (
          <div className="mt-4 flex h-40 items-center justify-center rounded-lg bg-slate-50 text-sm font-semibold text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            지표 계산 중
          </div>
        ) : error ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error}</div>
        ) : indicators ? (
          <>
            {selectedAnalysis ? <SelectedSymbolAnalysisPanel analysis={selectedAnalysis} /> : null}
            <div className="mt-4 rounded-lg bg-slate-950 p-4 text-white">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-400">종합 점수</p>
                  <p className="mt-1 text-4xl font-semibold">{indicators.score}</p>
                </div>
                <Badge className="rounded-md bg-white text-slate-950 hover:bg-white">{signalMeta[indicators.bias].label}</Badge>
              </div>
              <div className="mt-4 h-2 rounded-full bg-white/15">
                <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${indicators.score}%` }} />
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-950">지표 위치 막대</h4>
                  <p className="mt-1 text-xs text-slate-500">핵심 보조지표를 0-100 스케일로 정규화해 빠르게 비교합니다.</p>
                </div>
                <Badge variant="outline" className="rounded-md bg-white text-slate-600">50 기준선</Badge>
              </div>
              <div className="mt-3 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={indicatorBars} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: chartMutedText }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: chartMutedText, fontWeight: 700 }} width={58} tickLine={false} axisLine={false} />
                    <Tooltip
                      formatter={(value, name, payload: any) => {
                        if (name === "value") return [payload?.payload?.displayValue ?? indicatorValue(Number(value)), "현재값"];
                        return [String(value), String(name)];
                      }}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
                    />
                    <ReferenceLine x={50} stroke="#94a3b8" strokeDasharray="4 4" />
                    <Bar dataKey="value" radius={[0, 5, 5, 0]} isAnimationActive={false}>
                      {indicatorBars.map(row => (
                        <Cell key={row.label} fill={row.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-3">
              {indicatorJudgments.map(indicator => (
                <IndicatorCard key={indicator.label} indicator={indicator} />
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 ">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-950">
          <LineChartIcon className="h-4 w-4 text-cyan-600" />
          가격·거래량 흐름
        </h3>
        <div className="mt-4 h-64">
          {chartRows.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartRows} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: chartMutedText }} tickLine={false} axisLine={false} minTickGap={26} />
                <YAxis yAxisId="price" tick={{ fontSize: 11, fill: chartMutedText }} tickFormatter={value => formatPrice(Number(value))} width={72} tickLine={false} axisLine={false} />
                <YAxis yAxisId="volume" orientation="right" hide />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === "volume") return [Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 0 }), "거래량"];
                    const labelMap: Record<string, string> = { close: "종가", high: "고가", low: "저가", open: "시가" };
                    return [formatPrice(Number(value)), labelMap[String(name)] ?? String(name)];
                  }}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
                />
                {typeof latestChartClose === "number" ? (
                  <ReferenceLine yAxisId="price" y={latestChartClose} stroke="#0f172a" strokeDasharray="5 5" />
                ) : null}
                <Bar yAxisId="volume" dataKey="volume" fill="#cbd5e1" opacity={0.45} isAnimationActive={false} />
                <Line yAxisId="price" type="monotone" dataKey="high" stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.4} dot={false} isAnimationActive={false} />
                <Line yAxisId="price" type="monotone" dataKey="low" stroke="#38bdf8" strokeDasharray="4 4" strokeWidth={1.4} dot={false} isAnimationActive={false} />
                <Line yAxisId="price" type="monotone" dataKey="close" stroke="#0891b2" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-500">차트 데이터 없음</div>
          )}
        </div>
      </section>
    </aside>
  );
}

export default function BinanceFutures() {
  const detailPanelRef = useRef<HTMLDivElement>(null);
  const sheetTabRef = useRef<HTMLButtonElement>(null);
  const sheetScrollRef = useRef<HTMLDivElement>(null);
  const moveFocusAfterNavigation = useRef(false);
  const [activeView, setActiveView] = useState("sheet");
  const research = useFuturesResearchReport(activeView === "reports");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<FuturesMarketRow[]>([]);
  const [selectedKey, setSelectedKey] = useState<FuturesSelectionKey | "">("");
  const [query, setQuery] = useState("");
  const [assetFilter, setAssetFilter] = useState("crypto");
  const [marketFilter, setMarketFilter] = useState("all");
  const [quoteFilter, setQuoteFilter] = useState("all");
  const [signalFilter, setSignalFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("volume24hUsd");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [interval, setInterval] = useState("1h");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadataLastRefreshedAt, setMetadataLastRefreshedAt] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<Record<FuturesMarketType, WsStatus>>({ "USD-M": "idle", "COIN-M": "idle" });
  const [technicalLoading, setTechnicalLoading] = useState(false);
  const [technicalError, setTechnicalError] = useState<string | null>(null);
  const [technical, setTechnical] = useState<{ key: string; candles: FuturesCandle[]; indicators: FuturesTechnicalIndicators } | null>(null);
  const [favoriteKeys, setFavoriteKeys] = useState<FuturesSelectionKey[]>(readFavoriteKeysFromStorage);
  const [favoriteOnly, setFavoriteOnly] = useState(false);

  const reload = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setRefreshing(true);
    setError(null);
    try {
      const nextRows = await fetchAllFuturesRows();
      setRows(previousRows => mergeRowsWithoutLayoutShift(previousRows, nextRows));
      setMetadataLastRefreshedAt(new Date().toISOString());
      setSelectedKey(previous => {
        if (previous && nextRows.some(row => rowSelectionKey(row) === previous)) return previous;
        const fallback = nextRows.find(row => row.symbol === "BTCUSDT")
          ?? nextRows.find(row => row.symbol === "BTCUSD_PERP")
          ?? nextRows[0];
        return fallback ? rowSelectionKey(fallback) : "";
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Binance 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
      if (!silent) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    try {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, serializeFavoriteKeys(favoriteKeys));
    } catch {
      // Browsers may reject localStorage in private mode or strict privacy settings.
    }
  }, [favoriteKeys]);

  useEffect(() => {
    if (!rows.length) return;
    return subscribeAllFuturesTicker(setRows, (marketType, status) => {
      setWsStatus(previous => ({ ...previous, [marketType]: status }));
    });
  }, [rows.length]);

  useEffect(() => {
    if (!rows.length) return;
    const timer = window.setInterval(() => {
      void reload({ silent: true });
    }, MARKET_METADATA_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [reload, rows.length]);


  const selectedRow = useMemo(() => rows.find(row => rowSelectionKey(row) === selectedKey), [rows, selectedKey]);
  const selectedTechnicalKey = selectedRow ? `${rowSelectionKey(selectedRow)}:${interval}` : "";
  const activeTechnical = technical?.key === selectedTechnicalKey ? technical : null;

  useEffect(() => {
    if (!selectedRow) return;
    const controller = new AbortController();
    const requestKey = `${rowSelectionKey(selectedRow)}:${interval}`;
    setTechnicalLoading(true);
    setTechnicalError(null);
    fetchFuturesTechnicalDetail(selectedRow.symbol, selectedRow.marketType, interval, controller.signal)
      .then(detail => setTechnical({ key: requestKey, ...detail }))
      .catch(loadError => {
        if (controller.signal.aborted) return;
        setTechnicalError(loadError instanceof Error ? loadError.message : "기술적 지표를 계산하지 못했습니다.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setTechnicalLoading(false);
      });
    return () => controller.abort();
  }, [selectedKey, selectedRow?.marketType, selectedRow?.symbol, interval]);

  const summary = useMemo(() => summarizeFuturesRows(rows), [rows]);
  const quoteAssets = useMemo(() => Array.from(new Set(rows.map(row => row.quoteAsset))).sort(), [rows]);
  const favoriteKeySet = useMemo(() => new Set(favoriteKeys), [favoriteKeys]);
  const favoriteRows = useMemo(() => {
    const rowsByKey = new Map(rows.map(row => [rowSelectionKey(row), row]));
    return favoriteKeys
      .map(key => rowsByKey.get(key))
      .filter((row): row is FuturesMarketRow => Boolean(row));
  }, [favoriteKeys, rows]);
  const marketCounts = useMemo(() => {
    const usdM = rows.filter(row => row.marketType === "USD-M").length;
    const coinM = rows.filter(row => row.marketType === "COIN-M").length;
    return { usdM, coinM };
  }, [rows]);

  const toggleFavorite = useCallback((row: Pick<FuturesMarketRow, "marketType" | "symbol">) => {
    const key = rowSelectionKey(row);
    setFavoriteKeys(current => {
      if (current.includes(key)) return current.filter(favoriteKey => favoriteKey !== key);
      return [key, ...current];
    });
  }, []);

  const onSelectFavorite = useCallback((key: FuturesSelectionKey) => {
    setSelectedKey(key);
    moveFocusAfterNavigation.current = true;
    setActiveView("detail");
  }, []);

  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toUpperCase();
    const filtered = rows.filter(row => {
      const matchesQuery =
        !normalizedQuery ||
        row.symbol.includes(normalizedQuery) ||
        row.baseAsset.includes(normalizedQuery) ||
        row.pair.includes(normalizedQuery);
      const matchesMarket = marketFilter === "all" || row.marketType === marketFilter;
      const matchesAsset = assetFilter === "all" || row.assetClass === assetFilter;
      const matchesQuote = quoteFilter === "all" || row.quoteAsset === quoteFilter;
      const matchesSignal = signalFilter === "all" || row.signal === signalFilter;
      const matchesFavorite = !favoriteOnly || favoriteKeySet.has(rowSelectionKey(row));
      return matchesQuery && matchesAsset && matchesMarket && matchesQuote && matchesSignal && matchesFavorite;
    });
    return sortFuturesRows(filtered, sortKey, sortDirection);
  }, [query, assetFilter, favoriteKeySet, favoriteOnly, marketFilter, quoteFilter, rows, signalFilter, sortDirection, sortKey]);

  const pageCount = Math.max(1, Math.ceil(visibleRows.length / 50));
  const currentPage = Math.min(page, pageCount);
  const pageRows = visibleRows.slice((currentPage - 1) * 50, currentPage * 50);
  useEffect(() => { setPage(1); }, [query, assetFilter, marketFilter, quoteFilter, signalFilter, favoriteOnly, sortKey, sortDirection]);
  useEffect(() => { setPage(previous => Math.min(previous, pageCount)); }, [pageCount]);
  useEffect(() => { if (sheetScrollRef.current) sheetScrollRef.current.scrollTop = 0; }, [page, query, assetFilter, marketFilter, quoteFilter, signalFilter, favoriteOnly, sortKey, sortDirection]);
  useEffect(() => {
    if (!moveFocusAfterNavigation.current) return;
    // Tabs retain a hidden panel shell; focus after Radix reveals its content.
    const frame = requestAnimationFrame(() => {
      const target = activeView === "detail" ? detailPanelRef.current : sheetTabRef.current;
      target?.focus();
      moveFocusAfterNavigation.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [activeView]);
  const onSort = (key: SortKey) => {
    setSortDirection(sortKey === key ? (sortDirection === "asc" ? "desc" : "asc") : sortOptions.find(option => option.value === key)?.direction ?? "desc");
    setSortKey(key);
    setPage(1);
  };
  const resetFilters = () => { setQuery(""); setAssetFilter("crypto"); setMarketFilter("all"); setQuoteFilter("all"); setSignalFilter("all"); setFavoriteOnly(false); setPage(1); };
  const selectContract = (key: FuturesSelectionKey) => { setSelectedKey(key); moveFocusAfterNavigation.current = true; setActiveView("detail"); };
  const sortLabel = sortOptions.find(option => option.value === sortKey)?.label;
  const header = (label: string, key: SortKey, numeric = false, sticky = false) => <SortableFuturesHeader label={label} sortKey={key} activeKey={sortKey} direction={sortDirection} onSort={onSort} numeric={numeric} sticky={sticky} />;

  return (
    <div className="market-workspace">
      <header className="market-header">
        <div className="market-header-inner">
          <button type="button" className="market-brand" onClick={() => setActiveView("sheet")}>KJHSTOCK <span>Binance 선물</span></button>
          <div className="market-connection">
            <StatusBadge label="USD-M" status={wsStatus["USD-M"]} />
            <StatusBadge label="COIN-M" status={wsStatus["COIN-M"]} />
            <Button variant="outline" onClick={() => void reload()} disabled={refreshing}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} 새로고침
            </Button>
          </div>
        </div>
      </header>
      <div className="market-chat-layout">
      <VisitorChat />
      <main className="market-main">
        {activeView !== "reports" && <>
        <div className="market-intro">
          <div><h1>선물 시장 한눈에</h1><p>종목을 비교하고, 원하는 기준으로 정렬하세요.</p></div>
          <p className="market-updated" title={"전체 목록 갱신 " + formatDateTime(metadataLastRefreshedAt)}>시세 갱신 {formatDateTime(summary.lastUpdated)}</p>
        </div>
        {error ? (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            <ShieldAlert className="mr-2 inline h-4 w-4" />
            {error}
          </div>
        ) : null}

        <section className="market-summary" aria-label="전체 선물 시장 요약">
          <SummaryCard title="선물 계약" value={loading ? "불러오는 중" : summary.totalSymbols.toLocaleString("ko-KR")} detail={`USD-M ${marketCounts.usdM} / COIN-M ${marketCounts.coinM}`} icon={DatabaseZap} />
          <SummaryCard title="24h 거래대금" value={loading ? "불러오는 중" : formatUsd(summary.totalVolume24hUsd)} detail={`평균 등락률 ${formatPercent(summary.averageChange24hPercent)}`} icon={BarChart3} />
          <SummaryCard title="상승 1위" value={summary.topGainer?.symbol ?? "-"} detail={formatPercent(summary.topGainer?.change24hPercent)} icon={ArrowUp} />
          <SummaryCard title="하락 1위" value={summary.topLoser?.symbol ?? "-"} detail={formatPercent(summary.topLoser?.change24hPercent)} icon={ArrowDown} />
        </section>

        </>}
        <Tabs value={activeView} onValueChange={setActiveView} className="market-views">
          <TabsList className="market-tabs" aria-label="분석 화면">
            <TabsTrigger value="sheet" ref={sheetTabRef}>Sheet</TabsTrigger>
            <TabsTrigger value="charts">시장 차트</TabsTrigger>
            <TabsTrigger value="reports">분석 리포트</TabsTrigger>
            <TabsTrigger value="detail">종목 분석</TabsTrigger>
          </TabsList>
          <TabsContent value="sheet" className="market-view">
          <div className="min-w-0 space-y-4">
            <section className="market-filters" aria-label="종목 검색과 필터">
                <div className="relative market-search">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    className="h-10 rounded-md pl-9"
                    placeholder="BTC, ETH, SOL 검색"
                    aria-label="이름 또는 심볼 검색"
                  />
                </div>
              <div className="market-filter-heading"><h3>종목 필터</h3><span>{[assetFilter !== "crypto", marketFilter !== "all", quoteFilter !== "all", signalFilter !== "all", favoriteOnly, Boolean(query.trim())].filter(Boolean).length}개 필터 적용</span></div>
              <div className="market-filter-grid">
                <fieldset className="market-filter-field"><legend>자산 유형</legend>
                <Select value={assetFilter} onValueChange={setAssetFilter}>
                  <SelectTrigger aria-label="자산 유형" className="h-10 w-full rounded-md bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="crypto">크립토</SelectItem>
                    <SelectItem value="all">전체 계약</SelectItem>
                    <SelectItem value="tradefi">TradeFi</SelectItem>
                  </SelectContent>
                </Select>
                </fieldset>
                <fieldset className="market-filter-field"><legend>마켓</legend>
                <Select value={marketFilter} onValueChange={setMarketFilter}>
                  <SelectTrigger aria-label="마켓" className="h-10 w-full rounded-md bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 마켓</SelectItem>
                    <SelectItem value="USD-M">USD-M</SelectItem>
                    <SelectItem value="COIN-M">COIN-M</SelectItem>
                  </SelectContent>
                </Select>
                </fieldset>
                <fieldset className="market-filter-field"><legend>표시 통화</legend>
                <Select value={quoteFilter} onValueChange={setQuoteFilter}>
                  <SelectTrigger aria-label="표시 통화" className="h-10 w-full rounded-md bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 담보/표시</SelectItem>
                    {quoteAssets.map(asset => (
                      <SelectItem key={asset} value={asset}>
                        {asset}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                </fieldset>
                <fieldset className="market-filter-field"><legend>시그널</legend>
                <Select value={signalFilter} onValueChange={setSignalFilter}>
                  <SelectTrigger aria-label="시그널" className="h-10 w-full rounded-md bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 시그널</SelectItem>
                    <SelectItem value="bullish">강세</SelectItem>
                    <SelectItem value="neutral">중립</SelectItem>
                    <SelectItem value="bearish">약세</SelectItem>
                  </SelectContent>
                </Select>
                </fieldset>
                <fieldset className="market-filter-field"><legend>정렬 기준</legend>
                <Select
                  value={sortKey}
                  onValueChange={value => {
                    const nextKey = value as SortKey;
                    setSortKey(nextKey);
                    setSortDirection(sortOptions.find(option => option.value === nextKey)?.direction ?? "desc");
                  }}
                >
                  <SelectTrigger aria-label="정렬 기준" className="h-10 w-full rounded-md bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                </fieldset>
              </div>
              <div className="market-filter-actions">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-md"
                  onClick={() => setSortDirection(current => (current === "asc" ? "desc" : "asc"))}
                >
                  {sortDirection === "asc" ? "오름차순" : "내림차순"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  aria-pressed={favoriteOnly}
                  className={cn(
                    "h-10 rounded-md",
                    favoriteOnly && "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
                  )}
                  onClick={() => setFavoriteOnly(current => !current)}
                >
                  <Star className={cn("h-4 w-4", favoriteOnly ? "fill-amber-400 text-amber-500" : "text-slate-400")} />
                  즐겨찾기만
                </Button>
                <Button variant="ghost" onClick={resetFilters}>필터 초기화</Button>
                <span>{visibleRows.length.toLocaleString("ko-KR")}개 계약 표시</span>
              </div>
            </section>

            {favoriteKeys.length > 0 ? (
              <section className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 ">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-950">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                      즐겨찾기 종목
                    </h3>
                    <p className="mt-1 text-xs font-semibold text-amber-800">
                      저장 {favoriteKeys.length.toLocaleString("ko-KR")} / 현재 표시 가능 {favoriteRows.length.toLocaleString("ko-KR")}
                    </p>
                  </div>
                  <Badge variant="outline" className="w-fit rounded-md border-amber-200 bg-white text-amber-800">
                    브라우저 저장
                  </Badge>
                </div>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {favoriteRows.length > 0 ? favoriteRows.map(row => {
                    const key = rowSelectionKey(row);
                    const active = key === selectedKey;
                    return (
                      <button
                        key={key}
                        type="button"
                        className={cn(
                          "flex min-w-[154px] shrink-0 flex-col items-start rounded-md border bg-white px-3 py-2 text-left  transition-colors",
                          active ? "border-slate-950 ring-2 ring-slate-950/10" : "border-amber-200 hover:border-amber-400",
                        )}
                        onClick={() => onSelectFavorite(key)}
                      >
                        <span className="text-sm font-semibold text-slate-950">{row.symbol}</span>
                        <span className="mt-1 text-xs font-semibold text-slate-500">{row.marketType} · {formatPercent(row.change24hPercent)}</span>
                      </button>
                    );
                  }) : (
                    <p className="rounded-md border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-800">
                      저장한 종목이 현재 Binance 목록에 없습니다.
                    </p>
                  )}
                </div>
              </section>
            ) : null}

            <section className="market-sheet" aria-label="시장 Sheet">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
                    <Signal className="h-4 w-4 text-emerald-600" />
                    시장 Sheet
                  </h2>
                  <p className="sheet-help" id="sheet-instructions">표를 잡고 좌우로 끌거나 아래 이동 바를 사용하세요. 열 제목은 정렬, 이름은 종목 분석입니다.</p>
                  <p className="sheet-sort-status" role="status">{visibleRows.length.toLocaleString("ko-KR")}개 계약 · {sortLabel} {sortDirection === "asc" ? "오름차순" : "내림차순"}</p>
                </div>
                {loading ? (
                  <Badge variant="outline" className="rounded-md bg-slate-50">
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    로딩
                  </Badge>
                ) : null}
              </div>
              <SheetScrollArea ref={sheetScrollRef}>
                <Table aria-label="Binance 선물 시세" aria-describedby="sheet-instructions" aria-busy={loading}>
                  <TableHeader className="sticky top-0 z-10 bg-white">
                    <TableRow>
                      {header("이름", "symbol", false, true)}
                      <TableHead scope="col" className="sheet-favorite-heading"><span className="sr-only">즐겨찾기</span><Star aria-hidden="true" className="h-4 w-4" /></TableHead>
                      {header("현재가", "price", true)}
                      {header("등락률 (24h)", "change24hPercent", true)}
                      {header("거래대금 (24h)", "volume24hUsd", true)}
                      {header("거래량 (24h)", "baseVolume24h", true)}
                      {header("펀딩비", "fundingRate", true)}
                      {header("마켓", "marketType")}
                      {header("계약", "contractType")}
                      {header("시그널", "signal")}
                      {header("순위", "rank", true)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && <TableRow><TableCell colSpan={11} className="sheet-loading"><Loader2 className="h-4 w-4 animate-spin" />Binance 시세를 불러오는 중입니다.</TableCell></TableRow>}
                    {pageRows.map(row => {
                      const favoriteKey = rowSelectionKey(row);
                      const selected = favoriteKey === selectedKey;
                      const favorited = favoriteKeySet.has(favoriteKey);
                      return (
                        <TableRow
                          key={`${row.marketType}-${row.symbol}`}
                          data-state={selected ? "selected" : undefined}
                          className={cn("border-slate-100", selected && "bg-cyan-50/70 hover:bg-cyan-50")}
                          onClick={() => selectContract(favoriteKey)}
                        >
                          <TableCell className="sheet-name">
                            <button type="button" className="sheet-symbol" onClick={event => { event.stopPropagation(); selectContract(favoriteKey); }} aria-label={row.symbol + " " + row.marketType + " 분석 보기"}>
                              <strong>{row.symbol}</strong><span>{row.baseAsset} / {row.quoteAsset}</span>
                            </button>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-pressed={favorited}
                              aria-label={favorited ? `${row.symbol} 즐겨찾기 해제` : `${row.symbol} 즐겨찾기 추가`}
                              className={cn(
                                "h-8 w-8 rounded-md text-slate-300 hover:text-amber-500",
                                favorited && "bg-amber-50 text-amber-500 hover:bg-amber-100 hover:text-amber-600",
                              )}
                              onClick={event => {
                                event.stopPropagation();
                                toggleFavorite(row);
                              }}
                            >
                              <Star className={cn("h-4 w-4", favorited && "fill-amber-400")} />
                            </Button>
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums text-slate-950">{formatPrice(row.price)}</TableCell>
                          <TableCell className={cn("text-right font-semibold tabular-nums", row.change24hPercent >= 0 ? "text-emerald-700" : "text-rose-700")}>
                            {formatPercent(row.change24hPercent)}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-slate-700">{formatUsd(row.volume24hUsd)}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-slate-700"><span>{Number.isFinite(row.baseVolume24h) ? row.baseVolume24h.toLocaleString("ko-KR", row.baseVolume24h > 0 && row.baseVolume24h < 1 ? { maximumSignificantDigits: 4 } : { maximumFractionDigits: 2 }) : "-"}</span><span className="sheet-unit">{row.baseAsset}</span></TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-slate-700">{formatFunding(row.fundingRate)}</TableCell>
                          <TableCell className="text-xs text-slate-500">{row.marketType}</TableCell>
                          <TableCell className="text-xs font-semibold text-slate-500">{row.contractType}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={cn("rounded-md px-2 py-1", signalMeta[row.signal].className)}>
                              {signalMeta[row.signal].label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs text-slate-500">{row.rank}</TableCell>
                        </TableRow>
                      );
                    })}
                    {!loading && visibleRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="h-32 text-center text-sm text-slate-500">
                          {error ? "시세를 불러오지 못했습니다. 새로고침으로 다시 시도해 주세요." : favoriteOnly ? "즐겨찾기 조건에 맞는 선물 계약이 없습니다." : "조건에 맞는 선물 계약이 없습니다."}
                          {!error && <Button variant="ghost" onClick={resetFilters}>필터 초기화</Button>}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </SheetScrollArea>
              <div className="sheet-pagination">
                <span>{visibleRows.length ? (currentPage - 1) * 50 + 1 : 0}~{Math.min(currentPage * 50, visibleRows.length)} / {visibleRows.length.toLocaleString("ko-KR")}개</span>
                <span className="sheet-live-note">시세 갱신 시 선택한 정렬을 유지합니다.</span>
                <div><Button variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>이전</Button><span>{currentPage} / {pageCount}</span><Button variant="outline" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>다음</Button></div>
              </div>
            </section>
          </div>

          </TabsContent>
          <TabsContent value="charts" className="market-view"><div className="view-intro"><h2>시장 흐름 비교</h2><p>거래대금, 등락률, 펀딩비를 함께 확인하세요.</p></div><MarketVisualBoard rows={rows} /></TabsContent>
          <TabsContent value="reports" className="market-view">
            <ResearchReportPanel state={research} onSelect={selectContract} />
          </TabsContent>
          <TabsContent value="detail" className="market-view" ref={detailPanelRef} tabIndex={-1}>
            <div className="detail-toolbar"><Button variant="outline" onClick={() => { moveFocusAfterNavigation.current = true; setActiveView("sheet"); }}>← Sheet로 돌아가기</Button><span>표의 이름을 누르면 분석 종목이 바뀝니다.</span></div>
            <TechnicalPanel row={selectedRow} interval={interval} onIntervalChange={setInterval} loading={technicalLoading} error={technicalError} indicators={activeTechnical?.indicators ?? null} candles={activeTechnical?.candles ?? []} />
          </TabsContent>
        </Tabs>
        <details className="market-glossary"><summary>표의 지표는 어떻게 읽나요?</summary><dl>
          <div><dt>등락률</dt><dd>최근 24시간 가격 변화입니다. +는 상승, -는 하락입니다.</dd></div>
          <div><dt>거래대금</dt><dd>24시간 동안 거래된 금액의 달러 환산값입니다. M은 백만, B는 십억입니다. COIN-M은 기초자산 거래량에 현재가를 곱한 추정값입니다.</dd></div>
          <div><dt>거래량</dt><dd>기초자산 수량입니다. 코인별 단위가 다르므로 시장 간 규모 비교에는 거래대금을 함께 보세요.</dd></div>
          <div><dt>펀딩비</dt><dd>무기한 계약의 포지션 간 정산 비율입니다. 적용되지 않거나 값이 없으면 -로 표시합니다.</dd></div>
        </dl></details>
        <footer className="market-footer">Binance 공개 시세 기준. 점수와 시그널은 계산된 참고 지표이며, 데이터가 지연되거나 누락될 수 있습니다.</footer>
      </main>
      </div>
    </div>
  );
}
