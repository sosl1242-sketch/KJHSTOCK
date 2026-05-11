import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { refreshAllStoredStockPrices } from "./stockPrice";

export async function refreshStockPricesHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const results = await refreshAllStoredStockPrices();
    const successCount = results.filter(result => result.success).length;
    const failureCount = results.length - successCount;

    return res.json({
      ok: true,
      taskUid: user.taskUid,
      refreshedAt: new Date().toISOString(),
      total: results.length,
      successCount,
      failureCount,
      results,
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
