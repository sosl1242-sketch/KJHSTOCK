import { ENV } from "./_core/env";
import { PRICE_AUTO_REFRESH_CRON, PRICE_AUTO_REFRESH_INTERVAL_SECONDS } from "./stockPrice";

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

const DESCRIPTION = "국내 주식 현재가 캐시는 운영 PC의 로컬 cron이 Supabase DB를 직접 배치 갱신합니다.";

function toStatus(): StockPriceAutoRefreshStatus {
  return {
    exists: true,
    enabled: ENV.localCronEnabled,
    taskUid: null,
    cronExpression: PRICE_AUTO_REFRESH_CRON,
    intervalSeconds: PRICE_AUTO_REFRESH_INTERVAL_SECONDS,
    callbackPath: "scripts/localCron.ts refresh-prices",
    nextExecutionAt: null,
    lastExecutedAt: null,
    description: `${DESCRIPTION} 앱 서버는 조회만 담당하고 예약 실행은 이 컴퓨터의 crontab이 담당합니다.`,
  };
}

export async function getStockPriceAutoRefreshStatus() {
  return toStatus();
}

export async function ensureStockPriceAutoRefreshJob() {
  return toStatus();
}

export async function pauseStockPriceAutoRefreshJob() {
  return toStatus();
}
