import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Activity, ArrowDown, ArrowUp, ArrowUpDown, BarChart3, Bitcoin, Gauge, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";

type CryptoSector = "L1" | "L2" | "AI" | "DeFi" | "Meme" | "Exchange" | "Payments";

type CryptoRow = {
  rank: number;
  ticker: string;
  name: string;
  sector: CryptoSector;
  price: number;
  change24hPercent: number;
  change7dPercent: number;
  marketCapUsd: number;
  fdvUsd: number;
  circulatingSupply: number;
  volume24hUsd: number;
  volumeToMarketCapPercent: number;
  fundingRate: number;
  openInterestUsd: number;
  openInterestToMarketCapPercent: number;
  volatility30dPercent: number;
  longShortRatio: number;
  lastUpdated: string;
};

type SortKey =
  | "rank"
  | "ticker"
  | "sector"
  | "price"
  | "change24hPercent"
  | "change7dPercent"
  | "marketCapUsd"
  | "fdvUsd"
  | "circulatingSupply"
  | "volume24hUsd"
  | "volumeToMarketCapPercent"
  | "fundingRate"
  | "openInterestUsd"
  | "openInterestToMarketCapPercent"
  | "volatility30dPercent"
  | "longShortRatio"
  | "lastUpdated";

type SortDirection = "asc" | "desc";

const sectorLabels: Record<CryptoSector, string> = {
  L1: "L1",
  L2: "L2",
  AI: "AI",
  DeFi: "DeFi",
  Meme: "밈",
  Exchange: "거래소",
  Payments: "결제",
};

const formatUsd = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  if (Math.abs(value) >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}T`;
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}M`;
  return `$${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}`;
};

const formatPrice = (value: number) =>
  value >= 100 ? `$${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}` : `$${value.toLocaleString("ko-KR", { maximumFractionDigits: 4 })}`;

const formatPercent = (value: number | null | undefined, digits = 2) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toLocaleString("ko-KR", { maximumFractionDigits: digits })}%`;
};

const formatRatioPercent = (value: number | null | undefined, digits = 2) =>
  typeof value === "number" && Number.isFinite(value) ? `${value.toLocaleString("ko-KR", { maximumFractionDigits: digits })}%` : "-";

const formatFundingRate = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(4)}%` : "-";

const formatSupply = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}M`;
  return value.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
};

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
  price: "가격",
  change24hPercent: "24h 등락률",
  change7dPercent: "7d 등락률",
  marketCapUsd: "시가총액",
  fdvUsd: "FDV",
  circulatingSupply: "유통 공급량",
  volume24hUsd: "24h 거래대금",
  volumeToMarketCapPercent: "거래대금/시총",
  fundingRate: "펀딩비",
  openInterestUsd: "미결제약정",
  openInterestToMarketCapPercent: "OI/시총",
  volatility30dPercent: "30d 변동성",
  longShortRatio: "롱/숏 비율",
  lastUpdated: "마지막 갱신",
};

const metricGuides: Record<string, { category: string; meaning: string; standard: string; caution: string }> = {
  marketCapUsd: { category: "규모", meaning: "시가총액은 현재 유통 물량 기준으로 시장이 평가하는 코인의 크기입니다.", standard: "대형 코인은 방어력이 높고, 중소형 코인은 변동성과 성장 기대가 더 크게 반영됩니다.", caution: "유통량 변화와 락업 해제가 있으면 시가총액 해석이 빠르게 달라질 수 있습니다." },
  fdvUsd: { category: "토큰 경제", meaning: "FDV는 최대 공급량까지 모두 풀렸다고 가정한 완전희석가치입니다.", standard: "FDV가 시가총액보다 크게 높으면 향후 공급 부담을 점검해야 합니다.", caution: "프로젝트별 락업 일정과 실제 유통 속도를 같이 봐야 합니다." },
  circulatingSupply: { category: "공급", meaning: "유통 공급량은 시장에서 실제 거래 가능한 토큰 수량입니다.", standard: "유통량이 빠르게 증가하면 가격 상승에 공급 부담이 생길 수 있습니다.", caution: "거래소·재단·투자자 물량 구분이 없으면 체감 매도압력과 차이가 날 수 있습니다." },
  volume24hUsd: { category: "유동성", meaning: "24h 거래대금은 최근 하루 동안의 거래 활력을 보여줍니다.", standard: "시총 대비 거래대금이 높은 코인은 관심과 회전율이 높은 편입니다.", caution: "이벤트성 거래량 급증은 오래 지속되지 않을 수 있습니다." },
  volumeToMarketCapPercent: { category: "회전율", meaning: "거래대금/시총은 코인이 하루에 얼마나 활발히 회전했는지 보여줍니다.", standard: "값이 높으면 단기 수급이 강하지만 과열 신호일 수도 있습니다.", caution: "거래소별 중복 거래와 파생상품 영향이 섞일 수 있습니다." },
  fundingRate: { category: "선물 수급", meaning: "펀딩비는 선물 시장에서 롱과 숏 어느 쪽이 비용을 더 내는지 보여줍니다.", standard: "양수는 롱 쏠림, 음수는 숏 쏠림으로 해석합니다.", caution: "강한 추세장에서는 높은 펀딩비가 바로 반전 신호가 아닐 수 있습니다." },
  openInterestUsd: { category: "레버리지", meaning: "미결제약정은 아직 닫히지 않은 선물 포지션 규모입니다.", standard: "가격 상승과 OI 증가가 같이 나오면 레버리지 추세 참여가 늘어난 상태입니다.", caution: "OI가 과도하면 청산 연쇄 위험도 커집니다." },
  openInterestToMarketCapPercent: { category: "레버리지 부담", meaning: "OI/시총은 코인 규모 대비 선물 포지션 부담을 보여줍니다.", standard: "값이 높을수록 파생시장 영향력이 큰 편입니다.", caution: "급락·급등 시 강제청산 변동성이 커질 수 있습니다." },
  change24hPercent: { category: "단기 모멘텀", meaning: "24h 등락률은 하루 기준 가격 방향입니다.", standard: "섹터 내 상대 강도를 빠르게 비교할 때 유용합니다.", caution: "하루 등락률만으로 추세를 판단하면 노이즈에 흔들릴 수 있습니다." },
  change7dPercent: { category: "주간 추세", meaning: "7d 등락률은 일주일 기준 추세 흐름입니다.", standard: "24h와 7d가 동시에 강하면 단기와 주간 모멘텀이 맞물린 상태입니다.", caution: "급등 후 횡보 구간에서는 높게 남아 있어 후행적으로 보일 수 있습니다." },
  volatility30dPercent: { category: "위험", meaning: "30d 변동성은 최근 한 달 가격 움직임의 거친 정도입니다.", standard: "변동성이 높을수록 손익 폭과 리스크 관리 난이도가 커집니다.", caution: "낮은 변동성 뒤에는 큰 변동성 확장이 올 수 있습니다." },
  longShortRatio: { category: "심리", meaning: "롱/숏 비율은 선물 포지션 심리의 쏠림 정도입니다.", standard: "1보다 높으면 롱 우위, 낮으면 숏 우위로 봅니다.", caution: "거래소별 집계 방식이 달라 단일 수치에 과신하면 안 됩니다." },
};

const metricOrder: SortKey[] = [
  "marketCapUsd",
  "fdvUsd",
  "circulatingSupply",
  "volume24hUsd",
  "volumeToMarketCapPercent",
  "fundingRate",
  "openInterestUsd",
  "openInterestToMarketCapPercent",
  "change24hPercent",
  "change7dPercent",
  "volatility30dPercent",
  "longShortRatio",
];

export default function CryptoSectors() {
  const [searchText, setSearchText] = useState("");
  const [selectedSector, setSelectedSector] = useState<CryptoSector | "all">("all");
  const [sortState, setSortState] = useState<{ key: SortKey; direction: SortDirection } | null>({ key: "marketCapUsd", direction: "desc" });
  const [selectedCoin, setSelectedCoin] = useState<CryptoRow | null>(null);
  const [selectedMetricKey, setSelectedMetricKey] = useState<string | null>(null);

  const summary = trpc.cryptoFutures.getSummary.useQuery();
  const table = trpc.cryptoFutures.getTable.useQuery();

  const coins = useMemo<CryptoRow[]>(() => (table.data?.success && table.data?.coins ? table.data.coins : []), [table.data]);
  const sectors = useMemo(() => Array.from(new Set(coins.map(coin => coin.sector))), [coins]);

  const filteredRows = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const filtered = coins.filter(coin => {
      const matchesSector = selectedSector === "all" || coin.sector === selectedSector;
      const matchesSearch = !query || coin.ticker.toLowerCase().includes(query) || coin.name.toLowerCase().includes(query);
      return matchesSector && matchesSearch;
    });

    if (!sortState) return filtered;

    return [...filtered].sort((a, b) => {
      const aValue = a[sortState.key];
      const bValue = b[sortState.key];
      const compared = typeof aValue === "number" && typeof bValue === "number"
        ? aValue - bValue
        : String(aValue).localeCompare(String(bValue), "ko");
      return sortState.direction === "asc" ? compared : -compared;
    });
  }, [coins, searchText, selectedSector, sortState]);

  const chartData = useMemo(() => {
    const sectorRows = summary.data?.success && summary.data?.summary ? summary.data.summary.sectors : [];
    return sectorRows.map(sector => ({
      name: sectorLabels[sector.sector as CryptoSector] ?? sector.sector,
      value: sector.marketCapUsd,
      count: sector.count,
      volume24hUsd: sector.volume24hUsd,
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
  const selectedMetric = selectedMetricKey && selectedCoin
    ? {
        key: selectedMetricKey,
        label: sortLabels[selectedMetricKey as SortKey] ?? selectedMetricKey,
        guide: metricGuides[selectedMetricKey],
      }
    : null;

  const formatMetricValue = (row: CryptoRow, key: string) => {
    const value = row[key as keyof CryptoRow];
    if (key === "marketCapUsd" || key === "fdvUsd" || key === "volume24hUsd" || key === "openInterestUsd") return formatUsd(value as number | null);
    if (key === "circulatingSupply") return formatSupply(value as number | null);
    if (key === "volumeToMarketCapPercent" || key === "openInterestToMarketCapPercent" || key === "volatility30dPercent") return formatRatioPercent(value as number | null);
    if (key === "fundingRate") return formatFundingRate(value as number | null);
    if (key === "change24hPercent" || key === "change7dPercent") return formatPercent(value as number | null);
    if (key === "longShortRatio" && typeof value === "number") return value.toFixed(2);
    return typeof value === "number" ? value.toLocaleString("ko-KR") : `${value ?? "-"}`;
  };

  const detailChartData = useMemo(() => {
    if (!selectedCoin) return [];
    const start = selectedCoin.price / (1 + selectedCoin.change7dPercent / 100);
    return Array.from({ length: 8 }, (_, index) => {
      const progress = index / 7;
      const wave = Math.sin(progress * Math.PI * 2) * selectedCoin.volatility30dPercent * selectedCoin.price * 0.0008;
      return {
        label: index === 7 ? "현재" : `D-${7 - index}`,
        price: Number((start + (selectedCoin.price - start) * progress + wave).toFixed(selectedCoin.price >= 10 ? 2 : 4)),
      };
    });
  }, [selectedCoin]);

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-[#f7f9fb] p-4 text-slate-950 md:p-8">
      <section className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge className="mb-4 bg-slate-950 text-white hover:bg-slate-950">Crypto Futures Sector Dashboard</Badge>
            <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight md:text-4xl">
              <Bitcoin className="h-8 w-8 text-amber-500" /> 크립토 섹터분석
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              PER, PBR, EPS 대신 선물 시장과 토큰 경제에 맞는 시가총액, FDV, 공급량, 거래대금, 펀딩비, 미결제약정, 변동성 지표를 중심으로 비교합니다.
            </p>
          </div>
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="티커 또는 코인명 검색" className="rounded-full bg-white pl-9" />
          </div>
        </div>

        {summary.data?.success ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Card className="rounded-[1.5rem] border-0 bg-white/95 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-slate-500">분석 코인</p>
                <p className="mt-2 text-3xl font-black">{summary.data?.summary?.totalCoins ?? 0}</p>
              </CardContent>
            </Card>
            <Card className="rounded-[1.5rem] border-0 bg-white/95 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-slate-500">총 시가총액</p>
                <p className="mt-2 text-2xl font-black">{formatUsd(summary.data?.summary?.totalMarketCapUsd ?? 0)}</p>
              </CardContent>
            </Card>
            <Card className="rounded-[1.5rem] border-0 bg-white/95 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-slate-500">24h 거래대금</p>
                <p className="mt-2 text-2xl font-black">{formatUsd(summary.data?.summary?.totalVolume24hUsd ?? 0)}</p>
              </CardContent>
            </Card>
            <Card className="rounded-[1.5rem] border-0 bg-white/95 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-slate-500">평균 펀딩비</p>
                <p className="mt-2 text-2xl font-black text-amber-600">{formatFundingRate(summary.data?.summary?.avgFundingRate ?? 0)}</p>
              </CardContent>
            </Card>
            <Card className="rounded-[1.5rem] border-0 bg-white/95 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-slate-500">24h 평균 등락률</p>
                <p className={`mt-2 text-2xl font-black ${(summary.data?.summary?.avgChange24hPercent ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatPercent(summary.data?.summary?.avgChange24hPercent ?? 0)}
                </p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <Card className="rounded-[2rem] border-0 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl font-black tracking-tight">
                <BarChart3 className="h-6 w-6 text-amber-500" /> 섹터별 시가총액 차트
              </CardTitle>
              <CardDescription>크립토 섹터별 시장 규모와 거래대금 흐름을 비교합니다.</CardDescription>
            </CardHeader>
            <CardContent className="h-[420px]">
              {isLoading ? (
                <div className="flex h-full items-center justify-center text-slate-500">데이터를 불러오는 중입니다.</div>
              ) : chartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 32, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#475569", fontSize: 12 }} width={96} interval={0} tickLine={false} axisLine={false} />
                    <RechartsTooltip
                      formatter={(value, _name, item) => {
                        const payload = item.payload as { count: number; volume24hUsd: number };
                        return [`${formatUsd(Number(value))} · ${payload.count}개 · 거래대금 ${formatUsd(payload.volume24hUsd)}`, "시가총액"];
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 12, 12, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={index % 2 === 0 ? "#fbbf24" : "#60a5fa"} />
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
                <Gauge className="h-5 w-5 text-amber-500" /> 크립토 12개 지표
              </CardTitle>
              <CardDescription>주식 수익성 지표 대신 토큰 경제와 선물 수급 지표를 봅니다.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {(summary.data?.success && summary.data?.summary ? summary.data.summary.indicators : []).map(indicator => (
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
              {sectorLabels[sector]}
            </Button>
          ))}
        </div>

        <Card className="overflow-hidden rounded-[2rem] border-0 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
          <CardHeader>
            <CardTitle className="text-2xl font-black tracking-tight">크립토 선물 12개 지표 테이블</CardTitle>
            <CardDescription>헤더를 클릭하면 내림차순 → 오름차순 → 정렬취소 순서로 전환됩니다. PER/PBR 대신 토큰 공급, 유동성, 레버리지 수급, 변동성을 중심으로 봅니다.</CardDescription>
          </CardHeader>
          <CardContent className="max-w-full overflow-x-auto">
            <div className="mb-3 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-medium text-slate-500">
              현재 정렬: <span className="font-black text-slate-900">{currentSortLabel}</span> · 표시 코인 {filteredRows.length}개 · 마지막 갱신 {formatDateTime(summary.data?.success && summary.data?.summary ? summary.data.summary.lastUpdated : undefined)}
            </div>
            <table className="w-full min-w-[1660px] border-separate border-spacing-y-2 text-left text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className="px-2 py-2">{sortableHeader("순위", "rank")}</th>
                  <th className="px-2 py-2">{sortableHeader("티커", "ticker")}</th>
                  <th className="px-2 py-2">코인명</th>
                  <th className="px-2 py-2">{sortableHeader("섹터", "sector")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("가격", "price", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("24h", "change24hPercent", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("7d", "change7dPercent", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("시가총액", "marketCapUsd", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("FDV", "fdvUsd", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("유통 공급량", "circulatingSupply", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("24h 거래대금", "volume24hUsd", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("거래/시총", "volumeToMarketCapPercent", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("펀딩비", "fundingRate", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("미결제약정", "openInterestUsd", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("OI/시총", "openInterestToMarketCapPercent", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("30d 변동성", "volatility30dPercent", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("롱/숏", "longShortRatio", "right")}</th>
                  <th className="px-2 py-2 text-right">{sortableHeader("마지막 갱신", "lastUpdated", "right")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(row => (
                  <tr
                    key={row.ticker}
                    className="cursor-pointer rounded-2xl bg-slate-50/80 shadow-sm transition hover:bg-amber-50/80"
                    onClick={() => {
                      setSelectedCoin(row);
                      setSelectedMetricKey(null);
                    }}
                  >
                    <td className="rounded-l-2xl px-4 py-3 text-slate-500">{row.rank}</td>
                    <td className="px-4 py-3 font-black text-slate-950">{row.ticker}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{row.name}</td>
                    <td className="px-4 py-3"><Badge variant="secondary" className="rounded-full bg-amber-50 text-amber-700">{sectorLabels[row.sector]}</Badge></td>
                    <td className="px-4 py-3 text-right font-semibold">{formatPrice(row.price)}</td>
                    <td className="px-4 py-3 text-right"><Badge className={`rounded-full ${row.change24hPercent >= 0 ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50" : "bg-red-50 text-red-700 hover:bg-red-50"}`}>{formatPercent(row.change24hPercent)}</Badge></td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatPercent(row.change7dPercent)}</td>
                    <td className="px-4 py-3 text-right font-black text-slate-950">{formatUsd(row.marketCapUsd)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatUsd(row.fdvUsd)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatSupply(row.circulatingSupply)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatUsd(row.volume24hUsd)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatRatioPercent(row.volumeToMarketCapPercent)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${row.fundingRate >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatFundingRate(row.fundingRate)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatUsd(row.openInterestUsd)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatRatioPercent(row.openInterestToMarketCapPercent)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatRatioPercent(row.volatility30dPercent)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{row.longShortRatio.toFixed(2)}</td>
                    <td className="rounded-r-2xl px-4 py-3 text-right text-slate-500">{formatDateTime(row.lastUpdated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredRows.length ? (
              <div className="py-12 text-center text-sm text-slate-500">검색 조건에 맞는 코인이 없습니다.</div>
            ) : null}
          </CardContent>
        </Card>

        <Dialog open={Boolean(selectedCoin)} onOpenChange={(open) => { if (!open) { setSelectedCoin(null); setSelectedMetricKey(null); } }}>
          <DialogContent className="max-h-[88vh] overflow-y-auto border-0 bg-white text-slate-950 sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-3 text-2xl font-black">
                <Activity className="h-6 w-6 text-amber-500" />
                {selectedCoin?.name ?? "코인"} 선물 상세
              </DialogTitle>
              <DialogDescription>
                크립토 선물 기준 핵심 지표 12개와 가격 흐름을 확인하고, 각 지표 카드를 클릭하면 의미와 판단 기준을 별도 상세창으로 봅니다.
              </DialogDescription>
            </DialogHeader>

            {selectedCoin ? (
              <div className="space-y-5">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-slate-950">상단 핵심 카드 12개</h3>
                      <p className="mt-1 text-sm text-slate-500">{selectedCoin.ticker} · {sectorLabels[selectedCoin.sector]} · 선물 수급/토큰 경제</p>
                    </div>
                    <Badge className="rounded-full bg-slate-950 text-white hover:bg-slate-950">크립토 12개</Badge>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                    {metricOrder.map(key => {
                      const guide = metricGuides[key];
                      return (
                        <button
                          type="button"
                          key={key}
                          className="rounded-3xl bg-slate-50 p-4 text-left transition hover:bg-amber-50 hover:ring-2 hover:ring-amber-100"
                          onClick={() => setSelectedMetricKey(key)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-black text-slate-500">{sortLabels[key]}</p>
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
                    <div>
                      <h3 className="flex items-center gap-2 text-lg font-black text-slate-950"><BarChart3 className="h-5 w-5 text-amber-500" /> 가격 차트</h3>
                      <p className="mt-1 text-sm text-slate-500">7일 등락률과 30일 변동성을 기준으로 만든 요약 가격 흐름입니다.</p>
                    </div>
                    <Badge variant="secondary" className="rounded-full">7d {formatPercent(selectedCoin.change7dPercent)}</Badge>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={detailChartData} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="cryptoDetailPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.28} />
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: "#64748b" }} tickFormatter={value => `$${Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}`} width={74} tickLine={false} axisLine={false} />
                        <RechartsTooltip formatter={value => [formatPrice(Number(value)), "가격"]} />
                        <Area type="monotone" dataKey="price" stroke="#d97706" strokeWidth={3} fill="url(#cryptoDetailPrice)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(selectedCoin && selectedMetric)} onOpenChange={(open) => { if (!open) setSelectedMetricKey(null); }}>
          <DialogContent className="max-h-[88vh] overflow-y-auto border-0 bg-slate-50 text-slate-950 sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-3 text-2xl font-black">
                <Gauge className="h-6 w-6 text-amber-500" />
                지표 상세 해설 · {selectedMetric?.label}
              </DialogTitle>
              <DialogDescription>
                {selectedCoin?.name} 기준 현재값, 의미, 판단 기준, 주의점을 분리해서 보여줍니다.
              </DialogDescription>
            </DialogHeader>
            {selectedCoin && selectedMetric ? (
              <div className="space-y-4">
                <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-100">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black text-amber-700">{selectedMetric.guide?.category ?? "크립토 지표"}</p>
                      <h4 className="mt-1 text-xl font-black">{selectedCoin.name}의 {selectedMetric.label} 분석</h4>
                    </div>
                    <Badge className="rounded-full bg-slate-950 text-white hover:bg-slate-950">현재 {formatMetricValue(selectedCoin, selectedMetric.key)}</Badge>
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
                <p className="text-xs leading-5 text-slate-500">현재 데이터는 정적 샘플 기반이며, 실시간 투자 판단 전에는 거래소 원천 데이터와 온체인·공시 일정을 확인해야 합니다.</p>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </section>
    </div>
  );
}
