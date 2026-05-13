import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { InsertStock, InsertUser, Stock, StockSector, stocks, users } from "../drizzle/schema";
import { ENV } from './_core/env';
import { KOSPI_TOP200_STOCKS } from "./kospiSeed";

const KOREA_MARKET_CAP_STOCK_LIMIT = 200;

let _db: ReturnType<typeof drizzle> | null = null;
let _sql: ReturnType<typeof postgres> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _sql = postgres(process.env.DATABASE_URL, {
        max: 5,
        prepare: false,
      });
      _db = drizzle(_sql);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function closeDb() {
  if (_sql) {
    await _sql.end({ timeout: 5 });
  }
  _sql = null;
  _db = null;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (
      user.email &&
      ENV.supabaseAdminEmail &&
      user.email.toLowerCase() === ENV.supabaseAdminEmail.toLowerCase()
    ) {
      const existingAdmin = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
      if (existingAdmin.length === 0) {
        values.role = "admin";
        updateSet.role = "admin";
      }
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }
    updateSet.updatedAt = new Date();
    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export function calculateEarningsYield(annualEps: number, currentPrice: number) {
  if (!Number.isFinite(annualEps) || !Number.isFinite(currentPrice) || currentPrice <= 0) {
    return null;
  }
  return (annualEps / currentPrice) * 100;
}

export function stockWithYield(stock: Stock) {
  return {
    ...stock,
    earningsYield: calculateEarningsYield(Number(stock.annualEps), Number(stock.currentPrice)),
  };
}

function normalizeSeedStock(seed: (typeof KOSPI_TOP200_STOCKS)[number]): InsertStock {
  return {
    sector: seed.sector,
    name: seed.name,
    code: seed.code,
    marketSuffix: seed.marketSuffix,
    marketRank: seed.marketRank,
    currentPrice: seed.currentPrice,
    annualEps: seed.annualEps,
    dataSource: seed.dataSource,
    lastPriceFetchedAt: new Date(seed.lastPriceFetchedAt),
  };
}

export async function seedDefaultStocksIfNeeded() {
  const db = await getDb();
  if (!db) return;
  const seedStocks = KOSPI_TOP200_STOCKS.filter(seed => !seed.marketRank || seed.marketRank <= KOREA_MARKET_CAP_STOCK_LIMIT);
  const existing = await db.select({ id: stocks.id }).from(stocks).limit(KOREA_MARKET_CAP_STOCK_LIMIT + 1);
  if (existing.length >= seedStocks.length) return;
  await db.insert(stocks).values(seedStocks.map(normalizeSeedStock)).onConflictDoUpdate({
    target: stocks.code,
    set: {
      sector: sql`excluded."sector"`,
      name: sql`excluded."name"`,
      marketSuffix: sql`excluded."marketSuffix"`,
      marketRank: sql`excluded."marketRank"`,
      currentPrice: sql`excluded."currentPrice"`,
      annualEps: sql`excluded."annualEps"`,
      dataSource: sql`excluded."dataSource"`,
      lastPriceFetchedAt: sql`excluded."lastPriceFetchedAt"`,
      updatedAt: new Date(),
    },
  });
}

function sortStocksByRank(rows: Stock[]) {
  return [...rows].sort((a, b) => {
    const rankA = a.marketRank ?? 999999;
    const rankB = b.marketRank ?? 999999;
    if (rankA !== rankB) return rankA - rankB;
    return a.name.localeCompare(b.name, "ko");
  });
}

export async function listStocks(sector?: StockSector) {
  const db = await getDb();
  if (!db) return [];
  await seedDefaultStocksIfNeeded();
  const rows = sector
    ? await db.select().from(stocks).where(eq(stocks.sector, sector))
    : await db.select().from(stocks);
  return sortStocksByRank(rows).map(stockWithYield);
}

export async function upsertStock(input: Omit<InsertStock, "id" | "createdAt" | "updatedAt"> & { id?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const values = {
    sector: input.sector,
    name: input.name,
    code: input.code,
    marketSuffix: input.marketSuffix,
    marketRank: input.marketRank,
    currentPrice: input.currentPrice,
    annualEps: input.annualEps,
    dataSource: input.dataSource ?? "manual",
  };
  if (input.id) {
    await db.update(stocks).set({ ...values, updatedAt: new Date() }).where(eq(stocks.id, input.id));
    const updated = await db.select().from(stocks).where(eq(stocks.id, input.id)).limit(1);
    return updated[0] ? stockWithYield(updated[0]) : null;
  }
  await db.insert(stocks).values(values);
  const created = await db.select().from(stocks).where(eq(stocks.code, input.code)).limit(1);
  return created[0] ? stockWithYield(created[0]) : null;
}

export async function deleteStock(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(stocks).where(eq(stocks.id, id));
  return { success: true } as const;
}

export async function updateStockPrice(id: number, currentPrice: number, dataSource: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .update(stocks)
    .set({ currentPrice, dataSource, lastPriceFetchedAt: new Date(), updatedAt: new Date() })
    .where(eq(stocks.id, id));
  const updated = await db.select().from(stocks).where(eq(stocks.id, id)).limit(1);
  return updated[0] ? stockWithYield(updated[0]) : null;
}


// ============ 공개 조회용 캐시 헬퍼 함수 ============

import { stockFinancialCache, usStockCache, priceHistoryCache, cryptoFuturesCache, InsertStockFinancialCache, InsertUsStockCache, InsertPriceHistoryCache, InsertCryptoFuturesCache } from "../drizzle/schema";

export async function getCachedStockFinancial(code: string, marketSuffix: string = "KS") {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(stockFinancialCache)
    .where(and(eq(stockFinancialCache.code, code), eq(stockFinancialCache.marketSuffix, marketSuffix)))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertStockFinancialCache(data: InsertStockFinancialCache) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .insert(stockFinancialCache)
    .values(data)
    .onConflictDoUpdate({
      target: stockFinancialCache.code,
      set: {
        per: data.per,
        pbr: data.pbr,
        marketCapHundredMillionKrw: data.marketCapHundredMillionKrw,
        latestOperatingProfitHundredMillionKrw: data.latestOperatingProfitHundredMillionKrw,
        cachedAt: new Date(),
      },
    });
}

export async function getCachedUsStock(ticker: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(usStockCache)
    .where(eq(usStockCache.ticker, ticker))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getAllCachedUsStocks() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(usStockCache);
}

export async function upsertUsStockCache(data: InsertUsStockCache) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .insert(usStockCache)
    .values(data)
    .onConflictDoUpdate({
      target: usStockCache.ticker,
      set: {
        name: data.name,
        sector: data.sector,
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
        marketCapBillion: data.marketCapBillion,
        peRatio: data.peRatio,
        dividendYield: data.dividendYield,
        cachedAt: new Date(),
      },
    });
}

export async function getCachedPriceHistory(ticker: string, market: string, interval: string) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(priceHistoryCache)
    .where(
      and(
        eq(priceHistoryCache.ticker, ticker),
        eq(priceHistoryCache.market, market),
        eq(priceHistoryCache.interval, interval)
      )
    )
    .orderBy(priceHistoryCache.timestamp);
}

export async function upsertPriceHistoryCache(data: InsertPriceHistoryCache[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (data.length === 0) return;
  await db.transaction(async tx => {
    const first = data[0];
    await tx
      .delete(priceHistoryCache)
      .where(
        and(
          eq(priceHistoryCache.ticker, first.ticker),
          eq(priceHistoryCache.market, first.market),
          eq(priceHistoryCache.interval, first.interval)
        )
      );
    await tx.insert(priceHistoryCache).values(data);
  });
}

export async function getCachedCryptoFutures(symbol: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(cryptoFuturesCache)
    .where(eq(cryptoFuturesCache.symbol, symbol))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getAllCachedCryptoFutures() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(cryptoFuturesCache);
}

export async function upsertCryptoFuturesCache(data: InsertCryptoFuturesCache) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .insert(cryptoFuturesCache)
    .values(data)
    .onConflictDoUpdate({
      target: cryptoFuturesCache.symbol,
      set: {
        name: data.name,
        price: data.price,
        change24h: data.change24h,
        changePercent24h: data.changePercent24h,
        high24h: data.high24h,
        low24h: data.low24h,
        volume24hUsd: data.volume24hUsd,
        openInterestUsd: data.openInterestUsd,
        fundingRate: data.fundingRate,
        cachedAt: new Date(),
      },
    });
}

export async function upsertCryptoFuturesCacheRows(data: InsertCryptoFuturesCache[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (data.length === 0) return;
  await db
    .insert(cryptoFuturesCache)
    .values(data)
    .onConflictDoUpdate({
      target: cryptoFuturesCache.symbol,
      set: {
        name: sql`excluded."name"`,
        price: sql`excluded."price"`,
        change24h: sql`excluded."change24h"`,
        changePercent24h: sql`excluded."changePercent24h"`,
        high24h: sql`excluded."high24h"`,
        low24h: sql`excluded."low24h"`,
        volume24hUsd: sql`excluded."volume24hUsd"`,
        openInterestUsd: sql`excluded."openInterestUsd"`,
        fundingRate: sql`excluded."fundingRate"`,
        cachedAt: new Date(),
      },
    });
}
