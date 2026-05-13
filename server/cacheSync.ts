/**
 * 공개 조회 데이터 DB 캐싱 동기화
 * 로컬 cron에서 호출되어 외부 API 데이터를 DB에 저장
 */

import { fetchNaverFinancialDetail, fetchNaverFinancialSummaries } from "./financials";
import { fetchTechnicalIndicatorDetail } from "./technicalIndicators";
import { fetchCryptoFuturesTechnicalDetail, fetchLiveCryptoFuturesTable } from "./cryptoFutures";
import { listStocks } from "./db";
import {
  getAllCachedCryptoFutures,
  upsertStockFinancialCache,
  upsertPriceHistoryCache,
  upsertCryptoFuturesCacheRows,
} from "./db";

/**
 * 모든 국내주식의 재무 정보를 Naver Finance에서 조회하여 DB에 캐싱
 */
export async function syncStockFinancialCache() {
  try {
    const stocks = await listStocks();
    if (stocks.length === 0) {
      console.log("[Cache Sync] No stocks to sync");
      return { synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;

    // 배치로 처리 (Naver Finance 부하 분산)
    const batchSize = 5;
    for (let i = 0; i < stocks.length; i += batchSize) {
      const batch = stocks.slice(i, i + batchSize);
      const summaries = await fetchNaverFinancialSummaries(
        batch.map(s => ({
          code: s.code,
          name: s.name,
          marketSuffix: s.marketSuffix as "KS" | "KQ",
        }))
      );

      for (const summary of summaries) {
        try {
          if (summary.success) {
            await upsertStockFinancialCache({
              code: summary.code,
              marketSuffix: summary.marketSuffix,
              per: summary.per,
              pbr: summary.pbr,
              marketCapHundredMillionKrw: summary.marketCapHundredMillionKrw,
              latestOperatingProfitHundredMillionKrw:
                summary.latestOperatingProfitHundredMillionKrw,
            });
            synced++;
          } else {
            failed++;
          }
        } catch (error) {
          console.error(
            `[Cache Sync] Failed to sync financial cache for ${summary.code}:`,
            error
          );
          failed++;
        }
      }

      // 배치 간 딜레이 (Naver Finance 부하 분산)
      if (i + batchSize < stocks.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(
      `[Cache Sync] Financial cache synced: ${synced} succeeded, ${failed} failed`
    );
    return { synced, failed };
  } catch (error) {
    console.error("[Cache Sync] Failed to sync financial cache:", error);
    throw error;
  }
}

/**
 * 모든 국내주식의 기술적 지표 데이터를 Naver Finance에서 조회하여 DB에 캐싱
 */
export async function syncStockTechnicalCache() {
  try {
    const stocks = await listStocks();
    if (stocks.length === 0) {
      console.log("[Cache Sync] No stocks to sync technical indicators");
      return { synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;

    // 배치로 처리 (Naver Finance 부하 분산)
    const batchSize = 3;
    for (let i = 0; i < stocks.length; i += batchSize) {
      const batch = stocks.slice(i, i + batchSize);

      for (const stock of batch) {
        try {
          const detail = await fetchTechnicalIndicatorDetail({
            code: stock.code,
            name: stock.name,
            marketSuffix: stock.marketSuffix as "KS" | "KQ",
          });

          // 가격 이력을 DB에 저장 (일봉 기준)
          if (detail.priceHistory && detail.priceHistory.length > 0) {
            const historyData = detail.priceHistory.map(candle => ({
              ticker: stock.code,
              market: stock.marketSuffix,
              interval: "1d",
              timestamp: candle.date, // ISO string
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
              volume: candle.volume,
            }));

            await upsertPriceHistoryCache(historyData);
          }

          synced++;
        } catch (error) {
          console.error(
            `[Cache Sync] Failed to sync technical cache for ${stock.code}:`,
            error
          );
          failed++;
        }
      }

      // 배치 간 딜레이
      if (i + batchSize < stocks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(
      `[Cache Sync] Technical cache synced: ${synced} succeeded, ${failed} failed`
    );
    return { synced, failed };
  } catch (error) {
    console.error("[Cache Sync] Failed to sync technical cache:", error);
    throw error;
  }
}

/**
 * Binance USDT 무기한 선물 테이블 데이터를 Supabase에 캐싱
 */
export async function syncCryptoFuturesTableCache() {
  try {
    const rows = await fetchLiveCryptoFuturesTable();
    const cacheRows = rows.map(row => ({
      symbol: row.ticker,
      name: row.name,
      price: row.price,
      change24h: null,
      changePercent24h: row.change24hPercent,
      high24h: row.high24h,
      low24h: row.low24h,
      volume24hUsd: row.volume24hUsd,
      openInterestUsd: row.openInterestUsd,
      fundingRate: row.fundingRate,
    }));
    await upsertCryptoFuturesCacheRows(cacheRows);
    console.log(`[Cache Sync] Crypto futures table cache synced: ${cacheRows.length} rows`);
    return { synced: cacheRows.length, failed: 0 };
  } catch (error) {
    console.error("[Cache Sync] Failed to sync crypto futures table cache:", error);
    throw error;
  }
}

const CRYPTO_TECHNICAL_TARGETS = [
  { symbol: "BTCUSDT", name: "Bitcoin" },
  { symbol: "ETHUSDT", name: "Ethereum" },
  { symbol: "BNBUSDT", name: "Binance Coin" },
  { symbol: "SOLUSDT", name: "Solana" },
  { symbol: "ADAUSDT", name: "Cardano" },
  { symbol: "XRPUSDT", name: "Ripple" },
  { symbol: "DOGEUSDT", name: "Dogecoin" },
  { symbol: "AVAXUSDT", name: "Avalanche" },
  { symbol: "LINKUSDT", name: "Chainlink" },
  { symbol: "MATICUSDT", name: "Polygon" },
  { symbol: "LTCUSDT", name: "Litecoin" },
  { symbol: "BCHUSDT", name: "Bitcoin Cash" },
  { symbol: "XLMUSDT", name: "Stellar" },
  { symbol: "ZECUSDT", name: "Zcash" },
  { symbol: "DASHUSDT", name: "Dash" },
  { symbol: "CELOUSDT", name: "Celo" },
  { symbol: "ACHUSDT", name: "Alchemy Pay" },
  { symbol: "COTIUSDT", name: "COTI" },
  { symbol: "UNIUSDT", name: "Uniswap" },
  { symbol: "ATOMUSDT", name: "Cosmos" },
  { symbol: "ARBUSDT", name: "Arbitrum" },
  { symbol: "OPUSDT", name: "Optimism" },
  { symbol: "ONDOUSDT", name: "Ondo" },
  { symbol: "PENDLEUSDT", name: "Pendle" },
  { symbol: "ENAUSDT", name: "Ethena" },
  { symbol: "OMUSDT", name: "Mantra" },
  { symbol: "POLYXUSDT", name: "Polymesh" },
  { symbol: "RSRUSDT", name: "Reserve Rights" },
  { symbol: "MKRUSDT", name: "Maker" },
  { symbol: "MSTRUSDT", name: "Strategy" },
  { symbol: "AMZNUSDT", name: "Amazon" },
  { symbol: "CRCLUSDT", name: "Circle" },
  { symbol: "COINUSDT", name: "Coinbase" },
  { symbol: "PLTRUSDT", name: "Palantir" },
  { symbol: "TSLAUSDT", name: "Tesla" },
  { symbol: "METAUSDT", name: "Meta" },
  { symbol: "NVDAUSDT", name: "NVIDIA" },
  { symbol: "GOOGLUSDT", name: "Alphabet" },
  { symbol: "QQQUSDT", name: "Invesco QQQ" },
  { symbol: "SPYUSDT", name: "SPDR S&P 500 ETF" },
  { symbol: "EWYUSDT", name: "iShares MSCI South Korea ETF" },
  { symbol: "EWJUSDT", name: "iShares MSCI Japan ETF" },
  { symbol: "XAUUSDT", name: "Gold" },
  { symbol: "XAGUSDT", name: "Silver" },
  { symbol: "CLUSDT", name: "WTI Crude Oil" },
  { symbol: "BZUSDT", name: "Brent Crude Oil" },
  { symbol: "NATGASUSDT", name: "Natural Gas" },
  { symbol: "POWRUSDT", name: "Powerledger" },
  { symbol: "GASUSDT", name: "Gas" },
];

async function getCryptoTechnicalTargets() {
  const cachedRows = await getAllCachedCryptoFutures();
  if (cachedRows.length === 0) return CRYPTO_TECHNICAL_TARGETS;
  const available = new Map(cachedRows.map(row => [row.symbol.toUpperCase(), row.name ?? row.symbol.toUpperCase()]));
  return CRYPTO_TECHNICAL_TARGETS
    .filter(target => available.has(target.symbol))
    .map(target => ({ ...target, name: available.get(target.symbol) ?? target.name }));
}

/**
 * 상위 크립토 심볼의 기술적 보조지표를 Binance에서 조회하여 DB에 캐싱
 */
export async function syncCryptoTechnicalCache() {
  try {
    // 주요 코인 + TradeFi/Energy 후보만 캐싱 (차트 이력 API 호출 최소화)
    const topSymbols = await getCryptoTechnicalTargets();

    let synced = 0;
    let failed = 0;

    for (const { symbol, name } of topSymbols) {
      try {
        const detail = await fetchCryptoFuturesTechnicalDetail({ symbol, name });
        // priceHistoryCache에 저장
        const cacheData = detail.priceHistory.map(candle => ({
          ticker: symbol,
          market: "CRYPTO" as const,
          interval: "1d" as const,
          timestamp: candle.date,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        }));
        if (cacheData.length > 0) {
          await upsertPriceHistoryCache(cacheData);
        }
        synced++;
      } catch (error) {
        console.error(`[Cache Sync] Failed to sync crypto ${symbol}:`, error);
        failed++;
      }
    }

    console.log(
      `[Cache Sync] Crypto technical cache synced: ${synced} succeeded, ${failed} failed`
    );
    return { synced, failed };
  } catch (error) {
    console.error("[Cache Sync] Failed to sync crypto technical cache:", error);
    throw error;
  }
}

/**
 * 모든 캐시 동기화 (로컬 cron에서 호출)
 */
export async function syncAllPublicQueryCaches() {
  console.log("[Cache Sync] Starting full cache sync...");
  const startTime = Date.now();

  try {
    const [financialResult, technicalResult, cryptoTableResult, cryptoResult] = await Promise.allSettled([
      syncStockFinancialCache(),
      syncStockTechnicalCache(),
      syncCryptoFuturesTableCache(),
      syncCryptoTechnicalCache(),
    ]);

    const duration = Date.now() - startTime;
    console.log(
      `[Cache Sync] Full cache sync completed in ${duration}ms`,
      {
        financial:
          financialResult.status === "fulfilled"
            ? financialResult.value
            : financialResult.reason,
        technical:
          technicalResult.status === "fulfilled"
            ? technicalResult.value
            : technicalResult.reason,
        crypto:
          cryptoTableResult.status === "fulfilled"
            ? cryptoTableResult.value
            : cryptoTableResult.reason,
        cryptoTechnical:
          cryptoResult.status === "fulfilled"
            ? cryptoResult.value
            : cryptoResult.reason,
      }
    );

    return {
      success: true,
      duration,
      financial:
        financialResult.status === "fulfilled" ? financialResult.value : null,
      technical:
        technicalResult.status === "fulfilled" ? technicalResult.value : null,
      crypto:
        cryptoTableResult.status === "fulfilled" ? cryptoTableResult.value : null,
      cryptoTechnical:
        cryptoResult.status === "fulfilled" ? cryptoResult.value : null,
    };
  } catch (error) {
    console.error("[Cache Sync] Full cache sync failed:", error);
    throw error;
  }
}
