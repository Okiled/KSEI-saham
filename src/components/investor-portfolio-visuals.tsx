import { useEffect, useMemo, useRef, useState } from "react";
import { Layers } from "lucide-react";
import { fmtNumber, fmtPercent } from "../lib/utils";
import type { InvestorPortfolioPosition } from "../types/ownership";

type InvestorPortfolioVisualsProps = {
  positions: InvestorPortfolioPosition[];
  onSelectPosition: (position: InvestorPortfolioPosition) => void;
};

const PALETTE = [
  "#0a8c6e", "#0fa882", "#1ec19a", "#3dd9b3", "#62e8c6",
  "#c47c1a", "#d9922a", "#e8a64a", "#f0bf73",
  "#6b4fa0", "#8665b8", "#a080d0",
  "#2563a8", "#3578c0", "#4e90d5",
  "#b83a4b", "#d05060",
  "#6b7280", "#8b95a0",
];

function colorForIndex(index: number): string {
  return PALETTE[index % PALETTE.length];
}

export function InvestorPortfolioVisuals({ positions, onSelectPosition }: InvestorPortfolioVisualsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 100) setContainerWidth(w);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const sorted = useMemo(
    () => [...positions].sort((a, b) => b.percentage - a.percentage),
    [positions],
  );

  const totalPct = useMemo(() => sorted.reduce((s, p) => s + p.percentage, 0), [sorted]);

  // Treemap layout (simple squarified)
  const treemapRects = useMemo(() => {
    if (sorted.length === 0 || totalPct <= 0) return [];
    const treemapWidth = containerWidth - 16;
    const treemapHeight = 300;
    const rects: Array<{
      x: number; y: number; w: number; h: number;
      position: InvestorPortfolioPosition; index: number; color: string;
    }> = [];

    // Simple row-based treemap layout
    let currentY = 0;
    let remaining = [...sorted];
    let remainingArea = treemapWidth * treemapHeight;
    let remainingTotal = totalPct;

    while (remaining.length > 0) {
      const rowWidth = treemapWidth;
      const rowItems: typeof sorted = [];
      let rowTotal = 0;

      // Determine how many items fit in this row
      const targetRowHeight = Math.max(40, (remaining[0].percentage / remainingTotal) * remainingArea / rowWidth);
      let testTotal = 0;
      for (const item of remaining) {
        testTotal += item.percentage;
        const testRowHeight = (testTotal / remainingTotal) * (remainingArea / rowWidth);
        if (testRowHeight > targetRowHeight * 2.5 && rowItems.length >= 1) break;
        rowItems.push(item);
        rowTotal += item.percentage;
        if (rowItems.length >= 8) break;
      }

      if (rowItems.length === 0) break;

      const rowHeight = Math.max(36, (rowTotal / remainingTotal) * (remainingArea / rowWidth));
      let currentX = 0;

      for (const item of rowItems) {
        const itemWidth = rowTotal > 0 ? (item.percentage / rowTotal) * rowWidth : rowWidth / rowItems.length;
        const originalIndex = sorted.indexOf(item);
        rects.push({
          x: currentX + 8,
          y: currentY,
          w: Math.max(20, itemWidth - 2),
          h: Math.max(30, rowHeight - 2),
          position: item,
          index: originalIndex,
          color: colorForIndex(originalIndex),
        });
        currentX += itemWidth;
      }

      currentY += rowHeight;
      remaining = remaining.slice(rowItems.length);
      remainingTotal -= rowTotal;
      remainingArea -= rowHeight * rowWidth;
    }

    return rects;
  }, [sorted, totalPct, containerWidth]);

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-panel/25 p-6 text-center" style={{ minHeight: 200 }}>
        <Layers className="h-10 w-10 text-muted/30" />
        <div className="text-sm font-medium text-muted">Belum ada posisi portofolio</div>
        <p className="max-w-sm text-xs text-muted">Data portofolio akan tampil saat investor memiliki kepemilikan saham.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="rounded-2xl border border-border bg-panel/35 p-4" style={{ width: "100%" }}>
      {/* ── Stacked Horizontal Bar ── */}
      <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-muted">Proporsi Portofolio</div>
      <div className="relative mb-4 flex h-8 overflow-hidden rounded-full bg-panel-2/55">
        {sorted.map((pos, idx) => {
          const widthPct = totalPct > 0 ? (pos.percentage / totalPct) * 100 : 0;
          if (widthPct < 0.3) return null;
          return (
            <div
              key={`bar:${pos.investorId}:${pos.issuerId}`}
              className="relative h-full transition-opacity"
              style={{
                width: `${widthPct}%`,
                backgroundColor: colorForIndex(idx),
                opacity: hoveredIdx === null || hoveredIdx === idx ? 0.82 : 0.35,
              }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {widthPct > 5 && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white">
                  {pos.shareCode}
                </span>
              )}
              {hoveredIdx === idx && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-teal/20 bg-panel px-3 py-1.5 text-xs shadow-panel">
                  <span className="font-mono font-semibold text-teal">{pos.shareCode}</span>
                  <span className="mx-1 text-muted">|</span>
                  <span className="font-mono text-foreground">{fmtPercent(pos.percentage)}</span>
                  <span className="mx-1 text-muted">|</span>
                  <span className="font-mono text-muted">{fmtNumber(pos.shares)} shares</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Treemap ── */}
      <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-muted">Treemap Portofolio</div>
      <div className="relative overflow-hidden rounded-xl" style={{ width: containerWidth - 16, height: 300 }}>
        {treemapRects.map((rect) => (
          <button
            key={`tree:${rect.position.investorId}:${rect.position.issuerId}`}
            type="button"
            onClick={() => onSelectPosition(rect.position)}
            className="absolute flex flex-col items-center justify-center overflow-hidden rounded-md border border-white/20 transition-all hover:z-10 hover:scale-[1.02] hover:shadow-lg"
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.h,
              backgroundColor: rect.color,
              opacity: 0.8,
            }}
            title={`${rect.position.shareCode} — ${fmtPercent(rect.position.percentage)}`}
          >
            {rect.w > 48 && (
              <span className="font-mono text-[11px] font-semibold text-white">{rect.position.shareCode}</span>
            )}
            {rect.w > 64 && rect.h > 40 && (
              <span className="text-[9px] text-white/70">{fmtPercent(rect.position.percentage)}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Legend ── */}
      <div className="mt-3 flex flex-wrap gap-2">
        {sorted.slice(0, 12).map((pos, idx) => (
          <div key={`legend:${pos.issuerId}`} className="flex items-center gap-1 text-[11px] text-muted">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colorForIndex(idx) }} />
            <span className="font-mono text-foreground">{pos.shareCode}</span>
            <span>{fmtPercent(pos.percentage)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
