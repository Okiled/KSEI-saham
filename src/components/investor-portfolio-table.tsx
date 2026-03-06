import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Briefcase, ChevronDown, ChevronUp } from "lucide-react";
import { NumberTicker } from "./number-ticker";
import type { InvestorPortfolioPosition } from "../types/ownership";

type InvestorPortfolioTableProps = {
  positions: InvestorPortfolioPosition[];
  onSelectPosition: (position: InvestorPortfolioPosition) => void;
};

type SortColumn = "shareCode" | "issuerName" | "percentage" | "shares" | "localForeign";

export function InvestorPortfolioTable({ positions, onSelectPosition }: InvestorPortfolioTableProps) {
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

  const sortedPositions = useMemo(() => {
    return [...positions].sort((a, b) => {
      const aVal = a[sortCol];
      const bVal = b[sortCol];
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const cmp = aVal.localeCompare(bVal);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      
      const v1 = Number(aVal) || 0;
      const v2 = Number(bVal) || 0;
      return sortDir === 'asc' ? v1 - v2 : v2 - v1;
    });
  }, [positions, sortCol, sortDir]);

  const maxPct = useMemo(() => Math.max(1, ...sortedPositions.map((p) => p.percentage)), [sortedPositions]);

  const rowVirtualizer = useVirtualizer({
    count: sortedPositions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 12,
  });

  if (sortedPositions.length === 0) {
    return (
      <div className="flex h-[420px] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-panel/35 text-center">
        <Briefcase className="h-10 w-10 text-muted/30" />
        <div className="text-sm font-medium text-muted">Investor belum memiliki posisi pada snapshot ini</div>
        <p className="max-w-sm text-xs text-muted">
          Posisi akan muncul saat data ownership tersedia untuk investor ini.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-panel/35">
      <div className="grid grid-cols-[88px_1.7fr_160px_170px_100px] border-b border-border bg-panel-2/65 px-4 py-3 text-[11px] uppercase tracking-[0.1em] text-muted">
        <button type="button" onClick={() => toggleSort("shareCode")} className="flex items-center gap-1 hover:text-foreground outline-none">Ticker {sortCol === "shareCode" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}</button>
        <button type="button" onClick={() => toggleSort("issuerName")} className="flex items-center gap-1 hover:text-foreground outline-none">Emiten {sortCol === "issuerName" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}</button>
        <button type="button" onClick={() => toggleSort("percentage")} className="flex items-center justify-end gap-1 hover:text-foreground outline-none ml-auto">% Hold {sortCol === "percentage" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}</button>
        <button type="button" onClick={() => toggleSort("shares")} className="flex items-center justify-end gap-1 hover:text-foreground outline-none ml-auto">Shares {sortCol === "shares" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}</button>
        <button type="button" onClick={() => toggleSort("localForeign")} className="flex items-center justify-center gap-1 hover:text-foreground outline-none mx-auto">Status {sortCol === "localForeign" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}</button>
      </div>
      <div ref={parentRef} className="overflow-auto" style={{ maxHeight: 600 }}>
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = sortedPositions[virtualRow.index];
            const status = row.localForeign === "L" ? "Lokal" : row.localForeign === "A" ? "Asing" : "Unknown";
            const barWidth = Math.max(2, (row.percentage / maxPct) * 100);
            return (
              <button
                key={`${row.investorId}:${row.issuerId}`}
                type="button"
                onClick={() => onSelectPosition(row)}
                className="absolute left-0 right-0 grid grid-cols-[88px_1.7fr_160px_170px_100px] items-center border-b border-border/55 px-4 py-2 text-left transition-all hover:border-l-[3px] hover:border-l-teal/60 hover:bg-panel-2/50"
                style={{ transform: `translateY(${virtualRow.start}px)`, height: `${virtualRow.size}px` }}
              >
                <span className="font-mono text-[15px] font-semibold text-teal">{row.shareCode}</span>
                <span className="truncate text-sm text-foreground">{row.issuerName}</span>
                <span className="flex items-center justify-end gap-2">
                  <span className="h-1.5 rounded-full bg-teal/20" style={{ width: "60px" }}>
                    <span 
                      className="block h-full rounded-full bg-teal/70 transition-all duration-700 ease-expo-out" 
                      style={{ width: `${barWidth}%` }} 
                    />
                  </span>
                  <span className="font-mono text-sm font-semibold text-foreground">
                    <NumberTicker value={row.percentage} decimalPlaces={2} />%
                  </span>
                </span>
                <span className="text-right font-mono text-[13px] text-foreground">
                  <NumberTicker value={row.shares} />
                </span>
                <span className="flex items-center justify-center">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                    row.localForeign === "L" ? "border-teal/30 bg-teal/10 text-teal" : 
                    row.localForeign === "A" ? "border-gold/30 bg-gold/10 text-gold" : 
                    "border-border bg-panel text-muted"
                  }`}>
                    {status}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
