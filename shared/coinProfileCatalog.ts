export type CoinProfile = {
  asset: string;
  name: string;
  summary: string;
  category: string;
  sourceUrl: string;
  verifiedAt: string;
  sourceLabel?: string;
  sourceType?: "project" | "exchange";
};

/** Original Korean summaries checked against the linked project sources. */
export const COIN_PROFILE_CATALOG: CoinProfile[] = [
  {
    asset: "BTC",
    name: "비트코인",
    summary:
      "중앙 운영자 없이 참여자들이 거래를 검증하는 P2P 전자화폐 네트워크입니다. BTC는 이 네트워크에서 가치를 보내고 받는 기본 자산입니다.",
    category: "결제·가치 전송",
    sourceUrl: "https://bitcoin.org/en/faq",
    verifiedAt: "2026-09-06",
  },
  {
    asset: "ETH",
    name: "이더리움",
    summary:
      "스마트 계약으로 탈중앙 앱을 실행하는 블록체인입니다. ETH는 거래와 계약 실행 수수료를 내고, 지분증명 검증에 참여할 때 쓰는 기본 자산입니다.",
    category: "레이어 1",
    sourceUrl: "https://ethereum.org/developers/docs/intro-to-ether",
    verifiedAt: "2026-09-06",
  },
  {
    asset: "SOL",
    name: "솔라나",
    summary:
      "토큰과 스마트 계약 앱을 지원하는 블록체인입니다. SOL은 솔라나의 기본 자산으로, 네트워크에서 가치를 전송하고 거래 수수료를 내는 데 사용됩니다.",
    category: "레이어 1",
    sourceUrl: "https://solana.com/learn/introduction-to-solana-tokens",
    verifiedAt: "2026-09-06",
  },
  {
    asset: "BNB",
    name: "비앤비",
    summary:
      "BNB Chain 생태계의 기본 자산입니다. 이더리움과 호환되는 스마트 계약을 실행하는 BNB Smart Chain에서 거래 수수료와 검증자 스테이킹에 사용됩니다.",
    category: "레이어 1",
    sourceUrl: "https://docs.bnbchain.org/bnb-smart-chain/introduction/",
    verifiedAt: "2026-09-06",
  },
  {
    asset: "XRP",
    name: "엑스알피",
    summary:
      "결제와 자산 교환을 지원하는 XRP Ledger의 기본 자산입니다. XRP는 가치를 전송하고 서로 다른 통화 사이의 교환을 연결하며, 거래 비용을 통해 스팸을 억제합니다.",
    category: "결제·가치 전송",
    sourceUrl: "https://xrpl.org/about/faq",
    verifiedAt: "2026-09-06",
  },
  {
    asset: "DOGE",
    name: "도지코인",
    summary:
      "인터넷 밈에서 출발한 커뮤니티 중심의 P2P 암호화폐입니다. DOGE는 공개 블록체인에서 이용자끼리 가치를 주고받거나 결제하는 데 쓰입니다.",
    category: "밈·결제",
    sourceUrl: "https://dogecoin.com/dogepedia/articles/what-is-dogecoin/",
    verifiedAt: "2026-09-06",
  },
  {
    asset: "ADA",
    name: "에이다",
    summary:
      "카르다노 블록체인의 기본 자산입니다. ADA는 중개자 없이 가치를 주고받는 데 사용되며, 보유자는 스테이크 풀에 위임하거나 풀을 운영해 네트워크 검증에 참여할 수 있습니다.",
    category: "레이어 1",
    sourceUrl: "https://cardano.org/what-is-ada/",
    verifiedAt: "2026-09-06",
  },
  {
    asset: "AVAX",
    name: "아발란체",
    summary:
      "여러 레이어 1 체인으로 구성되는 아발란체 생태계의 기본 자산입니다. AVAX는 거래 수수료를 지불하고, 스테이킹으로 네트워크 보안에 참여하는 데 사용됩니다.",
    category: "레이어 1",
    sourceUrl: "https://build.avax.network/docs/primary-network/avax-token",
    verifiedAt: "2026-09-06",
  },
  {
    asset: "SUI",
    name: "수이",
    summary:
      "디지털 자산과 스마트 계약 앱을 처리하는 블록체인입니다. SUI는 거래 수수료, 검증자 스테이킹과 온체인 앱의 자산으로 사용되는 네트워크 기본 토큰입니다.",
    category: "레이어 1",
    sourceUrl:
      "https://docs.sui.io/develop/sui-architecture/tokenomics-overview",
    verifiedAt: "2026-09-06",
  },
  {
    asset: "LINK",
    name: "체인링크",
    summary:
      "블록체인이 외부 데이터와 시스템을 이용하도록 연결하는 오라클 플랫폼입니다. LINK는 서비스 비용을 지불하고, 스테이킹으로 오라클 서비스의 보안을 뒷받침하는 데 쓰입니다.",
    category: "오라클·데이터 연결",
    sourceUrl: "https://chain.link/economics",
    verifiedAt: "2026-09-06",
  },
  {
    asset: "AAVE",
    name: "에이브",
    summary:
      "스마트 계약에 자산을 공급하거나 담보를 맡기고 다른 자산을 빌릴 수 있는 대출 프로토콜입니다. AAVE는 프로토콜 변경과 업그레이드 등을 제안하고 투표하는 거버넌스 토큰입니다.",
    category: "탈중앙 금융·대출",
    sourceUrl: "https://aave.com/help/aave-101/introduction-to-aave",
    verifiedAt: "2026-09-06",
  },
  {
    asset: "UNI",
    name: "유니스왑",
    summary:
      "스마트 계약과 유동성 풀을 통해 토큰 교환을 지원하는 탈중앙 거래 프로토콜입니다. UNI는 프로토콜 업그레이드, 공동 자금과 수수료 정책 등을 결정하는 거버넌스에 사용됩니다.",
    category: "탈중앙 금융·거래소",
    sourceUrl:
      "https://developers.uniswap.org/docs/ecosystem/governance/overview",
    verifiedAt: "2026-09-06",
  },
  {
    asset: "ARB",
    name: "아비트럼",
    summary:
      "롤업 등으로 이더리움 앱의 처리 용량을 확장하는 생태계입니다. ARB는 아비트럼 DAO에서 네트워크 운영과 업그레이드에 관한 제안에 투표하거나 의결권을 위임하는 데 쓰입니다.",
    category: "이더리움 확장",
    sourceUrl: "https://docs.arbitrum.foundation/gentle-intro-dao-governance",
    verifiedAt: "2026-09-06",
  },
  {
    asset: "OP",
    name: "옵티미즘",
    summary:
      "이더리움 확장 기술인 OP Stack과 여러 OP 체인을 만드는 생태계입니다. OP는 프로토콜 업그레이드와 생태계 자금 배분 등을 결정하는 거버넌스에 사용됩니다.",
    category: "이더리움 확장",
    sourceUrl: "https://docs.optimism.io/governance/capital-allocation",
    verifiedAt: "2026-09-06",
  },
  {
    asset: "HYPE",
    name: "하이퍼리퀴드",
    summary:
      "현물·무기한 선물 거래와 스마트 계약 실행을 지원하는 블록체인입니다. HYPE는 HyperEVM의 거래 수수료와 HyperCore 검증자 스테이킹에 쓰이는 기본 자산입니다.",
    category: "거래 특화 블록체인",
    sourceUrl:
      "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm",
    verifiedAt: "2026-09-06",
  },
  {
    asset: "ZEC",
    name: "지캐시",
    summary:
      "영지식 증명을 이용해 송금 정보를 보호하는 전자화폐 네트워크입니다. ZEC는 가치를 보내고 받는 기본 자산이며, 차폐 거래에서는 거래 내역의 공개 범위를 제한할 수 있습니다.",
    category: "프라이버시·결제",
    sourceUrl: "https://www.z.cash/",
    verifiedAt: "2026-09-06",
  },
  {
    asset: "DASH",
    name: "대시",
    summary:
      "일상적인 디지털 결제에 초점을 둔 P2P 암호화폐 네트워크입니다. DASH는 송금과 결제에 쓰이며, 추가 네트워크 서비스를 제공하는 마스터노드 운영 시 담보로 사용됩니다.",
    category: "결제·가치 전송",
    sourceUrl:
      "https://docs.dash.org/en/stable/docs/user/masternodes/index.html",
    verifiedAt: "2026-09-06",
  },
  {
    asset: "HEMI",
    name: "헤미",
    summary:
      "비트코인의 보안과 이더리움의 스마트 계약 기능을 연결하는 네트워크입니다. HEMI는 네트워크 참여, 스테이킹과 거버넌스를 뒷받침하도록 설계된 생태계 토큰입니다.",
    category: "비트코인 확장",
    sourceUrl: "https://hemi.xyz/token",
    verifiedAt: "2026-09-06",
  },
  {
    asset: "WLD",
    name: "월드",
    summary:
      "World ID로 온라인에서 실제 사람임을 증명하는 신원·금융 네트워크입니다. WLD는 참여자에게 배포되는 생태계 토큰으로, 향후 프로토콜 거버넌스 참여를 위해 설계됐습니다.",
    category: "신원·사람 인증",
    sourceUrl: "https://whitepaper.world.org/designing-for-scale",
    verifiedAt: "2026-09-06",
  },
  {
    asset: "TON",
    name: "톤코인 / Gram",
    summary:
      "앱과 결제를 지원하는 TON 블록체인의 기본 자산입니다. 공식 명칭은 Toncoin(TON)에서 Gram(GRAM)으로 변경됐으며, 거래 수수료와 검증 참여에 사용됩니다.",
    category: "레이어 1",
    // The source's media page explicitly maps the former TON ticker to GRAM.
    // https://ton.org/media/
    sourceUrl: "https://ton.org/",
    verifiedAt: "2026-09-06",
  },
  {
    asset: "DOT",
    name: "폴카닷",
    summary:
      "여러 블록체인이 공통 인프라를 활용하도록 하는 네트워크입니다. DOT는 검증자 스테이킹, 온체인 의사결정과 체인 실행 자원인 코어타임 구매에 사용됩니다.",
    category: "블록체인 연결",
    sourceUrl: "https://wiki.polkadot.com/general/faq/",
    verifiedAt: "2026-09-06",
  },
  {
    asset: "LTC",
    name: "라이트코인",
    summary:
      "중앙 기관 없이 이용자끼리 결제할 수 있도록 만든 오픈소스 암호화폐 네트워크입니다. LTC는 라이트코인 블록체인에서 가치를 전송하고 상품·서비스를 결제하는 기본 자산입니다.",
    category: "결제·가치 전송",
    sourceUrl: "https://litecoin.com/what-is-litecoin",
    verifiedAt: "2026-09-06",
  },
  {
    asset: "NEAR",
    name: "니어 프로토콜",
    summary:
      "앱과 스마트 계약을 실행하는 지분증명 블록체인입니다. NEAR는 거래 처리와 데이터 저장 비용을 내고, 스테이킹으로 네트워크 검증에 참여하는 데 쓰이는 기본 자산입니다.",
    category: "레이어 1",
    sourceUrl: "https://docs.near.org/protocol/network/tokens",
    verifiedAt: "2026-09-06",
  },
  {
    asset: "ATOM",
    name: "코스모스 허브",
    summary:
      "코스모스 생태계의 Cosmos Hub를 보호하고 운영하는 토큰입니다. ATOM은 검증자 위임·스테이킹, 허브의 거버넌스와 거래 수수료에 사용됩니다.",
    category: "블록체인 연결",
    sourceUrl:
      "https://docs.cosmos.network/hub/latest/validators/validator-faq",
    verifiedAt: "2026-09-06",
  },
];
