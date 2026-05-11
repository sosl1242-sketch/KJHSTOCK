import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe2 } from "lucide-react";

export default function GlobalStocks() {
  return (
    <div className="min-h-[calc(100vh-3rem)] rounded-[2rem] bg-[#f7f9fb] p-6 text-slate-950 md:p-8">
      <Badge className="mb-5 bg-slate-950 text-white hover:bg-slate-950">Global Equity Sector Dashboard</Badge>
      <Card className="rounded-[2rem] border-0 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-3xl font-black tracking-tight">
            <Globe2 className="h-7 w-7 text-blue-500" /> 해외주식 섹터분석
          </CardTitle>
          <CardDescription>대표 미국주식 100개 섹터 테이블을 구성하는 중입니다. 다음 단계에서 실시간 요약 카드와 정렬 가능한 분석 표가 연결됩니다.</CardDescription>
        </CardHeader>
        <CardContent className="rounded-3xl bg-slate-50 p-6 text-sm font-medium text-slate-600">
          미국 대형주 100개를 기술, 커뮤니케이션, 헬스케어, 금융, 소비재, 에너지 등 섹터로 비교하도록 확장합니다.
        </CardContent>
      </Card>
    </div>
  );
}
