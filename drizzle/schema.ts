import { double, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
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

export const stocks = mysqlTable("stocks", {
  id: int("id").autoincrement().primaryKey(),
  sector: varchar("sector", { length: 80 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  code: varchar("code", { length: 12 }).notNull().unique(),
  marketSuffix: varchar("marketSuffix", { length: 4 }).default("KS").notNull(),
  marketRank: int("marketRank"),
  currentPrice: double("currentPrice").default(0).notNull(),
  annualEps: double("annualEps").default(0).notNull(),
  dataSource: varchar("dataSource", { length: 80 }).default("manual").notNull(),
  lastPriceFetchedAt: timestamp("lastPriceFetchedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * 공개 조회용 캐시 테이블 - 외부 API 호출 제거
 */
export const stockFinancialCache = mysqlTable("stock_financial_cache", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 12 }).notNull().unique(),
  marketSuffix: varchar("marketSuffix", { length: 4 }).default("KS").notNull(),
  per: double("per"), // Price-to-Earnings Ratio
  pbr: double("pbr"), // Price-to-Book Ratio
  marketCapHundredMillionKrw: double("marketCapHundredMillionKrw"),
  latestOperatingProfitHundredMillionKrw: double("latestOperatingProfitHundredMillionKrw"),
  cachedAt: timestamp("cachedAt").defaultNow().notNull(),
});

export const usStockCache = mysqlTable("us_stock_cache", {
  id: int("id").autoincrement().primaryKey(),
  ticker: varchar("ticker", { length: 16 }).notNull().unique(),
  name: varchar("name", { length: 120 }),
  sector: varchar("sector", { length: 80 }),
  price: double("price"),
  change: double("change"),
  changePercent: double("changePercent"),
  marketCapBillion: double("marketCapBillion"),
  peRatio: double("peRatio"),
  dividendYield: double("dividendYield"),
  cachedAt: timestamp("cachedAt").defaultNow().notNull(),
});

export const priceHistoryCache = mysqlTable("price_history_cache", {
  id: int("id").autoincrement().primaryKey(),
  ticker: varchar("ticker", { length: 24 }).notNull(),
  market: varchar("market", { length: 20 }).notNull(), // 'KS', 'KQ', 'US', 'CRYPTO'
  interval: varchar("interval", { length: 10 }).notNull(), // '1d', '1w', '1mo'
  timestamp: varchar("timestamp", { length: 20 }).notNull(), // Unix timestamp as string
  open: double("open"),
  high: double("high"),
  low: double("low"),
  close: double("close"),
  volume: double("volume"),
  cachedAt: timestamp("cachedAt").defaultNow().notNull(),
});

export const cryptoFuturesCache = mysqlTable("crypto_futures_cache", {
  id: int("id").autoincrement().primaryKey(),
  symbol: varchar("symbol", { length: 24 }).notNull().unique(),
  name: varchar("name", { length: 120 }),
  price: double("price"),
  change24h: double("change24h"),
  changePercent24h: double("changePercent24h"),
  high24h: double("high24h"),
  low24h: double("low24h"),
  volume24hUsd: double("volume24hUsd"),
  openInterestUsd: double("openInterestUsd"),
  fundingRate: double("fundingRate"),
  cachedAt: timestamp("cachedAt").defaultNow().notNull(),
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
