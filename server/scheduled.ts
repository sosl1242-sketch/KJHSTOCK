import type { Request, Response } from "express";
import { ENV } from "./_core/env";
import { refreshStaleStoredStockPrices } from "./stockPrice";

function isAuthorizedCronRequest(req: Request) {
  if (!ENV.cronSecret) return false;
  const authorization = req.headers.authorization;
  const cronHeader = req.headers["x-cron-secret"];
  return authorization === `Bearer ${ENV.cronSecret}` || cronHeader === ENV.cronSecret;
}

function parseBoolean(value: unknown) {
  if (value === true || value === "true" || value === "1") return true;
  return false;
}

function parseNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function refreshStockPricesHandler(req: Request, res: Response) {
  try {
    if (!isAuthorizedCronRequest(req)) {
      return res.status(403).json({ error: "cron-only" });
    }

    const body = typeof req.body === "object" && req.body !== null
      ? req.body as { batchSize?: number; force?: boolean }
      : {};
    const summary = await refreshStaleStoredStockPrices({
      batchSize: parseNumber(body.batchSize ?? req.query.batchSize),
      force: parseBoolean(body.force ?? req.query.force),
    });

    return res.json({
      ok: true,
      ...summary,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "알 수 없는 예약 갱신 오류",
      stack: error instanceof Error ? error.stack : undefined,
      context: {
        url: req.originalUrl,
      },
      timestamp: new Date().toISOString(),
    });
  }
}


/**
 * 일 1회 공개 조회 데이터 캐시 동기화
 * Vercel Cron에서 호출되어 공개 조회 데이터를 DB에 저장
 */
export async function syncPublicQueryCachesHandler(req: Request, res: Response) {
  try {
    if (!isAuthorizedCronRequest(req)) {
      return res.status(403).json({ error: "cron-only" });
    }

    const { syncAllPublicQueryCaches } = await import("./cacheSync");
    const result = await syncAllPublicQueryCaches();

    return res.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "캐시 동기화 오류",
      stack: error instanceof Error ? error.stack : undefined,
      context: {
        url: req.originalUrl,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
