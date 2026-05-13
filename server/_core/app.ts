import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  return app;
}

export async function initializeStartupCaches() {
  try {
    const { syncCryptoTechnicalCache } = await import("../cacheSync");
    await syncCryptoTechnicalCache();
    console.log("[Startup] Crypto technical cache initialized");
  } catch (error) {
    console.error("[Startup] Failed to initialize crypto cache:", error instanceof Error ? error.message : error);
  }
}
