import { useEffect, useMemo, useRef, useState } from "react";
import { GitBranch } from "lucide-react";
import { fmtPercent } from "../lib/utils";
import type { InvestorPortfolioPosition } from "../types/ownership";

type InvestorSankeyProps = {
  investorName: string;
  positions: InvestorPortfolioPosition[];
  onSelectEmiten: (shareCode: string) => void;
};

const CATEGORY_COLORS: Record<string, string> = {
  L: "#0a8c6e",
  A: "#c47c1a",
  U: "#8a8580",
};

const MIN_HEIGHT = 440;
const EMITEN_SLOT = 28;

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1))}…`;
}

export function InvestorSankey({ investorName, positions, onSelectEmiten }: InvestorSankeyProps) {
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

  const sorted = useMemo(() => {
    const list = [...positions].sort((a, b) => {
      // Sort by category first: L -> A -> U
      const catOrder = { L: 1, A: 2, U: 3 };
      const aCat = a.localForeign === "L" ? "L" : a.localForeign === "A" ? "A" : "U";
      const bCat = b.localForeign === "L" ? "L" : b.localForeign === "A" ? "A" : "U";
      
      if (catOrder[aCat] !== catOrder[bCat]) {
        return catOrder[aCat] - catOrder[bCat];
      }
      
      // Then sort by percentage highest to lowest
      return b.percentage - a.percentage;
    });
    return list.slice(0, 20);
  }, [positions]);

  const height = Math.max(MIN_HEIGHT, sorted.length * EMITEN_SLOT + 100);
  const investorX = 16;
  const investorW = 200;
  const investorH = 60;
  const investorY = height / 2 - investorH / 2;
  const investorMidY = investorY + investorH / 2;

  // Fixed right panel width to keep labels compact rather than stretching across the screen
  const emitenX = width > 400 ? width - 340 : width - 200;

  const emitenNodes = useMemo(
    () => sorted.map((p, i) => ({ ...p, x: emitenX, y: 40 + i * EMITEN_SLOT })),
    [sorted, emitenX],
  );

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-panel/25 p-6 text-center" style={{ minHeight: 200 }}>
        <GitBranch className="h-10 w-10 text-muted/30" />
        <div className="text-sm font-medium text-muted">Belum ada posisi untuk divisualisasikan</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="rounded-2xl border border-border bg-panel/35 p-2 overflow-x-auto" style={{ width: "100%", minHeight: `${MIN_HEIGHT}px` }}>
      <svg width={width} height={height} style={{ overflow: "visible" }}>
        {/* ── Flows: Investor → Emiten ── */}
        {emitenNodes.map((node) => {
          const nodeY = node.y + EMITEN_SLOT / 2;
          const catKey = node.localForeign === "L" ? "L" : node.localForeign === "A" ? "A" : "U";
          const color = CATEGORY_COLORS[catKey];
          const pathWeight = Math.max(1.5, Math.min(12, node.percentage * 0.6));
          const rightX = investorX + investorW;
          const controlOffset = (node.x - rightX) * 0.4;
          const path = `M ${rightX} ${investorMidY} C ${rightX + controlOffset} ${investorMidY}, ${node.x - controlOffset} ${nodeY}, ${node.x} ${nodeY}`;
          return (
            <path
              key={`flow:${node.issuerId}`}
              d={path}
              fill="none"
              stroke={color}
              strokeWidth={pathWeight}
              opacity={0.28}
              strokeLinecap="round"
            />
          );
        })}

        {/* ── Investor Node (left) ── */}
        <rect x={investorX} y={investorY} width={investorW} height={investorH} rx={12} fill="rgba(10,140,110,0.08)" />
        <rect x={investorX} y={investorY} width={investorW} height={investorH} rx={12} fill="none" stroke="rgba(10,140,110,0.4)" strokeWidth={1.5} />
        <text x={investorX + investorW / 2} y={investorMidY - 2} textAnchor="middle" style={{ fontSize: 13, fontFamily: "DM Mono", fontWeight: 700, fill: "#0a8c6e" }}>
          {truncate(investorName, 22)}
        </text>
        <text x={investorX + investorW / 2} y={investorMidY + 16} textAnchor="middle" style={{ fontSize: 11, fill: "#8a8580" }}>
          Investor
        </text>

        {/* ── Emiten Nodes (right) ── */}
        {emitenNodes.map((node) => {
          const midY = node.y + EMITEN_SLOT / 2;
          const catKey = node.localForeign === "L" ? "L" : node.localForeign === "A" ? "A" : "U";
          const color = CATEGORY_COLORS[catKey];
          return (
            <g key={`emiten:${node.issuerId}`} onClick={() => onSelectEmiten(node.shareCode)} className="cursor-pointer" role="button">
              <circle cx={node.x} cy={midY} r={4} fill={color} />
              <text x={node.x + 10} y={midY + 4} style={{ fontSize: 11.5, fontWeight: 500, fill: "rgb(26,24,20)" }}>
                {truncate(node.issuerName, 26)}
              </text>
              <text x={node.x + 210} y={midY + 4} style={{ fontSize: 11, fontFamily: "DM Mono", fontWeight: 600, fill: color }}>
                {fmtPercent(node.percentage)}
              </text>
              <text x={node.x + 265} y={midY + 4} style={{ fontSize: 11, fontFamily: "DM Mono", fontWeight: 700, fill: "rgb(26,24,20)" }}>
                {node.shareCode}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
