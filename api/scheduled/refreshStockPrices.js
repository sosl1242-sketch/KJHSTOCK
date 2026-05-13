import { createApp } from "../../dist/serverless.js";

const app = createApp();

export default function handler(req, res) {
  if (req.url && !req.url.startsWith("/api/scheduled/refreshStockPrices")) {
    req.url = "/api/scheduled/refreshStockPrices";
  }
  return app(req, res);
}
