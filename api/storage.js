import { createApp } from "../dist/serverless.js";

const app = createApp();

export default function handler(req, res) {
  if (req.url) {
    const url = new URL(req.url, "https://kjhstock.local");
    const key = url.searchParams.get("key");

    if (key) {
      url.searchParams.delete("key");
      req.url = `/api/storage/${key}${url.search}`;
    } else if (!req.url.startsWith("/api/storage") && !req.url.startsWith("/manus-storage")) {
      req.url = `/api/storage${req.url.startsWith("/") ? "" : "/"}${req.url}`;
    }
  }

  return app(req, res);
}
