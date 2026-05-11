import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertStock, InsertUser, Stock, StockSector, stocks, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { KOSPI_TOP200_STOCKS } from "./kospiSeed";

let _db: ReturnType<typeof drizzle> | null = null;
export const KOREA_MARKET_CAP_STOCK_LIMIT = 300;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
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
    const values: InsertUser = {
      openId: user.openId,
    };
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
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
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

  for (const seed of seedStocks) {
    const values = normalizeSeedStock(seed);
    await db.insert(stocks).values(values).onDuplicateKeyUpdate({
      set: {
        sector: values.sector,
        name: values.name,
        marketSuffix: values.marketSuffix,
        marketRank: values.marketRank,
        currentPrice: values.currentPrice,
        annualEps: values.annualEps,
        dataSource: values.dataSource,
        lastPriceFetchedAt: values.lastPriceFetchedAt,
      },
    });
  }
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
    await db.update(stocks).set(values).where(eq(stocks.id, input.id));
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
    .set({ currentPrice, dataSource, lastPriceFetchedAt: new Date() })
    .where(eq(stocks.id, id));

  const updated = await db.select().from(stocks).where(eq(stocks.id, id)).limit(1);
  return updated[0] ? stockWithYield(updated[0]) : null;
}
