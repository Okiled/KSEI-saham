import { useEffect, useMemo, useRef, useState } from "react";
import { GitBranch } from "lucide-react";
import { fmtPercent, truncate } from "../lib/utils";

export type SankeyHolder = {
  investorId: string;
  investorName: string;
  localForeign: "L" | "A" | null;
  percentage: number;
  shares: number;
};

type OwnershipSankeyL2RProps = {
  issuerLabel: string;
  holders: SankeyHolder[];
  onSelectInvestor: (investorId: string) => void;
};

type CategoryKey = "L" | "A" | "U";

const CATEGORY_COLORS: Record<CategoryKey, string> = {
  L: "#0a8c6e",
  A: "#c47c1a",
  U: "#8a8580",
};

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  L: "Lokal",
  A: "Asing",
  U: "Unknown",
};

const MIN_HEIGHT = 560;
const HOLDER_SLOT = 26;
const CAT_NODE_H = 52;
const CENTER_H = 72;
const CENTER_W = 240;

export function OwnershipSankeyL2R({ issuerLabel, holders, onSelectInvestor }: OwnershipSankeyL2RProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 100) setWidth(w);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const limitedHolders = useMemo(() => {
    const groupOrder = (lf: "L" | "A" | null) => (lf === "L" ? 0 : lf === "A" ? 1 : 2);
    return [...holders]
      .sort((a, b) => groupOrder(a.localForeign) - groupOrder(b.localForeign) || b.percentage - a.percentage || b.shares - a.shares)
      .slice(0, 24);
  }, [holders]);

  const height = Math.max(MIN_HEIGHT, limitedHolders.length * HOLDER_SLOT + 100);

  // Fixed right panel width to keep labels compact and avoid massive gaps on large screens
  const holderX = width > 400 ? width - 280 : width - 200;

  const catX = 16;
  const catNodeW = 130;
  const centerX = width / 2 - CENTER_W / 2;
  const centerY = height / 2 - CENTER_H / 2;

  const { categoryNodes, holderNodes } = useMemo(() => {
    const grouped = new Map<CategoryKey, SankeyHolder[]>();
    grouped.set("L", []);
    grouped.set("A", []);
    grouped.set("U", []);
    for (const h of limitedHolders) {
      const key: CategoryKey = h.localForeign === "L" ? "L" : h.localForeign === "A" ? "A" : "U";
      grouped.get(key)!.push(h);
    }

    const activeCategories = (["L", "A", "U"] as CategoryKey[]).filter(
      (k) => (grouped.get(k)?.length ?? 0) > 0,
    );
    const catSpacing = Math.min(140, (height - 80) / Math.max(1, activeCategories.length));

    const cats = activeCategories.map((key, index) => {
      const items = grouped.get(key) ?? [];
      const totalPct = items.reduce((s, item) => s + item.percentage, 0);
      const y = 50 + index * catSpacing;
      return { key, x: catX, y, w: catNodeW, h: CAT_NODE_H, totalPct, holders: items };
    });

    const nodes = limitedHolders.map((h, index) => ({
      ...h,
      x: holderX,
      y: 36 + index * HOLDER_SLOT,
    }));

    return { categoryNodes: cats, holderNodes: nodes };
  }, [limitedHolders, height, holderX]);

  if (limitedHolders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-panel/25 p-6 text-center" style={{ minHeight: MIN_HEIGHT }}>
        <GitBranch className="h-10 w-10 text-muted/30" />
        <div className="text-sm font-medium text-muted">Struktur ownership belum tersedia</div>
        <p className="max-w-sm text-xs text-muted">Sankey diagram akan tampil saat data holder tersedia untuk emiten ini.</p>
      </div>
    );
  }

  const centerMidX = centerX + CENTER_W / 2;
  const centerMidY = centerY + CENTER_H / 2;

  // Animate path draw via a CSS class + inline style
  const drawStyle = (delay: number, dashLen = 1200): React.CSSProperties => ({
    strokeDasharray: dashLen,
    strokeDashoffset: dashLen,
    animation: `sankeyDraw 1s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms forwards`,
  });

  const fadeStyle = (delay: number): React.CSSProperties => ({
    opacity: 0,
    animation: `sankeyFade 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms forwards`,
  });

  return (
    <div ref={containerRef} className="rounded-2xl border border-border bg-panel/35 p-2 overflow-x-auto" style={{ width: "100%", minHeight: `${MIN_HEIGHT}px` }}>
      {/* Keyframes defined in index.css */}
      <svg width={width} height={height} style={{ overflow: "visible" }}>
        {/* ── Flows: Category → Center → Holder ── */}
        {categoryNodes.flatMap((cat, catIdx) =>
          cat.holders.map((holder, holderIdx) => {
            const holderNode = holderNodes.find((n) => n.investorId === holder.investorId);
            if (!holderNode) return null;
            const catMidY = cat.y + cat.h / 2;
            const catRight = cat.x + cat.w;
            const controlOffset = (centerX - catRight) * 0.4;
            const catWeight = Math.max(1, Math.min(16, cat.totalPct * 0.06));
            const color = CATEGORY_COLORS[cat.key];

            // Category → Center path
            const catPath = `M ${catRight} ${catMidY} C ${catRight + controlOffset} ${catMidY}, ${centerX - controlOffset} ${centerMidY}, ${centerX} ${centerMidY}`;

            // Center → Holder path
            const holderY = holderNode.y + HOLDER_SLOT / 2;
            const centerRight = centerX + CENTER_W;
            const controlOffset2 = (holderNode.x - centerRight) * 0.4;
            const holderWeight = Math.max(1.5, Math.min(14, holder.percentage * 0.7));
            const holderPath = `M ${centerRight} ${centerMidY} C ${centerRight + controlOffset2} ${centerMidY}, ${holderNode.x - controlOffset2} ${holderY}, ${holderNode.x} ${holderY}`;

            const delay1 = catIdx * 120;
            const delay2 = 300 + holderIdx * 40;

            return (
              <g key={`flow:${cat.key}:${holder.investorId}`}>
                <path d={catPath} fill="none" stroke={color} strokeWidth={catWeight} opacity={0.13} style={drawStyle(delay1)} />
                <path d={holderPath} fill="none" stroke={color} strokeWidth={holderWeight} opacity={0.28} strokeLinecap="round" style={drawStyle(delay2)} />
              </g>
            );
          }),
        )}

        {/* ── Category Nodes ── */}
        {categoryNodes.map((node, idx) => {
          const color = CATEGORY_COLORS[node.key];
          return (
            <g key={`cat:${node.key}`} style={fadeStyle(idx * 100)}>
              <rect x={node.x} y={node.y} width={node.w} height={node.h} rx={10} fill={color} opacity={0.12} />
              <rect x={node.x} y={node.y} width={node.w} height={node.h} rx={10} fill="none" stroke={color} strokeWidth={1.5} opacity={0.45} />
              <text x={node.x + node.w / 2} y={node.y + 20} textAnchor="middle" style={{ fontSize: 13, fontFamily: "DM Mono", fontWeight: 600, fill: color }}>
                {CATEGORY_LABELS[node.key]}
              </text>
              <text x={node.x + node.w / 2} y={node.y + 38} textAnchor="middle" style={{ fontSize: 12, fontFamily: "DM Mono", fill: color, opacity: 0.7 }}>
                {fmtPercent(node.totalPct)}
              </text>
            </g>
          );
        })}

        {/* ── Center Node (Emiten) ── */}
        <g style={fadeStyle(150)}>
          <rect x={centerX} y={centerY} width={CENTER_W} height={CENTER_H} rx={14} fill="rgba(10,140,110,0.08)" />
          <rect x={centerX} y={centerY} width={CENTER_W} height={CENTER_H} rx={14} fill="none" stroke="rgba(10,140,110,0.4)" strokeWidth={1.5} />
          <text x={centerMidX} y={centerMidY - 4} textAnchor="middle" style={{ fontSize: 17, fontFamily: "DM Mono", fontWeight: 700, fill: "#0a8c6e" }}>
            {truncate(issuerLabel, 20)}
          </text>
          <text x={centerMidX} y={centerMidY + 16} textAnchor="middle" style={{ fontSize: 11, fill: "#8a8580" }}>Emiten</text>
        </g>

        {/* ── Holder Nodes ── */}
        {holderNodes.map((holder, idx) => {
          const color = CATEGORY_COLORS[holder.localForeign === "L" ? "L" : holder.localForeign === "A" ? "A" : "U"];
          const midY = holder.y + HOLDER_SLOT / 2;
          return (
            <g key={`holder:${holder.investorId}`} onClick={() => onSelectInvestor(holder.investorId)} className="cursor-pointer" role="button" style={fadeStyle(400 + idx * 30)}>
              <circle cx={holder.x} cy={midY} r={4.5} fill={color} />
              <text x={holder.x + 12} y={midY + 4} style={{ fontSize: 11.5, fontWeight: 500, fill: "rgb(var(--text-primary))" }}>
                {truncate(holder.investorName, 30)}
              </text>
              <text x={holder.x + 260} y={midY + 4} textAnchor="end" style={{ fontSize: 11, fontFamily: "DM Mono", fontWeight: 600, fill: color }}>
                {fmtPercent(holder.percentage)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
