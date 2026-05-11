import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bitcoin } from "lucide-react";

export default function CryptoSectors() {
  return (
    <div className="min-h-[calc(100vh-3rem)] rounded-[2rem] bg-[#f7f9fb] p-6 text-slate-950 md:p-8">
      <Badge className="mb-5 bg-slate-950 text-white hover:bg-slate-950">Crypto Futures Sector Dashboard</Badge>
      <Card className="rounded-[2rem] border-0 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-3xl font-black tracking-tight">
            <Bitcoin className="h-7 w-7 text-amber-500" /> 크립토 섹터분석
          </CardTitle>
          <CardDescription>바이낸스 선물 상장 코인의 핵심 지표 표를 구성하는 중입니다. 다음 단계에서 시가총액, 공급량, 거래량, 펀딩비를 연결합니다.</CardDescription>
        </CardHeader>
        <CardContent className="rounded-3xl bg-slate-50 p-6 text-sm font-medium text-slate-600">
          선물 상장 코인을 L1, L2, DeFi, AI, Meme, Infrastructure 등 섹터 관점으로 비교하도록 확장합니다.
        </CardContent>
      </Card>
    </div>
  );
}
