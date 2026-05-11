import { double, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
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

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Stock = typeof stocks.$inferSelect;
export type InsertStock = typeof stocks.$inferInsert;
export type StockSector = (typeof stockSectors)[number];
