import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { fmtNumber, fmtPercent } from "../lib/utils";
import type { OwnershipRow } from "../types/ownership";

type OwnershipTableProps = {
  rows: OwnershipRow[];
  selectedRowId: string | null;
  onSelectRow: (row: OwnershipRow) => void;
};

function normalizeInvestorType(value: string | null | undefined): string {
  const text = (value ?? "").trim().toUpperCase();
  return text || "UNKNOWN";
}

function isIndividualInvestorType(value: string): boolean {
  return value.includes("INDIV") || value === "ID" || value === "I";
}

function toStatusLabel(value: "L" | "A" | null): "Lokal" | "Asing" | "Unknown" {
  if (value === "L") return "Lokal";
  if (value === "A") return "Asing";
  return "Unknown";
}

export function OwnershipTable({ rows, selectedRowId, onSelectRow }: OwnershipTableProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const sortedRows = useMemo(() => [...rows].sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0)), [rows]);

  const rowVirtualizer = useVirtualizer({
    count: sortedRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 58,
    overscan: 10,
  });

  if (sortedRows.length === 0) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-xl border border-border bg-background/25 px-4 text-center text-sm text-muted">
        Tidak ada row untuk kombinasi filter ini.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="sticky top-0 z-10 grid grid-cols-[48px_1.8fr_180px_120px_170px_120px] border-b border-border bg-panel-2/95 px-4 py-3 text-[12px] uppercase tracking-[0.08em] text-muted backdrop-blur">
        <span>#</span>
        <span>Pemegang Saham</span>
        <span>Tipe Investor</span>
        <span>Status</span>
        <span className="text-right">Saham</span>
        <span className="text-right">% Kepemilikan</span>
      </div>
      <div ref={parentRef} className="h-[420px] overflow-auto bg-background/20">
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = sortedRows[virtualRow.index];
            const selected = row.id === selectedRowId;
            const investorType = normalizeInvestorType(row.investorType);
            const statusLabel = toStatusLabel(row.localForeign);
            const typeTone = isIndividualInvestorType(investorType)
              ? "border-focus/35 bg-focus/12 text-focus"
              : "border-border-strong/45 bg-panel-3/65 text-foreground";
            const statusTone =
              statusLabel === "Lokal"
                ? "border-local/35 bg-local/12 text-local"
                : statusLabel === "Asing"
                  ? "border-foreign/35 bg-foreign/12 text-foreign"
                  : "border-border bg-panel/70 text-muted";
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => onSelectRow(row)}
                className={`absolute left-0 right-0 grid grid-cols-[48px_1.8fr_180px_120px_170px_120px] items-center border-b border-border/45 px-4 text-left text-[14px] transition-colors duration-150 ${
                  selected ? "bg-gradient-to-r from-focus/18 to-transparent" : "hover:bg-panel-2/45"
                }`}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                title={row.investorName}
              >
                <span className="font-mono text-[13px] text-muted">{virtualRow.index + 1}</span>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-foreground">{row.investorName}</div>
                  <div className="truncate text-[12px] text-muted">
                    {row.shareCode} - {row.date}
                  </div>
                </div>
                <div>
                  <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[12px] font-medium ${typeTone}`}>
                    {isIndividualInvestorType(investorType) ? "Individual" : "Institusi"}
                  </span>
                  <div className="mt-0.5 text-[11px] text-muted">{investorType}</div>
                </div>
                <div>
                  <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[12px] font-medium ${statusTone}`}>
                    {statusLabel}
                  </span>
                </div>
                <span className="text-right font-mono text-[13px] text-muted">{fmtNumber(row.totalHoldingShares)}</span>
                <span className="text-right font-mono text-[14px] font-semibold text-foreground">{fmtPercent(row.percentage)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
