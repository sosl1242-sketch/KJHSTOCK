import { z } from "zod";
import { stockSectors } from "../drizzle/schema";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { deleteStock, listStocks, updateStockPrice, upsertStock, getCachedStockFinancial, getCachedPriceHistory } from "./db";
import { getCacheAutoRefreshStatus, ensureCacheAutoRefreshJob, pauseCacheAutoRefreshJob } from "./cacheAutoRefresh";
import { fetchNaverFinancialDetail, fetchNaverFinancialSummaries } from "./financials";
import { ensureStockPriceAutoRefreshJob, getStockPriceAutoRefreshStatus, pauseStockPriceAutoRefreshJob } from "./priceAutoRefresh";
import { fetchKoreanStockPrice, refreshAllStoredStockPrices } from "./stockPrice";
import { fetchTechnicalIndicatorDetail } from "./technicalIndicators";
import { fetchCryptoFuturesTechnicalDetail, getCryptoFuturesDataStatus, getCryptoFuturesSummary, getCryptoFuturesTable } from "./cryptoFutures";
import { getTradeFiAssetsSummary, getTradeFiAssetsTable } from "./tradeFiAssets";
import { fetchUsStockTechnicalDetail, getUsStocksSummary, getUsStocksTable } from "./usStocks";
import { KRX_CODE_PATTERN, normalizeKrxCode } from "./krxCode";

const sectorSchema = z.enum(stockSectors);
const krxCodeSchema = z
  .string()
  .transform(normalizeKrxCode)
  .refine(code => KRX_CODE_PATTERN.test(code), "KRX stock code must be exactly six uppercase alphanumeric characters");

const stockInputSchema = z.object({
  id: z.number().int().positive().optional(),
  sector: sectorSchema,
  name: z.string().min(1).max(120),
  code: krxCodeSchema,
  marketSuffix: z.enum(["KS", "KQ"]).default("KS"),
  currentPrice: z.number().min(0),
  annualEps: z.number(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(() => {
      return {
        success: true,
      } as const;
    }),
  }),

  stocks: router({
    list: protectedProcedure
      .input(z.object({ sector: sectorSchema.optional() }).optional())
      .query(({ input }) => listStocks(input?.sector)),

    save: adminProcedure.input(stockInputSchema).mutation(({ input }) =>
      upsertStock({
        ...input,
        dataSource: "manual",
      })
    ),

    delete: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) =>
      deleteStock(input.id)
    ),

    refreshPrice: adminProcedure
      .input(z.object({ id: z.number().int().positive(), code: krxCodeSchema, marketSuffix: z.enum(["KS", "KQ"]) }))
      .mutation(async ({ input }) => {
        const { price, symbol } = await fetchKoreanStockPrice(input.code, input.marketSuffix);
        return updateStockPrice(input.id, price, `YahooFinance:${symbol}`);
      }),

    refreshAllPrices: adminProcedure.mutation(() => refreshAllStoredStockPrices()),

    autoRefreshStatus: adminProcedure.query(() => getStockPriceAutoRefreshStatus()),

    enableAutoRefresh: adminProcedure.mutation(() => ensureStockPriceAutoRefreshJob()),

    pauseAutoRefresh: adminProcedure.mutation(() => pauseStockPriceAutoRefreshJob()),

    cacheRefreshStatus: adminProcedure.query(() => getCacheAutoRefreshStatus()),

    enableCacheRefresh: adminProcedure.mutation(() => ensureCacheAutoRefreshJob()),

    pauseCacheRefresh: adminProcedure.mutation(() => pauseCacheAutoRefreshJob()),

    syncCryptoCache: adminProcedure.mutation(async () => {
      try {
        const { syncCryptoTechnicalCache } = await import("./cacheSync");
        const result = await syncCryptoTechnicalCache();
        return { success: true, result };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to sync crypto cache";
        return { success: false, error: message };
      }
    }),

    financialDetail: protectedProcedure
      .input(z.object({ code: krxCodeSchema, name: z.string().max(120).optional(), marketSuffix: z.enum(["KS", "KQ"]).default("KS") }))
      .query(async ({ input }) => {
        // DB 캐시에서 먼저 조회 (API 호출 없음)
        try {
          const cached = await getCachedStockFinancial(input.code, input.marketSuffix);
          if (cached) {
            return {
              code: input.code,
              name: input.name,
              marketSuffix: input.marketSuffix,
              per: cached.per,
              pbr: cached.pbr,
              roe: null,
              bps: null,
              operatingProfitMargin: null,
              debtRatio: null,
              netBorrowingsHundredMillionKrw: null,
              dividendYield: null,
              revenueGrowthYoY: null,
              operatingProfitGrowthYoY: null,
              marketCapHundredMillionKrw: cached.marketCapHundredMillionKrw,
              latestRevenueHundredMillionKrw: null,
              latestOperatingProfitHundredMillionKrw: cached.latestOperatingProfitHundredMillionKrw,
              latestNetIncomeHundredMillionKrw: null,
              quarterly: [],
              source: "NaverFinance" as const,
              fetchedAt: cached.cachedAt?.toISOString() ?? new Date().toISOString(),
              note: "캐시된 데이터 (일 1회 갱신)",
            };
          }
        } catch (error) {
          console.error("[Router] Failed to get cached financial detail:", error);
        }
        // 캐시가 없으면 실시간 조회
        return fetchNaverFinancialDetail(input);
      }),

    financialSummaries: protectedProcedure
      .input(z.object({
        stocks: z.array(z.object({
          code: krxCodeSchema,
          name: z.string().max(120).optional(),
          marketSuffix: z.enum(["KS", "KQ"]).default("KS"),
        })).min(1).max(25),
      }))
      .query(async ({ input }) => {
        // DB 캐시에서 조회 (API 호출 없음)
        const results = [];
        for (const stock of input.stocks) {
          try {
            const cached = await getCachedStockFinancial(stock.code, stock.marketSuffix);
            if (cached) {
              results.push({
                code: stock.code,
                name: stock.name,
                marketSuffix: stock.marketSuffix,
                per: cached.per,
                pbr: cached.pbr,
                marketCapHundredMillionKrw: cached.marketCapHundredMillionKrw,
                latestOperatingProfitHundredMillionKrw: cached.latestOperatingProfitHundredMillionKrw,
                source: "NaverFinance" as const,
                fetchedAt: cached.cachedAt?.toISOString() ?? new Date().toISOString(),
                success: true,
              });
            } else {
              results.push({
                code: stock.code,
                name: stock.name,
                marketSuffix: stock.marketSuffix,
                success: false,
                error: "캐시 데이터 없음 (일 1회 갱신 대기 중)",
                fetchedAt: new Date().toISOString(),
              });
            }
          } catch (error) {
            console.error(`[Router] Failed to get cached financial summary for ${stock.code}:`, error);
            results.push({
              code: stock.code,
              name: stock.name,
              marketSuffix: stock.marketSuffix,
              success: false,
              error: "캐시 조회 실패",
              fetchedAt: new Date().toISOString(),
            });
          }
        }
        return results;
      }),

    technicalIndicators: protectedProcedure
      .input(z.object({ code: krxCodeSchema, name: z.string().max(120).optional(), marketSuffix: z.enum(["KS", "KQ"]).default("KS") }))
      .query(async ({ input }) => {
        // DB 캐시에서 가격 이력 조회 (API 호출 없음)
        try {
          const history = await getCachedPriceHistory(input.code, input.marketSuffix, "1d");
          if (history.length > 0) {
            // 캐시 데이터로 응답
            const closes = history.map(h => h.close ?? 0).filter(c => c > 0);
            const latestClose = closes.length > 0 ? closes[closes.length - 1] : null;
            const high52Week = Math.max(...history.map(h => h.high ?? 0));
            const low52Week = Math.min(...history.map(h => h.low ?? 0));
            return {
              code: input.code,
              name: input.name,
              marketSuffix: input.marketSuffix,
              symbol: input.code,
              latestClose,
              high52Week: high52Week > 0 ? high52Week : null,
              low52Week: low52Week > 0 ? low52Week : null,
              fairPriceMedian: null,
              indicators: [],
              priceHistory: history.map(h => ({
                date: h.timestamp,
                open: h.open ?? 0,
                high: h.high ?? 0,
                low: h.low ?? 0,
                close: h.close ?? 0,
                volume: h.volume ?? 0,
              })),
              source: "YahooFinance" as const,
              fetchedAt: history[0]?.cachedAt?.toISOString() ?? new Date().toISOString(),
              note: "캐시된 데이터 (일 1회 갱신)",
            };
          }
        } catch (error) {
          console.error("[Router] Failed to get cached technical indicators:", error);
        }
        // 캐시가 없으면 실시간 조회
        return fetchTechnicalIndicatorDetail(input);
      }),
  }),

  globalStocks: router({
    getSummary: protectedProcedure.query(async () => {
      try {
        const summary = await getUsStocksSummary();
        return { success: true, summary };
      } catch (error) {
        return { success: false, error: "Failed to fetch US stock summary" };
      }
    }),
    getTable: protectedProcedure.query(async () => {
      try {
        const stocks = await getUsStocksTable();
        return { success: true, stocks, total: stocks.length, lastUpdated: new Date().toISOString() };
      } catch (error) {
        return { success: false, error: "Failed to fetch US stock table" };
      }
    }),
    technicalIndicators: protectedProcedure
      .input(z.object({ ticker: z.string().min(1).max(16), name: z.string().max(120).optional() }))
      .query(async ({ input }) => {
        try {
          return { success: true, detail: await fetchUsStockTechnicalDetail(input) };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to fetch US technical indicators";
          return { success: false, error: message };
        }
      }),
  }),

  tradeFi: router({
    getSummary: protectedProcedure.query(async () => {
      try {
        return { success: true, summary: await getTradeFiAssetsSummary() };
      } catch (error) {
        return { success: false, error: "Failed to fetch TradeFi summary" };
      }
    }),
    getTable: protectedProcedure.query(async () => {
      try {
        const assets = await getTradeFiAssetsTable();
        const liveQuoteCount = assets.filter(asset => asset.quoteStatus === "live").length;
        const lastUpdated = assets.map(asset => asset.lastUpdated).sort().at(-1) ?? new Date().toISOString();
        const warning = liveQuoteCount < assets.length ? `최신 시세는 ${liveQuoteCount}/${assets.length}개 TradeFi 자산에만 반영되었습니다.` : undefined;
        return { success: true, assets, total: assets.length, lastUpdated, warning };
      } catch (error) {
        return { success: false, error: "Failed to fetch TradeFi table" };
      }
    }),
  }),

  cryptoFutures: router({
    getSummary: protectedProcedure.query(async () => {
      try {
        return { success: true, summary: await getCryptoFuturesSummary() };
      } catch (error) {
        return { success: false, error: "Failed to fetch crypto summary" };
      }
    }),
    getTable: protectedProcedure.query(async () => {
      try {
        const coins = await getCryptoFuturesTable();
        const status = await getCryptoFuturesDataStatus();
        return { success: true, coins, total: coins.length, lastUpdated: status.lastUpdated, warning: status.warning, source: status.source };
      } catch (error) {
        return { success: false, error: "Failed to fetch crypto table" };
      }
    }),
    technicalIndicators: protectedProcedure
      .input(z.object({ symbol: z.string().min(4).max(24), name: z.string().max(120).optional() }))
      .query(async ({ input }) => {
        try {
          // DB 캠시에서 먼저 조회
          const cachedHistory = await getCachedPriceHistory(input.symbol, "CRYPTO", "1d");
          if (cachedHistory && cachedHistory.length > 0) {
            // DB 캠시로 보조지표 차트 렌더링
            const { buildTechnicalIndicatorDetailFromCandles } = await import("./technicalIndicators");
            const candles = cachedHistory.map(row => ({
              date: row.timestamp,
              open: row.open ?? 0,
              high: row.high ?? 0,
              low: row.low ?? 0,
              close: row.close ?? 0,
              volume: row.volume ?? 0,
            }));
            const detail = buildTechnicalIndicatorDetailFromCandles({
              code: input.symbol,
              name: input.name,
              symbol: input.symbol,
              candles,
              source: "DB Cache (Binance Futures)",
              currency: "USD",
            });
            return { success: true, detail };
          }
          // 캠시 없으면 실시간 조회
          return { success: true, detail: await fetchCryptoFuturesTechnicalDetail(input) };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to fetch crypto technical indicators";
          return { success: false, error: message };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
