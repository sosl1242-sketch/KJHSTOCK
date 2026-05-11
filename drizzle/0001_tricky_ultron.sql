CREATE TABLE `stocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sector` enum('power','defense','semiconductor','semiconductor_equipment','display_equipment','investment_securities') NOT NULL,
	`name` varchar(120) NOT NULL,
	`code` varchar(12) NOT NULL,
	`marketSuffix` varchar(4) NOT NULL DEFAULT 'KS',
	`currentPrice` double NOT NULL DEFAULT 0,
	`annualEps` double NOT NULL DEFAULT 0,
	`dataSource` varchar(80) NOT NULL DEFAULT 'manual',
	`lastPriceFetchedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stocks_id` PRIMARY KEY(`id`),
	CONSTRAINT `stocks_code_unique` UNIQUE(`code`)
);
