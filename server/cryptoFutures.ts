export const CRYPTO_FUTURES_METRICS = [
  { key: "marketCapUsd", label: "시가총액", description: "유통 물량 기준 시장 규모입니다." },
  { key: "fdvUsd", label: "FDV", description: "최대 공급량 기준 완전희석가치입니다." },
  { key: "circulatingSupply", label: "유통 공급량", description: "현재 시장에 유통되는 토큰 수량입니다." },
  { key: "volume24hUsd", label: "24h 거래대금", description: "최근 24시간 거래 유동성입니다." },
  { key: "volumeToMarketCapPercent", label: "거래대금/시총", description: "시가총액 대비 거래 회전율입니다." },
  { key: "fundingRate", label: "펀딩비", description: "선물 시장의 롱·숏 비용 균형입니다." },
  { key: "openInterestUsd", label: "미결제약정", description: "아직 청산되지 않은 선물 포지션 규모입니다." },
  { key: "openInterestToMarketCapPercent", label: "OI/시총", description: "시가총액 대비 레버리지 포지션 부담입니다." },
  { key: "change24hPercent", label: "24h 등락률", description: "하루 기준 가격 모멘텀입니다." },
  { key: "change7dPercent", label: "7d 등락률", description: "주간 추세 방향입니다." },
  { key: "volatility30dPercent", label: "30d 변동성", description: "최근 한 달 가격 변동 위험입니다." },
  { key: "longShortRatio", label: "롱/숏 비율", description: "선물 포지션 심리의 쏠림 정도입니다." },
] as const;

export type CryptoMetricKey = (typeof CRYPTO_FUTURES_METRICS)[number]["key"];

export type CryptoFuturesAsset = {
  rank: number;
  ticker: string;
  name: string;
  sector: "L1" | "L2" | "AI" | "DeFi" | "Meme" | "Exchange" | "Payments";
  price: number;
  change24hPercent: number;
  change7dPercent: number;
  marketCapUsd: number;
  fdvUsd: number;
  circulatingSupply: number;
  volume24hUsd: number;
  fundingRate: number;
  openInterestUsd: number;
  volatility30dPercent: number;
  longShortRatio: number;
  lastUpdated: string;
};

export type CryptoFuturesTableRow = CryptoFuturesAsset & {
  volumeToMarketCapPercent: number;
  openInterestToMarketCapPercent: number;
};

const nowIso = () => new Date().toISOString();

const assets: Omit<CryptoFuturesAsset, "lastUpdated">[] = [
  { rank: 1, ticker: "BTCUSDT", name: "Bitcoin", sector: "Payments", price: 67850, change24hPercent: 2.1, change7dPercent: 5.8, marketCapUsd: 1338000000000, fdvUsd: 1424000000000, circulatingSupply: 19720000, volume24hUsd: 28500000000, fundingRate: 0.0001, openInterestUsd: 18200000000, volatility30dPercent: 42.5, longShortRatio: 1.08 },
  { rank: 2, ticker: "ETHUSDT", name: "Ethereum", sector: "L1", price: 3580, change24hPercent: 1.8, change7dPercent: 4.6, marketCapUsd: 430500000000, fdvUsd: 430500000000, circulatingSupply: 120250000, volume24hUsd: 15200000000, fundingRate: 0.00008, openInterestUsd: 9600000000, volatility30dPercent: 48.2, longShortRatio: 1.04 },
  { rank: 3, ticker: "BNBUSDT", name: "BNB", sector: "Exchange", price: 612, change24hPercent: 0.9, change7dPercent: 2.4, marketCapUsd: 94100000000, fdvUsd: 94100000000, circulatingSupply: 153800000, volume24hUsd: 2100000000, fundingRate: 0.00005, openInterestUsd: 820000000, volatility30dPercent: 35.6, longShortRatio: 0.98 },
  { rank: 4, ticker: "SOLUSDT", name: "Solana", sector: "L1", price: 142.5, change24hPercent: 3.2, change7dPercent: 8.7, marketCapUsd: 65500000000, fdvUsd: 81500000000, circulatingSupply: 459600000, volume24hUsd: 1850000000, fundingRate: 0.00012, openInterestUsd: 2140000000, volatility30dPercent: 63.1, longShortRatio: 1.18 },
  { rank: 5, ticker: "XRPUSDT", name: "XRP", sector: "Payments", price: 0.61, change24hPercent: 0.6, change7dPercent: 1.9, marketCapUsd: 33800000000, fdvUsd: 61000000000, circulatingSupply: 55400000000, volume24hUsd: 1250000000, fundingRate: 0.00003, openInterestUsd: 760000000, volatility30dPercent: 39.4, longShortRatio: 0.95 },
  { rank: 6, ticker: "DOGEUSDT", name: "Dogecoin", sector: "Meme", price: 0.15, change24hPercent: 4.1, change7dPercent: 11.3, marketCapUsd: 22000000000, fdvUsd: 22000000000, circulatingSupply: 146700000000, volume24hUsd: 1680000000, fundingRate: 0.00016, openInterestUsd: 1180000000, volatility30dPercent: 78.5, longShortRatio: 1.24 },
  { rank: 7, ticker: "ADAUSDT", name: "Cardano", sector: "L1", price: 0.98, change24hPercent: -0.5, change7dPercent: 3.4, marketCapUsd: 34700000000, fdvUsd: 44100000000, circulatingSupply: 35400000000, volume24hUsd: 1200000000, fundingRate: 0.00002, openInterestUsd: 530000000, volatility30dPercent: 44.7, longShortRatio: 0.92 },
  { rank: 8, ticker: "AVAXUSDT", name: "Avalanche", sector: "L1", price: 36.8, change24hPercent: 2.7, change7dPercent: 6.2, marketCapUsd: 14800000000, fdvUsd: 26400000000, circulatingSupply: 402000000, volume24hUsd: 670000000, fundingRate: 0.00009, openInterestUsd: 690000000, volatility30dPercent: 61.8, longShortRatio: 1.11 },
  { rank: 9, ticker: "LINKUSDT", name: "Chainlink", sector: "DeFi", price: 18.2, change24hPercent: 1.4, change7dPercent: 7.1, marketCapUsd: 10700000000, fdvUsd: 18200000000, circulatingSupply: 587000000, volume24hUsd: 520000000, fundingRate: 0.00006, openInterestUsd: 420000000, volatility30dPercent: 52.4, longShortRatio: 1.03 },
  { rank: 10, ticker: "TONUSDT", name: "Toncoin", sector: "L1", price: 6.2, change24hPercent: -1.1, change7dPercent: 2.2, marketCapUsd: 21500000000, fdvUsd: 31500000000, circulatingSupply: 3470000000, volume24hUsd: 410000000, fundingRate: -0.00001, openInterestUsd: 260000000, volatility30dPercent: 49.1, longShortRatio: 0.88 },
  { rank: 11, ticker: "NEARUSDT", name: "NEAR Protocol", sector: "AI", price: 7.1, change24hPercent: 5.2, change7dPercent: 13.4, marketCapUsd: 7800000000, fdvUsd: 8500000000, circulatingSupply: 1098000000, volume24hUsd: 620000000, fundingRate: 0.00018, openInterestUsd: 390000000, volatility30dPercent: 72.6, longShortRatio: 1.31 },
  { rank: 12, ticker: "APTUSDT", name: "Aptos", sector: "L1", price: 9.4, change24hPercent: 2.4, change7dPercent: 5.3, marketCapUsd: 4200000000, fdvUsd: 10300000000, circulatingSupply: 447000000, volume24hUsd: 310000000, fundingRate: 0.00011, openInterestUsd: 240000000, volatility30dPercent: 66.9, longShortRatio: 1.09 },
  { rank: 13, ticker: "ARBUSDT", name: "Arbitrum", sector: "L2", price: 1.28, change24hPercent: 1.2, change7dPercent: 4.1, marketCapUsd: 5100000000, fdvUsd: 12800000000, circulatingSupply: 3980000000, volume24hUsd: 360000000, fundingRate: 0.00007, openInterestUsd: 310000000, volatility30dPercent: 58.4, longShortRatio: 1.02 },
  { rank: 14, ticker: "OPUSDT", name: "Optimism", sector: "L2", price: 2.34, change24hPercent: 0.4, change7dPercent: 3.8, marketCapUsd: 2550000000, fdvUsd: 10050000000, circulatingSupply: 1090000000, volume24hUsd: 185000000, fundingRate: 0.00004, openInterestUsd: 145000000, volatility30dPercent: 55.2, longShortRatio: 0.99 },
  { rank: 15, ticker: "UNIUSDT", name: "Uniswap", sector: "DeFi", price: 10.6, change24hPercent: -0.8, change7dPercent: 1.5, marketCapUsd: 6370000000, fdvUsd: 10600000000, circulatingSupply: 601000000, volume24hUsd: 240000000, fundingRate: -0.00002, openInterestUsd: 190000000, volatility30dPercent: 50.3, longShortRatio: 0.91 },
  { rank: 16, ticker: "SUIUSDT", name: "Sui", sector: "L1", price: 1.84, change24hPercent: 3.8, change7dPercent: 9.9, marketCapUsd: 5100000000, fdvUsd: 18400000000, circulatingSupply: 2770000000, volume24hUsd: 520000000, fundingRate: 0.00014, openInterestUsd: 480000000, volatility30dPercent: 74.2, longShortRatio: 1.21 },
  { rank: 17, ticker: "INJUSDT", name: "Injective", sector: "DeFi", price: 28.5, change24hPercent: 2.9, change7dPercent: 8.2, marketCapUsd: 2800000000, fdvUsd: 2850000000, circulatingSupply: 98200000, volume24hUsd: 210000000, fundingRate: 0.0001, openInterestUsd: 185000000, volatility30dPercent: 69.5, longShortRatio: 1.16 },
  { rank: 18, ticker: "RNDRUSDT", name: "Render", sector: "AI", price: 8.7, change24hPercent: 4.6, change7dPercent: 12.7, marketCapUsd: 3400000000, fdvUsd: 4650000000, circulatingSupply: 390000000, volume24hUsd: 290000000, fundingRate: 0.00017, openInterestUsd: 250000000, volatility30dPercent: 82.1, longShortRatio: 1.28 },
];

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function getCryptoFuturesTable(): CryptoFuturesTableRow[] {
  const lastUpdated = nowIso();
  return assets.map(asset => ({
    ...asset,
    lastUpdated,
    volumeToMarketCapPercent: round((asset.volume24hUsd / asset.marketCapUsd) * 100, 2),
    openInterestToMarketCapPercent: round((asset.openInterestUsd / asset.marketCapUsd) * 100, 2),
  }));
}

export function getCryptoFuturesSummary() {
  const rows = getCryptoFuturesTable();
  const totalMarketCapUsd = rows.reduce((sum, row) => sum + row.marketCapUsd, 0);
  const totalVolume24hUsd = rows.reduce((sum, row) => sum + row.volume24hUsd, 0);
  const totalOpenInterestUsd = rows.reduce((sum, row) => sum + row.openInterestUsd, 0);
  const avgFundingRate = rows.reduce((sum, row) => sum + row.fundingRate, 0) / rows.length;
  const avgChange24hPercent = rows.reduce((sum, row) => sum + row.change24hPercent, 0) / rows.length;
  const topGainer = [...rows].sort((a, b) => b.change24hPercent - a.change24hPercent)[0];
  const topLoser = [...rows].sort((a, b) => a.change24hPercent - b.change24hPercent)[0];
  const hottestFunding = [...rows].sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate))[0];
  const sectors = Array.from(rows.reduce((map, row) => {
    const current = map.get(row.sector) ?? { sector: row.sector, count: 0, marketCapUsd: 0, volume24hUsd: 0 };
    current.count += 1;
    current.marketCapUsd += row.marketCapUsd;
    current.volume24hUsd += row.volume24hUsd;
    map.set(row.sector, current);
    return map;
  }, new Map<CryptoFuturesTableRow["sector"], { sector: CryptoFuturesTableRow["sector"]; count: number; marketCapUsd: number; volume24hUsd: number }>()).values())
    .sort((a, b) => b.marketCapUsd - a.marketCapUsd);

  return {
    totalCoins: rows.length,
    totalMarketCapUsd,
    totalVolume24hUsd,
    totalOpenInterestUsd,
    avgFundingRate,
    avgChange24hPercent: round(avgChange24hPercent, 2),
    topGainer: { ticker: topGainer.ticker, change: topGainer.change24hPercent },
    topLoser: { ticker: topLoser.ticker, change: topLoser.change24hPercent },
    hottestFunding: { ticker: hottestFunding.ticker, fundingRate: hottestFunding.fundingRate },
    sectors,
    indicators: CRYPTO_FUTURES_METRICS,
    lastUpdated: rows[0]?.lastUpdated ?? nowIso(),
  };
}
