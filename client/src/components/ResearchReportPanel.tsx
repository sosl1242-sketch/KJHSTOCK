import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, ChevronDown, Clipboard, Download, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { useFuturesResearchReport } from "@/hooks/useFuturesResearchReport";
import { buildFuturesResearchMarkdown, FUTURES_RESEARCH_SOURCES, type ResearchCandidate, type ResearchKey } from "@shared/futuresResearchReport";
import "@/styles/research-report.css";

const number = (value: number | null, digits = 1) => value == null || !Number.isFinite(value) ? "-" : value.toLocaleString("ko-KR", { maximumFractionDigits: digits });
const percent = (value: number | null) => value == null ? "-" : `${number(value)}%`;
const usd = (value: number) => `$${value >= 1e9 ? `${number(value / 1e9, 2)}B` : value >= 1e6 ? `${number(value / 1e6, 2)}M` : number(value, 2)}`;
const time = (value: string | null) => value ? new Date(value).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) : "확인 불가";
const directionText = { up: "상승", down: "하락", mixed: "엇갈림", unknown: "자료 확인 중" };
const frameDirectionText = { up: "상승 추세", down: "하락 추세", sideways: "방향 불명확", unknown: "판단 보류" };
const scenarioStatus = { watch: "조건 관찰", waiting: "재확인 대기", invalidated: "현재 조건 이탈", unavailable: "자료 부족" };

function CandidateDetails({ candidate, onSelect }: { candidate: ResearchCandidate; onSelect: (key: ResearchKey) => void }) {
  return <div className="research-candidate-body">
    <dl className="research-evidence-grid">
      {candidate.evidence.map(item => <div key={item.label}>
        <dt>{item.label}</dt><dd>{item.value}<p>{item.detail}</p></dd>
      </div>)}
    </dl>
    <div className="research-frames">
      {candidate.frames.map(frame => <section key={frame.timeframe} className="research-frame">
        <div className="research-row"><h4>{frame.timeframe === "1h" ? "1시간" : "4시간"} 마감 봉</h4><span className={`research-direction research-${frame.direction}`}>{frameDirectionText[frame.direction]}</span></div>
        <p>{frame.summary}</p>
        {frame.metrics && <dl className="research-frame-metrics">
          <div><dt>RSI 14</dt><dd>{number(frame.metrics.rsi14)}</dd></div>
          <div><dt>직전 20봉 대비 거래량</dt><dd>{frame.metrics.relativeVolume == null ? "확인 불가" : `${number(frame.metrics.relativeVolume, 2)}배`}</dd></div>
        </dl>}
        <small>최근 마감 {time(frame.lastClosedAt)} · 유효 {frame.barCount}봉</small>
      </section>)}
    </div>
    <p className="research-coverage">{candidate.coverage.detail}</p>
    <div className="research-scenarios">
      {candidate.scenarios.map(scenario => <section key={scenario.title}>
        <div className="research-row"><h4>{scenario.title}</h4><span>{scenarioStatus[scenario.status]}</span></div>
        <p>{scenario.condition}</p><p className="research-invalidation"><strong>판단 변경 조건</strong> {scenario.invalidation}</p>
      </section>)}
    </div>
    {candidate.risks.length > 0 && <div className="research-risks"><h4>함께 확인할 위험</h4><ul>{candidate.risks.map(risk => <li key={risk}>{risk}</li>)}</ul></div>}
    <Button variant="outline" onClick={() => onSelect(candidate.key)}>{candidate.row.symbol} 차트·상세 분석 <ArrowUpRight className="h-4 w-4" /></Button>
  </div>;
}

export function ResearchReportPanel({ state, onSelect }: {
  state: ReturnType<typeof useFuturesResearchReport>;
  onSelect: (key: ResearchKey) => void;
}) {
  const { report, loading, error, progress, refresh } = state;
  const [notice, setNotice] = useState("");
  const markdown = useMemo(() => report ? buildFuturesResearchMarkdown(report) : "", [report]);
  const exportReport = () => {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `kjhstock-market-research-${report.generatedAt.slice(0, 10)}.md`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("현재 리포트를 Markdown 파일로 저장했습니다.");
  };
  const copyReport = async () => {
    try { await navigator.clipboard.writeText(markdown); setNotice("현재 리포트를 복사했습니다."); }
    catch { setNotice("복사가 허용되지 않았습니다. 리포트 내보내기를 이용해 주세요."); }
  };
  const stats = report?.overview.stats;
  const breadth = report?.overview.breadth;
  const denominator = breadth ? breadth.positive + breadth.negative + breadth.unchanged || 1 : 1;
  const staleSnapshot = report && Date.now() - Date.parse(report.generatedAt) > 15 * 60_000;

  return <article className="research-report" aria-label="시장 분석 리포트" aria-busy={loading}>
    <header className="research-header">
      <div><h1>시장 분석 리포트</h1><p>시장 전체의 흐름과 종목별 확인 조건을 데이터로 정리합니다.</p></div>
      <div className="research-toolbar">
        <div className="research-actions">
          <Button variant="outline" onClick={() => void refresh()} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}새 분석 생성</Button>
          <Button variant="outline" onClick={exportReport} disabled={!report || loading}><Download className="h-4 w-4" />리포트 내보내기</Button>
          <Button variant="ghost" onClick={() => void copyReport()} disabled={!report || loading} aria-label="분석 리포트 복사"><Clipboard className="h-4 w-4" /></Button>
        </div>
        <p>분석 기준 {time(report?.generatedAt ?? null)}</p>
      </div>
    </header>
    {notice && <p role="status" className="research-notice">{notice}</p>}
    {loading && <div role="status" className="research-state"><Loader2 className="h-4 w-4 animate-spin" />{progress.total ? `1시간·4시간 봉 확인 중 ${progress.completed} / ${progress.total}` : "Binance 시장 데이터를 확인하고 있습니다."}{report && <span>아래에는 직전 리포트를 표시합니다.</span>}</div>}
    {error && <div role="alert" className="research-state research-error"><p>{error}{report && " 아래 내용은 직전 생성 시점의 리포트입니다."}</p><Button variant="outline" onClick={() => void refresh()} disabled={loading}>다시 시도</Button></div>}
    {staleSnapshot && <p className="research-state">생성 후 15분이 지났습니다. 현재 시장을 보려면 새 분석을 생성하세요.</p>}
    {!report && !loading && !error && <p className="research-state">새 분석을 생성하면 시장 흐름과 관찰 조건을 확인할 수 있습니다.</p>}

    {report && stats && breadth && <>
      <section className="research-overview" aria-labelledby="research-verdict">
        <p className="research-section-label">시장 종합 판단</p>
        <h2 id="research-verdict">{report.overview.headline}</h2>
        <p className="research-summary">{report.overview.summary}</p>
        <div className="research-breadth">
          <div className="research-row"><h3>시장 참여 폭</h3><span>{breadth.label}</span></div>
          <div className="research-breadth-bar" role="img" aria-label={`상승 ${breadth.positive}개, 보합 ${breadth.unchanged}개, 하락 ${breadth.negative}개`}>
            <span className="research-breadth-positive" style={{ flexGrow: breadth.positive }} />
            <span className="research-breadth-unchanged" style={{ flexGrow: breadth.unchanged }} />
            <span className="research-breadth-negative" style={{ flexGrow: breadth.negative }} />
          </div>
          <div className="research-breadth-labels"><span><ArrowUp />상승 {breadth.positive} · {percent(100 * breadth.positive / denominator)}</span><span>보합 {breadth.unchanged} · {percent(100 * breadth.unchanged / denominator)}</span><span><ArrowDown />하락 {breadth.negative} · {percent(100 * breadth.negative / denominator)}</span></div>
        </div>
        <dl className="research-summary-metrics">
          <div><dt>24h 거래대금</dt><dd>{usd(stats.representativeVolume24hUsd)}</dd><small>대표 계약 합산</small></div>
          <div><dt>상위 3개 거래 비중</dt><dd>{percent(stats.top3VolumeSharePercent)}</dd><small>거래대금 집중도</small></div>
          <div><dt>펀딩비 확보</dt><dd>{stats.fundingCoveredCount} / {stats.representativeCount}</dd><small>절댓값 0.1% 이상 {stats.extremeFundingCount}개</small></div>
        </dl>
        <p className="research-universe">전체 크립토의 달러·스테이블코인 표시 계약을 코인별 대표 계약으로 묶었습니다. Sheet 필터와 별도로 분석합니다. 24h 등락률 중앙값 {percent(stats.medianChange24hPercent)}.</p>
      </section>
      <div className="research-data-note"><span>1시간·4시간 자료 {stats.freshFrameCount} / {stats.expectedFrameCount}개 최신</span><span>리포트 수치는 생성 시점에 고정됩니다.</span></div>
      {report.overview.riskFlags.length > 0 && <aside className="research-risks"><h3>해석 전에 확인하세요</h3><ul>{report.overview.riskFlags.map(flag => <li key={flag}>{flag}</li>)}</ul></aside>}
      <section aria-labelledby="research-candidates">
        <div className="research-list-heading"><h2 id="research-candidates">관찰할 종목과 확인 조건</h2><p>대표 계약 중 거래대금 상위 50개에서 유동성·상승·하락·펀딩 상황을 고르게 살폈습니다. 순서는 수익률 예측 순위가 아닙니다.</p></div>
        <div className="research-candidate-list">
          {report.candidates.map((candidate, index) => <details key={`${report.generatedAt}:${candidate.key}`} className="research-candidate" open={index === 0}>
            <summary>
              <span className="research-candidate-name"><strong>{candidate.row.symbol}</strong><small>{candidate.row.marketType} · {candidate.row.baseAsset}</small></span>
              <span className={`research-direction research-${candidate.direction}`}>{directionText[candidate.direction]}</span>
              <span className="research-candidate-verdict">{candidate.verdict}<small>{candidate.coverage.detail}</small></span>
              <ChevronDown className="research-chevron" aria-hidden="true" />
            </summary>
            <CandidateDetails candidate={candidate} onSelect={onSelect} />
          </details>)}
          {!report.candidates.length && <div className="research-state">분석할 유효한 대표 계약이 없습니다. 새 분석으로 데이터를 다시 확인해 주세요.</div>}
        </div>
      </section>
      <details className="research-method"><summary>분석 방법과 데이터 출처</summary><ol>{report.method.map(method => <li key={method}>{method}</li>)}</ol><div>{FUTURES_RESEARCH_SOURCES.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}<ArrowUpRight className="h-4 w-4" /></a>)}</div></details>
      <p className="research-footer">이 리포트는 공개 시세와 명시된 계산 규칙으로 작성됩니다. 표시된 조건은 관찰 기준이며, 목표 수익률이나 상승 확률을 뜻하지 않습니다.</p>
    </>}
  </article>;
}
