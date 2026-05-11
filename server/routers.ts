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
        const usStocks = [
          { ticker: "AAPL", name: "Apple", sector: "Technology", price: 195.50, change: 2.3, volume: 52400000 },
          { ticker: "MSFT", name: "Microsoft", sector: "Technology", price: 420.75, change: 1.8, volume: 18900000 },
          { ticker: "GOOGL", name: "Alphabet", sector: "Technology", price: 155.30, change: 0.9, volume: 22100000 },
          { ticker: "AMZN", name: "Amazon", sector: "Consumer", price: 190.25, change: 3.1, volume: 42300000 },
          { ticker: "NVDA", name: "NVIDIA", sector: "Technology", price: 875.40, change: 5.2, volume: 35600000 },
        ];
        const summary = {
          totalStocks: 100,
          topGainer: { ticker: "NVDA", change: 5.2 },
          topLoser: { ticker: "TSLA", change: -1.5 },
          avgChange: 1.3,
          lastUpdated: new Date().toISOString(),
        };
        return { success: true, summary, sampleStocks: usStocks };
      } catch (error) {
        return { success: false, error: "Failed to fetch US stock summary" };
      }
    }),
    getTable: publicProcedure.query(async () => {
      try {
        const stocks = [
          { ticker: "AAPL", name: "Apple", sector: "Technology", price: 195.50, change: 2.3, changePercent: 1.19, volume: 52400000, marketCap: "3.05T" },
          { ticker: "MSFT", name: "Microsoft", sector: "Technology", price: 420.75, change: 1.8, changePercent: 0.43, volume: 18900000, marketCap: "3.14T" },
          { ticker: "GOOGL", name: "Alphabet", sector: "Technology", price: 155.30, change: 0.9, changePercent: 0.58, volume: 22100000, marketCap: "1.93T" },
          { ticker: "AMZN", name: "Amazon", sector: "Consumer", price: 190.25, change: 3.1, changePercent: 1.65, volume: 42300000, marketCap: "1.98T" },
          { ticker: "NVDA", name: "NVIDIA", sector: "Technology", price: 875.40, change: 5.2, changePercent: 0.60, volume: 35600000, marketCap: "2.15T" },
        ];
        return { success: true, stocks, total: 100, lastUpdated: new Date().toISOString() };
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
