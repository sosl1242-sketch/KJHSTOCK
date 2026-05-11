import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Activity, ArrowDown, ArrowUp, ArrowUpDown, BarChart3, Globe2, Search, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";

type UsSector = "AI·반도체" | "플랫폼" | "클라우드·소프트웨어" | "소비재" | "헬스케어" | "금융" | "에너지" | "산업재" | "리테일";

type UsStockRow = {
  rank: number;
  ticker: string;
  name: string;
  sector: UsSector;
  exchange: "NASDAQ" | "NYSE";
  price: number;
  change1dPercent: number;
  change5dPercent: number;
  marketCapUsd: number;
  revenueTtmUsd: number;
  grossMarginPercent: number | null;
  operatingMarginPercent: number;
  epsTtm: number;
  peRatio: number | null;
  forwardPeRatio: number | null;
  priceToSalesRatio: number;
  priceToBookRatio: number | null;
  dividendYieldPercent: number;
  beta: number;
  analystUpsidePercent: number;
  lastUpdated: string;
};

type SortKey =
  | "rank"
  | "ticker"
  | "sector"
  | "exchange"
  | "price"
  | "change1dPercent"
  | "change5dPercent"
  | "marketCapUsd"
  | "revenueTtmUsd"
  | "grossMarginPercent"
  | "operatingMarginPercent"
  | "epsTtm"
  | "peRatio"
  | "forwardPeRatio"
  | "priceToSalesRatio"
  | "priceToBookRatio"
  | "dividendYieldPercent"
  | "beta"
  | "analystUpsidePercent"
  | "lastUpdated";

type SortDirection = "asc" | "desc";

const formatUsd = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  if (Math.abs(value) >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}T`;
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}M`;
  return `$${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}`;
};

const formatPrice = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? `$${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}` : "-";

const formatPercent = (value: number | null | undefined, digits = 2) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toLocaleString("ko-KR", { maximumFractionDigits: digits })}%`;
};

const formatPlainPercent = (value: number | null | undefined, digits = 2) =>
  typeof value === "number" && Number.isFinite(value) ? `${value.toLocaleString("ko-KR", { maximumFractionDigits: digits })}%` : "-";

const formatRatio = (value: number | null | undefined, digits = 2) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? `${value.toLocaleString("ko-KR", { maximumFractionDigits: digits })}배` : "-";

const formatNumber = (value: number | null | undefined, digits = 2) =>
  typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("ko-KR", { maximumFractionDigits: digits }) : "-";

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const sortLabels: Record<SortKey, string> = {
  rank: "순위",
  ticker: "티커",
  sector: "섹터",
  exchange: "거래소",
  price: "주가",
  change1dPercent: "1d 등락률",
  change5dPercent: "5d 등락률",
  marketCapUsd: "시가총액",
  revenueTtmUsd: "TTM 매출",
  grossMarginPercent: "매출총이익률",
  operatingMarginPercent: "영업이익률",
  epsTtm: "TTM EPS",
  peRatio: "PER",
  forwardPeRatio: "Forward PER",
  priceToSalesRatio: "P/S",
  priceToBookRatio: "P/B",
  dividendYieldPercent: "배당수익률",
  beta: "베타",
  analystUpsidePercent: "애널리스트 업사이드",
  lastUpdated: "마지막 갱신",
};

const metricGuides: Record<string, { category: string; meaning: string; standard: string; caution: string }> = {
  marketCapUsd: {
    category: "규모",
    meaning: "시가총액은 미국 대형주 안에서 기업의 시장 지배력과 지수 영향력을 보는 기본 축입니다.",
    standard: "같은 섹터 안에서 시가총액 순위와 매출 규모를 함께 비교하면 방어주인지 성장 프리미엄 종목인지 구분하기 좋습니다.",
    caution: "시가총액이 크다고 저평가를 뜻하지는 않습니다. 성장률, 마진, 밸류에이션을 같이 봐야 합니다.",
  },
  revenueTtmUsd: {
    category: "성장 기반",
    meaning: "TTM 매출은 최근 12개월 동안 실제로 만든 외형입니다.",
    standard: "시가총액 대비 매출이 낮으면 고마진·고성장 기대가 반영된 경우가 많고, 높으면 안정형 대형주 성격이 강합니다.",
    caution: "매출만 크고 영업이익률이 낮으면 주가 프리미엄이 유지되기 어렵습니다.",
  },
  grossMarginPercent: {
    category: "수익성",
    meaning: "매출총이익률은 제품 원가를 뺀 뒤 남는 이익률이라 사업 모델의 질을 보여줍니다.",
    standard: "소프트웨어·플랫폼은 높게, 리테일·에너지는 낮게 나오는 것이 자연스러워 섹터별 비교가 필요합니다.",
    caution: "금융업처럼 매출총이익률 개념이 덜 맞는 업종은 영업이익률과 ROE 계열 지표를 우선 봐야 합니다.",
  },
  operatingMarginPercent: {
    category: "본업 수익성",
    meaning: "영업이익률은 본업에서 실제로 남기는 이익 체력을 보여줍니다.",
    standard: "고성장주라도 영업이익률이 개선되는지, 방어주라면 안정적으로 유지되는지가 중요합니다.",
    caution: "일회성 비용이나 구조조정 비용이 들어간 분기는 왜곡될 수 있습니다.",
  },
  epsTtm: {
    category: "주당 이익",
    meaning: "TTM EPS는 최근 12개월 순이익을 주식 수로 나눈 값입니다.",
    standard: "주가와 함께 보면 PER의 기초가 되고, 배당 여력 판단에도 쓰입니다.",
    caution: "자사주 매입으로 EPS가 좋아 보일 수 있어 매출·영업이익 성장과 같이 확인해야 합니다.",
  },
  peRatio: {
    category: "밸류에이션",
    meaning: "PER은 현재 이익 대비 주가가 몇 배에 거래되는지 보여줍니다.",
    standard: "성장주라면 높은 PER이 허용되지만, 성장 둔화가 보이면 빠르게 부담이 됩니다.",
    caution: "일시적으로 이익이 낮아진 기업은 PER이 과도하게 높아 보일 수 있습니다.",
  },
  forwardPeRatio: {
    category: "예상 밸류에이션",
    meaning: "Forward PER은 향후 예상 이익 기준으로 본 가격 부담입니다.",
    standard: "현재 PER보다 낮으면 이익 성장 기대가 반영된 상태로 볼 수 있습니다.",
    caution: "애널리스트 추정치가 틀리면 가장 먼저 흔들리는 지표입니다.",
  },
  priceToSalesRatio: {
    category: "매출 배수",
    meaning: "P/S는 매출 대비 시가총액 배수입니다.",
    standard: "적자 또는 이익 변동성이 큰 성장주는 PER보다 P/S가 더 유용할 수 있습니다.",
    caution: "마진이 낮은 업종의 높은 P/S는 부담 신호일 수 있습니다.",
  },
  priceToBookRatio: {
    category: "자산 배수",
    meaning: "P/B는 순자산 대비 주가 배수입니다.",
    standard: "금융·산업재는 P/B가 의미 있고, 소프트웨어 기업은 무형자산 비중 때문에 높게 나올 수 있습니다.",
    caution: "자본 잠식이나 자사주 영향이 큰 기업은 단순 비교가 어렵습니다.",
  },
  dividendYieldPercent: {
    category: "주주환원",
    meaning: "배당수익률은 주가 대비 연간 배당 매력입니다.",
    standard: "안정형 대형주는 배당과 이익 안정성을 같이 보면 좋습니다.",
    caution: "주가 하락 때문에 배당수익률이 높아진 경우는 배당 삭감 위험도 확인해야 합니다.",
  },
  beta: {
    category: "변동성",
    meaning: "베타는 시장지수 대비 주가가 얼마나 민감하게 움직이는지 보여줍니다.",
    standard: "1보다 높으면 시장보다 변동성이 큰 편, 낮으면 방어적 성격이 강합니다.",
    caution: "과거 변동성 기반 지표라 향후 이벤트 리스크를 보장하지 않습니다.",
  },
  analystUpsidePercent: {
    category: "컨센서스",
    meaning: "애널리스트 업사이드는 목표가 컨센서스가 현재가보다 얼마나 높은지 보여줍니다.",
    standard: "업사이드가 높고 실적 지표도 받쳐주면 관심 후보로 볼 수 있습니다.",
    caution: "목표가는 후행 조정되는 경우가 많아 실적 발표와 가이던스 변화가 더 중요할 때가 많습니다.",
  },
};

const metricOrder: SortKey[] = [
  "marketCapUsd",
  "revenueTtmUsd",
  "grossMarginPercent",
  "operatingMarginPercent",
  "epsTtm",
  "peRatio",
  "forwardPeRatio",
  "priceToSalesRatio",
  "priceToBookRatio",
  "dividendYieldPercent",
  "beta",
  "analystUpsidePercent",
];

export default function GlobalStocks() {
  const [searchText, setSearchText] = useState("");
  const [selectedSector, setSelectedSector] = useState<UsSector | "all">("all");
  const [sortState, setSortState] = useState<{ key: SortKey; direction: SortDirection } | null>({ key: "marketCapUsd", direction: "desc" });
  const [selectedStock, setSelectedStock] = useState<UsStockRow | null>(null);
  const [selectedMetricKey, setSelectedMetricKey] = useState<string | null>(null);

  const summary = trpc.globalStocks.getSummary.useQuery();
  const table = trpc.globalStocks.getTable.useQuery();

  const stocks = useMemo<UsStockRow[]>(() => (table.data?.success ? table.data.stocks : []), [table.data]);
  const sectors = useMemo(() => Array.from(new Set(stocks.map(stock => stock.sector))), [stocks]);

  const filteredRows = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const scoped = stocks.filter(stock => {
      const matchesSector = selectedSector === "all" || stock.sector === selectedSector;
      const matchesSearch = !query || `${stock.ticker} ${stock.name} ${stock.sector} ${stock.exchange}`.toLowerCase().includes(query);
      return matchesSector && matchesSearch;
    });

    if (!sortState) return scoped;

    return [...scoped].sort((a, b) => {
      const aValue = a[sortState.key];
      const bValue = b[sortState.key];
      const compared = typeof aValue === "number" && typeof bValue === "number"
        ? aValue - bValue
        : String(aValue ?? "").localeCompare(String(bValue ?? ""), "ko-KR");
      return sortState.direction === "asc" ? compared : -compared;
    });
  }, [stocks, searchText, selectedSector, sortState]);

  const chartData = useMemo(() => {
    const sectorRows = summary.data?.success ? summary.data.summary.sectors : [];
    return sectorRows.map(sector => ({
      name: sector.sector,
      value: sector.marketCapUsd,
      count: sector.count,
      revenueTtmUsd: sector.revenueTtmUsd,
    }));
  }, [summary.data]);

  const setSort = (key: SortKey) => {
    setSortState(current => {
      if (!current || current.key !== key) return { key, direction: "desc" };
      if (current.direction === "desc") return { key, direction: "asc" };
      return null;
    });
  };

  const sortIcon = (key: SortKey) => {
    if (sortState?.key !== key) return <ArrowUpDown className="h-3.5 w-3.5 text-slate-300" />;
    return sortState.direction === "desc" ? <ArrowDown className="h-3.5 w-3.5 text-slate-950" /> : <ArrowUp className="h-3.5 w-3.5 text-slate-950" />;
  };

  const sortableHeader = (label: string, key: SortKey, align: "left" | "right" = "left") => (
    <button
      type="button"
      className={`inline-flex items-center gap-1 whitespace-nowrap font-semibold transition hover:text-slate-950 ${align === "right" ? "justify-end text-right" : ""}`}
      onClick={() => setSort(key)}
      title={`${label} 기준 정렬`}
    >
      {label}
      {sortIcon(key)}
    </button>
  );

  const currentSortLabel = sortState ? `${sortLabels[sortState.key]} ${sortState.direction === "desc" ? "내림차순" : "오름차순"}` : "정렬취소: 기본 표시순";
  const isLoading = summary.isLoading || table.isLoading;
  const selectedMetric = selectedMetricKey && selectedStock
    ? {
        key: selectedMetricKey,
        label: sortLabels[selectedMetricKey as SortKey] ?? selectedMetricKey,
        value: selectedStock[selectedMetricKey as keyof UsStockRow],
        guide: metricGuides[selectedMetricKey],
      }
    : null;

  const formatMetricValue = (row: UsStockRow, key: string) => {
    const value = row[key as keyof UsStockRow];
    if (key === "marketCapUsd" || key === "revenueTtmUsd") return formatUsd(value as number | null);
    if (key === "grossMarginPercent" || key === "operatingMarginPercent" || key === "dividendYieldPercent") return formatPlainPercent(value as number | null);
    if (key === "analystUpsidePercent") return formatPercent(value as number | null);
    if (key === "epsTtm") return formatPrice(value as number | null);
    if (key === "peRatio" || key === "forwardPeRatio" || key === "priceToSalesRatio" || key === "priceToBookRatio") return formatRatio(value as number | null);
    if (key === "beta") return formatNumber(value as number | null);
    return typeof value === "number" ? formatNumber(value) : `${value ?? "-"}`;
  };

  const detailChartData = useMemo(() => {
    if (!selectedStock) return [];
    const start = selectedStock.price / (1 + selectedStock.change5dPercent / 100);
    return Array.from({ length: 6 }, (_, index) => {
      const progress = index / 5;
      const curve = Math.sin(progress * Math.PI) * selectedStock.change1dPercent * 0.15;
      return {
        label: index === 5 ? "현재" : `D-${5 - index}`,
        price: Number((start + (selectedStock.price - start) * progress + curve).toFixed(2)),
      };
    });
  }, [selectedStock]);

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-[#f7f9fb] p-4 text-slate-950 md:p-8">
      <section className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge className="mb-4 bg-slate-950 text-white hover:bg-slate-950">US Equity Sector Dashboard</Badge>
            <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight md:text-4xl">
              <Globe2 className="h-8 w-8 text-blue-500" /> 미국주식 섹터분석
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              미국 대형주를 섹터별로 묶고 시가총액, TTM 매출, 마진, EPS, PER, P/S, P/B, 배당, 베타, 목표가 여력을 한 화면에서 비교합니다.
            </p>
          </div>
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="티커, 회사명, 섹터 검색" className="rounded-full bg-white pl-9" />
          </div>
        </div>

        {summary.data?.success ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Card className="rounded-[1.5rem] border-0 bg-white/95 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-slate-500">분석 종목</p>
                <p className="mt-2 text-3xl font-black">{summary.data.summary.totalStocks}</p>
              </CardContent>
            </Card>
            <Card className="rounded-[1.5rem] border-0 bg-white/95 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-slate-500">총 시가총액</p>
                <p className="mt-2 text-2xl font-black">{formatUsd(summary.data.summary.totalMarketCapUsd)}</p>
              </CardContent>
            </Card>
            <Card className="rounded-[1.5rem] border-0 bg-white/95 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-slate-500">TTM 매출 합계</p>
                <p className="mt-2 text-2xl font-black">{formatUsd(summary.data.summary.totalRevenueTtmUsd)}</p>
              </CardContent>
            </Card>
            <Card className="rounded-[1.5rem] border-0 bg-white/95 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-slate-500">평균 PER</p>
                <p className="mt-2 text-2xl font-black text-blue-600">{formatRatio(summary.data.summary.avgPeRatio)}</p>
              </CardContent>
            </Card>
            <Card className="rounded-[1.5rem] border-0 bg-white/95 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-slate-500">평균 1d 등락률</p>
                <p className={`mt-2 text-2xl font-black ${summary.data.summary.avgChange1dPercent >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatPercent(summary.data.summary.avgChange1dPercent)}
                </p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <Card className="rounded-[2rem] border-0 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl font-black tracking-tight">
                <BarChart3 className="h-6 w-6 text-blue-500" /> 섹터별 시가총액 차트
              </CardTitle>
              <CardDescription>미국 대형주 섹터별 시장 규모와 매출 규모를 비교합니다.</CardDescription>
            </CardHeader>
            <CardContent className="h-[420px]">
              {isLoading ? (
                <div className="flex h-full items-center justify-center text-slate-500">데이터를 불러오는 중입니다.</div>
              ) : chartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 32, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#475569", fontSize: 12 }} width={132} interval={0} tickLine={false} axisLine={false} />
                    <RechartsTooltip
                      formatter={(value, _name, item) => {
                        const payload = item.payload as { count: number; revenueTtmUsd: number };
                        return [`${formatUsd(Number(value))} · ${payload.count}개 · 매출 ${formatUsd(payload.revenueTtmUsd)}`, "시가총액"];
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 12, 12, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={index % 2 === 0 ? "#60a5fa" : "#f9a8d4"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-500">표시할 섹터 데이터가 없습니다.</div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-0 bg-white/95 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-black">
                <TrendingUp className="h-5 w-5 text-blue-500" /> 미국주식 12개 지표
              </CardTitle>
              <CardDescription>성장성, 수익성, 밸류에이션, 배당, 변동성 지표를 함께 봅니다.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {(summary.data?.success ? summary.data.summary.indicators : []).map(indicator => (
                <div key={indicator.key} className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-sm font-black text-slate-950">{indicator.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{indicator.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant={selectedSector === "all" ? "default" : "outline"} className="rounded-full" onClick={() => setSelectedSector("all")}>전체</Button>
          {sectors.map(sector => (
            <Button key={sector} variant={selectedSector === sector ? "default" : "outline"} className="rounded-full" onClick={() => setSelectedSector(sector)}>
              {sector}
            </Button>
          ))}
        </div>

        <Card className="overflow-hidden rounded-[2rem] border-0 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
          <CardHeader>
            <CardTitle className="text-2xl font-black tracking-tight">미국 대형주 12개 지표 테이블</CardTitle>
            <CardDescription>헤더를 클릭하면 내림차순 → 오름차순 → 정렬취소 순서로 전환됩니다. 국내주식 표와 같은 방식으로 주요 지표를 가로 스크롤 테이블에 배치했습니다.</CardDescription>
          </CardHeader>
          <CardContent className="max-w-full overflow-x-auto">
            <div className="mb-3 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-medium text-slate-500">
              현재 정렬: <span className="font-black text-slate-900">{currentSortLabel}</span> · 표시 종목 {filteredRows.length}개 · 마지막 갱신 {formatDateTime(summary.data?.success ? summary.data.summary.lastUpdated : undefined)}
            </div>
            <table className="w-full min-w-[1760px] border-separate border-spacing-y-2 text-left text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className="px-2 py-2">{sortableHeader("순위", "rank")}</th>
                  <th className="px-2 py-2">{sortableHeader("티커", "ticker")}</th>
                  <th className="px-2 py-2">회사명</th>
                  <th className="px-2 py-2">{sortableHeader("섹터", "sector")}</th>
                  <th className="px-2 py-2">{sortableHeader("거래소", "exchange")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("주가", "price", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("1d", "change1dPercent", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("5d", "change5dPercent", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("시가총액", "marketCapUsd", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("TTM 매출", "revenueTtmUsd", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("매출총이익률", "grossMarginPercent", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("영업이익률", "operatingMarginPercent", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("TTM EPS", "epsTtm", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("PER", "peRatio", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("Forward PER", "forwardPeRatio", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("P/S", "priceToSalesRatio", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("P/B", "priceToBookRatio", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("배당", "dividendYieldPercent", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("베타", "beta", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("업사이드", "analystUpsidePercent", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("마지막 갱신", "lastUpdated", "right")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(row => (
                  <tr
                    key={row.ticker}
                    className="cursor-pointer rounded-2xl bg-slate-50/80 shadow-sm transition hover:bg-blue-50/80"
                    onClick={() => {
                      setSelectedStock(row);
                      setSelectedMetricKey(null);
                    }}
                  >
                    <td className="rounded-l-2xl px-4 py-3 text-slate-500">{row.rank}</td>
                    <td className="px-4 py-3 font-black text-slate-950">{row.ticker}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{row.name}</td>
                    <td className="px-4 py-3"><Badge variant="secondary" className="rounded-full bg-blue-50 text-blue-700">{row.sector}</Badge></td>
                    <td className="px-4 py-3 text-slate-500">{row.exchange}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatPrice(row.price)}</td>
                    <td className="px-4 py-3 text-right"><Badge className={`rounded-full ${row.change1dPercent >= 0 ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50" : "bg-red-50 text-red-700 hover:bg-red-50"}`}>{formatPercent(row.change1dPercent)}</Badge></td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatPercent(row.change5dPercent)}</td>
                    <td className="px-4 py-3 text-right font-black text-slate-950">{formatUsd(row.marketCapUsd)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatUsd(row.revenueTtmUsd)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatPlainPercent(row.grossMarginPercent)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatPlainPercent(row.operatingMarginPercent)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatPrice(row.epsTtm)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatRatio(row.peRatio)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatRatio(row.forwardPeRatio)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatRatio(row.priceToSalesRatio)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatRatio(row.priceToBookRatio)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatPlainPercent(row.dividendYieldPercent)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatNumber(row.beta)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-700">{formatPercent(row.analystUpsidePercent)}</td>
                    <td className="rounded-r-2xl px-4 py-3 text-right text-slate-500">{formatDateTime(row.lastUpdated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredRows.length ? (
              <div className="py-12 text-center text-sm text-slate-500">검색 조건에 맞는 미국주식이 없습니다.</div>
            ) : null}
          </CardContent>
        </Card>

        <Dialog open={Boolean(selectedStock)} onOpenChange={(open) => { if (!open) { setSelectedStock(null); setSelectedMetricKey(null); } }}>
          <DialogContent className="max-h-[88vh] overflow-y-auto border-0 bg-white text-slate-950 sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-3 text-2xl font-black">
                <Activity className="h-6 w-6 text-blue-500" />
                {selectedStock?.name ?? "미국주식"} 상세
              </DialogTitle>
              <DialogDescription>
                미국 대형주 기준 핵심 지표 12개와 최근 가격 흐름을 확인하고, 각 지표 카드를 클릭하면 의미와 판단 기준을 별도 상세창으로 봅니다.
              </DialogDescription>
            </DialogHeader>

            {selectedStock ? (
              <div className="space-y-5">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-slate-950">상단 핵심 카드 12개</h3>
                      <p className="mt-1 text-sm text-slate-500">{selectedStock.ticker} · {selectedStock.exchange} · {selectedStock.sector}</p>
                    </div>
                    <Badge className="rounded-full bg-slate-950 text-white hover:bg-slate-950">미국주식 12개</Badge>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                    {metricOrder.map(key => {
                      const guide = metricGuides[key];
                      return (
                        <button
                          type="button"
                          key={key}
                          className="rounded-3xl bg-slate-50 p-4 text-left transition hover:bg-blue-50 hover:ring-2 hover:ring-blue-100"
                          onClick={() => setSelectedMetricKey(key)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-black text-slate-500">{sortLabels[key]}</p>
                            <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-slate-500 ring-1 ring-slate-200">{guide?.category}</span>
                          </div>
                          <p className="mt-4 text-2xl font-black text-slate-950">{formatMetricValue(selectedStock, key)}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 text-lg font-black text-slate-950"><BarChart3 className="h-5 w-5 text-blue-500" /> 가격 차트</h3>
                      <p className="mt-1 text-sm text-slate-500">최근 5거래일 등락률을 기준으로 만든 요약 가격 흐름입니다.</p>
                    </div>
                    <Badge variant="secondary" className="rounded-full">5d {formatPercent(selectedStock.change5dPercent)}</Badge>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={detailChartData} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="usDetailPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.28} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: "#64748b" }} tickFormatter={value => `$${Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}`} width={74} tickLine={false} axisLine={false} />
                        <RechartsTooltip formatter={value => [formatPrice(Number(value)), "주가"]} />
                        <Area type="monotone" dataKey="price" stroke="#2563eb" strokeWidth={3} fill="url(#usDetailPrice)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(selectedStock && selectedMetric)} onOpenChange={(open) => { if (!open) setSelectedMetricKey(null); }}>
          <DialogContent className="max-h-[88vh] overflow-y-auto border-0 bg-slate-50 text-slate-950 sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-3 text-2xl font-black">
                <TrendingUp className="h-6 w-6 text-blue-500" />
                지표 상세 해설 · {selectedMetric?.label}
              </DialogTitle>
              <DialogDescription>
                {selectedStock?.name} 기준 현재값, 의미, 판단 기준, 주의점을 분리해서 보여줍니다.
              </DialogDescription>
            </DialogHeader>
            {selectedStock && selectedMetric ? (
              <div className="space-y-4">
                <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-100">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black text-blue-700">{selectedMetric.guide?.category ?? "미국주식 지표"}</p>
                      <h4 className="mt-1 text-xl font-black">{selectedStock.name}의 {selectedMetric.label}</h4>
                    </div>
                    <Badge className="rounded-full bg-slate-950 text-white hover:bg-slate-950">현재 {formatMetricValue(selectedStock, selectedMetric.key)}</Badge>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-700">{selectedMetric.guide?.meaning}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-100">
                    <p className="text-xs font-black text-slate-500">판단 기준</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{selectedMetric.guide?.standard}</p>
                  </div>
                  <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-100">
                    <p className="text-xs font-black text-slate-500">주의점</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{selectedMetric.guide?.caution}</p>
                  </div>
                </div>
                <p className="text-xs leading-5 text-slate-500">현재 데이터는 정적 샘플 기반이며, 실시간 투자 판단 전에는 원천 데이터와 최신 공시를 확인해야 합니다.</p>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </section>
    </div>
  );
}
