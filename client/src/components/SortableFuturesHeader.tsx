import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import type {
  FuturesTableSortKey,
  FuturesSortDirection,
} from "@/lib/futuresTableSort";

type Props = {
  label: string;
  sortKey: FuturesTableSortKey;
  activeKey: FuturesTableSortKey;
  direction: FuturesSortDirection;
  onSort: (key: FuturesTableSortKey) => void;
  numeric?: boolean;
  sticky?: boolean;
};

export function SortableFuturesHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  numeric,
  sticky,
}: Props) {
  const active = activeKey === sortKey;
  const Icon = active
    ? direction === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;
  return (
    <TableHead
      scope="col"
      aria-sort={
        active ? (direction === "asc" ? "ascending" : "descending") : "none"
      }
      className={`sheet-heading${numeric ? " is-numeric" : ""}${sticky ? " sheet-name" : ""}${active ? " is-sorted" : ""}`}
    >
      <button
        type="button"
        className="sheet-sort"
        onClick={() => onSort(sortKey)}
        title={`${label} 정렬, 다시 누르면 방향 전환`}
      >
        <span>{label}</span>
        <Icon aria-hidden="true" />
      </button>
    </TableHead>
  );
}
