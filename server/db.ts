import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertStock, InsertUser, Stock, StockSector, stocks, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

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

const DEFAULT_STOCKS: InsertStock[] = [
  { sector: "power", name: "한국전력", code: "015760", marketSuffix: "KS", currentPrice: 0, annualEps: 0, dataSource: "manual" },
  { sector: "power", name: "LS ELECTRIC", code: "010120", marketSuffix: "KS", currentPrice: 0, annualEps: 0, dataSource: "manual" },
  { sector: "power", name: "HD현대일렉트릭", code: "267260", marketSuffix: "KS", currentPrice: 0, annualEps: 0, dataSource: "manual" },
  { sector: "defense", name: "한화에어로스페이스", code: "012450", marketSuffix: "KS", currentPrice: 0, annualEps: 0, dataSource: "manual" },
  { sector: "defense", name: "LIG넥스원", code: "079550", marketSuffix: "KS", currentPrice: 0, annualEps: 0, dataSource: "manual" },
  { sector: "defense", name: "현대로템", code: "064350", marketSuffix: "KS", currentPrice: 0, annualEps: 0, dataSource: "manual" },
  { sector: "semiconductor", name: "삼성전자", code: "005930", marketSuffix: "KS", currentPrice: 0, annualEps: 0, dataSource: "manual" },
  { sector: "semiconductor", name: "SK하이닉스", code: "000660", marketSuffix: "KS", currentPrice: 0, annualEps: 0, dataSource: "manual" },
  { sector: "semiconductor", name: "DB하이텍", code: "000990", marketSuffix: "KS", currentPrice: 0, annualEps: 0, dataSource: "manual" },
  { sector: "semiconductor_equipment", name: "한미반도체", code: "042700", marketSuffix: "KS", currentPrice: 0, annualEps: 0, dataSource: "manual" },
  { sector: "semiconductor_equipment", name: "원익IPS", code: "240810", marketSuffix: "KQ", currentPrice: 0, annualEps: 0, dataSource: "manual" },
  { sector: "semiconductor_equipment", name: "주성엔지니어링", code: "036930", marketSuffix: "KQ", currentPrice: 0, annualEps: 0, dataSource: "manual" },
  { sector: "display_equipment", name: "LG디스플레이", code: "034220", marketSuffix: "KS", currentPrice: 0, annualEps: 0, dataSource: "manual" },
  { sector: "display_equipment", name: "AP시스템", code: "265520", marketSuffix: "KQ", currentPrice: 0, annualEps: 0, dataSource: "manual" },
  { sector: "display_equipment", name: "덕산네오룩스", code: "213420", marketSuffix: "KQ", currentPrice: 0, annualEps: 0, dataSource: "manual" },
  { sector: "investment_securities", name: "미래에셋증권", code: "006800", marketSuffix: "KS", currentPrice: 0, annualEps: 0, dataSource: "manual" },
  { sector: "investment_securities", name: "NH투자증권", code: "005940", marketSuffix: "KS", currentPrice: 0, annualEps: 0, dataSource: "manual" },
  { sector: "investment_securities", name: "키움증권", code: "039490", marketSuffix: "KS", currentPrice: 0, annualEps: 0, dataSource: "manual" },
];

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

export async function seedDefaultStocksIfEmpty() {
  const db = await getDb();
  if (!db) return;

  const existing = await db.select({ id: stocks.id }).from(stocks).limit(1);
  if (existing.length > 0) return;

  await db.insert(stocks).values(DEFAULT_STOCKS);
}

export async function listStocks(sector?: StockSector) {
  const db = await getDb();
  if (!db) return [];

  await seedDefaultStocksIfEmpty();
  const rows = sector
    ? await db.select().from(stocks).where(eq(stocks.sector, sector))
    : await db.select().from(stocks);

  return rows.map(stockWithYield);
}

export async function upsertStock(input: Omit<InsertStock, "id" | "createdAt" | "updatedAt"> & { id?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const values = {
    sector: input.sector,
    name: input.name,
    code: input.code,
    marketSuffix: input.marketSuffix,
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
