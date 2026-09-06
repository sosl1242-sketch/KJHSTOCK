import { fetchAllFuturesRows, fetchFuturesCandles } from "./binanceFuturesClient";
import {
  buildFuturesResearchReport,
  selectResearchCandidates,
  type ResearchCandlesByKey,
  type ResearchKey,
  type ResearchTimeframe,
} from "@shared/futuresResearchReport";

/** Fetch a coherent snapshot; a failed candle request remains explicitly missing. */
export async function fetchFuturesResearchReport(
  signal: AbortSignal,
  onProgress: (completed: number, total: number) => void = () => {},
) {
  const rows = await fetchAllFuturesRows(AbortSignal.any([signal, AbortSignal.timeout(15_000)]));
  signal.throwIfAborted();
  const generatedAt = new Date().toISOString();
  const candidates = selectResearchCandidates(rows);
  const candlesByKey: ResearchCandlesByKey = {};
  const jobs = candidates.flatMap(row => (["1h", "4h"] as ResearchTimeframe[]).map(timeframe => ({ row, timeframe })));
  let cursor = 0;
  let completed = 0;
  onProgress(0, jobs.length);

  const worker = async () => {
    while (cursor < jobs.length) {
      signal.throwIfAborted();
      const { row, timeframe } = jobs[cursor++];
      const key: ResearchKey = `${row.marketType}:${row.symbol}`;
      try {
        const candles = await fetchFuturesCandles(row.symbol, row.marketType, timeframe,
          AbortSignal.any([signal, AbortSignal.timeout(15_000)]));
        signal.throwIfAborted();
        candlesByKey[key] = { ...candlesByKey[key], [timeframe]: candles };
      } catch {
        signal.throwIfAborted();
        // Timeout or individual API failure: the engine reports missing evidence.
      }
      onProgress(++completed, jobs.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, worker));
  signal.throwIfAborted();
  return buildFuturesResearchReport({ rows, candlesByKey, generatedAt });
}
