import { ExternalLink } from "lucide-react";
import { coinSummaryText, getCoinProfile } from "@shared/coinProfiles";
import type { FuturesMarketRow } from "@shared/binanceFuturesAnalysis";
import "@/styles/coin-purpose.css";

export function CoinPurpose({ row }: { row: FuturesMarketRow | undefined }) {
  const profile = getCoinProfile(row);
  const nonCrypto = row && row.assetClass !== "crypto";

  return <section className="coin-purpose" aria-label={nonCrypto ? "기초자산 안내" : "코인 소개"}>
    <div className="coin-purpose-heading">
      <h3>{nonCrypto ? "기초자산 안내" : "어떤 코인인가요?"}</h3>
      {profile && <span>{profile.category}</span>}
    </div>
    {profile ? <>
      <p className="coin-purpose-name">{profile.name} <span>({profile.asset})</span></p>
      <p className="coin-purpose-summary">{coinSummaryText(profile.summary)}</p>
      {row && row.baseAsset.trim().toUpperCase() !== profile.asset && <p className="coin-purpose-unit">{row.baseAsset}는 {profile.asset} 1,000개 단위의 계약 표기입니다.</p>}
      <div className="coin-purpose-source">
        <a href={profile.sourceUrl} target="_blank" rel="noreferrer">공식 자료 보기 <ExternalLink aria-hidden="true" /></a>
        <span>자료 확인 <time dateTime={profile.verifiedAt}>{profile.verifiedAt.replaceAll("-", ".")}</time></span>
      </div>
    </> : <p className="coin-purpose-empty">
      {!row ? "Sheet에서 종목을 선택하면 코인의 용도와 토큰 역할을 확인할 수 있습니다."
        : nonCrypto ? `${row.baseAsset}는 주식·지수·상품 등을 기초로 하는 TradeFi 계약입니다. 코인 소개 대상이 아닙니다.`
          : `${row.baseAsset}의 용도와 토큰 역할을 확인한 소개가 아직 없습니다. 공식 프로젝트 자료 확인이 필요합니다.`}
    </p>}
  </section>;
}
