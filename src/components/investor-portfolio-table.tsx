import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Briefcase } from "lucide-react";
import { fmtNumber, fmtPercent } from "../lib/utils";
import type { InvestorPortfolioPosition } from "../types/ownership";

type InvestorPortfolioTableProps = {
  positions: InvestorPortfolioPosition[];
  onSelectPosition: (position: InvestorPortfolioPosition) => void;
};



export function InvestorPortfolioTable({ positions, onSelectPosition }: InvestorPortfolioTableProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const sortedPositions = useMemo(
    () => [...positions].sort((a, b) => b.percentage - a.percentage || b.shares - a.shares),
    [positions],
  );

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
        <span>Ticker</span>
        <span>Emiten</span>
        <span className="text-right">% Hold</span>
        <span className="text-right">Shares</span>
        <span className="text-center">Status</span>
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
                  <span className="font-mono text-sm font-semibold text-foreground">{fmtPercent(row.percentage)}</span>
                </span>
                <span className="text-right font-mono text-[13px] text-foreground">{fmtNumber(row.shares)}</span>
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
