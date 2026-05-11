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
import { BarChart3, Database, Eye, Loader2, RefreshCcw, Save, Search, ShieldCheck, Sparkles, Trash2, TrendingUp } from "lucide-react";
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

type SortMode = "desc" | "asc";

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
  const [sortMode, setSortMode] = useState<SortMode>("asc");
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
    return [...list].sort((a, b) => {
      const aRank = a.marketRank ?? Number.POSITIVE_INFINITY;
      const bRank = b.marketRank ?? Number.POSITIVE_INFINITY;
      return sortMode === "asc" ? aRank - bRank : bRank - aRank;
    });
  }, [stocksQuery.data, searchText, selectedSector, sortMode]);

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
            KOSPI 시가총액 상위 200개 종목을 자체 산업·비즈니스 테마로 재분류하고, 종목 클릭 시 PER, PBR, 시가총액, 영업이익, 최근 분기별 매출·영업이익·순이익을 별도 상세 패널에서 확인하도록 정리했습니다.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              onClick={() => { setSortMode(sortMode === "asc" ? "desc" : "asc"); setCurrentPage(1); }}
              className="rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800"
            >
              시총순위 {sortMode === "asc" ? "상위순" : "하위순"}
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
                placeholder="종목명·코드·출처 검색"
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
            <CardContent className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              <div>
                <p className="text-sm text-slate-400">종목 수</p>
                <p className="text-2xl font-black leading-tight sm:text-3xl">{rows.length}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">연동 종목</p>
                <p className="text-2xl font-black leading-tight sm:text-3xl">{linkedCount}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">상세 지표</p>
                <p className="break-keep text-2xl font-black leading-tight sm:text-3xl xl:text-2xl 2xl:text-3xl">PER·PBR</p>
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
              <CardDescription>현재 표에 보이는 25개 종목의 실제 시가총액을 우선 표시하고, 툴팁에서 PER·PBR·최근 영업이익을 함께 확인합니다.</CardDescription>
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
              <CardDescription>KOSPI 200 기본 데이터는 자동 시드되며, 현재가는 오너가 수동 보정할 수 있습니다. PER·PBR·분기 실적은 종목 클릭 시 네이버 금융에서 조회합니다.</CardDescription>
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
            <CardDescription>현재 페이지 25개 종목은 PER, PBR, 시가총액, 최근 영업이익 요약값을 먼저 불러오며, 행을 클릭하면 최근 분기별 매출·영업이익·순이익 상세가 열립니다.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-separate border-spacing-y-2 text-left text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className="px-4 py-2 font-medium">순위</th>
                  <th className="px-4 py-2 font-medium">종목명</th>
                  <th className="px-4 py-2 font-medium">종목코드</th>
                  <th className="px-4 py-2 font-medium">자체 테마</th>
                  <th className="px-4 py-2 font-medium">시장</th>
                  <th className="px-4 py-2 text-right font-medium">현재 주가</th>
                  <th className="px-4 py-2 text-right font-medium">PER/PBR</th>
                  <th className="px-4 py-2 text-right font-medium">시가총액·실적</th>
                  <th className="px-4 py-2 font-medium">연동 상태</th>
                  <th className="px-4 py-2 font-medium">마지막 갱신</th>
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
                    <td className="px-4 py-3 text-right text-xs text-slate-700">
                      {summary?.success ? (
                        <div className="space-y-1 whitespace-nowrap">
                          <p className="font-black text-slate-950">PER {formatMultiple(summary.per)}</p>
                          <p>PBR {formatMultiple(summary.pbr)}</p>
                        </div>
                      ) : summaryLoading ? <span className="text-slate-400">요약 수집 중</span> : summary && !summary.success ? <span className="text-amber-700">요약 실패</span> : <span className="text-slate-400">대기</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-700">
                      {summary?.success ? (
                        <div className="space-y-1 whitespace-nowrap">
                          <p className="font-black text-slate-950">{formatHundredMillionKrw(summary.marketCapHundredMillionKrw)}</p>
                          <p>영업이익 {formatHundredMillionKrw(summary.latestOperatingProfitHundredMillionKrw)}</p>
                        </div>
                      ) : summaryLoading ? <span className="text-slate-400">조회 중</span> : summary && !summary.success ? <span className="text-amber-700">상세에서 재시도</span> : <span className="text-slate-400">대기</span>}
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
              <p>표시 범위: {rows.length ? `${(safePage - 1) * TABLE_PAGE_SIZE + 1}-${Math.min(safePage * TABLE_PAGE_SIZE, rows.length)}` : "0"} / {rows.length}개 · 재무 요약은 현재 페이지 단위로 수집됩니다.</p>
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
              네이버 금융 기준 PER, PBR, 시가총액과 최근 분기별 매출·영업이익·순이익을 조회합니다. 단위는 네이버 금융 표기 기준의 억원입니다.
            </DialogDescription>
          </DialogHeader>

          {!selectedStock ? null : financialDetail.isLoading ? (
            <div className="flex min-h-56 items-center justify-center rounded-3xl bg-slate-50 text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 재무 상세 정보를 불러오는 중입니다.
            </div>
          ) : financialDetail.error ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
              <p className="font-semibold">재무지표 자동 수집에 실패했습니다.</p>
              <p className="mt-2">{financialDetail.error.message} 네이버 금융 페이지 구조 변경, 일시적 차단, 외부 응답 지연이 원인일 수 있습니다.</p>
              <p className="mt-2">수동 확인이 필요하면 네이버 금융에서 종목코드 <span className="font-black">{selectedStock.code}</span>를 검색한 뒤, 종목분석의 주요재무정보 표에서 PER, PBR, 시가총액, 분기별 매출·영업이익·순이익을 확인하세요.</p>
              <a className="mt-3 inline-flex rounded-full bg-white px-4 py-2 text-sm font-bold text-amber-900 underline" href={`https://finance.naver.com/item/main.naver?code=${selectedStock.code}`} target="_blank" rel="noreferrer">네이버 금융 원문 열기</a>
            </div>
          ) : financialDetail.data ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  ["PER", formatMultiple(financialDetail.data.per)],
                  ["PBR", formatMultiple(financialDetail.data.pbr)],
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

              <p className="text-xs leading-5 text-slate-500">출처: {financialDetail.data.source} · 조회 시각: {formatDateTime(financialDetail.data.fetchedAt)}{financialDetail.data.note ? ` · ${financialDetail.data.note}` : ""}</p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
