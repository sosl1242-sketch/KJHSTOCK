import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowDown, ArrowUp, ArrowUpDown, BarChart3, Bitcoin, Gauge, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";

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

export default function CryptoSectors() {
  const [searchText, setSearchText] = useState("");
  const [selectedSector, setSelectedSector] = useState<CryptoSector | "all">("all");
  const [sortState, setSortState] = useState<{ key: SortKey; direction: SortDirection } | null>({ key: "marketCapUsd", direction: "desc" });

  const summary = trpc.cryptoFutures.getSummary.useQuery();
  const table = trpc.cryptoFutures.getTable.useQuery();

  const coins = useMemo<CryptoRow[]>(() => (table.data?.success ? table.data.coins : []), [table.data]);
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
    const sectorRows = summary.data?.success ? summary.data.summary.sectors : [];
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
                <p className="mt-2 text-3xl font-black">{summary.data.summary.totalCoins}</p>
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
                <p className="text-xs font-semibold text-slate-500">24h 거래대금</p>
                <p className="mt-2 text-2xl font-black">{formatUsd(summary.data.summary.totalVolume24hUsd)}</p>
              </CardContent>
            </Card>
            <Card className="rounded-[1.5rem] border-0 bg-white/95 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-slate-500">평균 펀딩비</p>
                <p className="mt-2 text-2xl font-black text-amber-600">{formatFundingRate(summary.data.summary.avgFundingRate)}</p>
              </CardContent>
            </Card>
            <Card className="rounded-[1.5rem] border-0 bg-white/95 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-slate-500">24h 평균 등락률</p>
                <p className={`mt-2 text-2xl font-black ${summary.data.summary.avgChange24hPercent >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatPercent(summary.data.summary.avgChange24hPercent)}
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
              현재 정렬: <span className="font-black text-slate-900">{currentSortLabel}</span> · 표시 코인 {filteredRows.length}개 · 마지막 갱신 {formatDateTime(summary.data?.success ? summary.data.summary.lastUpdated : undefined)}
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
                  <tr key={row.ticker} className="rounded-2xl bg-slate-50/80 shadow-sm transition hover:bg-amber-50/80">
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
      </section>
    </div>
  );
}
