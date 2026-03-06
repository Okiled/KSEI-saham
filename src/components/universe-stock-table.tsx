import { useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Database, Lock, ShieldAlert, Layers, ChevronDown, ChevronUp } from "lucide-react";
import { fmtPercent } from "../lib/utils";
import { NumberTicker } from "./number-ticker";

export type UniverseStockRow = {
  issuerId: string;
  shareCode: string;
  issuerName: string;
  holderCount: number;
  topHolderPct: number;
  localPct: number;
  foreignPct: number;
  freeFloatPct: number;
  totalShares: number;
  signals: string[];
};

type UniverseStockTableProps = {
  rows: UniverseStockRow[];
  onSelectIssuer: (issuerId: string) => void;
  selectedIssuerId?: string | null;
  targetFreeFloat?: number | null;
};

/* ── Domain Expert: IDX Konsentrasi Risk ── */
function konsentrasiRisk(topHolderPct: number): { label: string; color: string; icon: typeof Lock } {
  if (topHolderPct >= 50) return { label: "Extreme Lock", color: "text-rose", icon: Lock };
  if (topHolderPct >= 30) return { label: "High Conc.", color: "text-gold", icon: ShieldAlert };
  return { label: "Distributed", color: "text-teal", icon: Layers };
}

function signalTone(signal: string): string {
  if (signal.includes("Asing")) return "border-gold/35 bg-gold/10 text-gold";
  if (signal.includes("Rendah")) return "border-rose/35 bg-rose/10 text-rose";
  if (signal.includes("Unknown")) return "border-warning/40 bg-warning/12 text-warning";
  return "border-teal/30 bg-teal/10 text-teal";
}

function freeFloatColor(pct: number): string {
  if (pct < 10) return "text-rose font-semibold";
  if (pct <= 25) return "text-gold font-semibold";
  return "text-teal";
}

type SortColumn = "shareCode" | "issuerName" | "topHolderPct" | "holderCount" | "localPct" | "freeFloatPct";

export function UniverseStockTable({ rows, onSelectIssuer, selectedIssuerId = null, targetFreeFloat = null }: UniverseStockTableProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [hoverData, setHoverData] = useState<{ row: UniverseStockRow; x: number; y: number } | null>(null);
  
  const [sortCol, setSortCol] = useState<SortColumn>("shareCode");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Keep track of the last target free float to auto-sort when it changes
  const lastTargetRef = useRef(targetFreeFloat);
  if (targetFreeFloat !== null && targetFreeFloat !== lastTargetRef.current) {
    if (sortCol !== "freeFloatPct") {
      setSortCol("freeFloatPct");
      setSortDir("asc");
    }
    lastTargetRef.current = targetFreeFloat;
  } else if (targetFreeFloat === null && lastTargetRef.current !== null) {
    lastTargetRef.current = null;
    setSortCol("shareCode");
    setSortDir("asc");
  }

  const toggleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const displayRows: UniverseStockRow[] = useMemo(() => {
    return [...rows].sort((a, b) => {
      // Custom proximity sort if sorting by free float and a target is active
      if (sortCol === "freeFloatPct" && targetFreeFloat !== null) {
        const diffA = Math.abs((a.freeFloatPct || 0) - targetFreeFloat);
        const diffB = Math.abs((b.freeFloatPct || 0) - targetFreeFloat);
        return sortDir === "asc" ? diffA - diffB : diffB - diffA;
      }

      const aVal = a[sortCol as keyof UniverseStockRow];
      const bVal = b[sortCol as keyof UniverseStockRow];
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const cmp = aVal.localeCompare(bVal);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      
      const v1 = Number(aVal) || 0;
      const v2 = Number(bVal) || 0;
      return sortDir === 'asc' ? v1 - v2 : v2 - v1;
    });
  }, [rows, sortCol, sortDir, targetFreeFloat]);

  const rowVirtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 84,
    overscan: 10,
  });

  if (displayRows.length === 0) {
    return (
      <div className="flex h-[520px] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-panel/35 text-center">
        <Database className="h-10 w-10 text-muted/30" />
        <div className="text-sm font-medium text-muted">Tidak ada emiten untuk filter saat ini</div>
        <p className="max-w-sm text-xs text-muted">
          Ubah parameter filter atau reset untuk melihat daftar emiten.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-panel/35">
      <div className="grid grid-cols-[88px_1.7fr_100px_90px_90px_150px_110px] border-b border-border bg-panel-2/65 px-4 py-3 text-[11px] uppercase tracking-[0.1em] text-muted">
        <button type="button" onClick={() => toggleSort("shareCode")} className="flex items-center gap-1 hover:text-foreground outline-none">Ticker {sortCol === "shareCode" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}</button>
        <button type="button" onClick={() => toggleSort("issuerName")} className="flex items-center gap-1 hover:text-foreground outline-none">Emiten {sortCol === "issuerName" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}</button>
        <div className="text-center">Risk</div>
        <button type="button" onClick={() => toggleSort("holderCount")} className="flex items-center justify-end gap-1 hover:text-foreground outline-none ml-auto">Holders {sortCol === "holderCount" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}</button>
        <button type="button" onClick={() => toggleSort("topHolderPct")} className="flex items-center justify-end gap-1 hover:text-foreground outline-none ml-auto">Top % {sortCol === "topHolderPct" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}</button>
        <button type="button" onClick={() => toggleSort("localPct")} className="flex items-center gap-1 hover:text-foreground outline-none">L/A Ratio {sortCol === "localPct" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}</button>
        <button type="button" onClick={() => toggleSort("freeFloatPct")} className="flex items-center justify-end gap-1 hover:text-foreground outline-none ml-auto">Free Float {sortCol === "freeFloatPct" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}</button>
      </div>

      <div ref={parentRef} className="h-[560px] overflow-auto">
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = displayRows[virtualRow.index];
            const selected = row.issuerId === selectedIssuerId;
            const risk = konsentrasiRisk(row.topHolderPct);
            const RiskIcon = risk.icon;
            return (
              <div
                key={row.issuerId}
                className="absolute left-0 right-0"
                style={{ 
                  transform: `translateY(${virtualRow.start}px)`, 
                  height: `${virtualRow.size}px`
                }}
              >
                <button
                  type="button"
                  onClick={() => onSelectIssuer(row.issuerId)}
                  onMouseMove={(e) => setHoverData({ row, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoverData(null)}
                  className={`relative grid h-full w-full grid-cols-[88px_1.7fr_100px_90px_90px_150px_110px] items-start gap-1.5 border-b border-border/60 px-4 py-3 text-left transition-all duration-150 ease-expo-out cursor-pointer ${
                    selected ? "border-l-[3px] border-l-teal bg-teal/5" : "hover:border-l-[3px] hover:border-l-teal/60 hover:bg-[#f4f1ec]"
                  }`}
                >
                  <div className="font-mono text-lg font-semibold text-teal">{row.shareCode}</div>
                  <div>
                    <div className="truncate text-sm font-semibold text-foreground">{row.issuerName}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {row.signals.slice(0, 3).map((signal) => (
                        <span
                          key={`${row.issuerId}:${signal}`}
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${signalTone(signal)}`}
                        >
                          {signal}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className={`flex items-center justify-center gap-1 text-[11px] font-medium ${risk.color}`}>
                    <RiskIcon className="h-3.5 w-3.5" />
                    <span>{risk.label}</span>
                  </div>
                    <span className="text-right font-mono text-[13px] text-foreground">
                      <NumberTicker value={row.holderCount} />
                    </span>
                    <span className="text-right font-mono text-[13px] text-foreground">
                      <NumberTicker value={row.topHolderPct} decimalPlaces={1} />%
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="flex h-1.5 w-[65px] overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full bg-teal transition-all duration-300"
                          style={{ width: `${(row.localPct / Math.max(0.1, row.localPct + row.foreignPct)) * 100}%` }}
                        />
                        <div
                          className="h-full bg-gold transition-all duration-300"
                          style={{ width: `${(row.foreignPct / Math.max(0.1, row.localPct + row.foreignPct)) * 100}%` }}
                        />
                      </div>
                      <span className="ml-1 font-mono text-xs text-muted">
                        <NumberTicker value={Math.round((row.localPct / Math.max(0.1, row.localPct + row.foreignPct)) * 100)} />%
                      </span>
                    </span>
                    <span className={`text-right font-mono text-[13px] ${freeFloatColor(row.freeFloatPct)}`}>
                      <NumberTicker value={row.freeFloatPct} decimalPlaces={1} />%
                    </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {hoverData &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[9999] w-[280px] rounded-xl border border-teal/20 bg-panel p-3 shadow-[0_12px_40px_rgba(0,0,0,0.25)]"
            style={{
              left: Math.max(12, Math.min(hoverData.x - 290, window.innerWidth - 300)),
              top: Math.max(12, hoverData.y - 200),
            }}
          >
            <div className="mb-1.5 font-mono text-sm font-semibold text-teal">{hoverData.row.shareCode}</div>
            <div className="mb-2 text-xs text-muted">{hoverData.row.issuerName}</div>
            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              <div className="rounded-lg border border-border bg-panel-2/50 p-1.5">
                <div className="text-muted">Top %</div>
                <div className="font-mono font-semibold text-foreground">
                  {fmtPercent(hoverData.row.topHolderPct)}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-panel-2/50 p-1.5">
                <div className="text-muted">Float</div>
                <div className={`font-mono font-semibold ${freeFloatColor(hoverData.row.freeFloatPct)}`}>
                  {fmtPercent(hoverData.row.freeFloatPct)}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-panel-2/50 p-1.5">
                <div className="text-muted">Holders</div>
                <div className="font-mono font-semibold text-foreground">
                  {hoverData.row.holderCount.toLocaleString("id-ID")}
                </div>
              </div>
            </div>
            <div
              className={`mt-2 flex items-center gap-1 text-xs font-medium ${konsentrasiRisk(hoverData.row.topHolderPct).color}`}
            >
              <ShieldAlert className="h-3 w-3" />
              {konsentrasiRisk(hoverData.row.topHolderPct).label}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
