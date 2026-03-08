import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronUp, Database, Layers, Lock, ShieldAlert } from "lucide-react";
import { formatIDR } from "../lib/format";
import { getPositionValueIDR } from "../lib/market-data";
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
  prices?: Record<string, number>;
};

type SortColumn =
  | "shareCode"
  | "issuerName"
  | "topHolderPct"
  | "holderCount"
  | "localPct"
  | "freeFloatPct"
  | "idr";

function konsentrasiRisk(topHolderPct: number): { label: string; color: string; icon: typeof Lock } {
  if (topHolderPct >= 50) return { label: "Extreme Lock", color: "text-[#7B312C]", icon: Lock };
  if (topHolderPct >= 30) return { label: "High Conc.", color: "text-[#996737]", icon: ShieldAlert };
  return { label: "Distributed", color: "text-[#1D4C45]", icon: Layers };
}

function signalTone(signal: string): string {
  if (signal.includes("Asing")) return "border-[#E7D2B3] bg-[#F8EEDC] text-[#996737]";
  if (signal.includes("Rendah")) return "border-[#E7BFB5] bg-[#F8E9E4] text-[#7B312C]";
  if (signal.includes("Unknown")) return "border-[#D8CDBF] bg-[#F7F0E6] text-[#665A4F]";
  return "border-[#C0D6CF] bg-[#EDF4F1] text-[#1D4C45]";
}

function freeFloatColor(pct: number): string {
  if (pct < 10) return "font-semibold text-[#7B312C]";
  if (pct <= 25) return "font-semibold text-[#996737]";
  return "text-[#1D4C45]";
}

export function UniverseStockTable({
  rows,
  onSelectIssuer,
  selectedIssuerId = null,
  targetFreeFloat = null,
  prices = {},
}: UniverseStockTableProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [hoverData, setHoverData] = useState<{ row: UniverseStockRow; x: number; y: number } | null>(null);
  const [sortCol, setSortCol] = useState<SortColumn>("shareCode");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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
      return;
    }

    setSortCol(col);
    setSortDir("desc");
  };

  const displayRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (sortCol === "freeFloatPct" && targetFreeFloat !== null) {
        const diffA = Math.abs((a.freeFloatPct || 0) - targetFreeFloat);
        const diffB = Math.abs((b.freeFloatPct || 0) - targetFreeFloat);
        return sortDir === "asc" ? diffA - diffB : diffB - diffA;
      }

      if (sortCol === "idr") {
        const aValue = getPositionValueIDR(a.totalShares, prices[a.shareCode]) ?? 0;
        const bValue = getPositionValueIDR(b.totalShares, prices[b.shareCode]) ?? 0;
        return sortDir === "asc" ? aValue - bValue : bValue - aValue;
      }

      const aVal = a[sortCol as keyof UniverseStockRow];
      const bVal = b[sortCol as keyof UniverseStockRow];

      if (typeof aVal === "string" && typeof bVal === "string") {
        const cmp = aVal.localeCompare(bVal);
        return sortDir === "asc" ? cmp : -cmp;
      }

      const v1 = Number(aVal) || 0;
      const v2 = Number(bVal) || 0;
      return sortDir === "asc" ? v1 - v2 : v2 - v1;
    });
  }, [prices, rows, sortCol, sortDir, targetFreeFloat]);

  const rowVirtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 76,
    overscan: 10,
  });

  if (displayRows.length === 0) {
    return (
      <div className="flex h-[520px] flex-col items-center justify-center gap-3 rounded-lg border border-[#E8E4DC] bg-white text-center">
        
        <Database className="h-10 w-10 text-[#9CA3AF]" />
        <div className="text-sm font-medium text-[#1A1A1A]">Tidak ada emiten untuk filter saat ini</div>
        <p className="max-w-sm text-xs text-[#6B6B6B]">
          Ubah parameter filter atau reset untuk melihat daftar emiten.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[22px] border border-[#D8CDBF] bg-[#FFFBF5] shadow-[0_14px_34px_rgba(95,73,47,0.07)]">
      <div className="grid grid-cols-[88px_1.6fr_96px_78px_88px_92px_130px_96px] border-b border-[#E6DCCE] bg-[#F6EEE2] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[#7A6E63]">
        <button type="button" onClick={() => toggleSort("shareCode")} className="flex items-center gap-1 outline-none transition-colors hover:text-[#1C1713]">
          Ticker
          {sortCol === "shareCode" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
        </button>
        <button type="button" onClick={() => toggleSort("issuerName")} className="flex items-center gap-1 outline-none transition-colors hover:text-[#1C1713]">
          Emiten
          {sortCol === "issuerName" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
        </button>
        <div className="text-center">Risk</div>
        <button type="button" onClick={() => toggleSort("holderCount")} className="ml-auto flex items-center justify-end gap-1 outline-none transition-colors hover:text-[#1C1713]">
          Holders
          {sortCol === "holderCount" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
        </button>
        <button type="button" onClick={() => toggleSort("topHolderPct")} className="ml-auto flex items-center justify-end gap-1 outline-none transition-colors hover:text-[#1C1713]">
          Top Hold
          {sortCol === "topHolderPct" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
        </button>
        <button type="button" onClick={() => toggleSort("localPct")} className="ml-2 flex items-center gap-1 outline-none transition-colors hover:text-[#1C1713]">
          L/A Ratio
          {sortCol === "localPct" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
        </button>
        <button type="button" onClick={() => toggleSort("idr")} className="ml-auto flex items-center justify-end gap-1 outline-none transition-colors hover:text-[#1C1713]">
          Nilai (IDR)
          {sortCol === "idr" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
        </button>
        <button type="button" onClick={() => toggleSort("freeFloatPct")} className="ml-auto flex items-center justify-end gap-1 outline-none transition-colors hover:text-[#1C1713]">
          True Float
          {sortCol === "freeFloatPct" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
        </button>
      </div>

      <div ref={parentRef} className="h-[560px] overflow-auto">
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = displayRows[virtualRow.index];
            const selected = row.issuerId === selectedIssuerId;
            const risk = konsentrasiRisk(row.topHolderPct);
            const RiskIcon = risk.icon;
            const disclosedValue = getPositionValueIDR(row.totalShares, prices[row.shareCode]);
            const ratioDenominator = Math.max(0.1, row.localPct + row.foreignPct);
            const localWidth = (row.localPct / ratioDenominator) * 100;
            const foreignWidth = (row.foreignPct / ratioDenominator) * 100;

            return (
              <div
                key={row.issuerId}
                className="absolute left-0 right-0"
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                  height: `${virtualRow.size}px`,
                }}
              >
                <button
                  type="button"
                  onClick={() => onSelectIssuer(row.issuerId)}
                  onMouseMove={(event) => setHoverData({ row, x: event.clientX, y: event.clientY })}
                  onMouseLeave={() => setHoverData(null)}
                  className={`relative grid h-full w-full grid-cols-[88px_1.6fr_96px_78px_88px_92px_130px_96px] items-center gap-1.5 border-b border-[#E8E4DC] px-4 py-2.5 text-left transition-colors ${
                    selected ? "border-l-[3px] border-l-[#1D4C45] bg-[#F6EEE2]" : "hover:bg-[#F6EEE2]"
                  }`}
                >
                  <div className="font-mono text-lg font-bold text-[#1D4C45]">{row.shareCode}</div>

                  <div>
                    <div className="truncate text-sm font-semibold text-[#1C1713]">{row.issuerName}</div>
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

                  <span className="text-right font-mono text-[13px] text-[#1C1713]">
                    <NumberTicker value={row.holderCount} />
                  </span>

                  <span className="text-right font-mono text-[13px] text-[#1C1713]">
                    <NumberTicker value={row.topHolderPct} decimalPlaces={1} />%
                  </span>

                  <span className="flex items-center gap-1">
                    <div className="flex h-1.5 w-[60px] overflow-hidden rounded-full bg-[#D8CDBF]">
                      <div className="h-full bg-[#1D4C45] transition-all duration-300" style={{ width: `${localWidth}%` }} />
                      <div className="h-full bg-[#996737] transition-all duration-300" style={{ width: `${foreignWidth}%` }} />
                    </div>
                    <span className="ml-1 font-mono text-xs text-[#665A4F]">
                      <NumberTicker value={Math.round(localWidth)} />%
                    </span>
                  </span>

                  <span className="text-right font-mono text-[13px] font-semibold text-[#996737]">
                    {disclosedValue !== null ? formatIDR(disclosedValue) : "-"}
                  </span>

                  <span className={`mt-0.5 text-right font-mono text-[13px] ${freeFloatColor(row.freeFloatPct)}`}>
                    <NumberTicker value={row.freeFloatPct} decimalPlaces={1} />%
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-[#E6DCCE] bg-[#F6EEE2] px-4 py-2 text-[11px] text-[#665A4F]">
        Nilai (IDR) merepresentasikan posisi disclosed &gt;=1% yang tertangkap terminal, bukan market cap penuh emiten.
      </div>

      {hoverData &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[9999] w-[280px] rounded-[22px] border border-[#D8CDBF] bg-[#FFFBF5] p-3 shadow-[0_20px_50px_rgba(95,73,47,0.18)]"
            style={{
              left: Math.max(12, Math.min(hoverData.x - 290, window.innerWidth - 300)),
              top: Math.max(12, hoverData.y - 200),
            }}
          >
            <div className="mb-1.5 font-mono text-sm font-bold text-[#1D4C45]">{hoverData.row.shareCode}</div>
            <div className="mb-2 text-xs text-[#665A4F]">{hoverData.row.issuerName}</div>
            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              <div className="rounded-xl border border-[#D8CDBF] bg-[#F6EEE2] p-1.5">
                <div className="text-[#665A4F]">Top %</div>
                <div className="font-mono font-semibold text-[#1C1713]">{fmtPercent(hoverData.row.topHolderPct)}</div>
              </div>
              <div className="rounded-xl border border-[#D8CDBF] bg-[#F6EEE2] p-1.5">
                <div className="text-[#665A4F]">Float</div>
                <div className={`font-mono font-semibold ${freeFloatColor(hoverData.row.freeFloatPct)}`}>
                  {fmtPercent(hoverData.row.freeFloatPct)}
                </div>
              </div>
              <div className="rounded-xl border border-[#D8CDBF] bg-[#F6EEE2] p-1.5">
                <div className="text-[#665A4F]">Holders</div>
                <div className="font-mono font-semibold text-[#1C1713]">
                  {hoverData.row.holderCount.toLocaleString("id-ID")}
                </div>
              </div>
            </div>
            {(() => {
              const hoverValue = getPositionValueIDR(hoverData.row.totalShares, prices[hoverData.row.shareCode]);
              return (
                <div className="mt-2 text-xs text-[#665A4F]">
                  Nilai disclosed:
                  <span className="ml-1 font-mono font-semibold text-[#996737]">
                    {hoverValue !== null ? formatIDR(hoverValue) : "-"}
                  </span>
                </div>
              );
            })()}
            <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${konsentrasiRisk(hoverData.row.topHolderPct).color}`}>
              <ShieldAlert className="h-3 w-3" />
              {konsentrasiRisk(hoverData.row.topHolderPct).label}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
