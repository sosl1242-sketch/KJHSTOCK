CREATE TABLE `crypto_futures_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`symbol` varchar(24) NOT NULL,
	`name` varchar(120),
	`price` double,
	`change24h` double,
	`changePercent24h` double,
	`high24h` double,
	`low24h` double,
	`volume24hUsd` double,
	`openInterestUsd` double,
	`fundingRate` double,
	`cachedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `crypto_futures_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `crypto_futures_cache_symbol_unique` UNIQUE(`symbol`)
);
--> statement-breakpoint
CREATE TABLE `price_history_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticker` varchar(24) NOT NULL,
	`market` varchar(20) NOT NULL,
	`interval` varchar(10) NOT NULL,
	`timestamp` varchar(20) NOT NULL,
	`open` double,
	`high` double,
	`low` double,
	`close` double,
	`volume` double,
	`cachedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `price_history_cache_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_financial_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(12) NOT NULL,
	`marketSuffix` varchar(4) NOT NULL DEFAULT 'KS',
	`per` double,
	`pbr` double,
	`marketCapHundredMillionKrw` double,
	`latestOperatingProfitHundredMillionKrw` double,
	`cachedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_financial_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_financial_cache_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `stocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sector` varchar(80) NOT NULL,
	`name` varchar(120) NOT NULL,
	`code` varchar(12) NOT NULL,
	`marketSuffix` varchar(4) NOT NULL DEFAULT 'KS',
	`marketRank` int,
	`currentPrice` double NOT NULL DEFAULT 0,
	`annualEps` double NOT NULL DEFAULT 0,
	`dataSource` varchar(80) NOT NULL DEFAULT 'manual',
	`lastPriceFetchedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stocks_id` PRIMARY KEY(`id`),
	CONSTRAINT `stocks_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `us_stock_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticker` varchar(16) NOT NULL,
	`name` varchar(120),
	`sector` varchar(80),
	`price` double,
	`change` double,
	`changePercent` double,
	`marketCapBillion` double,
	`peRatio` double,
	`dividendYield` double,
	`cachedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `us_stock_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `us_stock_cache_ticker_unique` UNIQUE(`ticker`)
);
