import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { BarChart3, Database, Loader2, RefreshCcw, Save, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

type SectorKey =
  | "power"
  | "defense"
  | "semiconductor"
  | "semiconductor_equipment"
  | "display_equipment"
  | "investment_securities";

type SortMode = "desc" | "asc";

type StockForm = {
  id?: number;
  sector: SectorKey;
  name: string;
  code: string;
  marketSuffix: "KS" | "KQ";
  currentPrice: string;
  annualEps: string;
};

const sectors: Array<{ key: SectorKey; label: string; shortLabel: string; description: string }> = [
  { key: "power", label: "전력", shortLabel: "전력", description: "전력 인프라와 전력기기 밸류체인을 추적합니다." },
  { key: "defense", label: "방산", shortLabel: "방산", description: "방위산업 대표 종목의 이익 대비 가격 매력을 비교합니다." },
  { key: "semiconductor", label: "반도체", shortLabel: "반도체", description: "메모리·파운드리 중심 대형 반도체 종목을 분석합니다." },
  { key: "semiconductor_equipment", label: "반도체 장비", shortLabel: "장비", description: "공정·후공정 장비사의 EPS/주가 수익률을 비교합니다." },
  { key: "display_equipment", label: "디스플레이+장비", shortLabel: "디스플레이", description: "패널 및 디스플레이 장비 밸류체인을 함께 봅니다." },
  { key: "investment_securities", label: "투자·증권", shortLabel: "증권", description: "증권·투자 업종의 이익수익률을 정렬해 봅니다." },
];

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

export default function Home() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [selectedSector, setSelectedSector] = useState<SectorKey>("power");
  const [sortMode, setSortMode] = useState<SortMode>("desc");
  const [form, setForm] = useState<StockForm>(() => emptyForm("power"));

  const queryInput = useMemo(() => ({ sector: selectedSector }), [selectedSector]);
  const utils = trpc.useUtils();
  const stocksQuery = trpc.stocks.list.useQuery(queryInput);
  const saveStock = trpc.stocks.save.useMutation({
    onSuccess: async () => {
      toast.success("종목 데이터가 저장되었습니다.");
      setForm(emptyForm(selectedSector));
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
      toast.success("현재 주가를 갱신했습니다.");
      await utils.stocks.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const refreshAll = trpc.stocks.refreshAllPrices.useMutation({
    onSuccess: async results => {
      const failed = results.filter(result => !result.success).length;
      toast.success(failed ? `현재가 갱신 완료, ${failed}건은 확인이 필요합니다.` : "모든 현재가를 갱신했습니다.");
      await utils.stocks.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const selectedSectorMeta = sectors.find(sector => sector.key === selectedSector) ?? sectors[0];
  const rows = useMemo(() => {
    const list = stocksQuery.data ?? [];
    return [...list].sort((a, b) => {
      const aYield = a.earningsYield ?? Number.NEGATIVE_INFINITY;
      const bYield = b.earningsYield ?? Number.NEGATIVE_INFINITY;
      return sortMode === "desc" ? bYield - aYield : aYield - bYield;
    });
  }, [stocksQuery.data, sortMode]);

  const chartData = useMemo(
    () =>
      rows.map(row => ({
        name: row.name,
        code: row.code,
        earningsYield: Number((row.earningsYield ?? 0).toFixed(2)),
      })),
    [rows]
  );

  const averageYield = useMemo(() => {
    const valid = rows.map(row => row.earningsYield).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (!valid.length) return null;
    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
  }, [rows]);

  const updateForm = (key: keyof StockForm, value: string) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const handleSectorChange = (sector: SectorKey) => {
    setSelectedSector(sector);
    setForm(emptyForm(sector));
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

      <section className="relative z-10 mb-8 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-[2rem] bg-white/80 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] ring-1 ring-white">
          <Badge className="mb-5 bg-slate-950 text-white hover:bg-slate-950">Internal Equity Dashboard</Badge>
          <h1 className="max-w-4xl text-4xl font-black tracking-[-0.05em] text-slate-950 md:text-6xl">
            한국 주식 섹터별 EPS/주가 수익률 분석
          </h1>
          <p className="mt-5 max-w-2xl text-base font-light leading-7 text-slate-500 md:text-lg">
            전력, 방산, 반도체, 반도체 장비, 디스플레이·장비, 투자·증권 섹터의 종목별 EPS를 현재 주가와 비교해 Earnings Yield 관점으로 빠르게 정렬하고 시각화합니다.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              onClick={() => setSortMode(sortMode === "desc" ? "asc" : "desc")}
              className="rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800"
            >
              EPS/주가 {sortMode === "desc" ? "내림차순" : "오름차순"}
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
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-400">종목 수</p>
                <p className="text-3xl font-black">{rows.length}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">평균 EPS/주가</p>
                <p className="text-3xl font-black">{formatPercent(averageYield)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-[2rem] border-0 bg-white/80 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-slate-500" /> 권한 상태
              </CardTitle>
              <CardDescription>
                {isAdmin ? "오너 권한으로 편집과 현재가 갱신이 가능합니다." : "일반 사용자는 조회 전용으로 접근합니다."}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      <section className="relative z-10 space-y-6">
        <Tabs value={selectedSector} onValueChange={value => handleSectorChange(value as SectorKey)}>
          <TabsList className="h-auto flex-wrap rounded-full bg-white/80 p-2 shadow-sm">
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
                <BarChart3 className="h-6 w-6 text-blue-500" /> 섹터 내 종목 비교 차트
              </CardTitle>
              <CardDescription>막대 차트는 Recharts 기반이며, 값은 EPS ÷ 현재 주가 × 100으로 계산합니다.</CardDescription>
            </CardHeader>
            <CardContent className="h-[360px]">
              {stocksQuery.isLoading ? (
                <div className="flex h-full items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> 데이터를 불러오는 중입니다.</div>
              ) : chartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 12, left: 0, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} interval={0} angle={-18} textAnchor="end" height={70} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 12 }} tickFormatter={value => `${value}%`} />
                    <Tooltip formatter={(value: number) => [`${value}%`, "EPS/주가"]} labelFormatter={label => `${label}`} />
                    <Bar dataKey="earningsYield" radius={[12, 12, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`${entry.code}-${index}`} fill={index % 2 === 0 ? "#93c5fd" : "#f9a8d4"} />
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
              <CardDescription>EPS는 연간 기준으로 직접 입력하고, 현재가는 수동 입력 또는 외부 API 갱신을 병행합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>섹터</Label>
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
                <div className="space-y-2"><Label>EPS(연간)</Label><Input disabled={!isAdmin} type="number" value={form.annualEps} onChange={event => updateForm("annualEps", event.target.value)} /></div>
              </div>
              <div className="flex gap-2">
                <Button disabled={!isAdmin || saveStock.isPending} onClick={handleSave} className="flex-1 bg-slate-950 hover:bg-slate-800">
                  {saveStock.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  저장
                </Button>
                <Button disabled={!isAdmin} variant="outline" onClick={() => setForm(emptyForm(selectedSector))}>초기화</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden rounded-[2rem] border-0 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
          <CardHeader>
            <CardTitle className="text-2xl font-black tracking-tight">종목 테이블</CardTitle>
            <CardDescription>현재 주가가 0이거나 EPS가 입력되지 않은 종목은 EPS/주가 수익률 계산에서 제외됩니다.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-separate border-spacing-y-2 text-left text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className="px-4 py-2 font-medium">종목명</th>
                  <th className="px-4 py-2 font-medium">종목코드</th>
                  <th className="px-4 py-2 text-right font-medium">현재 주가</th>
                  <th className="px-4 py-2 text-right font-medium">EPS(연간)</th>
                  <th className="px-4 py-2 text-right font-medium">EPS/주가(%)</th>
                  <th className="px-4 py-2 font-medium">데이터 출처</th>
                  <th className="px-4 py-2 text-right font-medium">관리</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} className="rounded-2xl bg-slate-50/80 shadow-sm">
                    <td className="rounded-l-2xl px-4 py-3 font-bold text-slate-950">{row.name}</td>
                    <td className="px-4 py-3 text-slate-500">{row.code}.{row.marketSuffix}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(row.currentPrice)}원</td>
                    <td className="px-4 py-3 text-right">{formatNumber(row.annualEps)}원</td>
                    <td className="px-4 py-3 text-right font-black text-slate-950">{formatPercent(row.earningsYield)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{row.dataSource}</td>
                    <td className="rounded-r-2xl px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" disabled={!isAdmin || refreshPrice.isPending} onClick={() => refreshPrice.mutate({ id: row.id, code: row.code, marketSuffix: row.marketSuffix as "KS" | "KQ" })}>
                          <RefreshCcw className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" disabled={!isAdmin} onClick={() => handleEdit(row)}>수정</Button>
                        <Button size="sm" variant="destructive" disabled={!isAdmin} onClick={() => deleteStock.mutate({ id: row.id })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
