import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  FuturesCandle,
  FuturesMarketRow,
} from "../shared/binanceFuturesAnalysis";
import {
  fetchAllFuturesRows,
  fetchFuturesCandles,
} from "../client/src/lib/binanceFuturesClient";
import { fetchFuturesResearchReport } from "../client/src/lib/futuresResearchClient";

vi.mock("../client/src/lib/binanceFuturesClient", () => ({
  fetchAllFuturesRows: vi.fn(),
  fetchFuturesCandles: vi.fn(),
}));

const GENERATED_AT = "2026-09-06T12:00:00.000Z";
const NOW = Date.parse(GENERATED_AT);
const HOUR = 3_600_000;
const marketFetch = vi.mocked(fetchAllFuturesRows);
const candleFetch = vi.mocked(fetchFuturesCandles);

function row(
  symbol: string,
  overrides: Partial<FuturesMarketRow> = {}
): FuturesMarketRow {
  return {
    rank: 1,
    marketType: "USD-M",
    assetClass: "crypto",
    symbol,
    pair: symbol,
    baseAsset: symbol.replace(/USDT$/, ""),
    quoteAsset: "USDT",
    contractType: "PERPETUAL",
    price: 180,
    high24h: 200,
    low24h: 150,
    change24hPercent: 2,
    baseVolume24h: 1_000,
    volume24hUsd: 10_000_000,
    fundingRate: 0.0001,
    markPrice: 180,
    nextFundingTime: null,
    openInterestUsd: null,
    openInterestToVolumePercent: null,
    lastUpdated: GENERATED_AT,
    signal: "bullish",
    ...overrides,
  };
}

function candles(timeframe: string): FuturesCandle[] {
  const duration = timeframe === "4h" ? 4 * HOUR : HOUR;
  return Array.from({ length: 80 }, (_, index) => {
    const close = 100 + index;
    return {
      openTime: NOW - (80 - index) * duration,
      open: close,
      high: close + 1,
      low: close - 1,
      close,
      volume: index === 79 ? 200 : 100,
    };
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const settleRequests = () =>
  new Promise<void>(resolve => setImmediate(resolve));

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  marketFetch.mockResolvedValue([row("BTCUSDT")]);
  candleFetch.mockImplementation(async (_symbol, _marketType, timeframe) =>
    candles(timeframe)
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("fetchFuturesResearchReport", () => {
  it("fetches both frames for six candidates with at most four requests in flight", async () => {
    marketFetch.mockResolvedValue(
      Array.from({ length: 8 }, (_, index) =>
        row(`TOKEN${index}USDT`, {
          volume24hUsd: 100_000_000 - index * 1_000_000,
        })
      )
    );
    const pending: Array<{
      resolve: (value: FuturesCandle[]) => void;
      timeframe: string;
    }> = [];
    let active = 0;
    let peak = 0;
    candleFetch.mockImplementation((_symbol, _marketType, timeframe) => {
      const request = deferred<FuturesCandle[]>();
      active++;
      peak = Math.max(peak, active);
      pending.push({ resolve: request.resolve, timeframe });
      return request.promise.finally(() => {
        active--;
      });
    });
    const progress = vi.fn();
    const task = fetchFuturesResearchReport(
      new AbortController().signal,
      progress
    );
    await settleRequests();

    expect(candleFetch).toHaveBeenCalledTimes(4);
    expect(active).toBe(4);
    expect(progress).toHaveBeenCalledWith(0, 12);

    // Complete requests in reverse order so the result cannot depend on response order.
    while (pending.length) {
      for (const request of pending.splice(0).reverse())
        request.resolve(candles(request.timeframe));
      await settleRequests();
    }
    const report = await task;

    expect(peak).toBeLessThanOrEqual(4);
    expect(active).toBe(0);
    expect(candleFetch).toHaveBeenCalledTimes(12);
    expect(report.candidates).toHaveLength(6);
    expect(
      report.candidates.every(
        candidate => candidate.coverage.status === "complete"
      )
    ).toBe(true);
    expect(report.overview.stats).toMatchObject({
      freshFrameCount: 12,
      expectedFrameCount: 12,
    });
    const requested = candleFetch.mock.calls.map(
      ([symbol, market, timeframe]) => `${market}:${symbol}:${timeframe}`
    );
    expect(new Set(requested).size).toBe(12);
    expect(new Set(requested)).toEqual(
      new Set(
        report.candidates.flatMap(candidate => [
          `${candidate.key}:1h`,
          `${candidate.key}:4h`,
        ])
      )
    );
    expect(progress.mock.calls).toEqual(
      Array.from({ length: 13 }, (_, completed) => [completed, 12])
    );
  });

  it("retains a candidate with one failed frame and marks its evidence partial", async () => {
    marketFetch.mockResolvedValue([row("BTCUSDT"), row("ETHUSDT")]);
    candleFetch.mockImplementation(async (symbol, _marketType, timeframe) => {
      if (symbol === "BTCUSDT" && timeframe === "4h")
        throw new Error("Candle endpoint unavailable");
      return candles(timeframe);
    });
    const progress = vi.fn();

    const report = await fetchFuturesResearchReport(
      new AbortController().signal,
      progress
    );
    const bitcoin = report.candidates.find(
      candidate => candidate.row.symbol === "BTCUSDT"
    );
    const ether = report.candidates.find(
      candidate => candidate.row.symbol === "ETHUSDT"
    );

    expect(report.candidates).toHaveLength(2);
    expect(bitcoin).toMatchObject({
      direction: "unknown",
      coverage: { status: "partial", freshFrames: 1, expectedFrames: 2 },
    });
    expect(
      bitcoin?.frames.find(frame => frame.timeframe === "4h")
    ).toMatchObject({ status: "missing", metrics: null, barCount: 0 });
    expect(ether?.coverage.status).toBe("complete");
    expect(report.overview.stats).toMatchObject({
      freshFrameCount: 3,
      expectedFrameCount: 4,
    });
    expect(progress).toHaveBeenLastCalledWith(4, 4);
  });

  it("retains entirely missing candle evidence without replacing it with an old bullish signal", async () => {
    candleFetch.mockRejectedValue(new Error("Rate limited"));
    const progress = vi.fn();

    const report = await fetchFuturesResearchReport(
      new AbortController().signal,
      progress
    );

    expect(report.candidates).toHaveLength(1);
    expect(report.candidates[0]).toMatchObject({
      row: { symbol: "BTCUSDT", signal: "bullish" },
      direction: "unknown",
      coverage: { status: "missing", freshFrames: 0, expectedFrames: 2 },
    });
    expect(
      report.candidates[0].frames.every(frame => frame.status === "missing")
    ).toBe(true);
    expect(report.overview.stats).toMatchObject({
      freshFrameCount: 0,
      expectedFrameCount: 2,
    });
    expect(progress).toHaveBeenLastCalledWith(2, 2);
  });

  it("rejects cancellation mid-flight without scheduling remaining work or reporting completion", async () => {
    marketFetch.mockResolvedValue(
      Array.from({ length: 6 }, (_, index) => row(`TOKEN${index}USDT`))
    );
    const pending: Array<{
      resolve: (value: FuturesCandle[]) => void;
      timeframe: string;
    }> = [];
    const requestSignals: AbortSignal[] = [];
    candleFetch.mockImplementation(
      (_symbol, _marketType, timeframe, signal) => {
        const request = deferred<FuturesCandle[]>();
        const abort = () => request.reject(signal?.reason);
        signal!.addEventListener("abort", abort, { once: true });
        requestSignals.push(signal!);
        pending.push({ resolve: request.resolve, timeframe });
        return request.promise.finally(() =>
          signal!.removeEventListener("abort", abort)
        );
      }
    );
    const controller = new AbortController();
    const progress = vi.fn();
    const task = fetchFuturesResearchReport(controller.signal, progress);
    const rejection = expect(task).rejects.toMatchObject({
      name: "AbortError",
    });
    await settleRequests();
    const first = pending.shift()!;
    first.resolve(candles(first.timeframe));
    await settleRequests();
    const startedBeforeAbort = candleFetch.mock.calls.length;

    controller.abort();
    await rejection;
    await settleRequests();

    expect(startedBeforeAbort).toBe(5);
    expect(candleFetch).toHaveBeenCalledTimes(startedBeforeAbort);
    expect(requestSignals.every(signal => signal.aborted)).toBe(true);
    expect(progress.mock.calls).toEqual([
      [0, 12],
      [1, 12],
    ]);
  });

  it("rejects an aborted snapshot even when the transport resolves after cancellation", async () => {
    const snapshot = deferred<FuturesMarketRow[]>();
    marketFetch.mockReturnValue(snapshot.promise);
    const controller = new AbortController();
    const progress = vi.fn();
    const task = fetchFuturesResearchReport(controller.signal, progress);
    const rejection = expect(task).rejects.toMatchObject({
      name: "AbortError",
    });

    controller.abort();
    snapshot.resolve([row("BTCUSDT")]);
    await rejection;

    expect(marketFetch.mock.calls[0][0]?.aborted).toBe(true);
    expect(candleFetch).not.toHaveBeenCalled();
    expect(progress).not.toHaveBeenCalled();
  });

  it("rejects a failed authoritative market snapshot instead of returning an empty completed report", async () => {
    const failure = new Error("USD-M market snapshot failed");
    marketFetch.mockRejectedValue(failure);
    const progress = vi.fn();

    await expect(
      fetchFuturesResearchReport(new AbortController().signal, progress)
    ).rejects.toBe(failure);

    expect(candleFetch).not.toHaveBeenCalled();
    expect(progress).not.toHaveBeenCalled();
  });

  it("requests a fresh REST snapshot on every refresh without carrying prior candidates forward", async () => {
    marketFetch
      .mockResolvedValueOnce([row("BTCUSDT")])
      .mockResolvedValueOnce([row("ETHUSDT")]);

    const first = await fetchFuturesResearchReport(
      new AbortController().signal
    );
    const second = await fetchFuturesResearchReport(
      new AbortController().signal
    );

    expect(marketFetch).toHaveBeenCalledTimes(2);
    expect(first.candidates.map(candidate => candidate.row.symbol)).toEqual([
      "BTCUSDT",
    ]);
    expect(second.candidates.map(candidate => candidate.row.symbol)).toEqual([
      "ETHUSDT",
    ]);
    expect(second.generatedAt).toBe(GENERATED_AT);
    expect(candleFetch).toHaveBeenCalledTimes(4);
  });
});
