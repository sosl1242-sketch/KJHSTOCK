import { TRPCError } from "@trpc/server";
import { callDataApi } from "./_core/dataApi";
import { listStocks, updateStockPrice } from "./db";

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

export async function fetchKoreanStockPrice(code: string, marketSuffix: "KS" | "KQ") {
  const suffixes = Array.from(new Set([marketSuffix, marketSuffix === "KS" ? "KQ" : "KS"]));

  for (const suffix of suffixes) {
    const symbol = `${code}.${suffix}`;
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
      return { price, symbol };
    }
  }

  throw new TRPCError({
    code: "BAD_GATEWAY",
    message: `${code} 종목의 현재가를 외부 데이터 API에서 찾지 못했습니다.`,
  });
}

export async function refreshAllStoredStockPrices() {
  const rows = await listStocks();
  const results = [];

  for (const row of rows) {
    try {
      const { price, symbol } = await fetchKoreanStockPrice(row.code, row.marketSuffix as "KS" | "KQ");
      const updated = await updateStockPrice(row.id, price, `YahooFinance:${symbol}`);
      results.push({ id: row.id, code: row.code, success: true, stock: updated });
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
