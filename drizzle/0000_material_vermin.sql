CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "crypto_futures_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" varchar(24) NOT NULL,
	"name" varchar(120),
	"price" double precision,
	"change24h" double precision,
	"changePercent24h" double precision,
	"high24h" double precision,
	"low24h" double precision,
	"volume24hUsd" double precision,
	"openInterestUsd" double precision,
	"fundingRate" double precision,
	"cachedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "crypto_futures_cache_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "price_history_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticker" varchar(24) NOT NULL,
	"market" varchar(20) NOT NULL,
	"interval" varchar(10) NOT NULL,
	"timestamp" varchar(20) NOT NULL,
	"open" double precision,
	"high" double precision,
	"low" double precision,
	"close" double precision,
	"volume" double precision,
	"cachedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_financial_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(12) NOT NULL,
	"marketSuffix" varchar(4) DEFAULT 'KS' NOT NULL,
	"per" double precision,
	"pbr" double precision,
	"marketCapHundredMillionKrw" double precision,
	"latestOperatingProfitHundredMillionKrw" double precision,
	"cachedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stock_financial_cache_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "stocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"sector" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"code" varchar(12) NOT NULL,
	"marketSuffix" varchar(4) DEFAULT 'KS' NOT NULL,
	"marketRank" integer,
	"currentPrice" double precision DEFAULT 0 NOT NULL,
	"annualEps" double precision DEFAULT 0 NOT NULL,
	"dataSource" varchar(80) DEFAULT 'manual' NOT NULL,
	"lastPriceFetchedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stocks_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "us_stock_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticker" varchar(16) NOT NULL,
	"name" varchar(120),
	"sector" varchar(80),
	"price" double precision,
	"change" double precision,
	"changePercent" double precision,
	"marketCapBillion" double precision,
	"peRatio" double precision,
	"dividendYield" double precision,
	"cachedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "us_stock_cache_ticker_unique" UNIQUE("ticker")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
