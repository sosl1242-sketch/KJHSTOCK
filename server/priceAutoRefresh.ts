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

const CALLBACK_PATH = "/api/scheduled/refreshStockPrices";
const DESCRIPTION = "국내 주식 현재가 캐시는 Vercel Hobby 제한에 맞춰 하루 1회 오래된 종목부터 배치 갱신합니다.";

function toStatus(): StockPriceAutoRefreshStatus {
  return {
    exists: true,
    enabled: Boolean(ENV.cronSecret),
    taskUid: null,
    cronExpression: PRICE_AUTO_REFRESH_CRON,
    intervalSeconds: PRICE_AUTO_REFRESH_INTERVAL_SECONDS,
    callbackPath: CALLBACK_PATH,
    nextExecutionAt: null,
    lastExecutedAt: null,
    description: `${DESCRIPTION} CRON_SECRET이 설정되어 있어야 실행 요청이 통과합니다.`,
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
