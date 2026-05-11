ALTER TABLE `stocks` MODIFY COLUMN `sector` varchar(80) NOT NULL;--> statement-breakpoint
ALTER TABLE `stocks` ADD `marketRank` int;