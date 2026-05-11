import { TRPCError } from "@trpc/server";
import { createHeartbeatJob, listHeartbeatJobs, updateHeartbeatJob, type HeartbeatJobInfo } from "./_core/heartbeat";
import { PRICE_AUTO_REFRESH_CRON, PRICE_AUTO_REFRESH_INTERVAL_SECONDS, PRICE_AUTO_REFRESH_JOB_NAME, REGULAR_MARKET_BATCH_SIZE } from "./stockPrice";

export type StockPriceAutoRefreshStatus = {
  exists: boolean;
  enabled: boolean;
  taskUid: string | null;
  cronExpression: string;
  intervalSeconds: number;
  callbackPath: string;
  nextExecutionAt?: string | null;
  lastExecutedAt?: string | null;
  description: string;
};

const CALLBACK_PATH = "/api/scheduled/refreshStockPrices";
const DESCRIPTION = "국내 주식 현재가 캐시를 60초마다 오래된 종목부터 배치 갱신합니다.";

function toStatus(job?: HeartbeatJobInfo): StockPriceAutoRefreshStatus {
  return {
    exists: Boolean(job),
    enabled: Boolean(job?.isEnable),
    taskUid: job?.taskUid ?? null,
    cronExpression: job?.cronExpression ?? PRICE_AUTO_REFRESH_CRON,
    intervalSeconds: PRICE_AUTO_REFRESH_INTERVAL_SECONDS,
    callbackPath: job?.callbackPath ?? CALLBACK_PATH,
    nextExecutionAt: job?.nextExecutionAt ?? null,
    lastExecutedAt: job?.lastExecutedAt ?? null,
    description: job?.description || DESCRIPTION,
  };
}

async function findStockRefreshJob(userSession = "") {
  const listing = await listHeartbeatJobs(userSession, { page: 1, pageSize: 50 });
  return listing.jobs.find(job => job.name === PRICE_AUTO_REFRESH_JOB_NAME);
}

export async function getStockPriceAutoRefreshStatus(userSession = "") {
  const job = await findStockRefreshJob(userSession);
  return toStatus(job);
}

export async function ensureStockPriceAutoRefreshJob(userSession = "") {
  const existing = await findStockRefreshJob(userSession);
  if (existing) {
    await updateHeartbeatJob(existing.taskUid, {
      cron: PRICE_AUTO_REFRESH_CRON,
      path: CALLBACK_PATH,
      method: "POST",
      payload: { batchSize: REGULAR_MARKET_BATCH_SIZE },
      description: DESCRIPTION,
      enable: true,
    }, userSession);
    const refreshed = await findStockRefreshJob(userSession);
    return toStatus(refreshed ?? existing);
  }

  try {
    const created = await createHeartbeatJob({
      name: PRICE_AUTO_REFRESH_JOB_NAME,
      cron: PRICE_AUTO_REFRESH_CRON,
      path: CALLBACK_PATH,
      method: "POST",
      payload: { batchSize: REGULAR_MARKET_BATCH_SIZE },
      description: DESCRIPTION,
    }, userSession);
    return {
      ...toStatus({
        taskUid: created.taskUid,
        name: PRICE_AUTO_REFRESH_JOB_NAME,
        userId: "owner",
        description: DESCRIPTION,
        cronExpression: PRICE_AUTO_REFRESH_CRON,
        callbackPath: CALLBACK_PATH,
        callbackMethod: "POST",
        callbackPayload: JSON.stringify({ batchSize: REGULAR_MARKET_BATCH_SIZE }),
        isEnable: true,
        createdAt: null,
        lastExecutedAt: null,
        nextExecutionAt: created.nextExecutionAt ?? null,
      }),
    };
  } catch (error) {
    if (error instanceof TRPCError && error.code === "CONFLICT") {
      const conflicted = await findStockRefreshJob(userSession);
      if (conflicted) {
        await updateHeartbeatJob(conflicted.taskUid, { enable: true }, userSession);
        return toStatus(conflicted);
      }
    }
    throw error;
  }
}

export async function pauseStockPriceAutoRefreshJob(userSession = "") {
  const existing = await findStockRefreshJob(userSession);
  if (!existing) return toStatus();
  await updateHeartbeatJob(existing.taskUid, { enable: false }, userSession);
  const refreshed = await findStockRefreshJob(userSession);
  return toStatus(refreshed ?? { ...existing, isEnable: false });
}
