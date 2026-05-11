import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { refreshStaleStoredStockPrices } from "./stockPrice";

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
