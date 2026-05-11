import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bitcoin } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function CryptoSectors() {
  const { data: summary, isLoading } = trpc.cryptoFutures.getSummary.useQuery();

  return (
    <div className="min-h-[calc(100vh-3rem)] rounded-[2rem] bg-[#f7f9fb] p-6 text-slate-950 md:p-8">
      <Badge className="mb-5 bg-slate-950 text-white hover:bg-slate-950">Crypto Futures Sector Dashboard</Badge>
      <Card className="rounded-[2rem] border-0 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-3xl font-black tracking-tight">
            <Bitcoin className="h-7 w-7 text-amber-500" /> 크립토 섹터분석
          </CardTitle>
          <CardDescription>바이낸스 선물 상장 코인 분석</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="text-center text-slate-500">로딩 중...</div>
          ) : summary?.success && summary.summary ? (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-4">
                  <div className="text-sm text-slate-600">총 코인</div>
                  <div className="text-2xl font-bold">{summary.summary.totalCoins}</div>
                </div>
                <div className="rounded-lg bg-amber-50 p-4">
                  <div className="text-sm text-slate-600">평균 펀딩비</div>
                  <div className="text-2xl font-bold text-amber-600">{(summary.summary.avgFundingRate * 100).toFixed(4)}%</div>
                </div>
                <div className="rounded-lg bg-green-50 p-4">
                  <div className="text-sm text-slate-600">상승 1위</div>
                  <div className="text-lg font-bold">{summary.summary.topGainer.ticker}</div>
                </div>
                <div className="rounded-lg bg-red-50 p-4">
                  <div className="text-sm text-slate-600">하락 1위</div>
                  <div className="text-lg font-bold">{summary.summary.topLoser.ticker}</div>
                </div>
              </div>
              <div className="text-xs text-slate-500">마지막 갱신: {new Date(summary.summary.lastUpdated).toLocaleString('ko-KR')}</div>
            </>
          ) : (
            <div className="text-center text-red-500">데이터 로드 실패</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
