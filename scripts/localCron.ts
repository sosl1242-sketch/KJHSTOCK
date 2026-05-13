import "dotenv/config";
import { closeDb, seedDefaultStocksIfNeeded } from "../server/db";
import { syncAllPublicQueryCaches, syncCryptoFuturesTableCache, syncCryptoTechnicalCache } from "../server/cacheSync";
import { refreshStaleStoredStockPrices } from "../server/stockPrice";

type Task = "seed-stocks" | "refresh-prices" | "sync-crypto" | "sync-crypto-technical" | "sync-caches" | "all";

function getArgValue(args: string[], name: string) {
  const prefix = `${name}=`;
  const inline = args.find(arg => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function hasFlag(args: string[], name: string) {
  return args.includes(name);
}

function readBatchSize(args: string[]) {
  const value = getArgValue(args, "--batch-size");
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`Invalid --batch-size value: ${value}`);
  }
  return Math.floor(parsed);
}

async function runTask(task: Task, args: string[]) {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for local cron tasks");
  }

  if (task === "seed-stocks") {
    await seedDefaultStocksIfNeeded();
    return { seeded: true };
  }

  if (task === "refresh-prices") {
    await seedDefaultStocksIfNeeded();
    return refreshStaleStoredStockPrices({
      batchSize: readBatchSize(args),
      force: hasFlag(args, "--force"),
    });
  }

  if (task === "sync-caches") {
    await seedDefaultStocksIfNeeded();
    return syncAllPublicQueryCaches();
  }

  if (task === "sync-crypto") {
    return syncCryptoFuturesTableCache();
  }

  if (task === "sync-crypto-technical") {
    return syncCryptoTechnicalCache();
  }

  await seedDefaultStocksIfNeeded();
  const price = await refreshStaleStoredStockPrices({
    batchSize: readBatchSize(args),
    force: hasFlag(args, "--force"),
  });
  const caches = await syncAllPublicQueryCaches();
  return { price, caches };
}

async function main() {
  const [rawTask = "all", ...args] = process.argv.slice(2);
  const allowed: Task[] = ["seed-stocks", "refresh-prices", "sync-crypto", "sync-crypto-technical", "sync-caches", "all"];
  if (!allowed.includes(rawTask as Task)) {
    throw new Error(`Unknown task "${rawTask}". Use one of: ${allowed.join(", ")}`);
  }

  const task = rawTask as Task;
  const startedAt = new Date().toISOString();
  console.log(JSON.stringify({ ok: true, event: "started", task, startedAt }));
  const result = await runTask(task, args);
  console.log(JSON.stringify({ ok: true, event: "completed", task, startedAt, completedAt: new Date().toISOString(), result }, null, 2));
}

main()
  .catch(error => {
    console.error(JSON.stringify({
      ok: false,
      event: "failed",
      message: error instanceof Error ? error.message : "Unknown local cron error",
      stack: error instanceof Error ? error.stack : undefined,
      failedAt: new Date().toISOString(),
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb().catch(() => undefined);
  });
