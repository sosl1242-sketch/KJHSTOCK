import { createApp } from "../../dist/serverless.js";

const app = createApp();

export default function handler(req, res) {
  if (req.url && !req.url.startsWith("/api/oauth/callback")) {
    const queryIndex = req.url.indexOf("?");
    const query = queryIndex >= 0 ? req.url.slice(queryIndex) : "";
    req.url = `/api/oauth/callback${query}`;
  }
  return app(req, res);
}
