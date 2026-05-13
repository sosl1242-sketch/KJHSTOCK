/**
 * 12시간 주기 공개 조회 데이터 캐시 동기화 Heartbeat 스케줄 관리
 */

import { createHeartbeatJob, listHeartbeatJobs, updateHeartbeatJob, type HeartbeatJobInfo } from "./_core/heartbeat";

// 12시간마다 실행 (UTC 기준: 00:00, 12:00)
const CACHE_AUTO_REFRESH_CRON = "0 0 0,12 * * *";
const CACHE_AUTO_REFRESH_JOB_NAME = "syncPublicQueryCaches";
const CALLBACK_PATH = "/api/scheduled/syncPublicQueryCaches";
const DESCRIPTION = "공개 조회 데이터(재무정보, 가격이력)를 DB에 캐싱하여 API 호출을 제거합니다. 12시간마다 실행됩니다.";

export type CacheAutoRefreshStatus = {
  exists: boolean;
  enabled: boolean;
  taskUid: string | null;
  cronExpression: string;
  callbackPath: string;
  nextExecutionAt?: string | null;
  lastExecutedAt?: string | null;
  description: string;
};

function toStatus(job?: HeartbeatJobInfo): CacheAutoRefreshStatus {
  return {
    exists: Boolean(job),
    enabled: Boolean(job?.isEnable),
    taskUid: job?.taskUid ?? null,
    cronExpression: job?.cronExpression ?? CACHE_AUTO_REFRESH_CRON,
    callbackPath: job?.callbackPath ?? CALLBACK_PATH,
    nextExecutionAt: job?.nextExecutionAt ?? null,
    lastExecutedAt: job?.lastExecutedAt ?? null,
    description: job?.description || DESCRIPTION,
  };
}

async function findCacheRefreshJob(userSession = "") {
  const listing = await listHeartbeatJobs(userSession, { page: 1, pageSize: 50 });
  return (listing.jobs ?? []).find(job => job.name === CACHE_AUTO_REFRESH_JOB_NAME);
}

export async function getCacheAutoRefreshStatus(userSession = "") {
  const job = await findCacheRefreshJob(userSession);
  return toStatus(job);
}

export async function ensureCacheAutoRefreshJob(userSession = "") {
  const existing = await findCacheRefreshJob(userSession);
  if (existing) {
    await updateHeartbeatJob(existing.taskUid, {
      cron: CACHE_AUTO_REFRESH_CRON,
      path: CALLBACK_PATH,
      method: "POST",
      description: DESCRIPTION,
      enable: true,
    }, userSession);
    const refreshed = await findCacheRefreshJob(userSession);
    return toStatus(refreshed ?? existing);
  }

  try {
    const created = await createHeartbeatJob({
      name: CACHE_AUTO_REFRESH_JOB_NAME,
      cron: CACHE_AUTO_REFRESH_CRON,
      path: CALLBACK_PATH,
      method: "POST",
      description: DESCRIPTION,
    }, userSession);
    return {
      ...toStatus({
        taskUid: created.taskUid,
        name: CACHE_AUTO_REFRESH_JOB_NAME,
        userId: "owner",
        description: DESCRIPTION,
        cronExpression: CACHE_AUTO_REFRESH_CRON,
        callbackPath: CALLBACK_PATH,
        callbackMethod: "POST",
        callbackPayload: "{}",
        isEnable: true,
        createdAt: null,
        lastExecutedAt: null,
        nextExecutionAt: created.nextExecutionAt,
      }),
      taskUid: created.taskUid,
    };
  } catch (error) {
    console.error("[Cache Auto Refresh] Failed to create job:", error);
    throw error;
  }
}

export async function pauseCacheAutoRefreshJob(userSession = "") {
  const existing = await findCacheRefreshJob(userSession);
  if (!existing) {
    throw new Error("Cache auto refresh job not found");
  }
  await updateHeartbeatJob(existing.taskUid, { enable: false }, userSession);
}
