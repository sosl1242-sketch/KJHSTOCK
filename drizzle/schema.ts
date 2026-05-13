import { doublePrecision, integer, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const userRole = pgEnum("role", ["user", "admin"]);

/**
 * Core user table backing auth flow.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRole("role").default("user").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { mode: "date" }).defaultNow().notNull(),
});

export const stockSectors = [
  "ai_semiconductor_value_chain",
  "power_infra_machinery",
  "battery_mobility",
  "shipbuilding_defense_aerospace",
  "finance_brokerage_insurance",
  "platform_telecom_content",
  "bio_healthcare",
  "consumer_retail_travel",
  "chemicals_materials_steel",
  "holding_multi_industry",
  "industrial_business_services",
] as const;

export const stocks = pgTable("stocks", {
  id: serial("id").primaryKey(),
  sector: varchar("sector", { length: 80 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  code: varchar("code", { length: 12 }).notNull().unique(),
  marketSuffix: varchar("marketSuffix", { length: 4 }).default("KS").notNull(),
  marketRank: integer("marketRank"),
  currentPrice: doublePrecision("currentPrice").default(0).notNull(),
  annualEps: doublePrecision("annualEps").default(0).notNull(),
  dataSource: varchar("dataSource", { length: 80 }).default("manual").notNull(),
  lastPriceFetchedAt: timestamp("lastPriceFetchedAt", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

/**
 * 공개 조회용 캐시 테이블 - 외부 API 호출 제거
 */
export const stockFinancialCache = pgTable("stock_financial_cache", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 12 }).notNull().unique(),
  marketSuffix: varchar("marketSuffix", { length: 4 }).default("KS").notNull(),
  per: doublePrecision("per"), // Price-to-Earnings Ratio
  pbr: doublePrecision("pbr"), // Price-to-Book Ratio
  marketCapHundredMillionKrw: doublePrecision("marketCapHundredMillionKrw"),
  latestOperatingProfitHundredMillionKrw: doublePrecision("latestOperatingProfitHundredMillionKrw"),
  cachedAt: timestamp("cachedAt", { mode: "date" }).defaultNow().notNull(),
});

export const usStockCache = pgTable("us_stock_cache", {
  id: serial("id").primaryKey(),
  ticker: varchar("ticker", { length: 16 }).notNull().unique(),
  name: varchar("name", { length: 120 }),
  sector: varchar("sector", { length: 80 }),
  price: doublePrecision("price"),
  change: doublePrecision("change"),
  changePercent: doublePrecision("changePercent"),
  marketCapBillion: doublePrecision("marketCapBillion"),
  peRatio: doublePrecision("peRatio"),
  dividendYield: doublePrecision("dividendYield"),
  cachedAt: timestamp("cachedAt", { mode: "date" }).defaultNow().notNull(),
});

export const priceHistoryCache = pgTable("price_history_cache", {
  id: serial("id").primaryKey(),
  ticker: varchar("ticker", { length: 24 }).notNull(),
  market: varchar("market", { length: 20 }).notNull(), // 'KS', 'KQ', 'US', 'CRYPTO'
  interval: varchar("interval", { length: 10 }).notNull(), // '1d', '1w', '1mo'
  timestamp: varchar("timestamp", { length: 20 }).notNull(), // Unix timestamp as string
  open: doublePrecision("open"),
  high: doublePrecision("high"),
  low: doublePrecision("low"),
  close: doublePrecision("close"),
  volume: doublePrecision("volume"),
  cachedAt: timestamp("cachedAt", { mode: "date" }).defaultNow().notNull(),
});

export const cryptoFuturesCache = pgTable("crypto_futures_cache", {
  id: serial("id").primaryKey(),
  symbol: varchar("symbol", { length: 24 }).notNull().unique(),
  name: varchar("name", { length: 120 }),
  price: doublePrecision("price"),
  change24h: doublePrecision("change24h"),
  changePercent24h: doublePrecision("changePercent24h"),
  high24h: doublePrecision("high24h"),
  low24h: doublePrecision("low24h"),
  volume24hUsd: doublePrecision("volume24hUsd"),
  openInterestUsd: doublePrecision("openInterestUsd"),
  fundingRate: doublePrecision("fundingRate"),
  cachedAt: timestamp("cachedAt", { mode: "date" }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Stock = typeof stocks.$inferSelect;
export type InsertStock = typeof stocks.$inferInsert;
export type StockSector = (typeof stockSectors)[number];
export type StockFinancialCache = typeof stockFinancialCache.$inferSelect;
export type InsertStockFinancialCache = typeof stockFinancialCache.$inferInsert;
export type UsStockCache = typeof usStockCache.$inferSelect;
export type InsertUsStockCache = typeof usStockCache.$inferInsert;
export type PriceHistoryCache = typeof priceHistoryCache.$inferSelect;
export type InsertPriceHistoryCache = typeof priceHistoryCache.$inferInsert;
export type CryptoFuturesCache = typeof cryptoFuturesCache.$inferSelect;
export type InsertCryptoFuturesCache = typeof cryptoFuturesCache.$inferInsert;
