import { TRPCError } from "@trpc/server";
import { callDataApi } from "./_core/dataApi";
import { listStocks, updateStockPrice } from "./db";

export const PRICE_AUTO_REFRESH_JOB_NAME = "stock-price-refresh-60s";
export const PRICE_AUTO_REFRESH_CRON = "0 * * * * *";
export const PRICE_AUTO_REFRESH_INTERVAL_SECONDS = 60;
export const REGULAR_MARKET_STALE_MS = PRICE_AUTO_REFRESH_INTERVAL_SECONDS * 1000;
export const CLOSED_MARKET_STALE_MS = 30 * 60 * 1000;
export const REGULAR_MARKET_BATCH_SIZE = 40;
export const CLOSED_MARKET_BATCH_SIZE = 10;
export const PRICE_FETCH_MAX_ATTEMPTS = 3;
export const PRICE_FETCH_RETRY_DELAY_MS = 250;

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        previousClose?: number;
        chartPreviousClose?: number;
        symbol?: string;
      };
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }>;
    error?: unknown;
  };
};

export type KoreaMarketSession = "regular" | "closed";

export type PriceRefreshPolicy = {
  session: KoreaMarketSession;
  sessionLabel: string;
  staleMs: number;
  batchSize: number;
};

export type PriceRefreshResult = {
  id: number;
  code: string;
  success: boolean;
  stock?: Awaited<ReturnType<typeof updateStockPrice>>;
  error?: string;
  attempts?: number;
};

export type StalePriceRefreshSummary = {
  mode: "stale-cache";
  refreshedAt: string;
  session: KoreaMarketSession;
  sessionLabel: string;
  staleMs: number;
  batchSize: number;
  totalStoredCount: number;
  staleCount: number;
  attemptedCount: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  results: PriceRefreshResult[];
};

export function extractLatestPrice(payload: unknown) {
  const response = payload as YahooChartResponse;
  const result = response.chart?.result?.[0];
  const metaPrice = result?.meta?.regularMarketPrice ?? result?.meta?.previousClose ?? result?.meta?.chartPreviousClose;
  if (typeof metaPrice === "number" && Number.isFinite(metaPrice) && metaPrice > 0) {
    return metaPrice;
  }

  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const latestClose = [...closes].reverse().find(value => typeof value === "number" && Number.isFinite(value) && value > 0);
  return typeof latestClose === "number" ? latestClose : null;
}

export function getKoreaMarketRefreshPolicy(now = new Date()): PriceRefreshPolicy {
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const day = kst.getDay();
  const minutes = kst.getHours() * 60 + kst.getMinutes();
  const isWeekday = day >= 1 && day <= 5;
  const isRegularSession = isWeekday && minutes >= 9 * 60 && minutes <= 15 * 60 + 30;

  if (isRegularSession) {
    return {
      session: "regular",
      sessionLabel: "장중 60초 자동 추적",
      staleMs: REGULAR_MARKET_STALE_MS,
      batchSize: REGULAR_MARKET_BATCH_SIZE,
    };
  }

  return {
    session: "closed",
    sessionLabel: "장외 저빈도 캐시 점검",
    staleMs: CLOSED_MARKET_STALE_MS,
    batchSize: CLOSED_MARKET_BATCH_SIZE,
  };
}

function getFetchedAtMs(value: Date | string | null | undefined) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
}

function sleep(ms: number) {
  if (ms <= 0) return Promise.resolve();
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchKoreanStockPrice(code: string, marketSuffix: "KS" | "KQ", options: {
  maxAttempts?: number;
  retryDelayMs?: number;
} = {}) {
  const suffixes = Array.from(new Set([marketSuffix, marketSuffix === "KS" ? "KQ" : "KS"]));
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? PRICE_FETCH_MAX_ATTEMPTS));
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? PRICE_FETCH_RETRY_DELAY_MS);
  const failures: string[] = [];
  let totalAttempts = 0;

  for (const suffix of suffixes) {
    const symbol = `${code}.${suffix}`;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      totalAttempts += 1;
      try {
        const payload = await callDataApi("YahooFinance/get_stock_chart", {
          query: {
            symbol,
            region: "KR",
            interval: "1d",
            range: "5d",
            includeAdjustedClose: true,
          },
        });
        const price = extractLatestPrice(payload);
        if (price) {
          return { price, symbol, attempts: totalAttempts };
        }
        failures.push(`${symbol} ${attempt}/${maxAttempts}: 유효한 현재가 없음`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "알 수 없는 오류";
        failures.push(`${symbol} ${attempt}/${maxAttempts}: ${message}`);
      }

      if (attempt < maxAttempts) {
        await sleep(retryDelayMs);
      }
    }
  }

  throw new TRPCError({
    code: "BAD_GATEWAY",
    message: `${code} 종목의 현재가를 외부 데이터 API에서 찾지 못했습니다. 재시도 ${totalAttempts}회 실패: ${failures.join(" | ")}`,
  });
}

export async function refreshAllStoredStockPrices() {
  const rows = await listStocks();
  const results: PriceRefreshResult[] = [];

  for (const row of rows) {
    try {
      const { price, symbol, attempts } = await fetchKoreanStockPrice(row.code, row.marketSuffix as "KS" | "KQ");
      const updated = await updateStockPrice(row.id, price, `YahooFinance:${symbol}`);
      results.push({ id: row.id, code: row.code, success: true, stock: updated, attempts });
    } catch (error) {
      results.push({
        id: row.id,
        code: row.code,
        success: false,
        error: error instanceof Error ? error.message : "알 수 없는 오류",
      });
    }
  }

  return results;
}

export async function refreshStaleStoredStockPrices(options: {
  now?: Date;
  staleMs?: number;
  batchSize?: number;
  force?: boolean;
} = {}): Promise<StalePriceRefreshSummary> {
  const now = options.now ?? new Date();
  const policy = getKoreaMarketRefreshPolicy(now);
  const staleMs = options.staleMs ?? policy.staleMs;
  const batchSize = options.batchSize ?? policy.batchSize;
  const rows = await listStocks();
  const nowMs = now.getTime();
  const staleRows = rows
    .filter(row => options.force || nowMs - getFetchedAtMs(row.lastPriceFetchedAt) >= staleMs)
    .sort((a, b) => {
      const fetchedDiff = getFetchedAtMs(a.lastPriceFetchedAt) - getFetchedAtMs(b.lastPriceFetchedAt);
      if (fetchedDiff !== 0) return fetchedDiff;
      return (a.marketRank ?? 999999) - (b.marketRank ?? 999999);
    });
  const targetRows = staleRows.slice(0, Math.max(1, batchSize));
  const results: PriceRefreshResult[] = [];

  for (const row of targetRows) {
    try {
      const { price, symbol, attempts } = await fetchKoreanStockPrice(row.code, row.marketSuffix as "KS" | "KQ");
      const updated = await updateStockPrice(row.id, price, `YahooFinance:${symbol}`);
      results.push({ id: row.id, code: row.code, success: true, stock: updated, attempts });
    } catch (error) {
      results.push({
        id: row.id,
        code: row.code,
        success: false,
        error: error instanceof Error ? error.message : "알 수 없는 오류",
      });
    }
  }

  const successCount = results.filter(result => result.success).length;
  const failureCount = results.length - successCount;

  return {
    mode: "stale-cache",
    refreshedAt: now.toISOString(),
    session: policy.session,
    sessionLabel: policy.sessionLabel,
    staleMs,
    batchSize,
    totalStoredCount: rows.length,
    staleCount: staleRows.length,
    attemptedCount: targetRows.length,
    successCount,
    failureCount,
    skippedCount: Math.max(staleRows.length - targetRows.length, 0),
    results,
  };
}
