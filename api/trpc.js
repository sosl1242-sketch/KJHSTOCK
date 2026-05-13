import { createApp } from "../dist/serverless.js";

const app = createApp();

export default function handler(req, res) {
  if (req.url) {
    const url = new URL(req.url, "https://kjhstock.local");
    const procedure = url.searchParams.get("procedure");

    if (procedure) {
      url.searchParams.delete("procedure");
      req.url = `/api/trpc/${procedure}${url.search}`;
    } else if (!req.url.startsWith("/api/trpc")) {
      req.url = `/api/trpc${req.url.startsWith("/") ? "" : "/"}${req.url}`;
    }
  }

  return app(req, res);
}
