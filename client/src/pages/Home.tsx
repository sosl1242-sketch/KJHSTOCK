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
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
type SortKey = "marketRank" | "name" | "code" | "sector" | "marketSuffix" | "currentPrice" | "annualEps" | "earningsYield" | "lastPriceFetchedAt";

const TABLE_PAGE_SIZE = 25;

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
  label: "KOSPI 200 전체",
  shortLabel: "전체 200",
  description: "KOSPI 시가총액 상위 200개 전체를 자체 테마와 함께 한 번에 비교합니다.",
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
  const stocksQuery = trpc.stocks.list.useQuery(queryInput);
  const [selectedStock, setSelectedStock] = useState<NonNullable<typeof stocksQuery.data>[number] | null>(null);
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
      ? (stocksQuery.data ?? []).filter(row => typeof row.marketRank === "number" && row.marketRank >= 1 && row.marketRank <= 200)
      : stocksQuery.data ?? [];
    const list = keyword
      ? scopedRows.filter(row => `${row.name} ${row.code} ${getMarketLabel(row.marketSuffix)} ${getSectorLabel(row.sector)} ${row.dataSource}`.toLowerCase().includes(keyword))
      : scopedRows;
    if (!sortState) return list;

    const getSortValue = (row: (typeof list)[number]) => {
      switch (sortState.key) {
        case "name": return row.name;
        case "code": return row.code;
        case "sector": return getSectorLabel(row.sector);
        case "marketSuffix": return getMarketLabel(row.marketSuffix);
        case "currentPrice": return row.currentPrice;
        case "annualEps": return row.annualEps;
        case "earningsYield": return row.earningsYield ?? Number.NEGATIVE_INFINITY;
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
    staleTime: 1000 * 60 * 10,
  });
  const summaryByCode = useMemo(() => new Map((financialSummaries.data ?? []).map(summary => [summary.code, summary])), [financialSummaries.data]);

  const chartData = useMemo(() => {
    const successfulSummaries = (financialSummaries.data ?? [])
      .filter(summary => summary.success && "marketCapHundredMillionKrw" in summary && typeof summary.marketCapHundredMillionKrw === "number")
      .map(summary => {
        const matchedRow = pagedRows.find(row => row.code.padStart(6, "0") === summary.code);
        const marketCap = "marketCapHundredMillionKrw" in summary ? summary.marketCapHundredMillionKrw : null;
        const per = "per" in summary ? summary.per : null;
        const pbr = "pbr" in summary ? summary.pbr : null;
        const operatingProfit = "latestOperatingProfitHundredMillionKrw" in summary ? summary.latestOperatingProfitHundredMillionKrw : null;
        return {
          name: matchedRow?.name ?? summary.name ?? summary.code,
          value: marketCap ?? 0,
          per,
          pbr,
          operatingProfit,
          metricLabel: "시가총액",
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    if (successfulSummaries.length) return successfulSummaries;

    return sectors.map(sector => ({
      name: sector.shortLabel,
      value: rows.filter(row => row.sector === sector.key).length,
      per: null,
      pbr: null,
      operatingProfit: null,
      metricLabel: "종목 수",
    })).filter(item => item.value > 0);
  }, [financialSummaries.data, pagedRows, rows]);

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
  const indicatorStatusClass = (status: string) => {
    if (status === "overheated" || status === "watch_high") return "border-rose-200 bg-rose-50 text-rose-800";
    if (status === "oversold" || status === "watch_low") return "border-blue-200 bg-blue-50 text-blue-800";
    return "border-slate-200 bg-slate-50 text-slate-700";
  };
  const technicalPanel = !selectedStock ? null : (
    <div className="rounded-[2rem] border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-black text-slate-950"><Activity className="h-5 w-5 text-blue-500" /> 고점·저점 판단 보조지표 10개</h3>
          <p className="mt-1 text-sm text-slate-500">최근 가격 이력 기반의 참고 지표입니다. 투자 판단은 재무·수급·뉴스를 함께 확인하세요.</p>
        </div>
        {technicalIndicators.data ? <Badge variant="outline" className="rounded-full bg-slate-50">{technicalIndicators.data.indicators.length}개 지표 · 종가 {formatNumber(technicalIndicators.data.latestClose ?? 0)}원</Badge> : null}
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
            {technicalIndicators.data.indicators.map(indicator => (
              <div key={indicator.key} className={`rounded-3xl border p-4 ${indicatorStatusClass(indicator.status)}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black">{indicator.label}</p>
                    <p className="mt-1 text-xs opacity-80">{indicator.statusLabel}</p>
                  </div>
                  <p className="whitespace-nowrap text-lg font-black">{indicator.displayValue}</p>
                </div>
                <p className="mt-3 text-xs font-semibold leading-5">{indicator.interpretation}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">출처: {technicalIndicators.data.source} · 조회 시각: {formatDateTime(technicalIndicators.data.fetchedAt)}</p>
        </>
      ) : null}
    </div>
  );
  return (
    <div className="relative min-h-[calc(100vh-3rem)] overflow-hidden rounded-[2rem] bg-[#f7f9fb] p-4 text-slate-950 md:p-8">
      <div className="pointer-events-none absolute right-[-5rem] top-[-5rem] h-64 w-64 rounded-[4rem] bg-blue-200/60 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-6rem] left-[18%] h-72 w-72 rounded-full bg-rose-200/70 blur-3xl" />

      <section className="relative z-10 mb-8 grid gap-6 xl:grid-cols-[1.45fr_0.55fr]">
        <div className="rounded-[2rem] bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] ring-1 ring-white sm:p-8">
          <Badge className="mb-5 bg-slate-950 text-white hover:bg-slate-950">KOSPI Top 200 Theme Dashboard</Badge>
          <h1 className="max-w-5xl break-keep text-3xl font-black leading-[1.12] tracking-[-0.03em] text-slate-950 sm:text-4xl lg:text-5xl">
            KOSPI 200 밸류에이션·실적 테마 분석
          </h1>
          <p className="mt-5 max-w-3xl text-base font-light leading-7 text-slate-500 md:text-lg">
            KOSPI 시가총액 상위 200개 종목을 자체 산업·비즈니스 테마로 재분류하고, 종목 클릭 시 PER, PBR, 시가총액, 영업이익, EPS, EPS/주가(%), 최근 분기별 실적과 RSI 등 대표 보조지표 10개를 한 화면에서 확인하도록 정리했습니다.
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
                {isAdmin ? "오너 권한으로 수동 편집과 현재가 갱신이 가능합니다." : "일반 사용자는 조회 전용입니다. 데이터 출처와 갱신 시각은 테이블에서 확인할 수 있습니다."}
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
                <BarChart3 className="h-6 w-6 text-blue-500" /> 페이지 내 시가총액·밸류에이션 차트
              </CardTitle>
              <CardDescription>현재 표에 보이는 25개 종목의 실제 시가총액을 우선 표시하고, 툴팁에서 PER, PBR, 최근 영업이익을 각각 확인합니다.</CardDescription>
            </CardHeader>
            <CardContent className="h-[420px]">
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
                        const payload = item.payload as { metricLabel?: string; per?: number | null; pbr?: number | null; operatingProfit?: number | null };
                        const mainValue = payload.metricLabel === "시가총액" ? formatHundredMillionKrw(value) : `${value}개`;
                        return [
                          `${mainValue} · PER ${formatMultiple(payload.per)} · PBR ${formatMultiple(payload.pbr)} · 영업이익 ${formatHundredMillionKrw(payload.operatingProfit)}`,
                          payload.metricLabel ?? "지표",
                        ];
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
                <div className="flex h-full items-center justify-center text-slate-500">표시할 종목 데이터가 없습니다.</div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-0 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-black">
                <Database className="h-5 w-5 text-rose-400" /> 오너 편집 패널
              </CardTitle>
              <CardDescription>KOSPI 200 기본 데이터는 자동 시드되며, 현재가는 오너가 수동 보정할 수 있습니다. PER, PBR, 분기 실적은 종목 클릭 시 각각 네이버 금융에서 조회합니다.</CardDescription>
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
            <CardTitle className="text-2xl font-black tracking-tight">KOSPI 200 종목 테이블</CardTitle>
            <CardDescription>헤더를 클릭하면 내림차순 → 오름차순 → 정렬취소 순서로 전환됩니다. 현재 페이지 25개 종목은 PER, PBR, 시가총액, 최근 영업이익 요약값을 먼저 불러오며, 외부 자료가 일시적으로 지연되면 행 클릭 상세조회에서 다시 확인할 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent className="max-w-full overflow-x-auto">
            <div className="mb-3 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-medium text-slate-500">
              현재 정렬: <span className="font-black text-slate-900">{currentSortLabel}</span> · 최신 화면 표식: KOSPI 200 테마, PER 별도, PBR 별도, RSI. 폭이 좁은 화면과 크롬 확대 상태에서는 표 영역만 좌우로 밀어 보세요. 공개 사이트가 이전 EPS 화면으로 보이면 Ctrl+Shift+R로 강력 새로고침하세요.
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
                  <th className="px-3 py-2 text-right font-medium">PER</th>
                  <th className="px-3 py-2 text-right font-medium">PBR</th>
                  <th className="px-4 py-2 text-right font-medium">시가총액·실적</th>
                  <th className="px-4 py-2 font-medium">연동 상태</th>
                  <th className="px-2 py-2">{sortableHeader("마지막 갱신", "lastPriceFetchedAt")}</th>
                  <th className="px-4 py-2 text-right font-medium">관리</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map(row => {
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
                        <div className="space-y-1 whitespace-nowrap">
                          <p className="font-black text-slate-950">{formatHundredMillionKrw(summary.marketCapHundredMillionKrw)}</p>
                          <p>영업이익 {formatHundredMillionKrw(summary.latestOperatingProfitHundredMillionKrw)}</p>
                        </div>
                      ) : summaryLoading ? <span className="text-slate-400">조회 중</span> : summary && !summary.success ? <button type="button" className="rounded-full bg-slate-100 px-2 py-1 text-slate-600 transition hover:bg-blue-50 hover:text-blue-700" onClick={(event) => { event.stopPropagation(); setSelectedStock(row); }} aria-label={`${row.name} 상세 실적 다시 조회`}>상세 조회</button> : <span className="text-slate-400">대기</span>}
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

      <Dialog open={Boolean(selectedStock)} onOpenChange={(open) => { if (!open) setSelectedStock(null); }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto border-0 bg-white text-slate-950 sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-3 text-2xl font-black">
              <TrendingUp className="h-6 w-6 text-blue-500" />
              {selectedStock?.name ?? "종목"} 재무 상세
            </DialogTitle>
            <DialogDescription>
              네이버 금융 기준 PER, PBR, 시가총액과 최근 분기별 실적을 확인하고, 야후 가격 이력 기반 RSI·스토캐스틱·52주 고저점 이격도 등 10개 보조지표를 함께 봅니다.
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
              {technicalPanel}
            </div>
          ) : financialDetail.data ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  ["PER", formatMultiple(financialDetail.data.per)],
                  ["PBR", formatMultiple(financialDetail.data.pbr)],
                  ["EPS", selectedStock ? `${formatNumber(selectedStock.annualEps)}원` : "-"],
                  ["EPS/주가", selectedStock ? formatPercent(selectedStock.earningsYield) : "-"],
                  ["시가총액", formatHundredMillionKrw(financialDetail.data.marketCapHundredMillionKrw)],
                  ["최근 영업이익", formatHundredMillionKrw(financialDetail.data.latestOperatingProfitHundredMillionKrw)],
                  ["최근 순이익", formatHundredMillionKrw(financialDetail.data.latestNetIncomeHundredMillionKrw)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-500">{label}</p>
                    <p className="mt-2 break-keep text-xl font-black text-slate-950">{value}</p>
                  </div>
                ))}
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

              {technicalPanel}
              <p className="text-xs leading-5 text-slate-500">출처: {financialDetail.data.source} · 조회 시각: {formatDateTime(financialDetail.data.fetchedAt)}{financialDetail.data.note ? ` · ${financialDetail.data.note}` : ""}</p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
