import { buildTechnicalIndicatorDetailFromCandles, PriceCandle } from "./technicalIndicators";
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
  volume: number | null;
  turnoverUsd: number | null;
  quoteSource: "Stooq" | "Fallback";
  quoteStatus: "live" | "fallback";
  quoteWarning?: string;
  lastUpdated: string;
};

type BaseUsStock = Omit<UsStockTableRow, "lastUpdated" | "volume" | "turnoverUsd" | "quoteSource" | "quoteStatus" | "quoteWarning">;

type StooqQuote = {
  ticker: string;
  close: number;
  open: number | null;
  volume: number | null;
  updatedAt: string;
};


type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      meta?: { symbol?: string };
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
    error?: unknown;
  };
};

const nowIso = () => new Date().toISOString();

const stocks: BaseUsStock[] = [
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
  { rank: 25, ticker: "INTC", name: "Intel", sector: "AI·반도체", exchange: "NASDAQ", price: 31.2, change1dPercent: -1.2, change5dPercent: -3.4, marketCapUsd: 132000000000, revenueTtmUsd: 54200000000, grossMarginPercent: 41.8, operatingMarginPercent: -2.1, epsTtm: -0.38, peRatio: null, forwardPeRatio: 22.5, priceToSalesRatio: 2.4, priceToBookRatio: 1.1, dividendYieldPercent: 2.0, beta: 1.05, analystUpsidePercent: 8.3 },
  { rank: 26, ticker: "QCOM", name: "Qualcomm", sector: "AI·반도체", exchange: "NASDAQ", price: 162.4, change1dPercent: 1.5, change5dPercent: 3.8, marketCapUsd: 181000000000, revenueTtmUsd: 38900000000, grossMarginPercent: 55.2, operatingMarginPercent: 28.4, epsTtm: 8.46, peRatio: 19.2, forwardPeRatio: 14.8, priceToSalesRatio: 4.7, priceToBookRatio: 6.2, dividendYieldPercent: 2.18, beta: 1.22, analystUpsidePercent: 11.4 },
  { rank: 27, ticker: "TXN", name: "Texas Instruments", sector: "AI·반도체", exchange: "NASDAQ", price: 178.3, change1dPercent: 0.6, change5dPercent: 1.8, marketCapUsd: 162000000000, revenueTtmUsd: 15800000000, grossMarginPercent: 62.4, operatingMarginPercent: 38.1, epsTtm: 5.26, peRatio: 33.9, forwardPeRatio: 28.4, priceToSalesRatio: 10.3, priceToBookRatio: 8.5, dividendYieldPercent: 2.96, beta: 1.04, analystUpsidePercent: 5.8 },
  { rank: 28, ticker: "MU", name: "Micron Technology", sector: "AI·반도체", exchange: "NASDAQ", price: 95.6, change1dPercent: 3.2, change5dPercent: 8.1, marketCapUsd: 106000000000, revenueTtmUsd: 25100000000, grossMarginPercent: 22.6, operatingMarginPercent: 4.8, epsTtm: 1.3, peRatio: 73.5, forwardPeRatio: 10.2, priceToSalesRatio: 4.2, priceToBookRatio: 2.1, dividendYieldPercent: 0.45, beta: 1.41, analystUpsidePercent: 22.3 },
  { rank: 29, ticker: "AMAT", name: "Applied Materials", sector: "AI·반도체", exchange: "NASDAQ", price: 195.4, change1dPercent: 2.1, change5dPercent: 5.4, marketCapUsd: 166000000000, revenueTtmUsd: 26500000000, grossMarginPercent: 47.2, operatingMarginPercent: 29.8, epsTtm: 8.52, peRatio: 22.9, forwardPeRatio: 17.6, priceToSalesRatio: 6.3, priceToBookRatio: 8.4, dividendYieldPercent: 0.88, beta: 1.35, analystUpsidePercent: 13.6 },
  { rank: 30, ticker: "LRCX", name: "Lam Research", sector: "AI·반도체", exchange: "NASDAQ", price: 890.2, change1dPercent: 1.8, change5dPercent: 4.9, marketCapUsd: 118000000000, revenueTtmUsd: 14900000000, grossMarginPercent: 47.8, operatingMarginPercent: 30.2, epsTtm: 38.4, peRatio: 23.2, forwardPeRatio: 18.1, priceToSalesRatio: 7.9, priceToBookRatio: 12.3, dividendYieldPercent: 1.12, beta: 1.38, analystUpsidePercent: 10.8 },
  { rank: 31, ticker: "KLAC", name: "KLA Corporation", sector: "AI·반도체", exchange: "NASDAQ", price: 720.5, change1dPercent: 1.4, change5dPercent: 3.7, marketCapUsd: 98000000000, revenueTtmUsd: 9800000000, grossMarginPercent: 59.4, operatingMarginPercent: 38.6, epsTtm: 25.8, peRatio: 27.9, forwardPeRatio: 22.4, priceToSalesRatio: 10.0, priceToBookRatio: 18.6, dividendYieldPercent: 0.96, beta: 1.28, analystUpsidePercent: 9.4 },
  { rank: 32, ticker: "MRVL", name: "Marvell Technology", sector: "AI·반도체", exchange: "NASDAQ", price: 68.4, change1dPercent: 2.6, change5dPercent: 6.8, marketCapUsd: 59000000000, revenueTtmUsd: 5500000000, grossMarginPercent: 49.2, operatingMarginPercent: 8.4, epsTtm: 0.48, peRatio: 142.5, forwardPeRatio: 28.6, priceToSalesRatio: 10.7, priceToBookRatio: 3.8, dividendYieldPercent: 0.0, beta: 1.52, analystUpsidePercent: 18.9 },
  { rank: 33, ticker: "ASML", name: "ASML Holding", sector: "AI·반도체", exchange: "NASDAQ", price: 880.6, change1dPercent: 1.2, change5dPercent: 3.1, marketCapUsd: 347000000000, revenueTtmUsd: 27600000000, grossMarginPercent: 51.3, operatingMarginPercent: 32.4, epsTtm: 21.8, peRatio: 40.4, forwardPeRatio: 28.9, priceToSalesRatio: 12.6, priceToBookRatio: 18.4, dividendYieldPercent: 0.82, beta: 1.18, analystUpsidePercent: 8.7 },
  { rank: 34, ticker: "NOW", name: "ServiceNow", sector: "클라우드·소프트웨어", exchange: "NYSE", price: 820.4, change1dPercent: 1.6, change5dPercent: 4.2, marketCapUsd: 168000000000, revenueTtmUsd: 9600000000, grossMarginPercent: 79.2, operatingMarginPercent: 18.6, epsTtm: 5.22, peRatio: 157.2, forwardPeRatio: 52.4, priceToSalesRatio: 17.5, priceToBookRatio: 18.2, dividendYieldPercent: 0.0, beta: 1.28, analystUpsidePercent: 11.3 },
  { rank: 35, ticker: "INTU", name: "Intuit", sector: "클라우드·소프트웨어", exchange: "NASDAQ", price: 620.8, change1dPercent: 0.9, change5dPercent: 2.8, marketCapUsd: 174000000000, revenueTtmUsd: 16300000000, grossMarginPercent: 79.6, operatingMarginPercent: 19.4, epsTtm: 9.82, peRatio: 63.2, forwardPeRatio: 38.6, priceToSalesRatio: 10.7, priceToBookRatio: 12.4, dividendYieldPercent: 0.62, beta: 1.22, analystUpsidePercent: 8.6 },
  { rank: 36, ticker: "PANW", name: "Palo Alto Networks", sector: "클라우드·소프트웨어", exchange: "NASDAQ", price: 340.2, change1dPercent: 1.8, change5dPercent: 4.6, marketCapUsd: 110000000000, revenueTtmUsd: 7500000000, grossMarginPercent: 73.8, operatingMarginPercent: 10.4, epsTtm: 1.24, peRatio: 274.4, forwardPeRatio: 52.8, priceToSalesRatio: 14.7, priceToBookRatio: 18.6, dividendYieldPercent: 0.0, beta: 1.34, analystUpsidePercent: 12.8 },
  { rank: 37, ticker: "SNOW", name: "Snowflake", sector: "클라우드·소프트웨어", exchange: "NYSE", price: 165.4, change1dPercent: 2.4, change5dPercent: 6.2, marketCapUsd: 54000000000, revenueTtmUsd: 3400000000, grossMarginPercent: 66.2, operatingMarginPercent: -8.4, epsTtm: -0.62, peRatio: null, forwardPeRatio: 72.4, priceToSalesRatio: 15.9, priceToBookRatio: 8.4, dividendYieldPercent: 0.0, beta: 1.46, analystUpsidePercent: 16.4 },
  { rank: 38, ticker: "DDOG", name: "Datadog", sector: "클라우드·소프트웨어", exchange: "NASDAQ", price: 118.6, change1dPercent: 2.1, change5dPercent: 5.4, marketCapUsd: 38000000000, revenueTtmUsd: 2400000000, grossMarginPercent: 78.4, operatingMarginPercent: 8.2, epsTtm: 0.64, peRatio: 185.3, forwardPeRatio: 68.4, priceToSalesRatio: 15.8, priceToBookRatio: 18.2, dividendYieldPercent: 0.0, beta: 1.38, analystUpsidePercent: 14.6 },
  { rank: 39, ticker: "WDAY", name: "Workday", sector: "클라우드·소프트웨어", exchange: "NASDAQ", price: 242.8, change1dPercent: 1.1, change5dPercent: 2.8, marketCapUsd: 64000000000, revenueTtmUsd: 7300000000, grossMarginPercent: 75.6, operatingMarginPercent: 4.8, epsTtm: 1.24, peRatio: 195.8, forwardPeRatio: 42.6, priceToSalesRatio: 8.8, priceToBookRatio: 8.4, dividendYieldPercent: 0.0, beta: 1.24, analystUpsidePercent: 13.2 },
  { rank: 40, ticker: "TEAM", name: "Atlassian", sector: "클라우드·소프트웨어", exchange: "NASDAQ", price: 188.4, change1dPercent: 1.6, change5dPercent: 4.2, marketCapUsd: 47000000000, revenueTtmUsd: 4400000000, grossMarginPercent: 81.2, operatingMarginPercent: 1.6, epsTtm: 0.24, peRatio: 785.0, forwardPeRatio: 58.4, priceToSalesRatio: 10.7, priceToBookRatio: 12.4, dividendYieldPercent: 0.0, beta: 1.32, analystUpsidePercent: 15.8 },
  { rank: 41, ticker: "ZS", name: "Zscaler", sector: "클라우드·소프트웨어", exchange: "NASDAQ", price: 192.6, change1dPercent: 2.2, change5dPercent: 5.8, marketCapUsd: 29000000000, revenueTtmUsd: 2400000000, grossMarginPercent: 78.6, operatingMarginPercent: 8.4, epsTtm: 0.84, peRatio: 229.3, forwardPeRatio: 68.4, priceToSalesRatio: 12.1, priceToBookRatio: 14.6, dividendYieldPercent: 0.0, beta: 1.42, analystUpsidePercent: 18.4 },
  { rank: 42, ticker: "GOOG", name: "Alphabet Class C", sector: "플랫폼", exchange: "NASDAQ", price: 157.2, change1dPercent: 0.8, change5dPercent: 2.2, marketCapUsd: 1930000000000, revenueTtmUsd: 307400000000, grossMarginPercent: 56.9, operatingMarginPercent: 27.4, epsTtm: 5.8, peRatio: 27.1, forwardPeRatio: 21.4, priceToSalesRatio: 6.3, priceToBookRatio: 6.4, dividendYieldPercent: 0.0, beta: 1.05, analystUpsidePercent: 13.4 },
  { rank: 43, ticker: "UBER", name: "Uber Technologies", sector: "플랫폼", exchange: "NYSE", price: 72.4, change1dPercent: 1.4, change5dPercent: 3.8, marketCapUsd: 154000000000, revenueTtmUsd: 37300000000, grossMarginPercent: 38.4, operatingMarginPercent: 6.8, epsTtm: 0.68, peRatio: 106.5, forwardPeRatio: 38.4, priceToSalesRatio: 4.1, priceToBookRatio: 18.6, dividendYieldPercent: 0.0, beta: 1.48, analystUpsidePercent: 14.2 },
  { rank: 44, ticker: "LYFT", name: "Lyft", sector: "플랫폼", exchange: "NASDAQ", price: 12.8, change1dPercent: 1.2, change5dPercent: 3.4, marketCapUsd: 5000000000, revenueTtmUsd: 4400000000, grossMarginPercent: 29.4, operatingMarginPercent: 2.4, epsTtm: 0.24, peRatio: 53.3, forwardPeRatio: 22.4, priceToSalesRatio: 1.1, priceToBookRatio: 3.4, dividendYieldPercent: 0.0, beta: 1.62, analystUpsidePercent: 18.6 },
  { rank: 45, ticker: "SPOT", name: "Spotify", sector: "플랫폼", exchange: "NYSE", price: 328.4, change1dPercent: 2.4, change5dPercent: 6.2, marketCapUsd: 63000000000, revenueTtmUsd: 14800000000, grossMarginPercent: 27.8, operatingMarginPercent: 5.4, epsTtm: 2.14, peRatio: 153.5, forwardPeRatio: 68.4, priceToSalesRatio: 4.3, priceToBookRatio: 18.2, dividendYieldPercent: 0.0, beta: 1.38, analystUpsidePercent: 12.4 },
  { rank: 46, ticker: "PINS", name: "Pinterest", sector: "플랫폼", exchange: "NYSE", price: 28.4, change1dPercent: 1.6, change5dPercent: 4.2, marketCapUsd: 18000000000, revenueTtmUsd: 3600000000, grossMarginPercent: 78.4, operatingMarginPercent: 14.6, epsTtm: 0.84, peRatio: 33.8, forwardPeRatio: 24.6, priceToSalesRatio: 5.0, priceToBookRatio: 4.8, dividendYieldPercent: 0.0, beta: 1.28, analystUpsidePercent: 16.8 },
  { rank: 47, ticker: "SNAP", name: "Snap", sector: "플랫폼", exchange: "NYSE", price: 10.4, change1dPercent: 2.1, change5dPercent: 5.6, marketCapUsd: 17000000000, revenueTtmUsd: 4600000000, grossMarginPercent: 52.4, operatingMarginPercent: -8.4, epsTtm: -0.24, peRatio: null, forwardPeRatio: null, priceToSalesRatio: 3.7, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 1.68, analystUpsidePercent: 12.4 },
  { rank: 48, ticker: "TTD", name: "The Trade Desk", sector: "플랫폼", exchange: "NASDAQ", price: 68.4, change1dPercent: 1.8, change5dPercent: 4.6, marketCapUsd: 34000000000, revenueTtmUsd: 2200000000, grossMarginPercent: 81.4, operatingMarginPercent: 8.4, epsTtm: 0.54, peRatio: 126.7, forwardPeRatio: 52.4, priceToSalesRatio: 15.5, priceToBookRatio: 18.4, dividendYieldPercent: 0.0, beta: 1.58, analystUpsidePercent: 18.4 },
  { rank: 49, ticker: "JNJ", name: "Johnson & Johnson", sector: "헬스케어", exchange: "NYSE", price: 152.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 367000000000, revenueTtmUsd: 85200000000, grossMarginPercent: 68.4, operatingMarginPercent: 22.4, epsTtm: 5.52, peRatio: 27.6, forwardPeRatio: 14.8, priceToSalesRatio: 4.3, priceToBookRatio: 5.8, dividendYieldPercent: 3.12, beta: 0.62, analystUpsidePercent: 6.4 },
  { rank: 50, ticker: "ABBV", name: "AbbVie", sector: "헬스케어", exchange: "NYSE", price: 168.6, change1dPercent: 0.6, change5dPercent: 1.8, marketCapUsd: 297000000000, revenueTtmUsd: 54300000000, grossMarginPercent: 69.8, operatingMarginPercent: 28.4, epsTtm: 6.24, peRatio: 27.0, forwardPeRatio: 14.6, priceToSalesRatio: 5.5, priceToBookRatio: null, dividendYieldPercent: 3.86, beta: 0.82, analystUpsidePercent: 8.2 },
  { rank: 51, ticker: "MRK", name: "Merck", sector: "헬스케어", exchange: "NYSE", price: 128.4, change1dPercent: 0.8, change5dPercent: 2.2, marketCapUsd: 326000000000, revenueTtmUsd: 60100000000, grossMarginPercent: 72.4, operatingMarginPercent: 28.6, epsTtm: 7.82, peRatio: 16.4, forwardPeRatio: 12.8, priceToSalesRatio: 5.4, priceToBookRatio: 6.2, dividendYieldPercent: 2.64, beta: 0.42, analystUpsidePercent: 9.4 },
  { rank: 52, ticker: "PFE", name: "Pfizer", sector: "헬스케어", exchange: "NYSE", price: 26.8, change1dPercent: -0.4, change5dPercent: -1.2, marketCapUsd: 152000000000, revenueTtmUsd: 58500000000, grossMarginPercent: 56.4, operatingMarginPercent: 12.4, epsTtm: 1.24, peRatio: 21.6, forwardPeRatio: 11.8, priceToSalesRatio: 2.6, priceToBookRatio: 2.4, dividendYieldPercent: 5.86, beta: 0.62, analystUpsidePercent: 12.8 },
  { rank: 53, ticker: "TMO", name: "Thermo Fisher Scientific", sector: "헬스케어", exchange: "NYSE", price: 548.6, change1dPercent: 0.6, change5dPercent: 1.8, marketCapUsd: 212000000000, revenueTtmUsd: 42900000000, grossMarginPercent: 42.4, operatingMarginPercent: 18.6, epsTtm: 19.82, peRatio: 27.7, forwardPeRatio: 22.4, priceToSalesRatio: 4.9, priceToBookRatio: 5.4, dividendYieldPercent: 0.28, beta: 0.68, analystUpsidePercent: 8.6 },
  { rank: 54, ticker: "ABT", name: "Abbott Laboratories", sector: "헬스케어", exchange: "NYSE", price: 112.4, change1dPercent: 0.4, change5dPercent: 1.4, marketCapUsd: 195000000000, revenueTtmUsd: 20200000000, grossMarginPercent: 54.6, operatingMarginPercent: 16.8, epsTtm: 3.24, peRatio: 34.7, forwardPeRatio: 24.6, priceToSalesRatio: 9.7, priceToBookRatio: 5.8, dividendYieldPercent: 1.96, beta: 0.72, analystUpsidePercent: 7.2 },
  { rank: 55, ticker: "DHR", name: "Danaher", sector: "헬스케어", exchange: "NYSE", price: 218.4, change1dPercent: 0.8, change5dPercent: 2.2, marketCapUsd: 158000000000, revenueTtmUsd: 23900000000, grossMarginPercent: 58.4, operatingMarginPercent: 18.4, epsTtm: 6.42, peRatio: 34.0, forwardPeRatio: 28.6, priceToSalesRatio: 6.6, priceToBookRatio: 4.8, dividendYieldPercent: 0.38, beta: 0.78, analystUpsidePercent: 9.8 },
  { rank: 56, ticker: "ISRG", name: "Intuitive Surgical", sector: "헬스케어", exchange: "NASDAQ", price: 428.6, change1dPercent: 1.2, change5dPercent: 3.4, marketCapUsd: 152000000000, revenueTtmUsd: 7900000000, grossMarginPercent: 67.8, operatingMarginPercent: 26.4, epsTtm: 5.82, peRatio: 73.6, forwardPeRatio: 52.4, priceToSalesRatio: 19.2, priceToBookRatio: 18.4, dividendYieldPercent: 0.0, beta: 1.12, analystUpsidePercent: 8.4 },
  { rank: 57, ticker: "GILD", name: "Gilead Sciences", sector: "헬스케어", exchange: "NASDAQ", price: 68.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 86000000000, revenueTtmUsd: 27100000000, grossMarginPercent: 74.8, operatingMarginPercent: 28.6, epsTtm: 4.24, peRatio: 16.1, forwardPeRatio: 12.4, priceToSalesRatio: 3.2, priceToBookRatio: 4.8, dividendYieldPercent: 3.48, beta: 0.62, analystUpsidePercent: 12.4 },
  { rank: 58, ticker: "REGN", name: "Regeneron", sector: "헬스케어", exchange: "NASDAQ", price: 1024.6, change1dPercent: 0.8, change5dPercent: 2.4, marketCapUsd: 108000000000, revenueTtmUsd: 13100000000, grossMarginPercent: 82.4, operatingMarginPercent: 38.6, epsTtm: 38.4, peRatio: 26.7, forwardPeRatio: 22.4, priceToSalesRatio: 8.3, priceToBookRatio: 5.4, dividendYieldPercent: 0.0, beta: 0.52, analystUpsidePercent: 6.8 },
  { rank: 59, ticker: "VRTX", name: "Vertex Pharmaceuticals", sector: "헬스케어", exchange: "NASDAQ", price: 468.4, change1dPercent: 1.4, change5dPercent: 3.8, marketCapUsd: 121000000000, revenueTtmUsd: 9900000000, grossMarginPercent: 86.4, operatingMarginPercent: 42.4, epsTtm: 14.82, peRatio: 31.6, forwardPeRatio: 28.4, priceToSalesRatio: 12.2, priceToBookRatio: 10.8, dividendYieldPercent: 0.0, beta: 0.62, analystUpsidePercent: 7.4 },
  { rank: 60, ticker: "BMY", name: "Bristol-Myers Squibb", sector: "헬스케어", exchange: "NYSE", price: 48.6, change1dPercent: -0.2, change5dPercent: 0.8, marketCapUsd: 100000000000, revenueTtmUsd: 45000000000, grossMarginPercent: 72.4, operatingMarginPercent: 22.4, epsTtm: 0.82, peRatio: 59.3, forwardPeRatio: 8.4, priceToSalesRatio: 2.2, priceToBookRatio: 3.8, dividendYieldPercent: 4.62, beta: 0.72, analystUpsidePercent: 14.8 },
  { rank: 61, ticker: "BAC", name: "Bank of America", sector: "금융", exchange: "NYSE", price: 38.4, change1dPercent: 0.6, change5dPercent: 1.8, marketCapUsd: 304000000000, revenueTtmUsd: 89100000000, grossMarginPercent: null, operatingMarginPercent: 36.4, epsTtm: 3.24, peRatio: 11.9, forwardPeRatio: 10.2, priceToSalesRatio: 3.4, priceToBookRatio: 1.3, dividendYieldPercent: 2.52, beta: 1.42, analystUpsidePercent: 8.6 },
  { rank: 62, ticker: "WFC", name: "Wells Fargo", sector: "금융", exchange: "NYSE", price: 52.8, change1dPercent: 0.4, change5dPercent: 1.4, marketCapUsd: 198000000000, revenueTtmUsd: 77200000000, grossMarginPercent: null, operatingMarginPercent: 28.4, epsTtm: 4.82, peRatio: 11.0, forwardPeRatio: 9.8, priceToSalesRatio: 2.6, priceToBookRatio: 1.4, dividendYieldPercent: 2.28, beta: 1.18, analystUpsidePercent: 9.4 },
  { rank: 63, ticker: "GS", name: "Goldman Sachs", sector: "금융", exchange: "NYSE", price: 468.4, change1dPercent: 0.8, change5dPercent: 2.4, marketCapUsd: 158000000000, revenueTtmUsd: 46300000000, grossMarginPercent: null, operatingMarginPercent: 22.4, epsTtm: 28.4, peRatio: 16.5, forwardPeRatio: 12.8, priceToSalesRatio: 3.4, priceToBookRatio: 1.4, dividendYieldPercent: 2.12, beta: 1.38, analystUpsidePercent: 7.8 },
  { rank: 64, ticker: "MS", name: "Morgan Stanley", sector: "금융", exchange: "NYSE", price: 98.6, change1dPercent: 0.6, change5dPercent: 1.8, marketCapUsd: 162000000000, revenueTtmUsd: 53700000000, grossMarginPercent: null, operatingMarginPercent: 18.4, epsTtm: 6.24, peRatio: 15.8, forwardPeRatio: 12.4, priceToSalesRatio: 3.0, priceToBookRatio: 1.8, dividendYieldPercent: 3.42, beta: 1.28, analystUpsidePercent: 8.4 },
  { rank: 65, ticker: "C", name: "Citigroup", sector: "금융", exchange: "NYSE", price: 64.8, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 124000000000, revenueTtmUsd: 78400000000, grossMarginPercent: null, operatingMarginPercent: 14.4, epsTtm: 5.82, peRatio: 11.1, forwardPeRatio: 8.6, priceToSalesRatio: 1.6, priceToBookRatio: 0.7, dividendYieldPercent: 3.08, beta: 1.32, analystUpsidePercent: 12.8 },
  { rank: 66, ticker: "AXP", name: "American Express", sector: "금융", exchange: "NYSE", price: 228.4, change1dPercent: 0.8, change5dPercent: 2.4, marketCapUsd: 168000000000, revenueTtmUsd: 59200000000, grossMarginPercent: null, operatingMarginPercent: 18.6, epsTtm: 11.82, peRatio: 19.3, forwardPeRatio: 16.4, priceToSalesRatio: 2.8, priceToBookRatio: 5.2, dividendYieldPercent: 1.24, beta: 1.18, analystUpsidePercent: 7.4 },
  { rank: 67, ticker: "BLK", name: "BlackRock", sector: "금융", exchange: "NYSE", price: 848.6, change1dPercent: 0.6, change5dPercent: 1.8, marketCapUsd: 128000000000, revenueTtmUsd: 18600000000, grossMarginPercent: null, operatingMarginPercent: 34.4, epsTtm: 38.4, peRatio: 22.1, forwardPeRatio: 18.6, priceToSalesRatio: 6.9, priceToBookRatio: 3.4, dividendYieldPercent: 2.48, beta: 1.12, analystUpsidePercent: 6.8 },
  { rank: 68, ticker: "SCHW", name: "Charles Schwab", sector: "금융", exchange: "NYSE", price: 68.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 124000000000, revenueTtmUsd: 18800000000, grossMarginPercent: null, operatingMarginPercent: 28.4, epsTtm: 2.82, peRatio: 24.3, forwardPeRatio: 18.4, priceToSalesRatio: 6.6, priceToBookRatio: 2.4, dividendYieldPercent: 1.48, beta: 1.22, analystUpsidePercent: 9.4 },
  { rank: 69, ticker: "CB", name: "Chubb", sector: "금융", exchange: "NYSE", price: 268.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 112000000000, revenueTtmUsd: 52400000000, grossMarginPercent: null, operatingMarginPercent: 12.4, epsTtm: 18.4, peRatio: 14.6, forwardPeRatio: 12.8, priceToSalesRatio: 2.2, priceToBookRatio: 1.8, dividendYieldPercent: 1.52, beta: 0.72, analystUpsidePercent: 6.8 },
  { rank: 70, ticker: "PGR", name: "Progressive", sector: "금융", exchange: "NYSE", price: 228.4, change1dPercent: 0.6, change5dPercent: 1.8, marketCapUsd: 134000000000, revenueTtmUsd: 62100000000, grossMarginPercent: null, operatingMarginPercent: 8.4, epsTtm: 12.4, peRatio: 18.4, forwardPeRatio: 14.6, priceToSalesRatio: 2.2, priceToBookRatio: 4.8, dividendYieldPercent: 0.24, beta: 0.68, analystUpsidePercent: 8.4 },
  { rank: 71, ticker: "CVX", name: "Chevron", sector: "에너지", exchange: "NYSE", price: 152.4, change1dPercent: -0.4, change5dPercent: 1.2, marketCapUsd: 282000000000, revenueTtmUsd: 196900000000, grossMarginPercent: 28.4, operatingMarginPercent: 12.4, epsTtm: 10.82, peRatio: 14.1, forwardPeRatio: 12.4, priceToSalesRatio: 1.4, priceToBookRatio: 1.8, dividendYieldPercent: 4.12, beta: 0.96, analystUpsidePercent: 7.4 },
  { rank: 72, ticker: "COP", name: "ConocoPhillips", sector: "에너지", exchange: "NYSE", price: 108.4, change1dPercent: -0.2, change5dPercent: 1.0, marketCapUsd: 134000000000, revenueTtmUsd: 55100000000, grossMarginPercent: 38.4, operatingMarginPercent: 18.4, epsTtm: 7.82, peRatio: 13.9, forwardPeRatio: 11.8, priceToSalesRatio: 2.4, priceToBookRatio: 2.4, dividendYieldPercent: 1.92, beta: 1.12, analystUpsidePercent: 8.6 },
  { rank: 73, ticker: "SLB", name: "SLB (Schlumberger)", sector: "에너지", exchange: "NYSE", price: 42.8, change1dPercent: -0.4, change5dPercent: 0.8, marketCapUsd: 60000000000, revenueTtmUsd: 33100000000, grossMarginPercent: 18.4, operatingMarginPercent: 12.4, epsTtm: 2.24, peRatio: 19.1, forwardPeRatio: 14.8, priceToSalesRatio: 1.8, priceToBookRatio: 2.8, dividendYieldPercent: 2.48, beta: 1.18, analystUpsidePercent: 12.4 },
  { rank: 74, ticker: "EOG", name: "EOG Resources", sector: "에너지", exchange: "NYSE", price: 118.4, change1dPercent: -0.2, change5dPercent: 0.8, marketCapUsd: 70000000000, revenueTtmUsd: 21300000000, grossMarginPercent: 48.4, operatingMarginPercent: 28.4, epsTtm: 8.82, peRatio: 13.4, forwardPeRatio: 11.8, priceToSalesRatio: 3.3, priceToBookRatio: 2.4, dividendYieldPercent: 3.12, beta: 0.92, analystUpsidePercent: 8.4 },
  { rank: 75, ticker: "PSX", name: "Phillips 66", sector: "에너지", exchange: "NYSE", price: 128.4, change1dPercent: -0.2, change5dPercent: 0.8, marketCapUsd: 54000000000, revenueTtmUsd: 148400000000, grossMarginPercent: 8.4, operatingMarginPercent: 4.8, epsTtm: 9.82, peRatio: 13.1, forwardPeRatio: 11.4, priceToSalesRatio: 0.4, priceToBookRatio: 2.2, dividendYieldPercent: 3.48, beta: 0.98, analystUpsidePercent: 7.8 },
  { rank: 76, ticker: "VLO", name: "Valero Energy", sector: "에너지", exchange: "NYSE", price: 142.8, change1dPercent: -0.4, change5dPercent: 0.8, marketCapUsd: 46000000000, revenueTtmUsd: 144800000000, grossMarginPercent: 6.4, operatingMarginPercent: 4.2, epsTtm: 12.82, peRatio: 11.1, forwardPeRatio: 9.8, priceToSalesRatio: 0.3, priceToBookRatio: 2.4, dividendYieldPercent: 3.68, beta: 0.92, analystUpsidePercent: 8.2 },
  { rank: 77, ticker: "MPC", name: "Marathon Petroleum", sector: "에너지", exchange: "NYSE", price: 168.4, change1dPercent: -0.2, change5dPercent: 0.8, marketCapUsd: 48000000000, revenueTtmUsd: 145400000000, grossMarginPercent: 8.4, operatingMarginPercent: 6.4, epsTtm: 14.82, peRatio: 11.4, forwardPeRatio: 10.2, priceToSalesRatio: 0.3, priceToBookRatio: 3.4, dividendYieldPercent: 2.48, beta: 0.98, analystUpsidePercent: 9.4 },
  { rank: 78, ticker: "OXY", name: "Occidental Petroleum", sector: "에너지", exchange: "NYSE", price: 52.8, change1dPercent: -0.4, change5dPercent: 0.8, marketCapUsd: 48000000000, revenueTtmUsd: 28300000000, grossMarginPercent: 38.4, operatingMarginPercent: 14.4, epsTtm: 3.82, peRatio: 13.8, forwardPeRatio: 12.4, priceToSalesRatio: 1.7, priceToBookRatio: 1.8, dividendYieldPercent: 1.24, beta: 1.08, analystUpsidePercent: 10.8 },
  { rank: 79, ticker: "KMI", name: "Kinder Morgan", sector: "에너지", exchange: "NYSE", price: 18.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 41000000000, revenueTtmUsd: 15100000000, grossMarginPercent: 38.4, operatingMarginPercent: 18.4, epsTtm: 1.04, peRatio: 17.7, forwardPeRatio: 14.8, priceToSalesRatio: 2.7, priceToBookRatio: 2.8, dividendYieldPercent: 6.52, beta: 0.82, analystUpsidePercent: 8.4 },
  { rank: 80, ticker: "WMB", name: "Williams Companies", sector: "에너지", exchange: "NYSE", price: 38.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 47000000000, revenueTtmUsd: 10200000000, grossMarginPercent: 42.4, operatingMarginPercent: 22.4, epsTtm: 1.84, peRatio: 20.9, forwardPeRatio: 16.4, priceToSalesRatio: 4.6, priceToBookRatio: 3.8, dividendYieldPercent: 4.68, beta: 0.88, analystUpsidePercent: 7.8 },
  { rank: 81, ticker: "CAT", name: "Caterpillar", sector: "산업재", exchange: "NYSE", price: 348.6, change1dPercent: 0.6, change5dPercent: 1.8, marketCapUsd: 174000000000, revenueTtmUsd: 64800000000, grossMarginPercent: 38.4, operatingMarginPercent: 18.4, epsTtm: 18.82, peRatio: 18.5, forwardPeRatio: 16.4, priceToSalesRatio: 2.7, priceToBookRatio: 8.4, dividendYieldPercent: 1.58, beta: 1.12, analystUpsidePercent: 7.4 },
  { rank: 82, ticker: "DE", name: "Deere & Company", sector: "산업재", exchange: "NYSE", price: 368.4, change1dPercent: 0.4, change5dPercent: 1.4, marketCapUsd: 106000000000, revenueTtmUsd: 51700000000, grossMarginPercent: 34.4, operatingMarginPercent: 18.4, epsTtm: 24.82, peRatio: 14.8, forwardPeRatio: 12.4, priceToSalesRatio: 2.1, priceToBookRatio: 5.4, dividendYieldPercent: 1.52, beta: 1.08, analystUpsidePercent: 8.4 },
  { rank: 83, ticker: "HON", name: "Honeywell", sector: "산업재", exchange: "NASDAQ", price: 198.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 128000000000, revenueTtmUsd: 36700000000, grossMarginPercent: 32.4, operatingMarginPercent: 18.4, epsTtm: 8.82, peRatio: 22.5, forwardPeRatio: 18.4, priceToSalesRatio: 3.5, priceToBookRatio: 6.8, dividendYieldPercent: 2.28, beta: 1.02, analystUpsidePercent: 8.8 },
  { rank: 84, ticker: "GE", name: "GE Aerospace", sector: "산업재", exchange: "NYSE", price: 168.4, change1dPercent: 0.8, change5dPercent: 2.4, marketCapUsd: 184000000000, revenueTtmUsd: 32000000000, grossMarginPercent: 28.4, operatingMarginPercent: 14.4, epsTtm: 3.82, peRatio: 44.1, forwardPeRatio: 28.4, priceToSalesRatio: 5.8, priceToBookRatio: null, dividendYieldPercent: 0.82, beta: 1.18, analystUpsidePercent: 12.4 },
  { rank: 85, ticker: "RTX", name: "RTX Corporation", sector: "산업재", exchange: "NYSE", price: 118.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 155000000000, revenueTtmUsd: 68900000000, grossMarginPercent: 18.4, operatingMarginPercent: 8.4, epsTtm: 4.82, peRatio: 24.6, forwardPeRatio: 18.4, priceToSalesRatio: 2.3, priceToBookRatio: 3.8, dividendYieldPercent: 2.12, beta: 1.08, analystUpsidePercent: 9.4 },
  { rank: 86, ticker: "LMT", name: "Lockheed Martin", sector: "산업재", exchange: "NYSE", price: 468.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 112000000000, revenueTtmUsd: 67600000000, grossMarginPercent: 12.4, operatingMarginPercent: 12.4, epsTtm: 26.82, peRatio: 17.5, forwardPeRatio: 14.8, priceToSalesRatio: 1.7, priceToBookRatio: null, dividendYieldPercent: 2.72, beta: 0.52, analystUpsidePercent: 6.8 },
  { rank: 87, ticker: "NOC", name: "Northrop Grumman", sector: "산업재", exchange: "NYSE", price: 468.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 72000000000, revenueTtmUsd: 39300000000, grossMarginPercent: 12.4, operatingMarginPercent: 12.4, epsTtm: 28.82, peRatio: 16.2, forwardPeRatio: 13.8, priceToSalesRatio: 1.8, priceToBookRatio: null, dividendYieldPercent: 1.68, beta: 0.62, analystUpsidePercent: 7.4 },
  { rank: 88, ticker: "BA", name: "Boeing", sector: "산업재", exchange: "NYSE", price: 168.4, change1dPercent: -0.4, change5dPercent: 0.8, marketCapUsd: 128000000000, revenueTtmUsd: 77800000000, grossMarginPercent: 8.4, operatingMarginPercent: -8.4, epsTtm: -4.82, peRatio: null, forwardPeRatio: 48.4, priceToSalesRatio: 1.6, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 1.38, analystUpsidePercent: 14.8 },
  { rank: 89, ticker: "GD", name: "General Dynamics", sector: "산업재", exchange: "NYSE", price: 268.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 73000000000, revenueTtmUsd: 42300000000, grossMarginPercent: 14.4, operatingMarginPercent: 12.4, epsTtm: 13.82, peRatio: 19.4, forwardPeRatio: 16.4, priceToSalesRatio: 1.7, priceToBookRatio: 5.4, dividendYieldPercent: 2.12, beta: 0.72, analystUpsidePercent: 7.8 },
  { rank: 90, ticker: "UPS", name: "United Parcel Service", sector: "산업재", exchange: "NYSE", price: 128.4, change1dPercent: -0.2, change5dPercent: 0.4, marketCapUsd: 110000000000, revenueTtmUsd: 91000000000, grossMarginPercent: 22.4, operatingMarginPercent: 8.4, epsTtm: 6.82, peRatio: 18.8, forwardPeRatio: 14.8, priceToSalesRatio: 1.2, priceToBookRatio: null, dividendYieldPercent: 4.82, beta: 1.02, analystUpsidePercent: 10.4 },
  { rank: 91, ticker: "FDX", name: "FedEx", sector: "산업재", exchange: "NYSE", price: 248.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 63000000000, revenueTtmUsd: 88500000000, grossMarginPercent: 18.4, operatingMarginPercent: 6.4, epsTtm: 14.82, peRatio: 16.8, forwardPeRatio: 12.8, priceToSalesRatio: 0.7, priceToBookRatio: 3.4, dividendYieldPercent: 2.08, beta: 1.12, analystUpsidePercent: 12.8 },
  { rank: 92, ticker: "CSX", name: "CSX Corporation", sector: "산업재", exchange: "NASDAQ", price: 34.8, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 68000000000, revenueTtmUsd: 14700000000, grossMarginPercent: 38.4, operatingMarginPercent: 28.4, epsTtm: 1.82, peRatio: 19.1, forwardPeRatio: 16.4, priceToSalesRatio: 4.6, priceToBookRatio: 4.8, dividendYieldPercent: 1.48, beta: 1.08, analystUpsidePercent: 8.4 },
  { rank: 93, ticker: "NSC", name: "Norfolk Southern", sector: "산업재", exchange: "NYSE", price: 228.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 55000000000, revenueTtmUsd: 12200000000, grossMarginPercent: 34.4, operatingMarginPercent: 28.4, epsTtm: 10.82, peRatio: 21.1, forwardPeRatio: 16.8, priceToSalesRatio: 4.5, priceToBookRatio: 4.8, dividendYieldPercent: 2.28, beta: 1.12, analystUpsidePercent: 9.4 },
  { rank: 94, ticker: "UNP", name: "Union Pacific", sector: "산업재", exchange: "NYSE", price: 228.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 138000000000, revenueTtmUsd: 23700000000, grossMarginPercent: 54.4, operatingMarginPercent: 38.4, epsTtm: 10.82, peRatio: 21.1, forwardPeRatio: 17.8, priceToSalesRatio: 5.8, priceToBookRatio: null, dividendYieldPercent: 2.48, beta: 0.92, analystUpsidePercent: 7.8 },
  { rank: 95, ticker: "WM", name: "Waste Management", sector: "산업재", exchange: "NYSE", price: 218.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 88000000000, revenueTtmUsd: 20400000000, grossMarginPercent: 38.4, operatingMarginPercent: 18.4, epsTtm: 6.82, peRatio: 32.0, forwardPeRatio: 24.4, priceToSalesRatio: 4.3, priceToBookRatio: null, dividendYieldPercent: 1.52, beta: 0.72, analystUpsidePercent: 6.4 },
  { rank: 96, ticker: "EMR", name: "Emerson Electric", sector: "산업재", exchange: "NYSE", price: 98.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 58000000000, revenueTtmUsd: 16500000000, grossMarginPercent: 42.4, operatingMarginPercent: 18.4, epsTtm: 4.82, peRatio: 20.4, forwardPeRatio: 16.8, priceToSalesRatio: 3.5, priceToBookRatio: 4.8, dividendYieldPercent: 2.28, beta: 0.92, analystUpsidePercent: 8.4 },
  { rank: 97, ticker: "ETN", name: "Eaton", sector: "산업재", exchange: "NYSE", price: 328.4, change1dPercent: 0.6, change5dPercent: 1.8, marketCapUsd: 130000000000, revenueTtmUsd: 24900000000, grossMarginPercent: 34.4, operatingMarginPercent: 18.4, epsTtm: 8.82, peRatio: 37.2, forwardPeRatio: 26.4, priceToSalesRatio: 5.2, priceToBookRatio: 8.4, dividendYieldPercent: 1.28, beta: 1.12, analystUpsidePercent: 9.4 },
  { rank: 98, ticker: "ITW", name: "Illinois Tool Works", sector: "산업재", exchange: "NYSE", price: 228.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 70000000000, revenueTtmUsd: 15900000000, grossMarginPercent: 42.4, operatingMarginPercent: 28.4, epsTtm: 9.82, peRatio: 23.3, forwardPeRatio: 18.4, priceToSalesRatio: 4.4, priceToBookRatio: null, dividendYieldPercent: 2.68, beta: 0.82, analystUpsidePercent: 6.8 },
  { rank: 99, ticker: "PH", name: "Parker Hannifin", sector: "산업재", exchange: "NYSE", price: 568.4, change1dPercent: 0.6, change5dPercent: 1.8, marketCapUsd: 73000000000, revenueTtmUsd: 19900000000, grossMarginPercent: 34.4, operatingMarginPercent: 18.4, epsTtm: 18.82, peRatio: 30.2, forwardPeRatio: 22.4, priceToSalesRatio: 3.7, priceToBookRatio: 5.8, dividendYieldPercent: 1.28, beta: 1.12, analystUpsidePercent: 8.4 },
  { rank: 100, ticker: "MMM", name: "3M", sector: "산업재", exchange: "NYSE", price: 128.4, change1dPercent: -0.2, change5dPercent: 0.4, marketCapUsd: 70000000000, revenueTtmUsd: 24600000000, grossMarginPercent: 44.4, operatingMarginPercent: 18.4, epsTtm: 8.82, peRatio: 14.5, forwardPeRatio: 12.4, priceToSalesRatio: 2.8, priceToBookRatio: null, dividendYieldPercent: 2.28, beta: 0.92, analystUpsidePercent: 10.4 },
  { rank: 101, ticker: "KO", name: "Coca-Cola", sector: "소비재", exchange: "NYSE", price: 62.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 268000000000, revenueTtmUsd: 45800000000, grossMarginPercent: 58.4, operatingMarginPercent: 28.4, epsTtm: 2.82, peRatio: 22.1, forwardPeRatio: 18.4, priceToSalesRatio: 5.9, priceToBookRatio: null, dividendYieldPercent: 3.12, beta: 0.52, analystUpsidePercent: 5.4 },
  { rank: 102, ticker: "PEP", name: "PepsiCo", sector: "소비재", exchange: "NASDAQ", price: 168.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 232000000000, revenueTtmUsd: 91500000000, grossMarginPercent: 54.4, operatingMarginPercent: 14.4, epsTtm: 6.82, peRatio: 24.7, forwardPeRatio: 18.4, priceToSalesRatio: 2.5, priceToBookRatio: null, dividendYieldPercent: 3.12, beta: 0.52, analystUpsidePercent: 7.4 },
  { rank: 103, ticker: "MCD", name: "McDonald's", sector: "소비재", exchange: "NYSE", price: 268.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 194000000000, revenueTtmUsd: 23200000000, grossMarginPercent: 56.4, operatingMarginPercent: 44.4, epsTtm: 11.82, peRatio: 22.7, forwardPeRatio: 18.4, priceToSalesRatio: 8.4, priceToBookRatio: null, dividendYieldPercent: 2.28, beta: 0.72, analystUpsidePercent: 6.8 },
  { rank: 104, ticker: "SBUX", name: "Starbucks", sector: "소비재", exchange: "NASDAQ", price: 78.4, change1dPercent: 0.6, change5dPercent: 1.8, marketCapUsd: 88000000000, revenueTtmUsd: 36200000000, grossMarginPercent: 26.4, operatingMarginPercent: 12.4, epsTtm: 3.24, peRatio: 24.2, forwardPeRatio: 18.4, priceToSalesRatio: 2.4, priceToBookRatio: null, dividendYieldPercent: 2.52, beta: 0.92, analystUpsidePercent: 12.4 },
  { rank: 105, ticker: "NKE", name: "Nike", sector: "소비재", exchange: "NYSE", price: 68.4, change1dPercent: -0.4, change5dPercent: 0.8, marketCapUsd: 104000000000, revenueTtmUsd: 51400000000, grossMarginPercent: 44.4, operatingMarginPercent: 8.4, epsTtm: 3.24, peRatio: 21.1, forwardPeRatio: 16.4, priceToSalesRatio: 2.0, priceToBookRatio: null, dividendYieldPercent: 2.08, beta: 0.82, analystUpsidePercent: 14.8 },
  { rank: 106, ticker: "TGT", name: "Target", sector: "리테일", exchange: "NYSE", price: 128.4, change1dPercent: -0.2, change5dPercent: 0.4, marketCapUsd: 59000000000, revenueTtmUsd: 109100000000, grossMarginPercent: 28.4, operatingMarginPercent: 4.4, epsTtm: 8.82, peRatio: 14.6, forwardPeRatio: 12.4, priceToSalesRatio: 0.5, priceToBookRatio: null, dividendYieldPercent: 3.68, beta: 0.82, analystUpsidePercent: 12.4 },
  { rank: 107, ticker: "LOW", name: "Lowe's", sector: "리테일", exchange: "NYSE", price: 228.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 128000000000, revenueTtmUsd: 86400000000, grossMarginPercent: 32.4, operatingMarginPercent: 12.4, epsTtm: 12.82, peRatio: 17.8, forwardPeRatio: 14.8, priceToSalesRatio: 1.5, priceToBookRatio: null, dividendYieldPercent: 2.08, beta: 1.02, analystUpsidePercent: 8.4 },
  { rank: 108, ticker: "TJX", name: "TJX Companies", sector: "리테일", exchange: "NYSE", price: 108.4, change1dPercent: 0.6, change5dPercent: 1.8, marketCapUsd: 124000000000, revenueTtmUsd: 52600000000, grossMarginPercent: 28.4, operatingMarginPercent: 10.4, epsTtm: 3.82, peRatio: 28.4, forwardPeRatio: 22.4, priceToSalesRatio: 2.4, priceToBookRatio: null, dividendYieldPercent: 1.28, beta: 0.72, analystUpsidePercent: 7.4 },
  { rank: 109, ticker: "BKNG", name: "Booking Holdings", sector: "리테일", exchange: "NASDAQ", price: 4028.4, change1dPercent: 1.4, change5dPercent: 3.8, marketCapUsd: 98000000000, revenueTtmUsd: 21400000000, grossMarginPercent: 82.4, operatingMarginPercent: 28.4, epsTtm: 128.4, peRatio: 31.4, forwardPeRatio: 24.4, priceToSalesRatio: 4.6, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 1.32, analystUpsidePercent: 9.4 },
  { rank: 110, ticker: "ABNB", name: "Airbnb", sector: "리테일", exchange: "NASDAQ", price: 128.4, change1dPercent: 1.2, change5dPercent: 3.4, marketCapUsd: 82000000000, revenueTtmUsd: 10000000000, grossMarginPercent: 74.4, operatingMarginPercent: 18.4, epsTtm: 3.82, peRatio: 33.6, forwardPeRatio: 26.4, priceToSalesRatio: 8.2, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 1.38, analystUpsidePercent: 12.4 },
  { rank: 111, ticker: "EBAY", name: "eBay", sector: "리테일", exchange: "NASDAQ", price: 52.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 28000000000, revenueTtmUsd: 10100000000, grossMarginPercent: 72.4, operatingMarginPercent: 22.4, epsTtm: 3.82, peRatio: 13.7, forwardPeRatio: 10.4, priceToSalesRatio: 2.8, priceToBookRatio: null, dividendYieldPercent: 1.92, beta: 1.02, analystUpsidePercent: 10.4 },
  { rank: 112, ticker: "ETSY", name: "Etsy", sector: "리테일", exchange: "NASDAQ", price: 58.4, change1dPercent: 0.8, change5dPercent: 2.4, marketCapUsd: 7000000000, revenueTtmUsd: 2700000000, grossMarginPercent: 68.4, operatingMarginPercent: 14.4, epsTtm: 2.24, peRatio: 26.1, forwardPeRatio: 18.4, priceToSalesRatio: 2.6, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 1.42, analystUpsidePercent: 16.8 },
  { rank: 113, ticker: "DASH", name: "DoorDash", sector: "리테일", exchange: "NASDAQ", price: 168.4, change1dPercent: 1.6, change5dPercent: 4.2, marketCapUsd: 72000000000, revenueTtmUsd: 8600000000, grossMarginPercent: 48.4, operatingMarginPercent: -4.4, epsTtm: -0.24, peRatio: null, forwardPeRatio: null, priceToSalesRatio: 8.4, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 1.52, analystUpsidePercent: 14.4 },
  { rank: 114, ticker: "AMGN", name: "Amgen", sector: "헬스케어", exchange: "NASDAQ", price: 268.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 144000000000, revenueTtmUsd: 32700000000, grossMarginPercent: 68.4, operatingMarginPercent: 38.4, epsTtm: 18.82, peRatio: 14.3, forwardPeRatio: 12.8, priceToSalesRatio: 4.4, priceToBookRatio: null, dividendYieldPercent: 3.28, beta: 0.72, analystUpsidePercent: 8.4 },
  { rank: 115, ticker: "BIIB", name: "Biogen", sector: "헬스케어", exchange: "NASDAQ", price: 168.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 24000000000, revenueTtmUsd: 9800000000, grossMarginPercent: 72.4, operatingMarginPercent: 22.4, epsTtm: 12.82, peRatio: 13.1, forwardPeRatio: 12.4, priceToSalesRatio: 2.4, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 0.52, analystUpsidePercent: 12.4 },
  { rank: 116, ticker: "MRNA", name: "Moderna", sector: "헬스케어", exchange: "NASDAQ", price: 38.4, change1dPercent: -0.4, change5dPercent: 0.8, marketCapUsd: 15000000000, revenueTtmUsd: 2800000000, grossMarginPercent: 62.4, operatingMarginPercent: -28.4, epsTtm: -4.82, peRatio: null, forwardPeRatio: null, priceToSalesRatio: 5.4, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 1.42, analystUpsidePercent: 22.4 },
  { rank: 117, ticker: "ZBH", name: "Zimmer Biomet", sector: "헬스케어", exchange: "NYSE", price: 98.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 20000000000, revenueTtmUsd: 7500000000, grossMarginPercent: 68.4, operatingMarginPercent: 14.4, epsTtm: 5.82, peRatio: 16.9, forwardPeRatio: 12.8, priceToSalesRatio: 2.7, priceToBookRatio: 4.8, dividendYieldPercent: 0.92, beta: 0.72, analystUpsidePercent: 9.4 },
  { rank: 118, ticker: "SYK", name: "Stryker", sector: "헬스케어", exchange: "NYSE", price: 368.4, change1dPercent: 0.6, change5dPercent: 1.8, marketCapUsd: 139000000000, revenueTtmUsd: 20500000000, grossMarginPercent: 62.4, operatingMarginPercent: 18.4, epsTtm: 8.82, peRatio: 41.8, forwardPeRatio: 28.4, priceToSalesRatio: 6.8, priceToBookRatio: 8.4, dividendYieldPercent: 1.12, beta: 0.82, analystUpsidePercent: 8.4 },
  { rank: 119, ticker: "MDT", name: "Medtronic", sector: "헬스케어", exchange: "NYSE", price: 82.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 110000000000, revenueTtmUsd: 32400000000, grossMarginPercent: 64.4, operatingMarginPercent: 18.4, epsTtm: 3.24, peRatio: 25.4, forwardPeRatio: 16.8, priceToSalesRatio: 3.4, priceToBookRatio: 3.8, dividendYieldPercent: 3.48, beta: 0.72, analystUpsidePercent: 10.4 },
  { rank: 120, ticker: "EW", name: "Edwards Lifesciences", sector: "헬스케어", exchange: "NYSE", price: 68.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 41000000000, revenueTtmUsd: 6400000000, grossMarginPercent: 76.4, operatingMarginPercent: 22.4, epsTtm: 2.24, peRatio: 30.5, forwardPeRatio: 22.4, priceToSalesRatio: 6.4, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 0.82, analystUpsidePercent: 12.4 },
  { rank: 121, ticker: "SPGI", name: "S&P Global", sector: "금융", exchange: "NYSE", price: 468.4, change1dPercent: 0.6, change5dPercent: 1.8, marketCapUsd: 148000000000, revenueTtmUsd: 13800000000, grossMarginPercent: 68.4, operatingMarginPercent: 38.4, epsTtm: 12.82, peRatio: 36.5, forwardPeRatio: 28.4, priceToSalesRatio: 10.7, priceToBookRatio: null, dividendYieldPercent: 0.88, beta: 0.92, analystUpsidePercent: 7.4 },
  { rank: 122, ticker: "MCO", name: "Moody's", sector: "금융", exchange: "NYSE", price: 368.4, change1dPercent: 0.6, change5dPercent: 1.8, marketCapUsd: 67000000000, revenueTtmUsd: 6400000000, grossMarginPercent: 72.4, operatingMarginPercent: 38.4, epsTtm: 10.82, peRatio: 34.0, forwardPeRatio: 26.4, priceToSalesRatio: 10.5, priceToBookRatio: null, dividendYieldPercent: 0.92, beta: 1.02, analystUpsidePercent: 8.4 },
  { rank: 123, ticker: "ICE", name: "Intercontinental Exchange", sector: "금융", exchange: "NYSE", price: 148.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 85000000000, revenueTtmUsd: 7600000000, grossMarginPercent: 56.4, operatingMarginPercent: 28.4, epsTtm: 4.82, peRatio: 30.8, forwardPeRatio: 22.4, priceToSalesRatio: 11.2, priceToBookRatio: 4.8, dividendYieldPercent: 1.28, beta: 0.82, analystUpsidePercent: 7.8 },
  { rank: 124, ticker: "CME", name: "CME Group", sector: "금융", exchange: "NASDAQ", price: 228.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 82000000000, revenueTtmUsd: 5800000000, grossMarginPercent: 62.4, operatingMarginPercent: 48.4, epsTtm: 8.82, peRatio: 25.9, forwardPeRatio: 22.4, priceToSalesRatio: 14.1, priceToBookRatio: null, dividendYieldPercent: 4.28, beta: 0.42, analystUpsidePercent: 6.8 },
  { rank: 125, ticker: "AON", name: "Aon", sector: "금융", exchange: "NYSE", price: 328.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 68000000000, revenueTtmUsd: 13400000000, grossMarginPercent: 38.4, operatingMarginPercent: 18.4, epsTtm: 12.82, peRatio: 25.6, forwardPeRatio: 20.4, priceToSalesRatio: 5.1, priceToBookRatio: null, dividendYieldPercent: 0.88, beta: 0.82, analystUpsidePercent: 7.4 },
  { rank: 126, ticker: "MMC", name: "Marsh & McLennan", sector: "금융", exchange: "NYSE", price: 218.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 110000000000, revenueTtmUsd: 22700000000, grossMarginPercent: 34.4, operatingMarginPercent: 18.4, epsTtm: 6.82, peRatio: 32.0, forwardPeRatio: 24.4, priceToSalesRatio: 4.8, priceToBookRatio: null, dividendYieldPercent: 1.48, beta: 0.82, analystUpsidePercent: 7.8 },
  { rank: 127, ticker: "TRV", name: "Travelers Companies", sector: "금융", exchange: "NYSE", price: 228.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 55000000000, revenueTtmUsd: 40500000000, grossMarginPercent: null, operatingMarginPercent: 8.4, epsTtm: 14.82, peRatio: 15.4, forwardPeRatio: 12.8, priceToSalesRatio: 1.4, priceToBookRatio: 2.8, dividendYieldPercent: 2.12, beta: 0.72, analystUpsidePercent: 7.4 },
  { rank: 128, ticker: "AFL", name: "Aflac", sector: "금융", exchange: "NYSE", price: 98.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 52000000000, revenueTtmUsd: 22400000000, grossMarginPercent: null, operatingMarginPercent: 12.4, epsTtm: 5.82, peRatio: 16.9, forwardPeRatio: 13.8, priceToSalesRatio: 2.3, priceToBookRatio: 3.8, dividendYieldPercent: 2.28, beta: 0.62, analystUpsidePercent: 8.4 },
  { rank: 129, ticker: "MET", name: "MetLife", sector: "금융", exchange: "NYSE", price: 68.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 52000000000, revenueTtmUsd: 69900000000, grossMarginPercent: null, operatingMarginPercent: 8.4, epsTtm: 6.82, peRatio: 10.0, forwardPeRatio: 8.8, priceToSalesRatio: 0.7, priceToBookRatio: 1.2, dividendYieldPercent: 3.28, beta: 0.82, analystUpsidePercent: 9.4 },
  { rank: 130, ticker: "PRU", name: "Prudential Financial", sector: "금융", exchange: "NYSE", price: 98.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 37000000000, revenueTtmUsd: 52400000000, grossMarginPercent: null, operatingMarginPercent: 8.4, epsTtm: 12.82, peRatio: 7.7, forwardPeRatio: 8.4, priceToSalesRatio: 0.7, priceToBookRatio: null, dividendYieldPercent: 4.68, beta: 0.92, analystUpsidePercent: 10.4 },
  { rank: 131, ticker: "NEE", name: "NextEra Energy", sector: "산업재", exchange: "NYSE", price: 68.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 138000000000, revenueTtmUsd: 21900000000, grossMarginPercent: 38.4, operatingMarginPercent: 18.4, epsTtm: 1.82, peRatio: 37.6, forwardPeRatio: 22.4, priceToSalesRatio: 6.3, priceToBookRatio: 3.8, dividendYieldPercent: 2.68, beta: 0.42, analystUpsidePercent: 8.4 },
  { rank: 132, ticker: "DUK", name: "Duke Energy", sector: "산업재", exchange: "NYSE", price: 98.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 72000000000, revenueTtmUsd: 28800000000, grossMarginPercent: 34.4, operatingMarginPercent: 18.4, epsTtm: 4.82, peRatio: 20.4, forwardPeRatio: 16.4, priceToSalesRatio: 2.5, priceToBookRatio: 1.8, dividendYieldPercent: 4.28, beta: 0.32, analystUpsidePercent: 7.4 },
  { rank: 133, ticker: "SO", name: "Southern Company", sector: "산업재", exchange: "NYSE", price: 78.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 84000000000, revenueTtmUsd: 23600000000, grossMarginPercent: 34.4, operatingMarginPercent: 18.4, epsTtm: 3.82, peRatio: 20.5, forwardPeRatio: 16.4, priceToSalesRatio: 3.6, priceToBookRatio: 2.4, dividendYieldPercent: 3.68, beta: 0.32, analystUpsidePercent: 7.8 },
  { rank: 134, ticker: "D", name: "Dominion Energy", sector: "산업재", exchange: "NYSE", price: 48.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 40000000000, revenueTtmUsd: 14400000000, grossMarginPercent: 34.4, operatingMarginPercent: 14.4, epsTtm: 2.82, peRatio: 17.2, forwardPeRatio: 14.4, priceToSalesRatio: 2.8, priceToBookRatio: 1.8, dividendYieldPercent: 4.68, beta: 0.32, analystUpsidePercent: 9.4 },
  { rank: 135, ticker: "AEP", name: "American Electric Power", sector: "산업재", exchange: "NASDAQ", price: 88.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 46000000000, revenueTtmUsd: 18400000000, grossMarginPercent: 34.4, operatingMarginPercent: 16.4, epsTtm: 4.82, peRatio: 18.3, forwardPeRatio: 14.8, priceToSalesRatio: 2.5, priceToBookRatio: 2.4, dividendYieldPercent: 3.68, beta: 0.32, analystUpsidePercent: 8.4 },
  { rank: 136, ticker: "EXC", name: "Exelon", sector: "산업재", exchange: "NASDAQ", price: 38.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 38000000000, revenueTtmUsd: 21700000000, grossMarginPercent: 34.4, operatingMarginPercent: 12.4, epsTtm: 1.82, peRatio: 21.1, forwardPeRatio: 16.4, priceToSalesRatio: 1.8, priceToBookRatio: 1.8, dividendYieldPercent: 3.68, beta: 0.42, analystUpsidePercent: 8.8 },
  { rank: 137, ticker: "XEL", name: "Xcel Energy", sector: "산업재", exchange: "NASDAQ", price: 58.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 32000000000, revenueTtmUsd: 13400000000, grossMarginPercent: 34.4, operatingMarginPercent: 14.4, epsTtm: 2.82, peRatio: 20.7, forwardPeRatio: 16.4, priceToSalesRatio: 2.4, priceToBookRatio: 2.4, dividendYieldPercent: 3.28, beta: 0.32, analystUpsidePercent: 8.4 },
  { rank: 138, ticker: "WEC", name: "WEC Energy Group", sector: "산업재", exchange: "NYSE", price: 88.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 28000000000, revenueTtmUsd: 8600000000, grossMarginPercent: 34.4, operatingMarginPercent: 18.4, epsTtm: 4.82, peRatio: 18.3, forwardPeRatio: 14.8, priceToSalesRatio: 3.3, priceToBookRatio: 3.4, dividendYieldPercent: 3.28, beta: 0.32, analystUpsidePercent: 7.4 },
  { rank: 139, ticker: "ES", name: "Eversource Energy", sector: "산업재", exchange: "NYSE", price: 58.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 18000000000, revenueTtmUsd: 9400000000, grossMarginPercent: 34.4, operatingMarginPercent: 14.4, epsTtm: 2.82, peRatio: 20.7, forwardPeRatio: 16.4, priceToSalesRatio: 1.9, priceToBookRatio: 1.8, dividendYieldPercent: 4.28, beta: 0.32, analystUpsidePercent: 10.4 },
  { rank: 140, ticker: "AWK", name: "American Water Works", sector: "산업재", exchange: "NYSE", price: 128.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 24000000000, revenueTtmUsd: 4000000000, grossMarginPercent: 54.4, operatingMarginPercent: 22.4, epsTtm: 4.82, peRatio: 26.6, forwardPeRatio: 20.4, priceToSalesRatio: 6.0, priceToBookRatio: 4.8, dividendYieldPercent: 2.28, beta: 0.42, analystUpsidePercent: 7.4 },
  { rank: 141, ticker: "IBM", name: "IBM", sector: "클라우드·소프트웨어", exchange: "NYSE", price: 168.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 154000000000, revenueTtmUsd: 61900000000, grossMarginPercent: 54.4, operatingMarginPercent: 12.4, epsTtm: 6.82, peRatio: 24.7, forwardPeRatio: 18.4, priceToSalesRatio: 2.5, priceToBookRatio: 7.4, dividendYieldPercent: 4.28, beta: 0.72, analystUpsidePercent: 8.4 },
  { rank: 142, ticker: "ACN", name: "Accenture", sector: "클라우드·소프트웨어", exchange: "NYSE", price: 318.4, change1dPercent: 0.6, change5dPercent: 1.8, marketCapUsd: 200000000000, revenueTtmUsd: 64900000000, grossMarginPercent: 32.4, operatingMarginPercent: 14.4, epsTtm: 11.82, peRatio: 26.9, forwardPeRatio: 22.4, priceToSalesRatio: 3.1, priceToBookRatio: null, dividendYieldPercent: 1.72, beta: 1.02, analystUpsidePercent: 8.4 },
  { rank: 143, ticker: "CTSH", name: "Cognizant", sector: "클라우드·소프트웨어", exchange: "NASDAQ", price: 68.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 35000000000, revenueTtmUsd: 19400000000, grossMarginPercent: 32.4, operatingMarginPercent: 12.4, epsTtm: 4.82, peRatio: 14.2, forwardPeRatio: 12.4, priceToSalesRatio: 1.8, priceToBookRatio: 3.8, dividendYieldPercent: 1.72, beta: 0.82, analystUpsidePercent: 10.4 },
  { rank: 144, ticker: "INFY", name: "Infosys", sector: "클라우드·소프트웨어", exchange: "NYSE", price: 18.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 77000000000, revenueTtmUsd: 18600000000, grossMarginPercent: 32.4, operatingMarginPercent: 22.4, epsTtm: 0.82, peRatio: 22.4, forwardPeRatio: 18.4, priceToSalesRatio: 4.1, priceToBookRatio: 7.4, dividendYieldPercent: 2.52, beta: 0.62, analystUpsidePercent: 9.4 },
  { rank: 145, ticker: "WIT", name: "Wipro", sector: "클라우드·소프트웨어", exchange: "NYSE", price: 6.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 33000000000, revenueTtmUsd: 11100000000, grossMarginPercent: 28.4, operatingMarginPercent: 14.4, epsTtm: 0.24, peRatio: 26.7, forwardPeRatio: 18.4, priceToSalesRatio: 3.0, priceToBookRatio: 4.8, dividendYieldPercent: 0.12, beta: 0.52, analystUpsidePercent: 12.4 },
  { rank: 146, ticker: "SAP", name: "SAP SE", sector: "클라우드·소프트웨어", exchange: "NYSE", price: 228.4, change1dPercent: 0.8, change5dPercent: 2.4, marketCapUsd: 274000000000, revenueTtmUsd: 33100000000, grossMarginPercent: 72.4, operatingMarginPercent: 18.4, epsTtm: 4.82, peRatio: 47.4, forwardPeRatio: 32.4, priceToSalesRatio: 8.3, priceToBookRatio: null, dividendYieldPercent: 1.12, beta: 0.82, analystUpsidePercent: 8.4 },
  { rank: 147, ticker: "ADSK", name: "Autodesk", sector: "클라우드·소프트웨어", exchange: "NASDAQ", price: 268.4, change1dPercent: 0.8, change5dPercent: 2.4, marketCapUsd: 58000000000, revenueTtmUsd: 5500000000, grossMarginPercent: 88.4, operatingMarginPercent: 22.4, epsTtm: 6.82, peRatio: 39.3, forwardPeRatio: 28.4, priceToSalesRatio: 10.5, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 1.32, analystUpsidePercent: 10.4 },
  { rank: 148, ticker: "ANSS", name: "Ansys", sector: "클라우드·소프트웨어", exchange: "NASDAQ", price: 328.4, change1dPercent: 0.6, change5dPercent: 1.8, marketCapUsd: 28000000000, revenueTtmUsd: 2300000000, grossMarginPercent: 84.4, operatingMarginPercent: 28.4, epsTtm: 7.82, peRatio: 42.0, forwardPeRatio: 32.4, priceToSalesRatio: 12.2, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 0.82, analystUpsidePercent: 8.4 },
  { rank: 149, ticker: "CDNS", name: "Cadence Design Systems", sector: "클라우드·소프트웨어", exchange: "NASDAQ", price: 268.4, change1dPercent: 0.8, change5dPercent: 2.4, marketCapUsd: 73000000000, revenueTtmUsd: 4100000000, grossMarginPercent: 86.4, operatingMarginPercent: 32.4, epsTtm: 4.82, peRatio: 55.7, forwardPeRatio: 38.4, priceToSalesRatio: 17.8, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 1.22, analystUpsidePercent: 9.4 },
  { rank: 150, ticker: "SNPS", name: "Synopsys", sector: "클라우드·소프트웨어", exchange: "NASDAQ", price: 468.4, change1dPercent: 0.8, change5dPercent: 2.4, marketCapUsd: 73000000000, revenueTtmUsd: 6100000000, grossMarginPercent: 78.4, operatingMarginPercent: 28.4, epsTtm: 8.82, peRatio: 53.1, forwardPeRatio: 38.4, priceToSalesRatio: 12.0, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 1.12, analystUpsidePercent: 8.4 },
  { rank: 151, ticker: "FTNT", name: "Fortinet", sector: "클라우드·소프트웨어", exchange: "NASDAQ", price: 68.4, change1dPercent: 1.2, change5dPercent: 3.4, marketCapUsd: 54000000000, revenueTtmUsd: 5300000000, grossMarginPercent: 76.4, operatingMarginPercent: 22.4, epsTtm: 1.24, peRatio: 55.2, forwardPeRatio: 38.4, priceToSalesRatio: 10.2, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 1.32, analystUpsidePercent: 12.4 },
  { rank: 152, ticker: "CRWD", name: "CrowdStrike", sector: "클라우드·소프트웨어", exchange: "NASDAQ", price: 328.4, change1dPercent: 2.1, change5dPercent: 5.6, marketCapUsd: 79000000000, revenueTtmUsd: 3800000000, grossMarginPercent: 74.4, operatingMarginPercent: 4.4, epsTtm: 0.24, peRatio: null, forwardPeRatio: 72.4, priceToSalesRatio: 20.8, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 1.42, analystUpsidePercent: 14.4 },
  { rank: 153, ticker: "S", name: "SentinelOne", sector: "클라우드·소프트웨어", exchange: "NYSE", price: 18.4, change1dPercent: 1.6, change5dPercent: 4.2, marketCapUsd: 6000000000, revenueTtmUsd: 700000000.0, grossMarginPercent: 72.4, operatingMarginPercent: -28.4, epsTtm: -0.82, peRatio: null, forwardPeRatio: null, priceToSalesRatio: 8.6, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 1.52, analystUpsidePercent: 18.4 },
  { rank: 154, ticker: "OKTA", name: "Okta", sector: "클라우드·소프트웨어", exchange: "NASDAQ", price: 88.4, change1dPercent: 1.4, change5dPercent: 3.8, marketCapUsd: 15000000000, revenueTtmUsd: 2300000000, grossMarginPercent: 74.4, operatingMarginPercent: -4.4, epsTtm: -0.24, peRatio: null, forwardPeRatio: null, priceToSalesRatio: 6.5, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 1.42, analystUpsidePercent: 16.4 },
  { rank: 155, ticker: "MDB", name: "MongoDB", sector: "클라우드·소프트웨어", exchange: "NASDAQ", price: 268.4, change1dPercent: 2.4, change5dPercent: 6.2, marketCapUsd: 19000000000, revenueTtmUsd: 1700000000, grossMarginPercent: 68.4, operatingMarginPercent: -8.4, epsTtm: -0.82, peRatio: null, forwardPeRatio: null, priceToSalesRatio: 11.2, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 1.52, analystUpsidePercent: 18.4 },
  { rank: 156, ticker: "TWLO", name: "Twilio", sector: "클라우드·소프트웨어", exchange: "NYSE", price: 68.4, change1dPercent: 1.2, change5dPercent: 3.4, marketCapUsd: 12000000000, revenueTtmUsd: 4200000000, grossMarginPercent: 48.4, operatingMarginPercent: -8.4, epsTtm: -0.42, peRatio: null, forwardPeRatio: null, priceToSalesRatio: 2.9, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 1.42, analystUpsidePercent: 16.4 },
  { rank: 157, ticker: "HCA", name: "HCA Healthcare", sector: "헬스케어", exchange: "NYSE", price: 268.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 68000000000, revenueTtmUsd: 65700000000, grossMarginPercent: 18.4, operatingMarginPercent: 8.4, epsTtm: 18.82, peRatio: 14.3, forwardPeRatio: 12.4, priceToSalesRatio: 1.0, priceToBookRatio: null, dividendYieldPercent: 0.88, beta: 1.12, analystUpsidePercent: 8.4 },
  { rank: 158, ticker: "CI", name: "Cigna", sector: "헬스케어", exchange: "NYSE", price: 328.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 100000000000, revenueTtmUsd: 195300000000, grossMarginPercent: 8.4, operatingMarginPercent: 4.4, epsTtm: 24.82, peRatio: 13.2, forwardPeRatio: 10.8, priceToSalesRatio: 0.5, priceToBookRatio: 2.4, dividendYieldPercent: 1.68, beta: 0.72, analystUpsidePercent: 9.4 },
  { rank: 159, ticker: "CVS", name: "CVS Health", sector: "헬스케어", exchange: "NYSE", price: 58.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 74000000000, revenueTtmUsd: 357800000000, grossMarginPercent: 14.4, operatingMarginPercent: 2.4, epsTtm: 5.82, peRatio: 10.0, forwardPeRatio: 8.4, priceToSalesRatio: 0.2, priceToBookRatio: 1.2, dividendYieldPercent: 3.68, beta: 0.72, analystUpsidePercent: 12.4 },
  { rank: 160, ticker: "MCK", name: "McKesson", sector: "헬스케어", exchange: "NYSE", price: 568.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 52000000000, revenueTtmUsd: 308900000000, grossMarginPercent: 4.4, operatingMarginPercent: 1.4, epsTtm: 28.82, peRatio: 19.7, forwardPeRatio: 16.4, priceToSalesRatio: 0.2, priceToBookRatio: null, dividendYieldPercent: 0.68, beta: 0.72, analystUpsidePercent: 8.4 },
  { rank: 161, ticker: "ABC", name: "AmerisourceBergen", sector: "헬스케어", exchange: "NYSE", price: 228.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 46000000000, revenueTtmUsd: 268900000000, grossMarginPercent: 2.4, operatingMarginPercent: 0.8, epsTtm: 12.82, peRatio: 17.8, forwardPeRatio: 14.8, priceToSalesRatio: 0.2, priceToBookRatio: null, dividendYieldPercent: 1.28, beta: 0.72, analystUpsidePercent: 8.8 },
  { rank: 162, ticker: "CAH", name: "Cardinal Health", sector: "헬스케어", exchange: "NYSE", price: 108.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 28000000000, revenueTtmUsd: 205000000000, grossMarginPercent: 2.4, operatingMarginPercent: 0.8, epsTtm: 7.82, peRatio: 13.9, forwardPeRatio: 10.8, priceToSalesRatio: 0.1, priceToBookRatio: null, dividendYieldPercent: 1.92, beta: 0.72, analystUpsidePercent: 9.4 },
  { rank: 163, ticker: "DGX", name: "Quest Diagnostics", sector: "헬스케어", exchange: "NYSE", price: 148.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 18000000000, revenueTtmUsd: 9300000000, grossMarginPercent: 34.4, operatingMarginPercent: 14.4, epsTtm: 8.82, peRatio: 16.8, forwardPeRatio: 13.8, priceToSalesRatio: 1.9, priceToBookRatio: null, dividendYieldPercent: 2.28, beta: 0.72, analystUpsidePercent: 8.4 },
  { rank: 164, ticker: "LH", name: "Laboratory Corp", sector: "헬스케어", exchange: "NYSE", price: 228.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 21000000000, revenueTtmUsd: 12400000000, grossMarginPercent: 34.4, operatingMarginPercent: 12.4, epsTtm: 14.82, peRatio: 15.4, forwardPeRatio: 12.4, priceToSalesRatio: 1.7, priceToBookRatio: null, dividendYieldPercent: 1.28, beta: 0.72, analystUpsidePercent: 9.4 },
  { rank: 165, ticker: "IDXX", name: "IDEXX Laboratories", sector: "헬스케어", exchange: "NASDAQ", price: 468.4, change1dPercent: 0.6, change5dPercent: 1.8, marketCapUsd: 38000000000, revenueTtmUsd: 3800000000, grossMarginPercent: 54.4, operatingMarginPercent: 22.4, epsTtm: 9.82, peRatio: 47.7, forwardPeRatio: 36.4, priceToSalesRatio: 10.0, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 0.82, analystUpsidePercent: 8.4 },
  { rank: 166, ticker: "A", name: "Agilent Technologies", sector: "헬스케어", exchange: "NYSE", price: 118.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 35000000000, revenueTtmUsd: 6800000000, grossMarginPercent: 52.4, operatingMarginPercent: 18.4, epsTtm: 4.82, peRatio: 24.6, forwardPeRatio: 18.4, priceToSalesRatio: 5.1, priceToBookRatio: null, dividendYieldPercent: 0.88, beta: 0.82, analystUpsidePercent: 10.4 },
  { rank: 167, ticker: "WAT", name: "Waters Corporation", sector: "헬스케어", exchange: "NYSE", price: 268.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 17000000000, revenueTtmUsd: 2900000000, grossMarginPercent: 54.4, operatingMarginPercent: 28.4, epsTtm: 10.82, peRatio: 24.8, forwardPeRatio: 20.4, priceToSalesRatio: 5.9, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 0.72, analystUpsidePercent: 9.4 },
  { rank: 168, ticker: "IQV", name: "IQVIA Holdings", sector: "헬스케어", exchange: "NYSE", price: 228.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 42000000000, revenueTtmUsd: 15400000000, grossMarginPercent: 34.4, operatingMarginPercent: 12.4, epsTtm: 8.82, peRatio: 25.9, forwardPeRatio: 18.4, priceToSalesRatio: 2.7, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 1.02, analystUpsidePercent: 10.4 },
  { rank: 169, ticker: "CNC", name: "Centene", sector: "헬스케어", exchange: "NYSE", price: 68.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 37000000000, revenueTtmUsd: 144500000000, grossMarginPercent: 4.4, operatingMarginPercent: 1.4, epsTtm: 5.82, peRatio: 11.7, forwardPeRatio: 9.8, priceToSalesRatio: 0.3, priceToBookRatio: 1.4, dividendYieldPercent: 0.0, beta: 0.82, analystUpsidePercent: 12.4 },
  { rank: 170, ticker: "WELL", name: "Welltower", sector: "산업재", exchange: "NYSE", price: 108.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 58000000000, revenueTtmUsd: 6500000000, grossMarginPercent: 38.4, operatingMarginPercent: 18.4, epsTtm: 1.82, peRatio: 59.6, forwardPeRatio: 38.4, priceToSalesRatio: 8.9, priceToBookRatio: null, dividendYieldPercent: 2.68, beta: 0.72, analystUpsidePercent: 7.4 },
  { rank: 171, ticker: "PLD", name: "Prologis", sector: "산업재", exchange: "NYSE", price: 108.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 98000000000, revenueTtmUsd: 7900000000, grossMarginPercent: 68.4, operatingMarginPercent: 48.4, epsTtm: 1.82, peRatio: 59.6, forwardPeRatio: 38.4, priceToSalesRatio: 12.4, priceToBookRatio: null, dividendYieldPercent: 3.28, beta: 0.82, analystUpsidePercent: 8.4 },
  { rank: 172, ticker: "AMT", name: "American Tower", sector: "산업재", exchange: "NYSE", price: 198.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 92000000000, revenueTtmUsd: 10000000000, grossMarginPercent: 68.4, operatingMarginPercent: 28.4, epsTtm: 2.82, peRatio: 70.4, forwardPeRatio: 38.4, priceToSalesRatio: 9.2, priceToBookRatio: null, dividendYieldPercent: 3.28, beta: 0.72, analystUpsidePercent: 9.4 },
  { rank: 173, ticker: "CCI", name: "Crown Castle", sector: "산업재", exchange: "NYSE", price: 98.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 42000000000, revenueTtmUsd: 6900000000, grossMarginPercent: 72.4, operatingMarginPercent: 28.4, epsTtm: 1.82, peRatio: 54.1, forwardPeRatio: 28.4, priceToSalesRatio: 6.1, priceToBookRatio: null, dividendYieldPercent: 5.68, beta: 0.72, analystUpsidePercent: 10.4 },
  { rank: 174, ticker: "EQIX", name: "Equinix", sector: "산업재", exchange: "NASDAQ", price: 768.4, change1dPercent: 0.6, change5dPercent: 1.8, marketCapUsd: 68000000000, revenueTtmUsd: 8200000000, grossMarginPercent: 48.4, operatingMarginPercent: 8.4, epsTtm: 8.82, peRatio: 87.1, forwardPeRatio: 52.4, priceToSalesRatio: 8.3, priceToBookRatio: null, dividendYieldPercent: 2.28, beta: 0.82, analystUpsidePercent: 8.4 },
  { rank: 175, ticker: "DLR", name: "Digital Realty", sector: "산업재", exchange: "NYSE", price: 148.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 48000000000, revenueTtmUsd: 5500000000, grossMarginPercent: 48.4, operatingMarginPercent: 8.4, epsTtm: 1.82, peRatio: 81.5, forwardPeRatio: 38.4, priceToSalesRatio: 8.7, priceToBookRatio: null, dividendYieldPercent: 3.28, beta: 0.72, analystUpsidePercent: 9.4 },
  { rank: 176, ticker: "O", name: "Realty Income", sector: "산업재", exchange: "NYSE", price: 52.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 46000000000, revenueTtmUsd: 4800000000, grossMarginPercent: 94.4, operatingMarginPercent: 28.4, epsTtm: 1.24, peRatio: 42.3, forwardPeRatio: 28.4, priceToSalesRatio: 9.6, priceToBookRatio: null, dividendYieldPercent: 5.68, beta: 0.52, analystUpsidePercent: 8.4 },
  { rank: 177, ticker: "SPG", name: "Simon Property Group", sector: "산업재", exchange: "NYSE", price: 168.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 54000000000, revenueTtmUsd: 5700000000, grossMarginPercent: 68.4, operatingMarginPercent: 38.4, epsTtm: 6.82, peRatio: 24.7, forwardPeRatio: 18.4, priceToSalesRatio: 9.5, priceToBookRatio: null, dividendYieldPercent: 5.28, beta: 1.02, analystUpsidePercent: 7.4 },
  { rank: 178, ticker: "PSA", name: "Public Storage", sector: "산업재", exchange: "NYSE", price: 268.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 47000000000, revenueTtmUsd: 3900000000, grossMarginPercent: 72.4, operatingMarginPercent: 38.4, epsTtm: 8.82, peRatio: 30.4, forwardPeRatio: 22.4, priceToSalesRatio: 12.1, priceToBookRatio: null, dividendYieldPercent: 4.28, beta: 0.72, analystUpsidePercent: 7.8 },
  { rank: 179, ticker: "EXR", name: "Extra Space Storage", sector: "산업재", exchange: "NYSE", price: 148.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 30000000000, revenueTtmUsd: 2100000000, grossMarginPercent: 72.4, operatingMarginPercent: 38.4, epsTtm: 5.82, peRatio: 25.5, forwardPeRatio: 18.4, priceToSalesRatio: 14.3, priceToBookRatio: null, dividendYieldPercent: 4.28, beta: 0.72, analystUpsidePercent: 8.4 },
  { rank: 180, ticker: "ROST", name: "Ross Stores", sector: "리테일", exchange: "NASDAQ", price: 138.4, change1dPercent: 0.6, change5dPercent: 1.8, marketCapUsd: 47000000000, revenueTtmUsd: 20400000000, grossMarginPercent: 28.4, operatingMarginPercent: 12.4, epsTtm: 5.82, peRatio: 23.8, forwardPeRatio: 18.4, priceToSalesRatio: 2.3, priceToBookRatio: null, dividendYieldPercent: 1.08, beta: 0.82, analystUpsidePercent: 8.4 },
  { rank: 181, ticker: "DG", name: "Dollar General", sector: "리테일", exchange: "NYSE", price: 128.4, change1dPercent: -0.2, change5dPercent: 0.4, marketCapUsd: 28000000000, revenueTtmUsd: 37800000000, grossMarginPercent: 30.4, operatingMarginPercent: 6.4, epsTtm: 8.82, peRatio: 14.6, forwardPeRatio: 12.4, priceToSalesRatio: 0.7, priceToBookRatio: null, dividendYieldPercent: 1.68, beta: 0.72, analystUpsidePercent: 12.4 },
  { rank: 182, ticker: "DLTR", name: "Dollar Tree", sector: "리테일", exchange: "NASDAQ", price: 68.4, change1dPercent: -0.2, change5dPercent: 0.4, marketCapUsd: 15000000000, revenueTtmUsd: 30600000000, grossMarginPercent: 34.4, operatingMarginPercent: 4.4, epsTtm: 4.82, peRatio: 14.2, forwardPeRatio: 10.8, priceToSalesRatio: 0.5, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 0.72, analystUpsidePercent: 14.4 },
  { rank: 183, ticker: "KR", name: "Kroger", sector: "리테일", exchange: "NYSE", price: 58.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 24000000000, revenueTtmUsd: 148300000000, grossMarginPercent: 22.4, operatingMarginPercent: 2.4, epsTtm: 4.82, peRatio: 12.1, forwardPeRatio: 10.4, priceToSalesRatio: 0.2, priceToBookRatio: null, dividendYieldPercent: 2.28, beta: 0.72, analystUpsidePercent: 9.4 },
  { rank: 184, ticker: "SYY", name: "Sysco", sector: "리테일", exchange: "NYSE", price: 78.4, change1dPercent: 0.2, change5dPercent: 0.8, marketCapUsd: 39000000000, revenueTtmUsd: 76300000000, grossMarginPercent: 18.4, operatingMarginPercent: 4.4, epsTtm: 3.82, peRatio: 20.5, forwardPeRatio: 16.4, priceToSalesRatio: 0.5, priceToBookRatio: null, dividendYieldPercent: 2.68, beta: 0.72, analystUpsidePercent: 8.4 },
  { rank: 185, ticker: "YUM", name: "Yum! Brands", sector: "소비재", exchange: "NYSE", price: 128.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 36000000000, revenueTtmUsd: 7100000000, grossMarginPercent: 52.4, operatingMarginPercent: 22.4, epsTtm: 4.82, peRatio: 26.6, forwardPeRatio: 20.4, priceToSalesRatio: 5.1, priceToBookRatio: null, dividendYieldPercent: 1.88, beta: 0.82, analystUpsidePercent: 8.4 },
  { rank: 186, ticker: "CMG", name: "Chipotle Mexican Grill", sector: "소비재", exchange: "NYSE", price: 52.4, change1dPercent: 0.8, change5dPercent: 2.4, marketCapUsd: 72000000000, revenueTtmUsd: 9900000000, grossMarginPercent: 24.4, operatingMarginPercent: 14.4, epsTtm: 0.54, peRatio: 97.0, forwardPeRatio: 52.4, priceToSalesRatio: 7.3, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 1.22, analystUpsidePercent: 9.4 },
  { rank: 187, ticker: "DPZ", name: "Domino's Pizza", sector: "소비재", exchange: "NASDAQ", price: 428.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 15000000000, revenueTtmUsd: 4500000000, grossMarginPercent: 38.4, operatingMarginPercent: 18.4, epsTtm: 14.82, peRatio: 28.9, forwardPeRatio: 22.4, priceToSalesRatio: 3.3, priceToBookRatio: null, dividendYieldPercent: 1.28, beta: 0.72, analystUpsidePercent: 8.4 },
  { rank: 188, ticker: "HLT", name: "Hilton Worldwide", sector: "소비재", exchange: "NYSE", price: 228.4, change1dPercent: 0.8, change5dPercent: 2.4, marketCapUsd: 54000000000, revenueTtmUsd: 10200000000, grossMarginPercent: 72.4, operatingMarginPercent: 28.4, epsTtm: 5.82, peRatio: 39.2, forwardPeRatio: 28.4, priceToSalesRatio: 5.3, priceToBookRatio: null, dividendYieldPercent: 0.52, beta: 1.22, analystUpsidePercent: 9.4 },
  { rank: 189, ticker: "MAR", name: "Marriott International", sector: "소비재", exchange: "NASDAQ", price: 228.4, change1dPercent: 0.6, change5dPercent: 1.8, marketCapUsd: 58000000000, revenueTtmUsd: 23700000000, grossMarginPercent: 82.4, operatingMarginPercent: 18.4, epsTtm: 8.82, peRatio: 25.9, forwardPeRatio: 20.4, priceToSalesRatio: 2.5, priceToBookRatio: null, dividendYieldPercent: 1.12, beta: 1.22, analystUpsidePercent: 8.4 },
  { rank: 190, ticker: "H", name: "Hyatt Hotels", sector: "소비재", exchange: "NYSE", price: 128.4, change1dPercent: 0.6, change5dPercent: 1.8, marketCapUsd: 14000000000, revenueTtmUsd: 6600000000, grossMarginPercent: 72.4, operatingMarginPercent: 8.4, epsTtm: 2.82, peRatio: 45.5, forwardPeRatio: 28.4, priceToSalesRatio: 2.1, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 1.12, analystUpsidePercent: 10.4 },
  { rank: 191, ticker: "LVS", name: "Las Vegas Sands", sector: "소비재", exchange: "NYSE", price: 38.4, change1dPercent: 0.8, change5dPercent: 2.4, marketCapUsd: 28000000000, revenueTtmUsd: 10400000000, grossMarginPercent: 52.4, operatingMarginPercent: 18.4, epsTtm: 0.82, peRatio: 46.8, forwardPeRatio: 22.4, priceToSalesRatio: 2.7, priceToBookRatio: null, dividendYieldPercent: 1.92, beta: 1.52, analystUpsidePercent: 12.4 },
  { rank: 192, ticker: "WYNN", name: "Wynn Resorts", sector: "소비재", exchange: "NASDAQ", price: 78.4, change1dPercent: 0.8, change5dPercent: 2.4, marketCapUsd: 9000000000, revenueTtmUsd: 7100000000, grossMarginPercent: 52.4, operatingMarginPercent: 14.4, epsTtm: 2.82, peRatio: 27.8, forwardPeRatio: 18.4, priceToSalesRatio: 1.3, priceToBookRatio: null, dividendYieldPercent: 1.28, beta: 1.52, analystUpsidePercent: 14.4 },
  { rank: 193, ticker: "MGM", name: "MGM Resorts", sector: "소비재", exchange: "NYSE", price: 28.4, change1dPercent: 0.6, change5dPercent: 1.8, marketCapUsd: 9000000000, revenueTtmUsd: 15200000000, grossMarginPercent: 28.4, operatingMarginPercent: 8.4, epsTtm: 0.82, peRatio: 34.6, forwardPeRatio: 18.4, priceToSalesRatio: 0.6, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 1.42, analystUpsidePercent: 14.4 },
  { rank: 194, ticker: "CZR", name: "Caesars Entertainment", sector: "소비재", exchange: "NASDAQ", price: 28.4, change1dPercent: 0.4, change5dPercent: 1.2, marketCapUsd: 6000000000, revenueTtmUsd: 11400000000, grossMarginPercent: 28.4, operatingMarginPercent: 4.4, epsTtm: 0.24, peRatio: null, forwardPeRatio: 18.4, priceToSalesRatio: 0.5, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 1.62, analystUpsidePercent: 16.4 },
  { rank: 195, ticker: "F", name: "Ford Motor", sector: "소비재", exchange: "NYSE", price: 10.4, change1dPercent: -0.4, change5dPercent: 0.8, marketCapUsd: 41000000000, revenueTtmUsd: 185000000000, grossMarginPercent: 8.4, operatingMarginPercent: 2.4, epsTtm: 1.82, peRatio: 5.7, forwardPeRatio: 7.4, priceToSalesRatio: 0.2, priceToBookRatio: 1.4, dividendYieldPercent: 4.62, beta: 1.52, analystUpsidePercent: 12.4 },
  { rank: 196, ticker: "GM", name: "General Motors", sector: "소비재", exchange: "NYSE", price: 42.4, change1dPercent: -0.2, change5dPercent: 0.8, marketCapUsd: 48000000000, revenueTtmUsd: 187400000000, grossMarginPercent: 12.4, operatingMarginPercent: 6.4, epsTtm: 7.82, peRatio: 5.4, forwardPeRatio: 5.8, priceToSalesRatio: 0.3, priceToBookRatio: 1.2, dividendYieldPercent: 0.92, beta: 1.22, analystUpsidePercent: 14.4 },
  { rank: 197, ticker: "RIVN", name: "Rivian Automotive", sector: "소비재", exchange: "NASDAQ", price: 12.4, change1dPercent: -0.8, change5dPercent: 1.8, marketCapUsd: 12000000000, revenueTtmUsd: 5000000000, grossMarginPercent: -28.4, operatingMarginPercent: -48.4, epsTtm: -2.82, peRatio: null, forwardPeRatio: null, priceToSalesRatio: 2.4, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 2.12, analystUpsidePercent: 22.4 },
  { rank: 198, ticker: "LCID", name: "Lucid Group", sector: "소비재", exchange: "NASDAQ", price: 2.4, change1dPercent: -0.4, change5dPercent: 0.8, marketCapUsd: 7000000000, revenueTtmUsd: 800000000.0, grossMarginPercent: -128.4, operatingMarginPercent: -248.4, epsTtm: -0.82, peRatio: null, forwardPeRatio: null, priceToSalesRatio: 8.7, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 2.42, analystUpsidePercent: 28.4 },
  { rank: 199, ticker: "NIO", name: "NIO", sector: "소비재", exchange: "NYSE", price: 4.4, change1dPercent: -0.8, change5dPercent: 1.2, marketCapUsd: 9000000000, revenueTtmUsd: 8100000000, grossMarginPercent: -8.4, operatingMarginPercent: -28.4, epsTtm: -0.82, peRatio: null, forwardPeRatio: null, priceToSalesRatio: 1.1, priceToBookRatio: null, dividendYieldPercent: 0.0, beta: 1.82, analystUpsidePercent: 24.4 },
];

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parseNumber(value: string | undefined): number | null {
  if (!value || value === "N/D") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stooqSymbol(ticker: string) {
  return `${ticker.toLowerCase().replace(".", "-")}.us`;
}

async function fetchStooqQuote(stock: BaseUsStock): Promise<StooqQuote | null> {
  const symbol = stooqSymbol(stock.ticker);
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcv&h&e=csv`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KoreaStockSectorAnalyzer/1.0)" },
    });
    if (!response.ok) return null;
    const csv = (await response.text()).trim();
    const [, row] = csv.split(/\r?\n/);
    if (!row) return null;
    const columns = row.split(",");
    const close = parseNumber(columns[6]);
    if (close === null || close <= 0) return null;
    const date = columns[1] && columns[1] !== "N/D" ? columns[1] : undefined;
    const time = columns[2] && columns[2] !== "N/D" ? columns[2] : undefined;
    const updatedAt = date ? new Date(`${date}T${time ?? "00:00:00"}Z`).toISOString() : nowIso();

    return {
      ticker: stock.ticker,
      close,
      open: parseNumber(columns[3]),
      volume: parseNumber(columns[7]),
      updatedAt,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchLiveQuotes() {
  const settled = await Promise.allSettled(stocks.map(stock => fetchStooqQuote(stock)));
  const quotes = new Map<string, StooqQuote>();
  for (const result of settled) {
    if (result.status === "fulfilled" && result.value) quotes.set(result.value.ticker, result.value);
  }
  return quotes;
}

export async function getUsStocksTable(): Promise<UsStockTableRow[]> {
  const quotes = await fetchLiveQuotes();
  const fallbackUpdatedAt = nowIso();
  const liveCount = quotes.size;
  const warning = liveCount === 0
    ? "Stooq 최신 시세 API 응답이 없어 저장된 기본 기초지표와 이전 기준 주가를 표시합니다."
    : liveCount < stocks.length
      ? `일부 종목(${liveCount}/${stocks.length})만 Stooq 최신 시세로 갱신되었습니다.`
      : undefined;

  return stocks.map(stock => {
    const quote = quotes.get(stock.ticker);
    const price = quote?.close ?? stock.price;
    const change1dPercent = quote?.open && quote.open > 0 ? round(((price - quote.open) / quote.open) * 100, 2) : stock.change1dPercent;
    const volume = quote?.volume ?? null;
    const turnoverUsd = volume === null ? null : round(price * volume, 2);

    return {
      ...stock,
      price,
      change1dPercent,
      volume,
      turnoverUsd,
      quoteSource: quote ? "Stooq" : "Fallback",
      quoteStatus: quote ? "live" : "fallback",
      quoteWarning: quote ? undefined : warning,
      lastUpdated: quote?.updatedAt ?? fallbackUpdatedAt,
    };
  });
}

export async function getUsStocksSummary() {
  const rows = await getUsStocksTable();
  const totalMarketCapUsd = rows.reduce((sum, row) => sum + row.marketCapUsd, 0);
  const totalRevenueTtmUsd = rows.reduce((sum, row) => sum + row.revenueTtmUsd, 0);
  const totalTurnoverUsd = rows.reduce((sum, row) => sum + (row.turnoverUsd ?? 0), 0);
  const avgChange1dPercent = rows.reduce((sum, row) => sum + row.change1dPercent, 0) / rows.length;
  const valuedPeRows = rows.filter(row => typeof row.peRatio === "number" && Number.isFinite(row.peRatio));
  const avgPeRatio = valuedPeRows.reduce((sum, row) => sum + Number(row.peRatio), 0) / valuedPeRows.length;
  const avgAnalystUpsidePercent = rows.reduce((sum, row) => sum + row.analystUpsidePercent, 0) / rows.length;
  const topGainer = [...rows].sort((a, b) => b.change1dPercent - a.change1dPercent)[0];
  const topLoser = [...rows].sort((a, b) => a.change1dPercent - b.change1dPercent)[0];
  const highestMarketCap = [...rows].sort((a, b) => b.marketCapUsd - a.marketCapUsd)[0];
  const liveQuoteCount = rows.filter(row => row.quoteStatus === "live").length;
  const warning = liveQuoteCount < rows.length
    ? liveQuoteCount === 0
      ? "최신 해외주식 시세 수집에 실패해 기본 기초지표 중심으로 표시합니다."
      : `최신 시세는 ${liveQuoteCount}/${rows.length}개 종목에만 반영되었습니다.`
    : undefined;
  const sectors = Array.from(rows.reduce((map, row) => {
    const current = map.get(row.sector) ?? { sector: row.sector, count: 0, marketCapUsd: 0, revenueTtmUsd: 0, turnoverUsd: 0, avgChange1dPercent: 0 };
    current.count += 1;
    current.marketCapUsd += row.marketCapUsd;
    current.revenueTtmUsd += row.revenueTtmUsd;
    current.turnoverUsd += row.turnoverUsd ?? 0;
    current.avgChange1dPercent += row.change1dPercent;
    map.set(row.sector, current);
    return map;
  }, new Map<UsStockSector, { sector: UsStockSector; count: number; marketCapUsd: number; revenueTtmUsd: number; turnoverUsd: number; avgChange1dPercent: number }>()).values())
    .map(sector => ({ ...sector, avgChange1dPercent: round(sector.avgChange1dPercent / sector.count, 2) }))
    .sort((a, b) => b.marketCapUsd - a.marketCapUsd);

  return {
    totalStocks: rows.length,
    totalMarketCapUsd,
    totalRevenueTtmUsd,
    totalTurnoverUsd,
    avgChange1dPercent: round(avgChange1dPercent, 2),
    avgPeRatio: round(avgPeRatio, 2),
    avgAnalystUpsidePercent: round(avgAnalystUpsidePercent, 2),
    liveQuoteCount,
    topGainer: { ticker: topGainer.ticker, change: topGainer.change1dPercent },
    topLoser: { ticker: topLoser.ticker, change: topLoser.change1dPercent },
    highestMarketCap: { ticker: highestMarketCap.ticker, marketCapUsd: highestMarketCap.marketCapUsd },
    sectors,
    indicators: US_STOCK_METRICS,
    warning,
    lastUpdated: rows.map(row => row.lastUpdated).sort().at(-1) ?? nowIso(),
  };
}


function parseYahooCandles(payload: YahooChartResponse): { symbol?: string; candles: PriceCandle[] } {
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  const candles: PriceCandle[] = [];
  for (let index = 0; index < timestamps.length; index += 1) {
    const close = quote?.close?.[index];
    const high = quote?.high?.[index];
    const low = quote?.low?.[index];
    const open = quote?.open?.[index] ?? close;
    const volume = quote?.volume?.[index] ?? 0;
    if ([open, high, low, close].every(value => typeof value === "number" && Number.isFinite(value) && value > 0)) {
      candles.push({
        date: new Date(timestamps[index] * 1000).toISOString().slice(0, 10),
        open: open as number,
        high: high as number,
        low: low as number,
        close: close as number,
        volume: typeof volume === "number" && Number.isFinite(volume) ? volume : 0,
      });
    }
  }
  return { symbol: result?.meta?.symbol, candles };
}

export async function fetchUsStockTechnicalDetail(input: { ticker: string; name?: string }) {
  const ticker = input.ticker.trim().toUpperCase();
  const yahooSymbol = ticker.replace(".", "-");
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=2y&interval=1d&includeAdjustedClose=true`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KoreaStockSectorAnalyzer/1.0)" },
    });
    if (!response.ok) throw new Error(`Yahoo Finance chart returned ${response.status}`);
    const payload = await response.json() as YahooChartResponse;
    const parsed = parseYahooCandles(payload);
    return buildTechnicalIndicatorDetailFromCandles({
      code: ticker,
      name: input.name,
      symbol: parsed.symbol ?? yahooSymbol,
      candles: parsed.candles,
      source: "YahooFinance",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "알 수 없는 오류";
    throw new Error(`${ticker} 해외주식 보조지표 데이터를 가져오지 못했습니다. ${reason}`);
  } finally {
    clearTimeout(timeout);
  }
}
