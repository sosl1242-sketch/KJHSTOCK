export const US_STOCK_METRICS = [
  { key: "marketCapUsd", label: "시가총액", description: "상장 주식 기준 기업가치입니다." },
  { key: "revenueTtmUsd", label: "TTM 매출", description: "최근 12개월 누적 매출입니다." },
  { key: "grossMarginPercent", label: "매출총이익률", description: "제품·서비스 원가 이후 남는 이익률입니다." },
  { key: "operatingMarginPercent", label: "영업이익률", description: "본업 수익성의 핵심 지표입니다." },
  { key: "epsTtm", label: "TTM EPS", description: "최근 12개월 주당순이익입니다." },
  { key: "peRatio", label: "PER", description: "현재 이익 대비 주가 배수입니다." },
  { key: "forwardPeRatio", label: "Forward PER", description: "예상 이익 기준 주가 배수입니다." },
  { key: "priceToSalesRatio", label: "P/S", description: "매출 대비 시가총액 배수입니다." },
  { key: "priceToBookRatio", label: "P/B", description: "순자산 대비 주가 배수입니다." },
  { key: "dividendYieldPercent", label: "배당수익률", description: "주가 대비 연간 배당 비율입니다." },
  { key: "beta", label: "베타", description: "시장 대비 가격 민감도입니다." },
  { key: "analystUpsidePercent", label: "애널리스트 업사이드", description: "목표가 컨센서스의 기대 여력입니다." },
] as const;

export type UsStockMetricKey = (typeof US_STOCK_METRICS)[number]["key"];
export type UsStockSector = "AI·반도체" | "플랫폼" | "클라우드·소프트웨어" | "소비재" | "헬스케어" | "금융" | "에너지" | "산업재" | "리테일";

export type UsStockTableRow = {
  rank: number;
  ticker: string;
  name: string;
  sector: UsStockSector;
  exchange: "NASDAQ" | "NYSE";
  price: number;
  change1dPercent: number;
  change5dPercent: number;
  marketCapUsd: number;
  revenueTtmUsd: number;
  grossMarginPercent: number | null;
  operatingMarginPercent: number;
  epsTtm: number;
  peRatio: number | null;
  forwardPeRatio: number | null;
  priceToSalesRatio: number;
  priceToBookRatio: number | null;
  dividendYieldPercent: number;
  beta: number;
  analystUpsidePercent: number;
  lastUpdated: string;
};

const nowIso = () => new Date().toISOString();

const stocks: Omit<UsStockTableRow, "lastUpdated">[] = [
  { rank: 1, ticker: "NVDA", name: "NVIDIA", sector: "AI·반도체", exchange: "NASDAQ", price: 875.4, change1dPercent: 5.2, change5dPercent: 9.4, marketCapUsd: 2150000000000, revenueTtmUsd: 60900000000, grossMarginPercent: 73.8, operatingMarginPercent: 54.1, epsTtm: 11.93, peRatio: 73.4, forwardPeRatio: 34.8, priceToSalesRatio: 35.3, priceToBookRatio: 50.1, dividendYieldPercent: 0.02, beta: 1.72, analystUpsidePercent: 11.5 },
  { rank: 2, ticker: "MSFT", name: "Microsoft", sector: "클라우드·소프트웨어", exchange: "NASDAQ", price: 420.75, change1dPercent: 1.8, change5dPercent: 3.6, marketCapUsd: 3140000000000, revenueTtmUsd: 236600000000, grossMarginPercent: 69.8, operatingMarginPercent: 44.6, epsTtm: 11.8, peRatio: 35.7, forwardPeRatio: 29.3, priceToSalesRatio: 13.3, priceToBookRatio: 12.4, dividendYieldPercent: 0.74, beta: 0.89, analystUpsidePercent: 8.2 },
  { rank: 3, ticker: "AAPL", name: "Apple", sector: "소비재", exchange: "NASDAQ", price: 195.5, change1dPercent: 2.3, change5dPercent: 4.1, marketCapUsd: 3050000000000, revenueTtmUsd: 383300000000, grossMarginPercent: 45.6, operatingMarginPercent: 30.8, epsTtm: 6.13, peRatio: 31.9, forwardPeRatio: 27.4, priceToSalesRatio: 8.0, priceToBookRatio: 39.8, dividendYieldPercent: 0.51, beta: 1.2, analystUpsidePercent: 5.6 },
  { rank: 4, ticker: "GOOGL", name: "Alphabet", sector: "플랫폼", exchange: "NASDAQ", price: 155.3, change1dPercent: 0.9, change5dPercent: 2.4, marketCapUsd: 1930000000000, revenueTtmUsd: 307400000000, grossMarginPercent: 56.9, operatingMarginPercent: 27.4, epsTtm: 5.8, peRatio: 26.8, forwardPeRatio: 21.1, priceToSalesRatio: 6.3, priceToBookRatio: 6.4, dividendYieldPercent: 0.0, beta: 1.05, analystUpsidePercent: 13.8 },
  { rank: 5, ticker: "AMZN", name: "Amazon", sector: "리테일", exchange: "NASDAQ", price: 190.25, change1dPercent: 3.1, change5dPercent: 6.8, marketCapUsd: 1980000000000, revenueTtmUsd: 574800000000, grossMarginPercent: 47.3, operatingMarginPercent: 7.5, epsTtm: 2.9, peRatio: 65.6, forwardPeRatio: 39.2, priceToSalesRatio: 3.4, priceToBookRatio: 9.1, dividendYieldPercent: 0.0, beta: 1.15, analystUpsidePercent: 16.1 },
  { rank: 6, ticker: "META", name: "Meta Platforms", sector: "플랫폼", exchange: "NASDAQ", price: 485.4, change1dPercent: 1.4, change5dPercent: 5.9, marketCapUsd: 1230000000000, revenueTtmUsd: 134900000000, grossMarginPercent: 80.7, operatingMarginPercent: 37.8, epsTtm: 14.87, peRatio: 32.6, forwardPeRatio: 22.5, priceToSalesRatio: 9.1, priceToBookRatio: 8.3, dividendYieldPercent: 0.42, beta: 1.21, analystUpsidePercent: 10.4 },
  { rank: 7, ticker: "BRK.B", name: "Berkshire Hathaway", sector: "금융", exchange: "NYSE", price: 410.2, change1dPercent: 0.5, change5dPercent: 1.1, marketCapUsd: 890000000000, revenueTtmUsd: 364500000000, grossMarginPercent: 34.2, operatingMarginPercent: 17.5, epsTtm: 42.5, peRatio: 9.7, forwardPeRatio: 19.8, priceToSalesRatio: 2.4, priceToBookRatio: 1.6, dividendYieldPercent: 0.0, beta: 0.86, analystUpsidePercent: 4.7 },
  { rank: 8, ticker: "LLY", name: "Eli Lilly", sector: "헬스케어", exchange: "NYSE", price: 780.6, change1dPercent: 2.2, change5dPercent: 7.3, marketCapUsd: 741000000000, revenueTtmUsd: 34100000000, grossMarginPercent: 80.1, operatingMarginPercent: 25.3, epsTtm: 6.32, peRatio: 123.5, forwardPeRatio: 58.2, priceToSalesRatio: 21.7, priceToBookRatio: 56.4, dividendYieldPercent: 0.65, beta: 0.34, analystUpsidePercent: 9.8 },
  { rank: 9, ticker: "AVGO", name: "Broadcom", sector: "AI·반도체", exchange: "NASDAQ", price: 1290.4, change1dPercent: 1.9, change5dPercent: 4.7, marketCapUsd: 600000000000, revenueTtmUsd: 35800000000, grossMarginPercent: 68.9, operatingMarginPercent: 45.2, epsTtm: 32.1, peRatio: 40.2, forwardPeRatio: 28.1, priceToSalesRatio: 16.8, priceToBookRatio: 22.6, dividendYieldPercent: 1.61, beta: 1.25, analystUpsidePercent: 12.3 },
  { rank: 10, ticker: "TSLA", name: "Tesla", sector: "소비재", exchange: "NASDAQ", price: 175.8, change1dPercent: -1.5, change5dPercent: -4.2, marketCapUsd: 560000000000, revenueTtmUsd: 96700000000, grossMarginPercent: 18.2, operatingMarginPercent: 8.1, epsTtm: 3.12, peRatio: 56.3, forwardPeRatio: 44.6, priceToSalesRatio: 5.8, priceToBookRatio: 9.6, dividendYieldPercent: 0.0, beta: 2.3, analystUpsidePercent: 6.4 },
  { rank: 11, ticker: "JPM", name: "JPMorgan Chase", sector: "금융", exchange: "NYSE", price: 198.6, change1dPercent: 0.7, change5dPercent: 2.0, marketCapUsd: 571000000000, revenueTtmUsd: 158100000000, grossMarginPercent: null, operatingMarginPercent: 41.7, epsTtm: 16.25, peRatio: 12.2, forwardPeRatio: 11.4, priceToSalesRatio: 3.6, priceToBookRatio: 1.9, dividendYieldPercent: 2.12, beta: 1.11, analystUpsidePercent: 7.1 },
  { rank: 12, ticker: "UNH", name: "UnitedHealth", sector: "헬스케어", exchange: "NYSE", price: 520.9, change1dPercent: 0.8, change5dPercent: 1.6, marketCapUsd: 480000000000, revenueTtmUsd: 371600000000, grossMarginPercent: 24.8, operatingMarginPercent: 8.4, epsTtm: 22.12, peRatio: 23.6, forwardPeRatio: 18.6, priceToSalesRatio: 1.3, priceToBookRatio: 5.2, dividendYieldPercent: 1.45, beta: 0.62, analystUpsidePercent: 10.9 },
  { rank: 13, ticker: "V", name: "Visa", sector: "금융", exchange: "NYSE", price: 275.1, change1dPercent: 0.6, change5dPercent: 2.2, marketCapUsd: 550000000000, revenueTtmUsd: 32600000000, grossMarginPercent: 78.4, operatingMarginPercent: 66.1, epsTtm: 8.28, peRatio: 33.2, forwardPeRatio: 27.6, priceToSalesRatio: 16.9, priceToBookRatio: 14.1, dividendYieldPercent: 0.75, beta: 0.94, analystUpsidePercent: 9.3 },
  { rank: 14, ticker: "XOM", name: "Exxon Mobil", sector: "에너지", exchange: "NYSE", price: 114.2, change1dPercent: -0.4, change5dPercent: 1.3, marketCapUsd: 455000000000, revenueTtmUsd: 344600000000, grossMarginPercent: 25.1, operatingMarginPercent: 13.8, epsTtm: 8.89, peRatio: 12.8, forwardPeRatio: 12.1, priceToSalesRatio: 1.3, priceToBookRatio: 2.0, dividendYieldPercent: 3.35, beta: 0.96, analystUpsidePercent: 5.2 },
  { rank: 15, ticker: "WMT", name: "Walmart", sector: "리테일", exchange: "NYSE", price: 60.1, change1dPercent: 0.4, change5dPercent: 1.8, marketCapUsd: 486000000000, revenueTtmUsd: 648000000000, grossMarginPercent: 24.4, operatingMarginPercent: 4.1, epsTtm: 2.32, peRatio: 25.9, forwardPeRatio: 23.1, priceToSalesRatio: 0.8, priceToBookRatio: 5.8, dividendYieldPercent: 1.34, beta: 0.49, analystUpsidePercent: 6.8 },
  { rank: 16, ticker: "MA", name: "Mastercard", sector: "금융", exchange: "NYSE", price: 470.5, change1dPercent: 0.9, change5dPercent: 2.7, marketCapUsd: 437000000000, revenueTtmUsd: 25000000000, grossMarginPercent: 77.1, operatingMarginPercent: 58.9, epsTtm: 11.83, peRatio: 39.8, forwardPeRatio: 31.2, priceToSalesRatio: 17.5, priceToBookRatio: 62.5, dividendYieldPercent: 0.56, beta: 1.08, analystUpsidePercent: 8.9 },
  { rank: 17, ticker: "PG", name: "Procter & Gamble", sector: "소비재", exchange: "NYSE", price: 164.7, change1dPercent: 0.3, change5dPercent: 1.0, marketCapUsd: 388000000000, revenueTtmUsd: 83900000000, grossMarginPercent: 50.2, operatingMarginPercent: 23.4, epsTtm: 5.9, peRatio: 27.9, forwardPeRatio: 24.0, priceToSalesRatio: 4.6, priceToBookRatio: 8.1, dividendYieldPercent: 2.34, beta: 0.44, analystUpsidePercent: 4.3 },
  { rank: 18, ticker: "COST", name: "Costco", sector: "리테일", exchange: "NASDAQ", price: 730.2, change1dPercent: 1.0, change5dPercent: 3.0, marketCapUsd: 324000000000, revenueTtmUsd: 248800000000, grossMarginPercent: 12.6, operatingMarginPercent: 3.6, epsTtm: 15.2, peRatio: 48.0, forwardPeRatio: 43.4, priceToSalesRatio: 1.3, priceToBookRatio: 15.9, dividendYieldPercent: 0.56, beta: 0.78, analystUpsidePercent: 3.5 },
  { rank: 19, ticker: "HD", name: "Home Depot", sector: "리테일", exchange: "NYSE", price: 362.5, change1dPercent: -0.2, change5dPercent: 1.2, marketCapUsd: 360000000000, revenueTtmUsd: 152700000000, grossMarginPercent: 33.4, operatingMarginPercent: 14.2, epsTtm: 15.11, peRatio: 24.0, forwardPeRatio: 22.1, priceToSalesRatio: 2.4, priceToBookRatio: null, dividendYieldPercent: 2.32, beta: 0.98, analystUpsidePercent: 7.4 },
  { rank: 20, ticker: "ORCL", name: "Oracle", sector: "클라우드·소프트웨어", exchange: "NYSE", price: 125.6, change1dPercent: 1.6, change5dPercent: 4.4, marketCapUsd: 345000000000, revenueTtmUsd: 51300000000, grossMarginPercent: 71.4, operatingMarginPercent: 29.1, epsTtm: 3.72, peRatio: 33.8, forwardPeRatio: 20.6, priceToSalesRatio: 6.7, priceToBookRatio: 44.0, dividendYieldPercent: 1.27, beta: 1.03, analystUpsidePercent: 8.6 },
  { rank: 21, ticker: "AMD", name: "Advanced Micro Devices", sector: "AI·반도체", exchange: "NASDAQ", price: 166.3, change1dPercent: 2.8, change5dPercent: 7.6, marketCapUsd: 268000000000, revenueTtmUsd: 22680000000, grossMarginPercent: 50.6, operatingMarginPercent: 5.9, epsTtm: 1.32, peRatio: 126.0, forwardPeRatio: 42.5, priceToSalesRatio: 11.8, priceToBookRatio: 4.7, dividendYieldPercent: 0.0, beta: 1.68, analystUpsidePercent: 14.2 },
  { rank: 22, ticker: "CRM", name: "Salesforce", sector: "클라우드·소프트웨어", exchange: "NYSE", price: 295.4, change1dPercent: 1.2, change5dPercent: 2.6, marketCapUsd: 286000000000, revenueTtmUsd: 34800000000, grossMarginPercent: 75.5, operatingMarginPercent: 14.4, epsTtm: 4.21, peRatio: 70.2, forwardPeRatio: 28.8, priceToSalesRatio: 8.2, priceToBookRatio: 4.6, dividendYieldPercent: 0.54, beta: 1.24, analystUpsidePercent: 12.7 },
  { rank: 23, ticker: "NFLX", name: "Netflix", sector: "플랫폼", exchange: "NASDAQ", price: 604.8, change1dPercent: 2.1, change5dPercent: 5.1, marketCapUsd: 260000000000, revenueTtmUsd: 33700000000, grossMarginPercent: 42.5, operatingMarginPercent: 20.6, epsTtm: 12.03, peRatio: 50.3, forwardPeRatio: 32.1, priceToSalesRatio: 7.7, priceToBookRatio: 11.2, dividendYieldPercent: 0.0, beta: 1.26, analystUpsidePercent: 6.9 },
  { rank: 24, ticker: "ADBE", name: "Adobe", sector: "클라우드·소프트웨어", exchange: "NASDAQ", price: 510.3, change1dPercent: -0.7, change5dPercent: 1.1, marketCapUsd: 230000000000, revenueTtmUsd: 19400000000, grossMarginPercent: 87.8, operatingMarginPercent: 35.1, epsTtm: 11.82, peRatio: 43.2, forwardPeRatio: 29.4, priceToSalesRatio: 11.9, priceToBookRatio: 14.0, dividendYieldPercent: 0.0, beta: 1.32, analystUpsidePercent: 15.4 },
];

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function getUsStocksTable(): UsStockTableRow[] {
  const lastUpdated = nowIso();
  return stocks.map(stock => ({ ...stock, lastUpdated }));
}

export function getUsStocksSummary() {
  const rows = getUsStocksTable();
  const totalMarketCapUsd = rows.reduce((sum, row) => sum + row.marketCapUsd, 0);
  const totalRevenueTtmUsd = rows.reduce((sum, row) => sum + row.revenueTtmUsd, 0);
  const avgChange1dPercent = rows.reduce((sum, row) => sum + row.change1dPercent, 0) / rows.length;
  const valuedPeRows = rows.filter(row => typeof row.peRatio === "number" && Number.isFinite(row.peRatio));
  const avgPeRatio = valuedPeRows.reduce((sum, row) => sum + Number(row.peRatio), 0) / valuedPeRows.length;
  const avgAnalystUpsidePercent = rows.reduce((sum, row) => sum + row.analystUpsidePercent, 0) / rows.length;
  const topGainer = [...rows].sort((a, b) => b.change1dPercent - a.change1dPercent)[0];
  const topLoser = [...rows].sort((a, b) => a.change1dPercent - b.change1dPercent)[0];
  const highestMarketCap = [...rows].sort((a, b) => b.marketCapUsd - a.marketCapUsd)[0];
  const sectors = Array.from(rows.reduce((map, row) => {
    const current = map.get(row.sector) ?? { sector: row.sector, count: 0, marketCapUsd: 0, revenueTtmUsd: 0 };
    current.count += 1;
    current.marketCapUsd += row.marketCapUsd;
    current.revenueTtmUsd += row.revenueTtmUsd;
    map.set(row.sector, current);
    return map;
  }, new Map<UsStockSector, { sector: UsStockSector; count: number; marketCapUsd: number; revenueTtmUsd: number }>()).values())
    .sort((a, b) => b.marketCapUsd - a.marketCapUsd);

  return {
    totalStocks: rows.length,
    totalMarketCapUsd,
    totalRevenueTtmUsd,
    avgChange1dPercent: round(avgChange1dPercent, 2),
    avgPeRatio: round(avgPeRatio, 2),
    avgAnalystUpsidePercent: round(avgAnalystUpsidePercent, 2),
    topGainer: { ticker: topGainer.ticker, change: topGainer.change1dPercent },
    topLoser: { ticker: topLoser.ticker, change: topLoser.change1dPercent },
    highestMarketCap: { ticker: highestMarketCap.ticker, marketCapUsd: highestMarketCap.marketCapUsd },
    sectors,
    indicators: US_STOCK_METRICS,
    lastUpdated: rows[0]?.lastUpdated ?? nowIso(),
  };
}
