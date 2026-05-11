import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { stockSectors } from "../drizzle/schema";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { deleteStock, listStocks, updateStockPrice, upsertStock } from "./db";
import { fetchNaverFinancialDetail, fetchNaverFinancialSummaries } from "./financials";
import { ensureStockPriceAutoRefreshJob, getStockPriceAutoRefreshStatus, pauseStockPriceAutoRefreshJob } from "./priceAutoRefresh";
import { fetchKoreanStockPrice, refreshAllStoredStockPrices } from "./stockPrice";
import { fetchTechnicalIndicatorDetail } from "./technicalIndicators";
import { getCryptoFuturesSummary, getCryptoFuturesTable } from "./cryptoFutures";
import { getUsStocksSummary, getUsStocksTable } from "./usStocks";

const sectorSchema = z.enum(stockSectors);

const stockInputSchema = z.object({
  id: z.number().int().positive().optional(),
  sector: sectorSchema,
  name: z.string().min(1).max(120),
  code: z.string().min(5).max(12),
  marketSuffix: z.enum(["KS", "KQ"]).default("KS"),
  currentPrice: z.number().min(0),
  annualEps: z.number(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
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
      .input(z.object({ id: z.number().int().positive(), code: z.string(), marketSuffix: z.enum(["KS", "KQ"]) }))
      .mutation(async ({ input }) => {
        const { price, symbol } = await fetchKoreanStockPrice(input.code, input.marketSuffix);
        return updateStockPrice(input.id, price, `YahooFinance:${symbol}`);
      }),

    refreshAllPrices: adminProcedure.mutation(() => refreshAllStoredStockPrices()),

    autoRefreshStatus: adminProcedure.query(() => getStockPriceAutoRefreshStatus()),

    enableAutoRefresh: adminProcedure.mutation(() => ensureStockPriceAutoRefreshJob()),

    pauseAutoRefresh: adminProcedure.mutation(() => pauseStockPriceAutoRefreshJob()),

    financialDetail: protectedProcedure
      .input(z.object({ code: z.string().min(5).max(12), name: z.string().max(120).optional(), marketSuffix: z.enum(["KS", "KQ"]).default("KS") }))
      .query(({ input }) => fetchNaverFinancialDetail(input)),

    financialSummaries: protectedProcedure
      .input(z.object({
        stocks: z.array(z.object({
          code: z.string().min(5).max(12),
          name: z.string().max(120).optional(),
          marketSuffix: z.enum(["KS", "KQ"]).default("KS"),
        })).min(1).max(25),
      }))
      .query(({ input }) => fetchNaverFinancialSummaries(input.stocks)),

    technicalIndicators: protectedProcedure
      .input(z.object({ code: z.string().min(5).max(12), name: z.string().max(120).optional(), marketSuffix: z.enum(["KS", "KQ"]).default("KS") }))
      .query(({ input }) => fetchTechnicalIndicatorDetail(input)),
  }),

  globalStocks: router({
    getSummary: publicProcedure.query(async () => {
      try {
        return { success: true, summary: getUsStocksSummary() };
      } catch (error) {
        return { success: false, error: "Failed to fetch US stock summary" };
      }
    }),
    getTable: publicProcedure.query(async () => {
      try {
        const stocks = getUsStocksTable();
        return { success: true, stocks, total: stocks.length, lastUpdated: new Date().toISOString() };
      } catch (error) {
        return { success: false, error: "Failed to fetch US stock table" };
      }
    }),
  }),

  cryptoFutures: router({
    getSummary: publicProcedure.query(async () => {
      try {
        return { success: true, summary: getCryptoFuturesSummary() };
      } catch (error) {
        return { success: false, error: "Failed to fetch crypto summary" };
      }
    }),
    getTable: publicProcedure.query(async () => {
      try {
        const coins = getCryptoFuturesTable();
        return { success: true, coins, total: coins.length, lastUpdated: new Date().toISOString() };
      } catch (error) {
        return { success: false, error: "Failed to fetch crypto table" };
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
