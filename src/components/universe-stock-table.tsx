import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Database, Lock, ShieldAlert, Layers } from "lucide-react";
import { fmtPercent } from "../lib/utils";

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

export function UniverseStockTable({ rows, onSelectIssuer, selectedIssuerId = null }: UniverseStockTableProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [hoverData, setHoverData] = useState<{ row: UniverseStockRow; x: number; y: number } | null>(null);
  const displayRows = rows;

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
        <span>Ticker</span>
        <span>Emiten</span>
        <span className="text-center">Risk</span>
        <span className="text-right">Holders</span>
        <span className="text-right">Top %</span>
        <span>L/A Ratio</span>
        <span className="text-right">Free Float</span>
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
                  <div className="text-right font-mono text-sm text-muted">{row.holderCount.toLocaleString("id-ID")}</div>
                  <div className="text-right font-mono text-sm font-semibold text-foreground">{fmtPercent(row.topHolderPct)}</div>
                  <div className="pr-2">
                    <div className="flex h-3 overflow-hidden rounded-full bg-panel-2">
                      <div className="h-full bg-teal/80 transition-all" style={{ width: `${Math.min(100, row.localPct)}%` }} />
                      <div className="h-full bg-gold/80 transition-all" style={{ width: `${Math.min(100, row.foreignPct)}%` }} />
                    </div>
                    <div className="mt-1 text-[11px] text-muted">
                      L {row.localPct.toFixed(1)}% | A {row.foreignPct.toFixed(1)}%
                    </div>
                  </div>
                  <div className={`text-right font-mono text-sm ${freeFloatColor(row.freeFloatPct)}`}>{fmtPercent(row.freeFloatPct)}</div>
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
