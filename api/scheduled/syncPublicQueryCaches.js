import { createApp } from "../../dist/serverless.js";

const app = createApp();

export default function handler(req, res) {
  if (req.url && !req.url.startsWith("/api/scheduled/syncPublicQueryCaches")) {
    req.url = "/api/scheduled/syncPublicQueryCaches";
  }
  return app(req, res);
}
