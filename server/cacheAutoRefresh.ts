import { ENV } from "./_core/env";

const CACHE_AUTO_REFRESH_CRON = "0 */12 * * *";
const CALLBACK_PATH = "scripts/localCron.ts sync-caches";
const DESCRIPTION = "공개 조회 데이터 캐시는 운영 PC의 로컬 cron이 Supabase DB에 직접 동기화합니다.";

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
    enabled: ENV.localCronEnabled,
    taskUid: null,
    cronExpression: CACHE_AUTO_REFRESH_CRON,
    callbackPath: CALLBACK_PATH,
    nextExecutionAt: null,
    lastExecutedAt: null,
    description: `${DESCRIPTION} 앱 서버는 조회만 담당하고 예약 실행은 이 컴퓨터의 crontab이 담당합니다.`,
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
