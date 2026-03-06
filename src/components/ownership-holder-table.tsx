import { useRef, useState, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Users, ChevronDown, ChevronUp } from "lucide-react";
import { formatInvestorType } from "../lib/utils";
import { NumberTicker } from "./number-ticker";
import type { IssuerHolderPosition } from "../types/ownership";

type OwnershipHolderTableProps = {
  holders: IssuerHolderPosition[];
  onSelectInvestor: (investorId: string) => void;
};

function statusTone(localForeign: "L" | "A" | null): string {
  if (localForeign === "L") return "text-teal";
  if (localForeign === "A") return "text-gold";
  return "text-muted";
}

function statusLabel(localForeign: "L" | "A" | null): string {
  if (localForeign === "L") return "Lokal";
  if (localForeign === "A") return "Asing";
  return "—";
}

type SortColumn = "investorName" | "investorType" | "percentage" | "shares";

export function OwnershipHolderTable({ holders, onSelectInvestor }: OwnershipHolderTableProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  
  const [sortCol, setSortCol] = useState<SortColumn>("percentage");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    return [...holders].sort((a, b) => {
      const aVal = a[sortCol as keyof IssuerHolderPosition];
      const bVal = b[sortCol as keyof IssuerHolderPosition];
      
      if (typeof aVal === 'string' || typeof bVal === 'string') {
         const cmp = (aVal?.toString() || "").localeCompare(bVal?.toString() || "");
         return sortDir === 'asc' ? cmp : -cmp;
      }
      
      const v1 = Number(aVal) || 0;
      const v2 = Number(bVal) || 0;
      return sortDir === 'asc' ? v1 - v2 : v2 - v1;
    });
  }, [holders, sortCol, sortDir]);

  const maxPct = useMemo(() => Math.max(1, ...sorted.map((h) => h.percentage)), [sorted]);

  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 12,
  });

  if (sorted.length === 0) {
    return (
      <div className="flex h-[420px] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-panel/35 text-center">
        <Users className="h-10 w-10 text-muted/30" />
        <div className="text-sm font-medium text-muted">Belum ada data holder untuk emiten ini</div>
        <p className="max-w-sm text-xs text-muted">
          Holder table akan terisi saat data ownership tersedia.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-panel/35">
      <div className="grid grid-cols-[minmax(110px,1.8fr)_100px_130px_120px] gap-3 border-b border-border bg-panel-2/65 px-4 py-3 text-[11px] uppercase tracking-[0.1em] text-muted">
        <button type="button" onClick={() => toggleSort("investorName")} className="flex items-center gap-1 hover:text-foreground outline-none">Holder {sortCol === "investorName" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}</button>
        <button type="button" onClick={() => toggleSort("investorType")} className="flex items-center gap-1 hover:text-foreground outline-none">Tipe {sortCol === "investorType" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}</button>
        <button type="button" onClick={() => toggleSort("percentage")} className="flex items-center justify-end gap-1 hover:text-foreground outline-none ml-auto">% Hold {sortCol === "percentage" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}</button>
        <button type="button" onClick={() => toggleSort("shares")} className="flex items-center justify-end gap-1 hover:text-foreground outline-none ml-auto">Shares {sortCol === "shares" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}</button>
      </div>
      <div ref={parentRef} className="h-[460px] overflow-auto">
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = sorted[virtualRow.index];
            const barWidth = Math.max(2, (row.percentage / maxPct) * 100);
            return (
              <button
                key={`${row.issuerId}:${row.investorId}`}
                type="button"
                onClick={() => onSelectInvestor(row.investorId)}
                className="absolute left-0 right-0 grid grid-cols-[minmax(110px,1.8fr)_100px_130px_120px] gap-3 items-center border-b border-border/55 px-4 py-2 text-left transition-all hover:border-l-[3px] hover:border-l-teal/60 hover:bg-panel-2/50"
                style={{ transform: `translateY(${virtualRow.start}px)`, height: `${virtualRow.size}px` }}
              >
                <span className="flex items-center gap-2 truncate">
                  <span className="truncate text-sm font-medium text-foreground">{row.investorName}</span>
                  <span className={`shrink-0 text-[11px] font-semibold ${statusTone(row.localForeign)}`}>{statusLabel(row.localForeign)}</span>
                </span>
                <span className="truncate text-[11px] text-muted pr-2" title={(row.investorType ?? "—").toUpperCase()}>
                  {formatInvestorType(row.investorType)}
                </span>
                <span className="flex items-center justify-end gap-2">
                  <span className="h-1.5 rounded-full bg-teal/20" style={{ width: "50px" }}>
                    <span className="block h-full rounded-full bg-teal/70" style={{ width: `${barWidth}%` }} />
                  </span>
                  <span className="font-mono text-sm font-semibold text-foreground">
                    <NumberTicker value={row.percentage} decimalPlaces={2} />%
                  </span>
                </span>
                <span className="text-right font-mono text-sm text-muted">
                  <NumberTicker value={row.shares} />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
