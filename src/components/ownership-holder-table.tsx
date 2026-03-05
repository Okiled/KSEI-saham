import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Users } from "lucide-react";
import { fmtNumber, fmtPercent } from "../lib/utils";
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

export function OwnershipHolderTable({ holders, onSelectInvestor }: OwnershipHolderTableProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const sorted = useMemo(
    () => [...holders].sort((a, b) => b.percentage - a.percentage || b.shares - a.shares),
    [holders],
  );

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
      <div className="grid grid-cols-[1.8fr_80px_150px_140px] border-b border-border bg-panel-2/65 px-4 py-3 text-[11px] uppercase tracking-[0.1em] text-muted">
        <span>Holder</span>
        <span>Tipe</span>
        <span className="text-right">% Hold</span>
        <span className="text-right">Shares</span>
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
                className="absolute left-0 right-0 grid grid-cols-[1.8fr_80px_150px_140px] items-center border-b border-border/55 px-4 py-2 text-left transition-all hover:border-l-[3px] hover:border-l-teal/60 hover:bg-panel-2/50"
                style={{ transform: `translateY(${virtualRow.start}px)`, height: `${virtualRow.size}px` }}
              >
                <span className="flex items-center gap-2 truncate">
                  <span className="truncate text-sm font-medium text-foreground">{row.investorName}</span>
                  <span className={`shrink-0 text-[11px] font-semibold ${statusTone(row.localForeign)}`}>{statusLabel(row.localForeign)}</span>
                </span>
                <span className="font-mono text-xs text-muted">{(row.investorType ?? "—").toUpperCase()}</span>
                <span className="flex items-center justify-end gap-2">
                  <span className="h-1.5 rounded-full bg-teal/20" style={{ width: "50px" }}>
                    <span className="block h-full rounded-full bg-teal/70" style={{ width: `${barWidth}%` }} />
                  </span>
                  <span className="font-mono text-sm font-semibold text-foreground">{fmtPercent(row.percentage)}</span>
                </span>
                <span className="text-right font-mono text-sm text-muted">{fmtNumber(row.shares)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
