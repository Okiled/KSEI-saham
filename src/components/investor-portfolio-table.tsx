import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Briefcase, ChevronDown, ChevronUp } from "lucide-react";
import { formatIDR } from "../lib/format";
import { getPositionValueIDR } from "../lib/market-data";
import type { InvestorPortfolioPosition } from "../types/ownership";
import { NumberTicker } from "./number-ticker";

type InvestorPortfolioTableProps = {
  positions: InvestorPortfolioPosition[];
  onSelectPosition: (position: InvestorPortfolioPosition) => void;
  prices?: Record<string, number>;
};

type SortColumn = "shareCode" | "issuerName" | "percentage" | "shares" | "localForeign" | "idr";

function localForeignBadge(localForeign: "L" | "A" | null): string {
  if (localForeign === "L") return "border-[#E7D2B3] bg-[#F8EEDC] text-[#996737]";
  if (localForeign === "A") return "border-[#C0D6CF] bg-[#EDF4F1] text-[#1D4C45]";
  return "border-[#D8CDBF] bg-[#F7F0E6] text-[#665A4F]";
}

function localForeignLabel(localForeign: "L" | "A" | null): string {
  if (localForeign === "L") return "Lokal";
  if (localForeign === "A") return "Asing";
  return "Unknown";
}

export function InvestorPortfolioTable({ positions, onSelectPosition, prices = {} }: InvestorPortfolioTableProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [sortCol, setSortCol] = useState<SortColumn>("percentage");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
      return;
    }
    setSortCol(col);
    setSortDir("desc");
  };

  const sortedPositions = useMemo(() => {
    return [...positions].sort((a, b) => {
      if (sortCol === "idr") {
        const v1 = getPositionValueIDR(a.shares, prices[a.shareCode]) ?? 0;
        const v2 = getPositionValueIDR(b.shares, prices[b.shareCode]) ?? 0;
        return sortDir === "asc" ? v1 - v2 : v2 - v1;
      }

      const aVal = a[sortCol as keyof InvestorPortfolioPosition];
      const bVal = b[sortCol as keyof InvestorPortfolioPosition];
      if (typeof aVal === "string" && typeof bVal === "string") {
        const cmp = aVal.localeCompare(bVal);
        return sortDir === "asc" ? cmp : -cmp;
      }

      const v1 = Number(aVal) || 0;
      const v2 = Number(bVal) || 0;
      return sortDir === "asc" ? v1 - v2 : v2 - v1;
    });
  }, [positions, prices, sortCol, sortDir]);

  const maxPct = useMemo(() => Math.max(1, ...sortedPositions.map((position) => position.percentage)), [sortedPositions]);

  const rowVirtualizer = useVirtualizer({
    count: sortedPositions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 12,
  });

  if (sortedPositions.length === 0) {
    return (
      <div className="flex h-[420px] flex-col items-center justify-center gap-3 rounded-[26px] border border-[#D8CDBF] bg-[#FFFBF5] text-center">
        <Briefcase className="h-10 w-10 text-[#A99F95]" />
        <div className="text-sm font-medium text-[#1C1713]">Investor belum memiliki posisi pada snapshot ini</div>
        <p className="max-w-sm text-xs text-[#665A4F]">Posisi akan muncul saat data ownership tersedia untuk investor ini.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[26px] border border-[#D8CDBF] bg-[#FFFBF5] shadow-[0_18px_40px_rgba(95,73,47,0.08)]">
      <div className="grid grid-cols-[88px_1.7fr_110px_120px_100px_110px] border-b border-[#E6DCCE] bg-[#F6EEE2] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[#7A6E63]">
        <button type="button" onClick={() => toggleSort("shareCode")} className="flex items-center gap-1 outline-none transition-colors hover:text-[#1C1713]">
          Ticker
          {sortCol === "shareCode" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
        </button>
        <button type="button" onClick={() => toggleSort("issuerName")} className="flex items-center gap-1 outline-none transition-colors hover:text-[#1C1713]">
          Emiten
          {sortCol === "issuerName" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
        </button>
        <button type="button" onClick={() => toggleSort("percentage")} className="ml-auto flex items-center justify-end gap-1 outline-none transition-colors hover:text-[#1C1713]">
          % Hold
          {sortCol === "percentage" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
        </button>
        <button type="button" onClick={() => toggleSort("shares")} className="ml-auto flex items-center justify-end gap-1 outline-none transition-colors hover:text-[#1C1713]">
          Shares
          {sortCol === "shares" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
        </button>
        <button type="button" onClick={() => toggleSort("localForeign")} className="mx-auto flex items-center justify-center gap-1 outline-none transition-colors hover:text-[#1C1713]">
          Status
          {sortCol === "localForeign" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
        </button>
        <button type="button" onClick={() => toggleSort("idr")} className="ml-auto flex items-center justify-end gap-1 outline-none transition-colors hover:text-[#1C1713]">
          Nilai (IDR)
          {sortCol === "idr" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
        </button>
      </div>

      <div ref={parentRef} className="overflow-auto" style={{ maxHeight: 600 }}>
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = sortedPositions[virtualRow.index];
            const barWidth = Math.max(2, (row.percentage / maxPct) * 100);
            const idrValue = getPositionValueIDR(row.shares, prices[row.shareCode]);

            return (
              <button
                key={`${row.investorId}:${row.issuerId}`}
                type="button"
                onClick={() => onSelectPosition(row)}
                className="absolute left-0 right-0 grid grid-cols-[88px_1.7fr_110px_120px_100px_110px] items-center border-b border-[#EEE3D6] px-4 py-2.5 text-left transition-colors hover:bg-[#F6EEE2]"
                style={{ transform: `translateY(${virtualRow.start}px)`, height: `${virtualRow.size}px` }}
              >
                <span className="font-mono text-[15px] font-semibold text-[#1D4C45]">{row.shareCode}</span>
                <span className="truncate pr-2 text-sm text-[#1C1713]">{row.issuerName}</span>
                <span className="flex items-center justify-end gap-2 pr-2">
                  <span className="h-1.5 w-[42px] rounded-full bg-[#D8CDBF]">
                    <span className="block h-full rounded-full bg-[#1D4C45]" style={{ width: `${barWidth}%` }} />
                  </span>
                  <span className="font-mono text-sm font-semibold text-[#1C1713]">
                    <NumberTicker value={row.percentage} decimalPlaces={2} />%
                  </span>
                </span>
                <span className="pr-2 text-right font-mono text-[13px] text-[#665A4F]">
                  <NumberTicker value={row.shares} />
                </span>
                <span className="flex items-center justify-center">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${localForeignBadge(row.localForeign)}`}>
                    {localForeignLabel(row.localForeign)}
                  </span>
                </span>
                <span className="text-right font-mono text-[13px] font-semibold text-[#996737]">
                  {idrValue !== null ? formatIDR(idrValue) : "-"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
