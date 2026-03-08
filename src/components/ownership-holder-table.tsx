import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronUp, Users } from "lucide-react";
import { formatIDR } from "../lib/format";
import { getPositionValueIDR } from "../lib/market-data";
import { formatInvestorType } from "../lib/utils";
import type { IssuerHolderPosition } from "../types/ownership";
import { NumberTicker } from "./number-ticker";

type OwnershipHolderTableProps = {
  holders: IssuerHolderPosition[];
  onSelectInvestor: (investorId: string) => void;
  prices?: Record<string, number>;
};

type SortColumn = "investorName" | "investorType" | "percentage" | "shares" | "idr";

function statusTone(localForeign: "L" | "A" | null): string {
  if (localForeign === "L") return "text-[#996737]";
  if (localForeign === "A") return "text-[#1D4C45]";
  return "text-[#A99F95]";
}

function statusLabel(localForeign: "L" | "A" | null): string {
  if (localForeign === "L") return "Lokal";
  if (localForeign === "A") return "Asing";
  return "-";
}

export function OwnershipHolderTable({
  holders,
  onSelectInvestor,
  prices = {},
}: OwnershipHolderTableProps) {
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

  const sorted = useMemo(() => {
    return [...holders].sort((a, b) => {
      if (sortCol === "idr") {
        const v1 = getPositionValueIDR(a.shares, prices[a.shareCode]) ?? 0;
        const v2 = getPositionValueIDR(b.shares, prices[b.shareCode]) ?? 0;
        return sortDir === "asc" ? v1 - v2 : v2 - v1;
      }

      const aVal = a[sortCol as keyof IssuerHolderPosition];
      const bVal = b[sortCol as keyof IssuerHolderPosition];
      if (typeof aVal === "string" || typeof bVal === "string") {
        const cmp = (aVal?.toString() || "").localeCompare(bVal?.toString() || "");
        return sortDir === "asc" ? cmp : -cmp;
      }

      const v1 = Number(aVal) || 0;
      const v2 = Number(bVal) || 0;
      return sortDir === "asc" ? v1 - v2 : v2 - v1;
    });
  }, [holders, prices, sortCol, sortDir]);

  const maxPct = useMemo(() => Math.max(1, ...sorted.map((holder) => holder.percentage)), [sorted]);

  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 12,
  });

  if (sorted.length === 0) {
    return (
      <div className="flex h-[420px] flex-col items-center justify-center gap-3 rounded-[26px] border border-[#D8CDBF] bg-[#FFFBF5] text-center">
        <Users className="h-10 w-10 text-[#A99F95]" />
        <div className="text-sm font-medium text-[#1C1713]">Belum ada data holder untuk emiten ini</div>
        <p className="max-w-sm text-xs text-[#665A4F]">Holder table akan terisi saat data ownership tersedia.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[26px] border border-[#D8CDBF] bg-[#FFFBF5] shadow-[0_18px_40px_rgba(95,73,47,0.08)]">
      <div className="grid grid-cols-[minmax(110px,1.8fr)_100px_130px_120px_130px] gap-3 border-b border-[#E6DCCE] bg-[#F6EEE2] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[#7A6E63]">
        <button type="button" onClick={() => toggleSort("investorName")} className="flex items-center gap-1 outline-none transition-colors hover:text-[#1C1713]">
          Holder
          {sortCol === "investorName" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
        </button>
        <button type="button" onClick={() => toggleSort("investorType")} className="flex items-center gap-1 outline-none transition-colors hover:text-[#1C1713]">
          Tipe
          {sortCol === "investorType" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
        </button>
        <button type="button" onClick={() => toggleSort("percentage")} className="ml-auto flex items-center justify-end gap-1 outline-none transition-colors hover:text-[#1C1713]">
          % Hold
          {sortCol === "percentage" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
        </button>
        <button type="button" onClick={() => toggleSort("shares")} className="ml-auto flex items-center justify-end gap-1 outline-none transition-colors hover:text-[#1C1713]">
          Shares
          {sortCol === "shares" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
        </button>
        <button type="button" onClick={() => toggleSort("idr")} className="ml-auto flex items-center justify-end gap-1 outline-none transition-colors hover:text-[#1C1713]">
          Nilai (IDR)
          {sortCol === "idr" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
        </button>
      </div>

      <div ref={parentRef} className="h-[460px] overflow-auto">
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = sorted[virtualRow.index];
            const barWidth = Math.max(2, (row.percentage / maxPct) * 100);
            const idrValue = getPositionValueIDR(row.shares, prices[row.shareCode]);

            return (
              <button
                id={`holder-${encodeURIComponent(row.investorId)}`}
                key={`${row.issuerId}:${row.investorId}`}
                type="button"
                onClick={() => onSelectInvestor(row.investorId)}
                className="absolute left-0 right-0 grid grid-cols-[minmax(110px,1.8fr)_100px_130px_120px_130px] items-center gap-3 border-b border-[#EEE3D6] px-4 py-2.5 text-left transition-colors hover:bg-[#F6EEE2]"
                style={{ transform: `translateY(${virtualRow.start}px)`, height: `${virtualRow.size}px` }}
              >
                <span className="flex items-center gap-2 truncate">
                  <span className="truncate text-sm font-medium text-[#1C1713]">{row.investorName}</span>
                  <span className={`shrink-0 text-[11px] font-semibold ${statusTone(row.localForeign)}`}>
                    {statusLabel(row.localForeign)}
                  </span>
                </span>
                <span className="truncate pr-2 text-[11px] text-[#665A4F]" title={(row.investorType ?? "-").toUpperCase()}>
                  {formatInvestorType(row.investorType)}
                </span>
                <span className="flex items-center justify-end gap-2">
                  <span className="h-1.5 w-[56px] rounded-full bg-[#D8CDBF]">
                    <span className="block h-full rounded-full bg-[#1D4C45]" style={{ width: `${barWidth}%` }} />
                  </span>
                  <span className="font-mono text-sm font-semibold text-[#1C1713]">
                    <NumberTicker value={row.percentage} decimalPlaces={2} />%
                  </span>
                </span>
                <span className="text-right font-mono text-sm text-[#665A4F]">
                  <NumberTicker value={row.shares} />
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
