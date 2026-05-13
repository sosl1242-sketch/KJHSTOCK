import { callDataApi } from "./_core/dataApi";
import { ENV } from "./_core/env";

type YahooChartQuery = {
  symbol: string;
  region?: string;
  interval: string;
  range: string;
  includeAdjustedClose?: boolean | string;
};

export async function fetchYahooStockChart(query: YahooChartQuery): Promise<unknown> {
  if (ENV.forgeApiUrl && ENV.forgeApiKey) {
    return callDataApi("YahooFinance/get_stock_chart", { query });
  }

  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(query.symbol)}`);
  url.searchParams.set("interval", query.interval);
  url.searchParams.set("range", query.range);
  if (query.region) url.searchParams.set("region", query.region);
  if (query.includeAdjustedClose !== undefined) {
    url.searchParams.set("includeAdjustedClose", String(query.includeAdjustedClose));
  }

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "kjhstock-local-cron/1.0",
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Yahoo Finance request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`);
  }
  return response.json();
}
