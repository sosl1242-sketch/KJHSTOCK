import { ENV } from "./_core/env";

const CACHE_AUTO_REFRESH_CRON = "0 */12 * * *";
const CALLBACK_PATH = "/api/scheduled/syncPublicQueryCaches";
const DESCRIPTION = "공개 조회 데이터 캐시는 Vercel Cron이 12시간마다 DB에 동기화합니다.";

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

function toStatus(): CacheAutoRefreshStatus {
  return {
    exists: true,
    enabled: Boolean(ENV.cronSecret),
    taskUid: null,
    cronExpression: CACHE_AUTO_REFRESH_CRON,
    callbackPath: CALLBACK_PATH,
    nextExecutionAt: null,
    lastExecutedAt: null,
    description: `${DESCRIPTION} CRON_SECRET이 설정되어 있어야 실행 요청이 통과합니다.`,
  };
}

export async function getCacheAutoRefreshStatus() {
  return toStatus();
}

export async function ensureCacheAutoRefreshJob() {
  return toStatus();
}

export async function pauseCacheAutoRefreshJob() {
  return toStatus();
}
