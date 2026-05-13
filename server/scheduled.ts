import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { refreshStaleStoredStockPrices } from "./stockPrice";
import { getDb } from "./db";
import { stocks } from "../drizzle/schema";

export async function refreshPublicDataHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const database = await getDb();
    if (!database) {
      return res.status(500).json({
        error: "데이터베이스 연결 실패",
        context: { url: req.originalUrl },
        timestamp: new Date().toISOString(),
      });
    }

    // 공개 데이터 갱신: 국내주식 캐시 초기화
    const summary = {
      stocksCleared: 0,
      timestamp: new Date().toISOString(),
    };

    try {
      // 국내주식 캐시 초기화
      await database.delete(stocks);
      summary.stocksCleared = 1;
    } catch (e) {
      console.error("Failed to clear stocks:", e);
    }

    return res.json({
      ok: true,
      taskUid: user.taskUid,
      ...summary,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "공개 데이터 갱신 오류",
      stack: error instanceof Error ? error.stack : undefined,
      context: {
        url: req.originalUrl,
      },
      timestamp: new Date().toISOString(),
    });
  }
}

export async function refreshStockPricesHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const payload = typeof req.body === "object" && req.body !== null ? req.body as { batchSize?: number; force?: boolean } : {};
    const summary = await refreshStaleStoredStockPrices({
      batchSize: typeof payload.batchSize === "number" ? payload.batchSize : undefined,
      force: payload.force === true,
    });

    return res.json({
      ok: true,
      taskUid: user.taskUid,
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
