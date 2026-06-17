import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchAllFuturesRows,
  fetchFuturesTechnicalDetail,
  subscribeAllFuturesTicker,
} from "@/lib/binanceFuturesClient";
import { cn } from "@/lib/utils";
import {
  buildFuturesWatchReport,
  buildFuturesWatchReportMarkdown,
  summarizeFuturesRows,
  type FuturesBias,
  type FuturesCandle,
  type FuturesMarketRow,
  type FuturesMarketType,
  type FuturesTechnicalIndicators,
  type FuturesWatchReportItem,
  type FuturesWatchTechnicalSnapshot,
} from "@shared/binanceFuturesAnalysis";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bitcoin,
  Clock3,
  Clipboard,
  DatabaseZap,
  Download,
  Gauge,
  LineChart as LineChartIcon,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Signal,
  Sparkles,
  Target,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

type SortKey = "rank" | "marketType" | "symbol" | "price" | "change24hPercent" | "volume24hUsd" | "fundingRate" | "signal";
type SortDirection = "asc" | "desc";
type WsStatus = "idle" | "connecting" | "live" | "closed" | "error";

type FuturesSelectionKey = `${FuturesMarketType}:${string}`;
type ReportTechnicalByKey = Partial<Record<FuturesSelectionKey, FuturesWatchTechnicalSnapshot>>;

const MARKET_METADATA_REFRESH_MS = 300_000;
const REPORT_TECHNICAL_REFRESH_MS = 120_000;

const sortOptions: Array<{ value: SortKey; label: string; direction: SortDirection }> = [
  { value: "volume24hUsd", label: "거래대금", direction: "desc" },
  { value: "change24hPercent", label: "24h 등락률", direction: "desc" },
  { value: "fundingRate", label: "펀딩비", direction: "desc" },
  { value: "price", label: "가격", direction: "desc" },
  { value: "marketType", label: "마켓", direction: "asc" },
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

const reportCategoryLabel: Record<FuturesWatchReportItem["category"], string> = {
  momentum_liquidity: "모멘텀",
  volume_leader: "유동성",
  funding_pressure: "펀딩",
  pullback_liquidity: "변동성",
  coin_margin_focus: "COIN-M",
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

function sortValue(row: FuturesMarketRow, key: SortKey) {
  if (key === "signal") return signalRank[row.signal];
  if (key === "fundingRate") return row.fundingRate ?? 0;
  return row[key];
}

function buildChartRows(candles: FuturesCandle[]) {
  return candles.slice(-120).map(candle => ({
    time: new Date(candle.openTime).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit" }),
    close: candle.close,
    volume: candle.volume,
  }));
}

function rowSelectionKey(row: Pick<FuturesMarketRow, "marketType" | "symbol">): FuturesSelectionKey {
  return `${row.marketType}:${row.symbol}`;
}

function technicalSnapshotFromIndicators(indicators: FuturesTechnicalIndicators): FuturesWatchTechnicalSnapshot {
  return {
    score: indicators.score,
    bias: indicators.bias,
    rsi14: indicators.rsi14,
    ema20: indicators.ema20,
    ema50: indicators.ema50,
    macdHistogram: indicators.macdHistogram,
    atrPercent: indicators.atrPercent,
    volume20Ratio: indicators.volume20Ratio,
  };
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back to selection-based copy when the browser blocks async clipboard access.
    }
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "true");
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  textArea.setSelectionRange(0, text.length);
  const copied = document.execCommand("copy");
  textArea.remove();
  if (!copied) throw new Error("Clipboard copy failed");
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

function WatchReport({
  items,
  markdown,
  technicalLoading,
  technicalUpdatedAt,
  onSelect,
  onCopyReport,
  onDownloadReport,
}: {
  items: FuturesWatchReportItem[];
  markdown: string;
  technicalLoading: boolean;
  technicalUpdatedAt: string | null;
  onSelect: (key: FuturesSelectionKey) => void;
  onCopyReport: () => void;
  onDownloadReport: () => void;
}) {
  const hasItems = items.length > 0;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-black text-slate-950">
            <Sparkles className="h-4 w-4 text-amber-500" />
            주목 후보 리포트
          </h2>
          <p className="mt-1 text-xs text-slate-500">거래대금, 24h 변동, 펀딩비, COIN-M 흐름을 조합한 관찰 후보입니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="h-9 rounded-md bg-white" onClick={onCopyReport} disabled={!hasItems}>
            <Clipboard className="mr-2 h-4 w-4" />
            리포트 복사
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-9 rounded-md bg-white" onClick={onDownloadReport} disabled={!hasItems}>
            <Download className="mr-2 h-4 w-4" />
            MD 저장
          </Button>
          <Badge variant="outline" className="h-9 w-fit rounded-md bg-slate-50 px-3 text-slate-600">
            투자 조언 아님
          </Badge>
          <Badge variant="outline" className="h-9 w-fit rounded-md bg-slate-50 px-3 text-slate-600">
            {technicalLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Gauge className="mr-1 h-3.5 w-3.5" />}
            {technicalLoading ? "TA 갱신 중" : technicalUpdatedAt ? `TA ${formatDateTime(technicalUpdatedAt)}` : "TA 대기"}
          </Badge>
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-5">
        {items.slice(0, 5).map(item => (
          <button
            key={`${item.category}-${item.symbol}`}
            type="button"
            onClick={() => onSelect(rowSelectionKey(item))}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge variant="outline" className="rounded-md bg-white text-[11px] text-slate-500">
                  {reportCategoryLabel[item.category]}
                </Badge>
                <h3 className="mt-2 text-lg font-black text-slate-950">{item.symbol}</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {item.marketType} · {item.contractType}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-400">점수</p>
                <p className="text-xl font-black text-slate-950">{item.priorityScore}</p>
              </div>
            </div>
            <p className="mt-3 text-sm font-black text-slate-800">{item.title}</p>
            <p className="mt-2 text-xs leading-5 text-slate-600">{item.why}</p>
            <p className="mt-3 border-t border-slate-200 pt-3 text-xs leading-5 text-rose-700">{item.risk}</p>
            <div className="mt-3 border-t border-slate-200 pt-3">
              <p className="flex items-center gap-1 text-[11px] font-black uppercase text-slate-400">
                <Target className="h-3 w-3" />
                관찰 체크
              </p>
              <ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-600">
                {item.watchPoints.slice(0, 2).map(point => (
                  <li key={point} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-200 pt-3 text-xs">
              {item.technical ? (
                <>
                  <div>
                    <p className="font-bold text-slate-400">TA 점수</p>
                    <p className="mt-0.5 font-black text-slate-900">
                      {item.technical.score} · {signalMeta[item.technical.bias].label}
                    </p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-400">RSI</p>
                    <p className="mt-0.5 font-black text-slate-900">{item.technical.rsi14.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-400">MACD</p>
                    <p className={cn("mt-0.5 font-black", item.technical.macdHistogram >= 0 ? "text-emerald-700" : "text-rose-700")}>
                      {item.technical.macdHistogram.toLocaleString("ko-KR", { maximumFractionDigits: 6 })}
                    </p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-400">ATR</p>
                    <p className="mt-0.5 font-black text-slate-900">{item.technical.atrPercent.toFixed(2)}%</p>
                  </div>
                </>
              ) : (
                <p className="col-span-2 font-semibold text-slate-500">
                  {technicalLoading ? "기술 지표 계산 중" : "기술 지표 대기"}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
      <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-sm font-black text-slate-700">Markdown 리포트 원문</summary>
        <Textarea
          readOnly
          value={markdown}
          className="mt-3 min-h-64 resize-y rounded-md bg-white font-mono text-xs leading-5 text-slate-700"
          onFocus={event => event.currentTarget.select()}
        />
      </details>
    </section>
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
            <p className="mt-1 text-sm text-slate-500">
              {row ? `${row.marketType} · ${row.pair} · ${row.contractType}` : "Binance Futures"}
            </p>
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
  const [technical, setTechnical] = useState<{ candles: FuturesCandle[]; indicators: FuturesTechnicalIndicators } | null>(null);
  const [reportTechnicalByKey, setReportTechnicalByKey] = useState<ReportTechnicalByKey>({});
  const [reportTechnicalLoading, setReportTechnicalLoading] = useState(false);
  const [reportTechnicalUpdatedAt, setReportTechnicalUpdatedAt] = useState<string | null>(null);
  const [reportTechnicalRefreshTick, setReportTechnicalRefreshTick] = useState(0);

  const reload = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setRefreshing(true);
    setError(null);
    try {
      const nextRows = await fetchAllFuturesRows();
      setRows(nextRows);
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

  useEffect(() => {
    const timer = window.setInterval(() => {
      setReportTechnicalRefreshTick(current => current + 1);
    }, REPORT_TECHNICAL_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  const selectedRow = useMemo(() => rows.find(row => rowSelectionKey(row) === selectedKey), [rows, selectedKey]);

  useEffect(() => {
    if (!selectedRow) return;
    const controller = new AbortController();
    setTechnicalLoading(true);
    setTechnicalError(null);
    fetchFuturesTechnicalDetail(selectedRow.symbol, selectedRow.marketType, interval, controller.signal)
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
  }, [selectedRow, interval]);

  const summary = useMemo(() => summarizeFuturesRows(rows), [rows]);
  const report = useMemo(() => buildFuturesWatchReport(rows), [rows]);
  const reportCandidates = useMemo(() => report.items.slice(0, 5), [report]);
  const reportCandidateSignature = useMemo(() => reportCandidates.map(item => rowSelectionKey(item)).join("|"), [reportCandidates]);
  const reportWithTechnical = useMemo(() => ({
    ...report,
    items: report.items.map(item => ({
      ...item,
      technical: reportTechnicalByKey[rowSelectionKey(item)],
    })),
  }), [report, reportTechnicalByKey]);
  const reportMarkdown = useMemo(() => buildFuturesWatchReportMarkdown(reportWithTechnical), [reportWithTechnical]);
  const quoteAssets = useMemo(() => Array.from(new Set(rows.map(row => row.quoteAsset))).sort(), [rows]);
  const marketCounts = useMemo(() => {
    const usdM = rows.filter(row => row.marketType === "USD-M").length;
    const coinM = rows.filter(row => row.marketType === "COIN-M").length;
    return { usdM, coinM };
  }, [rows]);

  useEffect(() => {
    if (!reportCandidates.length) {
      setReportTechnicalByKey({});
      setReportTechnicalLoading(false);
      setReportTechnicalUpdatedAt(null);
      return;
    }

    const controller = new AbortController();
    const candidates = reportCandidates;
    setReportTechnicalLoading(true);

    Promise.all(candidates.map(async item => {
      try {
        const detail = await fetchFuturesTechnicalDetail(item.symbol, item.marketType, interval, controller.signal);
        return [rowSelectionKey(item), technicalSnapshotFromIndicators(detail.indicators)] as const;
      } catch {
        return null;
      }
    }))
      .then(entries => {
        if (controller.signal.aborted) return;
        const nextTechnicalByKey = Object.fromEntries(entries.filter(entry => entry !== null));
        setReportTechnicalByKey(nextTechnicalByKey);
        if (Object.keys(nextTechnicalByKey).length > 0) {
          setReportTechnicalUpdatedAt(new Date().toISOString());
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setReportTechnicalLoading(false);
      });

    return () => controller.abort();
  }, [reportCandidateSignature, interval, reportTechnicalRefreshTick]);

  const copyReport = useCallback(() => {
    void copyTextToClipboard(reportMarkdown)
      .then(() => toast.success("주목 후보 리포트를 복사했습니다."))
      .catch(() => toast.error("클립보드 복사에 실패했습니다."));
  }, [reportMarkdown]);

  const downloadReport = useCallback(() => {
    const generatedDate = (report.generatedAt ?? new Date().toISOString()).slice(0, 10);
    const blob = new Blob([reportMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `binance-futures-watch-report-${generatedDate}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success("Markdown 리포트를 저장했습니다.");
  }, [report.generatedAt, reportMarkdown]);

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
      return matchesQuery && matchesAsset && matchesMarket && matchesQuote && matchesSignal;
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
  }, [query, assetFilter, marketFilter, quoteFilter, rows, signalFilter, sortDirection, sortKey]);

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
              <h1 className="text-2xl font-black tracking-tight text-slate-950">Binance Futures Intelligence</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label="USD-M" status={wsStatus["USD-M"]} />
            <StatusBadge label="COIN-M" status={wsStatus["COIN-M"]} />
            <Badge variant="outline" className="rounded-md px-3 py-1.5 text-slate-600">
              <Clock3 className="mr-1 h-3.5 w-3.5" />
              {formatDateTime(summary.lastUpdated)}
            </Badge>
            <Badge variant="outline" className="rounded-md px-3 py-1.5 text-slate-600">
              <DatabaseZap className="mr-1 h-3.5 w-3.5" />
              REST {formatDateTime(metadataLastRefreshedAt)}
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
          <SummaryCard title="선물 계약" value={summary.totalSymbols.toLocaleString("ko-KR")} detail={`USD-M ${marketCounts.usdM} / COIN-M ${marketCounts.coinM}`} icon={DatabaseZap} />
          <SummaryCard title="24h 거래대금" value={formatUsd(summary.totalVolume24hUsd)} detail={`평균 등락률 ${formatPercent(summary.averageChange24hPercent)}`} icon={BarChart3} />
          <SummaryCard title="상승 1위" value={summary.topGainer?.symbol ?? "-"} detail={formatPercent(summary.topGainer?.change24hPercent)} icon={ArrowUp} />
          <SummaryCard title="하락 1위" value={summary.topLoser?.symbol ?? "-"} detail={formatPercent(summary.topLoser?.change24hPercent)} icon={ArrowDown} />
        </section>

        <div className="mt-5">
          <WatchReport
            items={reportWithTechnical.items}
            markdown={reportMarkdown}
            technicalLoading={reportTechnicalLoading}
            technicalUpdatedAt={reportTechnicalUpdatedAt}
            onSelect={setSelectedKey}
            onCopyReport={copyReport}
            onDownloadReport={downloadReport}
          />
        </div>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0 space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_130px_130px] 2xl:grid-cols-[minmax(220px,1fr)_120px_130px_130px_150px_160px_120px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    className="h-10 rounded-md pl-9"
                    placeholder="BTC, ETH, SOL..."
                  />
                </div>
                <Select value={assetFilter} onValueChange={setAssetFilter}>
                  <SelectTrigger className="h-10 w-full rounded-md bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="crypto">크립토</SelectItem>
                    <SelectItem value="all">전체 계약</SelectItem>
                    <SelectItem value="tradefi">TradeFi</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={marketFilter} onValueChange={setMarketFilter}>
                  <SelectTrigger className="h-10 w-full rounded-md bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 마켓</SelectItem>
                    <SelectItem value="USD-M">USD-M</SelectItem>
                    <SelectItem value="COIN-M">COIN-M</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={quoteFilter} onValueChange={setQuoteFilter}>
                  <SelectTrigger className="h-10 w-full rounded-md bg-white">
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
                    Binance 선물 전체
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
                      <TableHead>마켓</TableHead>
                      <TableHead>심볼</TableHead>
                      <TableHead className="text-right">가격</TableHead>
                      <TableHead className="text-right">24h</TableHead>
                      <TableHead className="text-right">거래대금</TableHead>
                      <TableHead className="text-right">펀딩비</TableHead>
                      <TableHead>계약</TableHead>
                      <TableHead className="text-center">시그널</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.map(row => {
                      const selected = rowSelectionKey(row) === selectedKey;
                      return (
                        <TableRow
                          key={`${row.marketType}-${row.symbol}`}
                          data-state={selected ? "selected" : undefined}
                          className={cn("border-slate-100", selected && "bg-cyan-50/70 hover:bg-cyan-50")}
                          onClick={() => setSelectedKey(rowSelectionKey(row))}
                        >
                          <TableCell className="text-right text-xs font-bold text-slate-400">{row.rank}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="rounded-md px-2 py-1 text-[11px] text-slate-600">
                              {row.marketType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-950">{row.symbol}</span>
                              <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[10px] text-slate-500">
                                {row.quoteAsset}
                              </Badge>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500">{row.pair}</p>
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums text-slate-950">{formatPrice(row.price)}</TableCell>
                          <TableCell className={cn("text-right font-black tabular-nums", row.change24hPercent >= 0 ? "text-emerald-700" : "text-rose-700")}>
                            {formatPercent(row.change24hPercent)}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-slate-700">{formatUsd(row.volume24hUsd)}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-slate-700">{formatFunding(row.fundingRate)}</TableCell>
                          <TableCell className="text-xs font-semibold text-slate-500">{row.contractType}</TableCell>
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
                        <TableCell colSpan={9} className="h-32 text-center text-sm text-slate-500">
                          조건에 맞는 선물 계약이 없습니다.
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
          Binance USD-M 및 COIN-M 공개 API 기준입니다. 데이터는 지연되거나 누락될 수 있으며, 표시된 점수와 리포트는 투자 조언이 아닙니다.
        </section>
      </main>
    </div>
  );
}
