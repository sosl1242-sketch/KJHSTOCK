import type {
  FuturesBias,
  FuturesMarketRow,
} from "@shared/binanceFuturesAnalysis";

export type FuturesTableSortKey =
  | "rank"
  | "marketType"
  | "symbol"
  | "price"
  | "change24hPercent"
  | "baseVolume24h"
  | "volume24hUsd"
  | "fundingRate"
  | "contractType"
  | "signal";

export type FuturesSortDirection = "asc" | "desc";

const collator = new Intl.Collator("ko-KR", {
  numeric: true,
  sensitivity: "base",
});

const signalRank: Record<FuturesBias, number> = {
  bullish: 3,
  neutral: 2,
  bearish: 1,
};

type SortValue = string | number | null | undefined;

function isMissing(value: SortValue) {
  return (
    value == null ||
    (typeof value === "number" && !Number.isFinite(value)) ||
    (typeof value === "string" && value.trim() === "")
  );
}

function compareValues(
  left: SortValue,
  right: SortValue,
  direction: FuturesSortDirection
) {
  const leftMissing = isMissing(left);
  const rightMissing = isMissing(right);

  // Missing data has no numeric meaning and stays below known values in both directions.
  if (leftMissing || rightMissing)
    return Number(leftMissing) - Number(rightMissing);

  const comparison =
    typeof left === "string" && typeof right === "string"
      ? collator.compare(left, right)
      : Number(left) - Number(right);

  return direction === "asc" ? comparison : -comparison;
}

function compareIdentity(left: FuturesMarketRow, right: FuturesMarketRow) {
  for (const key of ["symbol", "marketType", "contractType"] as const) {
    const comparison = compareValues(left[key], right[key], "asc");
    if (comparison) return comparison;

    // Resolve collator-equivalent spellings independently of incoming ticker order.
    if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
  }

  return compareValues(left.rank, right.rank, "asc");
}

/** Return a sorted copy, keeping live-feed ties deterministic and missing values last. */
export function sortFuturesRows<T extends FuturesMarketRow>(
  rows: readonly T[],
  key: FuturesTableSortKey,
  direction: FuturesSortDirection
): T[] {
  return [...rows].sort((left, right) => {
    const leftValue = key === "signal" ? signalRank[left.signal] : left[key];
    const rightValue = key === "signal" ? signalRank[right.signal] : right[key];

    return (
      compareValues(leftValue, rightValue, direction) ||
      compareIdentity(left, right)
    );
  });
}
