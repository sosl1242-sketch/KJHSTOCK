import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  fetchFuturesTechnicalDetail,
  fetchUsdMFuturesRows,
  subscribeUsdMFuturesTicker,
} from "@/lib/binanceFuturesClient";
import { cn } from "@/lib/utils";
import { summarizeFuturesRows, type FuturesBias, type FuturesCandle, type FuturesMarketRow, type FuturesTechnicalIndicators } from "@shared/binanceFuturesAnalysis";
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
  Wifi,
  WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type SortKey = "rank" | "symbol" | "price" | "change24hPercent" | "volume24hUsd" | "fundingRate" | "signal";
type SortDirection = "asc" | "desc";
type WsStatus = "idle" | "connecting" | "live" | "closed" | "error";

const sortOptions: Array<{ value: SortKey; label: string; direction: SortDirection }> = [
  { value: "volume24hUsd", label: "거래대금", direction: "desc" },
  { value: "change24hPercent", label: "24h 등락률", direction: "desc" },
  { value: "fundingRate", label: "펀딩비", direction: "desc" },
  { value: "price", label: "가격", direction: "desc" },
  { value: "symbol", label: "심볼", direction: "asc" },
  { value: "rank", label: "순위", direction: "asc" },
  { value: "signal", label: "시그널", direction: "desc" },
];

const signalRank: Record<FuturesBias, number> = {
  bullish: 3,
  neutral: 2,
  bearish: 1,
};

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

function sortValue(row: FuturesMarketRow, key: SortKey) {
  if (key === "signal") return signalRank[row.signal];
  if (key === "fundingRate") return row.fundingRate ?? 0;
  return row[key];
}

function buildChartRows(candles: FuturesCandle[]) {
  return candles.slice(-120).map(candle => ({
    time: new Date(candle.openTime).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit" }),
    close: candle.close,
    high: candle.high,
    low: candle.low,
    volume: candle.volume,
  }));
}

function wsLabel(status: WsStatus) {
  if (status === "live") return "실시간 연결";
  if (status === "connecting") return "연결 중";
  if (status === "error") return "연결 오류";
  if (status === "closed") return "연결 종료";
  return "대기";
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
    <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold text-slate-500">{title}</CardTitle>
        <Icon className="h-4 w-4 text-slate-400" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-black tracking-tight text-slate-950">{value}</div>
        <p className="mt-1 text-xs font-medium text-slate-500">{detail}</p>
      </CardContent>
    </Card>
  );
}

function IndicatorRow({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "good" | "bad" }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-2 last:border-b-0">
      <span className="text-sm font-medium text-slate-500">{label}</span>
      <span
        className={cn(
          "text-sm font-black tabular-nums",
          tone === "good" && "text-emerald-700",
          tone === "bad" && "text-rose-700",
          tone === "default" && "text-slate-950",
        )}
      >
        {value}
      </span>
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
  const bias = indicators?.bias ?? row?.signal ?? "neutral";

  return (
    <aside className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Selected Futures</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">{row?.symbol ?? "선택 없음"}</h2>
            <p className="mt-1 text-sm text-slate-500">{row ? `${row.baseAsset} / ${row.quoteAsset} PERPETUAL` : "Binance USD-M Futures"}</p>
          </div>
          <Badge variant="outline" className={cn("rounded-md px-2 py-1", signalMeta[bias].className)}>
            {signalMeta[bias].label}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">현재가</p>
            <p className="mt-1 text-lg font-black text-slate-950">{formatPrice(row?.price)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">24h</p>
            <p className={cn("mt-1 text-lg font-black", (row?.change24hPercent ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700")}>
              {formatPercent(row?.change24hPercent)}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">거래대금</p>
            <p className="mt-1 text-lg font-black text-slate-950">{formatUsd(row?.volume24hUsd)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">펀딩비</p>
            <p className="mt-1 text-lg font-black text-slate-950">{formatFunding(row?.fundingRate)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-black text-slate-950">
              <Gauge className="h-4 w-4 text-indigo-500" />
              기술적 지표
            </h3>
            <p className="mt-1 text-xs text-slate-500">RSI, EMA, MACD, Bollinger, ATR</p>
          </div>
          <Select value={interval} onValueChange={onIntervalChange}>
            <SelectTrigger className="h-9 w-28 rounded-md bg-white">
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

        {loading ? (
          <div className="mt-4 flex h-40 items-center justify-center rounded-lg bg-slate-50 text-sm font-semibold text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            지표 계산 중
          </div>
        ) : error ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error}</div>
        ) : indicators ? (
          <>
            <div className="mt-4 rounded-lg bg-slate-950 p-4 text-white">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-400">종합 점수</p>
                  <p className="mt-1 text-4xl font-black">{indicators.score}</p>
                </div>
                <Badge className="rounded-md bg-white text-slate-950 hover:bg-white">{signalMeta[indicators.bias].label}</Badge>
              </div>
              <div className="mt-4 h-2 rounded-full bg-white/15">
                <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${indicators.score}%` }} />
              </div>
            </div>
            <div className="mt-4">
              <IndicatorRow label="RSI 14" value={indicators.rsi14.toFixed(2)} tone={indicators.rsi14 >= 50 ? "good" : "bad"} />
              <IndicatorRow label="EMA 20 / 50" value={`${formatPrice(indicators.ema20)} / ${formatPrice(indicators.ema50)}`} tone={indicators.ema20 > indicators.ema50 ? "good" : "bad"} />
              <IndicatorRow label="MACD Histogram" value={indicators.macdHistogram.toLocaleString("ko-KR", { maximumFractionDigits: 6 })} tone={indicators.macdHistogram >= 0 ? "good" : "bad"} />
              <IndicatorRow label="Bollinger %B" value={`${indicators.bollingerPercentB.toFixed(2)}%`} />
              <IndicatorRow label="ATR %" value={`${indicators.atrPercent.toFixed(2)}%`} />
              <IndicatorRow label="Stochastic 14" value={`${indicators.stochastic14.toFixed(2)}%`} tone={indicators.stochastic14 >= 50 ? "good" : "bad"} />
              <IndicatorRow label="Volume / 20" value={`${indicators.volume20Ratio.toFixed(2)}%`} />
            </div>
          </>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="flex items-center gap-2 text-base font-black text-slate-950">
          <LineChartIcon className="h-4 w-4 text-cyan-600" />
          가격 흐름
        </h3>
        <div className="mt-4 h-64">
          {chartRows.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartRows} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} minTickGap={26} />
                <YAxis yAxisId="price" tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={value => formatPrice(Number(value))} width={72} tickLine={false} axisLine={false} />
                <YAxis yAxisId="volume" orientation="right" hide />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === "volume") return [Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 0 }), "거래량"];
                    return [formatPrice(Number(value)), name === "close" ? "종가" : String(name)];
                  }}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
                />
                <Bar yAxisId="volume" dataKey="volume" fill="#cbd5e1" opacity={0.45} />
                <Line yAxisId="price" type="monotone" dataKey="close" stroke="#0891b2" strokeWidth={2.5} dot={false} />
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
  const [rows, setRows] = useState<FuturesMarketRow[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>("");
  const [query, setQuery] = useState("");
  const [quoteFilter, setQuoteFilter] = useState("all");
  const [signalFilter, setSignalFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("volume24hUsd");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [interval, setInterval] = useState("1h");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>("idle");
  const [technicalLoading, setTechnicalLoading] = useState(false);
  const [technicalError, setTechnicalError] = useState<string | null>(null);
  const [technical, setTechnical] = useState<{ candles: FuturesCandle[]; indicators: FuturesTechnicalIndicators } | null>(null);

  const reload = useCallback(async () => {
    const controller = new AbortController();
    setRefreshing(true);
    setError(null);
    try {
      const nextRows = await fetchUsdMFuturesRows(controller.signal);
      setRows(nextRows);
      setSelectedSymbol(previous => {
        if (previous && nextRows.some(row => row.symbol === previous)) return previous;
        return nextRows.find(row => row.symbol === "BTCUSDT")?.symbol ?? nextRows[0]?.symbol ?? "";
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Binance 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    return () => controller.abort();
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!rows.length) return;
    return subscribeUsdMFuturesTicker(setRows, status => setWsStatus(status));
  }, [rows.length]);

  useEffect(() => {
    if (!selectedSymbol) return;
    const controller = new AbortController();
    setTechnicalLoading(true);
    setTechnicalError(null);
    fetchFuturesTechnicalDetail(selectedSymbol, interval, controller.signal)
      .then(detail => setTechnical(detail))
      .catch(loadError => {
        if (controller.signal.aborted) return;
        setTechnical(null);
        setTechnicalError(loadError instanceof Error ? loadError.message : "기술적 지표를 계산하지 못했습니다.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setTechnicalLoading(false);
      });
    return () => controller.abort();
  }, [selectedSymbol, interval]);

  const summary = useMemo(() => summarizeFuturesRows(rows), [rows]);
  const quoteAssets = useMemo(() => Array.from(new Set(rows.map(row => row.quoteAsset))).sort(), [rows]);
  const selectedRow = useMemo(() => rows.find(row => row.symbol === selectedSymbol), [rows, selectedSymbol]);

  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toUpperCase();
    const filtered = rows.filter(row => {
      const matchesQuery = !normalizedQuery || row.symbol.includes(normalizedQuery) || row.baseAsset.includes(normalizedQuery);
      const matchesQuote = quoteFilter === "all" || row.quoteAsset === quoteFilter;
      const matchesSignal = signalFilter === "all" || row.signal === signalFilter;
      return matchesQuery && matchesQuote && matchesSignal;
    });
    return filtered.sort((a, b) => {
      const aValue = sortValue(a, sortKey);
      const bValue = sortValue(b, sortKey);
      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      const delta = Number(aValue) - Number(bValue);
      return sortDirection === "asc" ? delta : -delta;
    });
  }, [query, quoteFilter, rows, signalFilter, sortDirection, sortKey]);

  const wsIsLive = wsStatus === "live";

  return (
    <div className="min-h-screen bg-[#f4f7fa] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-950 text-white">
              <Bitcoin className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">JBGGAMES / KJHSTOCK</p>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">Binance Futures Live Board</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("rounded-md px-3 py-1.5", wsIsLive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600")}>
              {wsIsLive ? <Wifi className="mr-1 h-3.5 w-3.5" /> : <WifiOff className="mr-1 h-3.5 w-3.5" />}
              {wsLabel(wsStatus)}
            </Badge>
            <Badge variant="outline" className="rounded-md px-3 py-1.5 text-slate-600">
              <Clock3 className="mr-1 h-3.5 w-3.5" />
              {formatDateTime(summary.lastUpdated)}
            </Badge>
            <Button className="rounded-md" variant="outline" onClick={() => void reload()} disabled={refreshing}>
              {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              새로고침
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-5 lg:px-6">
        {error ? (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            <ShieldAlert className="mr-2 inline h-4 w-4" />
            {error}
          </div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="선물 심볼" value={summary.totalSymbols.toLocaleString("ko-KR")} detail={`${summary.positiveCount} 상승 / ${summary.negativeCount} 하락`} icon={DatabaseZap} />
          <SummaryCard title="24h 거래대금" value={formatUsd(summary.totalVolume24hUsd)} detail={`평균 등락률 ${formatPercent(summary.averageChange24hPercent)}`} icon={BarChart3} />
          <SummaryCard title="상승 1위" value={summary.topGainer?.symbol ?? "-"} detail={formatPercent(summary.topGainer?.change24hPercent)} icon={ArrowUp} />
          <SummaryCard title="하락 1위" value={summary.topLoser?.symbol ?? "-"} detail={formatPercent(summary.topLoser?.change24hPercent)} icon={ArrowDown} />
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0 space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_150px_150px] 2xl:grid-cols-[minmax(220px,1fr)_150px_150px_170px_120px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    className="h-10 rounded-md pl-9"
                    placeholder="BTC, ETH, SOL..."
                  />
                </div>
                <Select value={quoteFilter} onValueChange={setQuoteFilter}>
                  <SelectTrigger className="h-10 w-full rounded-md bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 마켓</SelectItem>
                    {quoteAssets.map(asset => (
                      <SelectItem key={asset} value={asset}>
                        {asset}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={signalFilter} onValueChange={setSignalFilter}>
                  <SelectTrigger className="h-10 w-full rounded-md bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 시그널</SelectItem>
                    <SelectItem value="bullish">강세</SelectItem>
                    <SelectItem value="neutral">중립</SelectItem>
                    <SelectItem value="bearish">약세</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={sortKey}
                  onValueChange={value => {
                    const nextKey = value as SortKey;
                    setSortKey(nextKey);
                    setSortDirection(sortOptions.find(option => option.value === nextKey)?.direction ?? "desc");
                  }}
                >
                  <SelectTrigger className="h-10 w-full rounded-md bg-white">
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
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-md"
                  onClick={() => setSortDirection(current => (current === "asc" ? "desc" : "asc"))}
                >
                  {sortDirection === "asc" ? "오름차순" : "내림차순"}
                </Button>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-black text-slate-950">
                    <Signal className="h-4 w-4 text-emerald-600" />
                    USD-M 선물 전체
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">표시 {visibleRows.length.toLocaleString("ko-KR")} / 전체 {rows.length.toLocaleString("ko-KR")}</p>
                </div>
                {loading ? (
                  <Badge variant="outline" className="rounded-md bg-slate-50">
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    로딩
                  </Badge>
                ) : null}
              </div>
              <div className="max-h-[72vh] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-white">
                    <TableRow>
                      <TableHead className="w-14 text-right">#</TableHead>
                      <TableHead>심볼</TableHead>
                      <TableHead className="text-right">가격</TableHead>
                      <TableHead className="text-right">24h</TableHead>
                      <TableHead className="text-right">거래대금</TableHead>
                      <TableHead className="text-right">펀딩비</TableHead>
                      <TableHead className="text-right">고가 / 저가</TableHead>
                      <TableHead className="text-center">시그널</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.map(row => {
                      const selected = row.symbol === selectedSymbol;
                      return (
                        <TableRow
                          key={row.symbol}
                          data-state={selected ? "selected" : undefined}
                          className={cn("border-slate-100", selected && "bg-cyan-50/70 hover:bg-cyan-50")}
                          onClick={() => setSelectedSymbol(row.symbol)}
                        >
                          <TableCell className="text-right text-xs font-bold text-slate-400">{row.rank}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-950">{row.symbol}</span>
                              <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[10px] text-slate-500">
                                {row.quoteAsset}
                              </Badge>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500">{row.baseAsset} perpetual</p>
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums text-slate-950">{formatPrice(row.price)}</TableCell>
                          <TableCell className={cn("text-right font-black tabular-nums", row.change24hPercent >= 0 ? "text-emerald-700" : "text-rose-700")}>
                            {formatPercent(row.change24hPercent)}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-slate-700">{formatUsd(row.volume24hUsd)}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-slate-700">{formatFunding(row.fundingRate)}</TableCell>
                          <TableCell className="text-right text-xs font-semibold tabular-nums text-slate-500">
                            {formatPrice(row.high24h)} / {formatPrice(row.low24h)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={cn("rounded-md px-2 py-1", signalMeta[row.signal].className)}>
                              {signalMeta[row.signal].label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!loading && visibleRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center text-sm text-slate-500">
                          조건에 맞는 선물 심볼이 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </section>
          </div>

          <TechnicalPanel
            row={selectedRow}
            interval={interval}
            onIntervalChange={setInterval}
            loading={technicalLoading}
            error={technicalError}
            indicators={technical?.indicators ?? null}
            candles={technical?.candles ?? []}
          />
        </section>

        <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500 shadow-sm">
          Binance USD-M Futures 공개 API 기준입니다. 데이터는 지연되거나 누락될 수 있으며, 표시된 점수와 지표는 투자 조언이 아닙니다.
        </section>
      </main>
    </div>
  );
}
