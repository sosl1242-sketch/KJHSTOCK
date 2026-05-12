import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Activity, ArrowDown, ArrowUp, ArrowUpDown, BarChart3, Bitcoin, Gauge, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";

type CryptoSector = "L1" | "L2" | "AI" | "DeFi" | "Meme" | "Exchange" | "Payments" | "Infrastructure" | "Other";

type CryptoRow = {
  rank: number;
  ticker: string;
  name: string;
  baseAsset: string;
  sector: CryptoSector;
  contractType: "PERPETUAL";
  price: number;
  high24h: number;
  low24h: number;
  change24hPercent: number;
  change7dPercent: number | null;
  marketCapUsd: number | null;
  fdvUsd: number | null;
  circulatingSupply: number | null;
  baseVolume24h: number;
  volume24hUsd: number;
  fundingRate: number;
  markPrice: number | null;
  nextFundingTime: string | null;
  openInterestUsd: number | null;
  volumeToMarketCapPercent: number | null;
  openInterestToMarketCapPercent: number | null;
  openInterestToVolumePercent: number | null;
  volatility30dPercent: number | null;
  longShortRatio: number | null;
  lastUpdated: string;
};

type SortKey =
  | "rank"
  | "ticker"
  | "sector"
  | "price"
  | "high24h"
  | "low24h"
  | "change24hPercent"
  | "change7dPercent"
  | "marketCapUsd"
  | "fdvUsd"
  | "circulatingSupply"
  | "baseVolume24h"
  | "volume24hUsd"
  | "volumeToMarketCapPercent"
  | "fundingRate"
  | "markPrice"
  | "nextFundingTime"
  | "openInterestUsd"
  | "openInterestToMarketCapPercent"
  | "openInterestToVolumePercent"
  | "volatility30dPercent"
  | "longShortRatio"
  | "contractType"
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
  Infrastructure: "인프라",
  Other: "기타",
};

const formatUsd = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  if (Math.abs(value) >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}T`;
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}M`;
  return `$${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}`;
};

const formatPrice = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value >= 100 ? `$${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}` : `$${value.toLocaleString("ko-KR", { maximumFractionDigits: 6 })}`;
};

const formatPercent = (value: number | null | undefined, digits = 2) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toLocaleString("ko-KR", { maximumFractionDigits: digits })}%`;
};

const formatFundingRate = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(4)}%` : "-";

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
  price: "가격",
  high24h: "24h 고가",
  low24h: "24h 저가",
  change24hPercent: "24h 등락률",
  change7dPercent: "7d 등락률",
  marketCapUsd: "시가총액",
  fdvUsd: "FDV",
  circulatingSupply: "유통 공급량",
  baseVolume24h: "24h 거래량",
  volume24hUsd: "24h 거래대금",
  volumeToMarketCapPercent: "거래/시총",
  fundingRate: "펀딩비",
  markPrice: "마크가격",
  nextFundingTime: "다음 펀딩",
  openInterestUsd: "미결제약정",
  openInterestToMarketCapPercent: "OI/시총",
  openInterestToVolumePercent: "OI/거래대금",
  volatility30dPercent: "30d 변동성",
  longShortRatio: "롱/숏 비율",
  contractType: "계약유형",
  lastUpdated: "마지막 갱신",
};

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

const metricOrder: SortKey[] = [
  "volume24hUsd",
  "change24hPercent",
  "fundingRate",
  "openInterestUsd",
  "openInterestToVolumePercent",
  "price",
  "high24h",
  "low24h",
  "baseVolume24h",
  "markPrice",
  "nextFundingTime",
  "contractType",
];

export default function CryptoSectors() {
  const [searchText, setSearchText] = useState("");
  const [selectedSector, setSelectedSector] = useState<CryptoSector | "all">("all");
  const [sortState, setSortState] = useState<{ key: SortKey; direction: SortDirection } | null>({ key: "volume24hUsd", direction: "desc" });
  const [selectedCoin, setSelectedCoin] = useState<CryptoRow | null>(null);
  const [selectedMetricKey, setSelectedMetricKey] = useState<string | null>(null);

  const summary = trpc.cryptoFutures.getSummary.useQuery(undefined, { staleTime: 1000 * 60 * 3, refetchOnWindowFocus: false });
  const table = trpc.cryptoFutures.getTable.useQuery(undefined, { staleTime: 1000 * 60 * 3, refetchOnWindowFocus: false });

  const coins = useMemo<CryptoRow[]>(() => (table.data?.success && table.data?.coins ? table.data.coins : []), [table.data]);
  const sectors = useMemo(() => Array.from(new Set(coins.map(coin => coin.sector))), [coins]);

  const filteredRows = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const filtered = coins.filter(coin => {
      const matchesSector = selectedSector === "all" || coin.sector === selectedSector;
      const matchesSearch = !query || `${coin.ticker} ${coin.name} ${coin.baseAsset} ${coin.sector}`.toLowerCase().includes(query);
      return matchesSector && matchesSearch;
    });

    if (!sortState) return filtered;

    return [...filtered].sort((a, b) => {
      const aValue = a[sortState.key];
      const bValue = b[sortState.key];
      const compared = typeof aValue === "number" && typeof bValue === "number"
        ? aValue - bValue
        : String(aValue ?? "").localeCompare(String(bValue ?? ""), "ko-KR");
      return sortState.direction === "asc" ? compared : -compared;
    });
  }, [coins, searchText, selectedSector, sortState]);

  const chartData = useMemo(() => {
    const sectorRows = summary.data?.success && summary.data?.summary ? summary.data.summary.sectors : [];
    return sectorRows.map(sector => ({
      name: sectorLabels[sector.sector as CryptoSector] ?? sector.sector,
      value: sector.volume24hUsd,
      count: sector.count,
      openInterestUsd: sector.openInterestUsd,
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

  const currentSortLabel = sortState ? `${sortLabels[sortState.key]} ${sortState.direction === "desc" ? "내림차순" : "오름차순"}` : "정렬취소: Binance 거래대금 순";
  const isLoading = summary.isLoading || table.isLoading;
  const dataError = summary.data?.success === false ? summary.data.error : table.data?.success === false ? table.data.error : null;
  const warning = summary.data?.success ? summary.data.summary?.warning : undefined;
  const selectedMetric = selectedMetricKey && selectedCoin
    ? {
        key: selectedMetricKey,
        label: sortLabels[selectedMetricKey as SortKey] ?? selectedMetricKey,
        guide: metricGuides[selectedMetricKey],
      }
    : null;

  const refreshAll = () => {
    void summary.refetch();
    void table.refetch();
  };

  const formatMetricValue = (row: CryptoRow, key: string) => {
    const value = row[key as keyof CryptoRow];
    if (["volume24hUsd", "openInterestUsd", "marketCapUsd", "fdvUsd"].includes(key)) return formatUsd(value as number | null);
    if (["openInterestToVolumePercent", "volumeToMarketCapPercent", "openInterestToMarketCapPercent", "volatility30dPercent", "change24hPercent", "change7dPercent"].includes(key)) return formatPercent(value as number | null);
    if (key === "fundingRate") return formatFundingRate(value as number | null);
    if (["price", "high24h", "low24h", "markPrice"].includes(key)) return formatPrice(value as number | null);
    if (key === "baseVolume24h" || key === "circulatingSupply") return formatNumber(value as number | null, 0);
    if (key === "nextFundingTime" || key === "lastUpdated") return formatDateTime(value as string | null);
    return typeof value === "number" ? value.toLocaleString("ko-KR") : `${value ?? "-"}`;
  };

  const detailChartData = useMemo(() => {
    if (!selectedCoin) return [];
    const low = selectedCoin.low24h || selectedCoin.price;
    const high = selectedCoin.high24h || selectedCoin.price;
    const mid = selectedCoin.markPrice ?? selectedCoin.price;
    return [
      { label: "24h 저가", price: low },
      { label: "중간", price: mid },
      { label: "현재", price: selectedCoin.price },
      { label: "24h 고가", price: high },
    ];
  }, [selectedCoin]);

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-[#f7f9fb] p-4 text-slate-950 md:p-8">
      <section className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge className="mb-4 bg-slate-950 text-white hover:bg-slate-950">Binance USDT Futures Top 100</Badge>
            <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight md:text-4xl">
              <Bitcoin className="h-8 w-8 text-amber-500" /> 크립토 섹터분석
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Binance 공개 API에서 거래 가능한 USDT 무기한 선물 전체 종목을 가져와 거래대금, 등락률, 펀딩비, 미결제약정 중심으로 비교합니다. Binance가 제공하지 않는 시가총액·FDV·7일 등락률은 대시(-)로 표시합니다.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:max-w-xl sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="티커·코인명·섹터 검색" className="rounded-full bg-white pl-9" />
            </div>
            <Button type="button" variant="outline" className="rounded-full bg-white" onClick={refreshAll} disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> 재시도
            </Button>
          </div>
        </div>

        {dataError ? (
          <div className="rounded-3xl border border-red-100 bg-red-50 px-5 py-4 text-sm leading-6 text-red-700">
            Binance 선물 데이터를 불러오지 못했습니다. 실패 원인: {dataError}. 잠시 뒤 재시도 버튼을 눌러 다시 조회하세요.
          </div>
        ) : null}
        {warning ? (
          <div className="rounded-3xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800">{warning}</div>
        ) : null}

        {summary.data?.success ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Card className="rounded-[1.5rem] border-0 bg-white/95 shadow-sm"><CardContent className="p-5"><p className="text-xs font-semibold text-slate-500">분석 코인</p><p className="mt-2 text-3xl font-black">{summary.data.summary?.totalCoins ?? 0}</p></CardContent></Card>
            <Card className="rounded-[1.5rem] border-0 bg-white/95 shadow-sm"><CardContent className="p-5"><p className="text-xs font-semibold text-slate-500">24h 총 거래대금</p><p className="mt-2 text-2xl font-black">{formatUsd(summary.data.summary?.totalVolume24hUsd)}</p></CardContent></Card>
            <Card className="rounded-[1.5rem] border-0 bg-white/95 shadow-sm"><CardContent className="p-5"><p className="text-xs font-semibold text-slate-500">총 미결제약정</p><p className="mt-2 text-2xl font-black">{formatUsd(summary.data.summary?.totalOpenInterestUsd)}</p></CardContent></Card>
            <Card className="rounded-[1.5rem] border-0 bg-white/95 shadow-sm"><CardContent className="p-5"><p className="text-xs font-semibold text-slate-500">평균 펀딩비</p><p className="mt-2 text-2xl font-black text-amber-600">{formatFundingRate(summary.data.summary?.avgFundingRate)}</p></CardContent></Card>
            <Card className="rounded-[1.5rem] border-0 bg-white/95 shadow-sm"><CardContent className="p-5"><p className="text-xs font-semibold text-slate-500">24h 평균 등락률</p><p className={`mt-2 text-2xl font-black ${(summary.data.summary?.avgChange24hPercent ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatPercent(summary.data.summary?.avgChange24hPercent)}</p></CardContent></Card>
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <Card className="rounded-[2rem] border-0 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl font-black tracking-tight"><BarChart3 className="h-6 w-6 text-amber-500" /> 섹터별 거래대금 차트</CardTitle>
              <CardDescription>Binance USDT 무기한 선물 전체 종목을 자체 섹터로 묶어 거래대금과 OI를 비교합니다.</CardDescription>
            </CardHeader>
            <CardContent className="h-[420px]">
              {isLoading ? <div className="flex h-full items-center justify-center text-slate-500">Binance 데이터를 불러오는 중입니다.</div> : chartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 32, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#475569", fontSize: 12 }} width={96} interval={0} tickLine={false} axisLine={false} />
                    <RechartsTooltip formatter={(value, _name, item) => { const payload = item.payload as { count: number; openInterestUsd: number }; return [`${formatUsd(Number(value))} · ${payload.count}개 · OI ${formatUsd(payload.openInterestUsd)}`, "거래대금"]; }} />
                    <Bar dataKey="value" radius={[0, 12, 12, 0]}>{chartData.map((entry, index) => <Cell key={`${entry.name}-${index}`} fill={index % 2 === 0 ? "#fbbf24" : "#60a5fa"} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="flex h-full items-center justify-center text-slate-500">표시할 섹터 데이터가 없습니다.</div>}
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-0 bg-white/95 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-black"><Gauge className="h-5 w-5 text-amber-500" /> 크립토 12개 지표</CardTitle>
              <CardDescription>주식 가치지표 대신 Binance 선물 수급과 계약 지표를 봅니다.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {(summary.data?.success && summary.data.summary ? summary.data.summary.indicators : []).map(indicator => (
                <div key={indicator.key} className="rounded-2xl bg-slate-50 p-3"><p className="text-sm font-black text-slate-950">{indicator.label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{indicator.description}</p></div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant={selectedSector === "all" ? "default" : "outline"} className="rounded-full" onClick={() => setSelectedSector("all")}>전체</Button>
          {sectors.map(sector => <Button key={sector} variant={selectedSector === sector ? "default" : "outline"} className="rounded-full" onClick={() => setSelectedSector(sector)}>{sectorLabels[sector]}</Button>)}
        </div>

        <Card className="overflow-hidden rounded-[2rem] border-0 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
          <CardHeader>
            <CardTitle className="text-2xl font-black tracking-tight">Binance USDT 무기한 선물 전체 테이블</CardTitle>
            <CardDescription>헤더를 클릭하면 정렬이 전환됩니다. 행을 클릭하면 국내주식 상세 흐름처럼 핵심 카드와 지표 해설을 확인할 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent className="max-w-full overflow-x-auto">
            <div className="mb-3 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-medium text-slate-500">
              현재 정렬: <span className="font-black text-slate-900">{currentSortLabel}</span> · 표시 코인 {filteredRows.length}개 · 마지막 갱신 {formatDateTime(summary.data?.success ? summary.data.summary?.lastUpdated : undefined)}
            </div>
            <table className="w-full min-w-[1380px] border-separate border-spacing-y-2 text-left text-sm">
              <thead><tr className="text-slate-500">
                <th className="px-2 py-2">{sortableHeader("순위", "rank")}</th><th className="px-2 py-2">{sortableHeader("티커", "ticker")}</th><th className="px-2 py-2">코인명</th><th className="px-2 py-2">{sortableHeader("섹터", "sector")}</th>
                <th className="px-2 py-2 text-right">{sortableHeader("가격", "price", "right")}</th><th className="px-2 py-2 text-right">{sortableHeader("24h", "change24hPercent", "right")}</th><th className="px-2 py-2 text-right">{sortableHeader("거래대금", "volume24hUsd", "right")}</th><th className="px-2 py-2 text-right">{sortableHeader("펀딩비", "fundingRate", "right")}</th><th className="px-2 py-2 text-right">{sortableHeader("미결제약정", "openInterestUsd", "right")}</th><th className="px-2 py-2 text-right">{sortableHeader("OI/거래", "openInterestToVolumePercent", "right")}</th><th className="px-2 py-2 text-right">{sortableHeader("마크가격", "markPrice", "right")}</th><th className="px-2 py-2 text-right">{sortableHeader("다음 펀딩", "nextFundingTime", "right")}</th>
              </tr></thead>
              <tbody>{filteredRows.map(row => (
                <tr key={row.ticker} className="cursor-pointer rounded-2xl bg-slate-50/80 shadow-sm transition hover:bg-amber-50/80" onClick={() => { setSelectedCoin(row); setSelectedMetricKey(null); }}>
                  <td className="rounded-l-2xl px-4 py-3 text-slate-500">{row.rank}</td><td className="px-4 py-3 font-black text-slate-950">{row.ticker}</td><td className="px-4 py-3 font-semibold text-slate-700">{row.name}</td><td className="px-4 py-3"><Badge variant="secondary" className="rounded-full bg-amber-50 text-amber-700">{sectorLabels[row.sector]}</Badge></td>
                  <td className="px-4 py-3 text-right font-semibold">{formatPrice(row.price)}</td><td className="px-4 py-3 text-right"><Badge className={`rounded-full ${row.change24hPercent >= 0 ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50" : "bg-red-50 text-red-700 hover:bg-red-50"}`}>{formatPercent(row.change24hPercent)}</Badge></td><td className="px-4 py-3 text-right font-black text-slate-950">{formatUsd(row.volume24hUsd)}</td><td className={`px-4 py-3 text-right font-semibold ${row.fundingRate >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatFundingRate(row.fundingRate)}</td><td className="px-4 py-3 text-right text-slate-700">{formatUsd(row.openInterestUsd)}</td><td className="px-4 py-3 text-right text-slate-700">{formatPercent(row.openInterestToVolumePercent)}</td><td className="px-4 py-3 text-right text-slate-700">{formatPrice(row.markPrice)}</td><td className="rounded-r-2xl px-4 py-3 text-right text-slate-500">{formatDateTime(row.nextFundingTime)}</td>
                </tr>
              ))}</tbody>
            </table>
            {!filteredRows.length ? <div className="py-12 text-center text-sm text-slate-500">검색 조건에 맞는 코인이 없습니다. 필터를 초기화하거나 Binance API 재시도를 눌러 주세요.</div> : null}
          </CardContent>
        </Card>

        <Dialog open={Boolean(selectedCoin)} onOpenChange={(open) => { if (!open) { setSelectedCoin(null); setSelectedMetricKey(null); } }}>
          <DialogContent className="max-h-[88vh] overflow-y-auto border-0 bg-white text-slate-950 sm:max-w-5xl">
            <DialogHeader><DialogTitle className="flex flex-wrap items-center gap-3 text-2xl font-black"><Activity className="h-6 w-6 text-amber-500" />{selectedCoin?.name ?? "코인"} 선물 상세</DialogTitle><DialogDescription>핵심 지표 12개와 가격 범위를 확인하고 각 지표 카드를 클릭해 의미·판단 기준·주의점을 봅니다.</DialogDescription></DialogHeader>
            {selectedCoin ? <div className="space-y-5">
              <div><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-black text-slate-950">상단 핵심 카드 12개</h3><p className="mt-1 text-sm text-slate-500">{selectedCoin.ticker} · {sectorLabels[selectedCoin.sector]} · Binance USDT 무기한 선물</p></div><Badge className="rounded-full bg-slate-950 text-white hover:bg-slate-950">실시간 API</Badge></div>
                <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">{metricOrder.map(key => { const guide = metricGuides[key]; return <button type="button" key={key} className="rounded-3xl bg-slate-50 p-4 text-left transition hover:bg-amber-50 hover:ring-2 hover:ring-amber-100" onClick={() => setSelectedMetricKey(key)}><div className="flex items-start justify-between gap-2"><p className="text-xs font-black text-slate-500">{sortLabels[key]}</p><span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-slate-500 ring-1 ring-slate-200">{guide?.category}</span></div><p className="mt-4 text-2xl font-black text-slate-950">{formatMetricValue(selectedCoin, key)}</p></button>; })}</div>
              </div>
              <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-lg font-black text-slate-950"><BarChart3 className="h-5 w-5 text-amber-500" /> 24시간 가격 범위</h3><p className="mt-1 text-sm text-slate-500">24시간 고가·저가, 현재가, 마크가격 기준의 원천 가격 흐름입니다.</p></div><Badge variant="secondary" className="rounded-full">24h {formatPercent(selectedCoin.change24hPercent)}</Badge></div><div className="h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={detailChartData} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}><defs><linearGradient id="cryptoDetailPrice" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.28} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 12, fill: "#64748b" }} tickFormatter={value => `$${Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}`} width={74} tickLine={false} axisLine={false} /><RechartsTooltip formatter={value => [formatPrice(Number(value)), "가격"]} /><Area type="monotone" dataKey="price" stroke="#d97706" strokeWidth={3} fill="url(#cryptoDetailPrice)" /></AreaChart></ResponsiveContainer></div></div>
            </div> : null}
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(selectedCoin && selectedMetric)} onOpenChange={(open) => { if (!open) setSelectedMetricKey(null); }}>
          <DialogContent className="max-h-[88vh] overflow-y-auto border-0 bg-slate-50 text-slate-950 sm:max-w-3xl">
            <DialogHeader><DialogTitle className="flex flex-wrap items-center gap-3 text-2xl font-black"><Gauge className="h-6 w-6 text-amber-500" />지표 상세 해설 · {selectedMetric?.label}</DialogTitle><DialogDescription>{selectedCoin?.name} 기준 현재값, 의미, 판단 기준, 주의점을 분리해서 보여줍니다.</DialogDescription></DialogHeader>
            {selectedCoin && selectedMetric ? <div className="space-y-4"><div className="rounded-3xl bg-white p-5 ring-1 ring-slate-100"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black text-amber-700">{selectedMetric.guide?.category ?? "크립토 지표"}</p><h4 className="mt-1 text-xl font-black">{selectedCoin.name}의 {selectedMetric.label} 분석</h4></div><Badge className="rounded-full bg-slate-950 text-white hover:bg-slate-950">현재 {formatMetricValue(selectedCoin, selectedMetric.key)}</Badge></div><p className="mt-4 text-sm leading-6 text-slate-700">{selectedMetric.guide?.meaning}</p></div><div className="grid gap-4 md:grid-cols-2"><div className="rounded-3xl bg-white p-5 ring-1 ring-slate-100"><p className="text-xs font-black text-slate-500">판단 기준</p><p className="mt-2 text-sm leading-6 text-slate-700">{selectedMetric.guide?.standard}</p></div><div className="rounded-3xl bg-white p-5 ring-1 ring-slate-100"><p className="text-xs font-black text-slate-500">주의점</p><p className="mt-2 text-sm leading-6 text-slate-700">{selectedMetric.guide?.caution}</p></div></div><p className="text-xs leading-5 text-slate-500">현재 데이터는 Binance Futures 공개 API 기준입니다. Binance가 제공하지 않는 시가총액, FDV, 7일 등락률, 롱/숏 비율은 임의 추정하지 않고 표시하지 않습니다.</p></div> : null}
          </DialogContent>
        </Dialog>
      </section>
    </div>
  );
}
