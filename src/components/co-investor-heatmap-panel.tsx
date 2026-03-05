import { useMemo, useState } from "react";
import { Grid3X3 } from "lucide-react";
import { truncate } from "../lib/utils";
import type { CoInvestorOverlapCell, CoInvestorOverlapView } from "../types/ownership";

type CoInvestorHeatmapPanelProps = {
  overlap: CoInvestorOverlapView | null;
  onSelectInvestor: (investorId: string) => void;
  onSelectIssuer: (issuerId: string) => void;
};



function intensityColor(value: number, max: number, isDiagonal: boolean): string {
  if (isDiagonal) {
    // Diagonal = portfolio breadth, use a blue-gray tone
    const ratio = Math.max(0, Math.min(1, value / Math.max(1, max)));
    const alpha = 0.15 + ratio * 0.4;
    return `rgba(37, 99, 168, ${alpha})`;
  }
  if (value === 0) return "rgba(250, 248, 244, 1)"; // white for 0
  if (max <= 0) return "rgba(250, 248, 244, 1)";
  const ratio = Math.max(0, Math.min(1, value / max));
  // Scale from light teal to dark teal
  const r = Math.round(240 - ratio * 230);
  const g = Math.round(248 - ratio * 108);
  const b = Math.round(244 - ratio * 134);
  return `rgb(${r}, ${g}, ${b})`;
}

export function CoInvestorHeatmapPanel({ overlap, onSelectInvestor, onSelectIssuer }: CoInvestorHeatmapPanelProps) {
  const [activeCell, setActiveCell] = useState<CoInvestorOverlapCell | null>(null);

  const prepared = useMemo(() => {
    if (!overlap) return null;
    // For maxCount, exclude diagonal (same investor = portfolio breadth)
    const offDiagonalCounts = overlap.cells
      .filter((cell) => cell.investorAId !== cell.investorBId)
      .map((cell) => cell.commonIssuerCount);
    const maxOffDiagonal = Math.max(1, ...offDiagonalCounts);
    const maxDiagonal = Math.max(1, ...overlap.cells.filter((c) => c.investorAId === c.investorBId).map((c) => c.commonIssuerCount));
    const matrix = new Map<string, CoInvestorOverlapCell>();
    for (const cell of overlap.cells) {
      matrix.set(`${cell.investorAId}:${cell.investorBId}`, cell);
    }
    return { maxOffDiagonal, maxDiagonal, matrix };
  }, [overlap]);

  if (!overlap || !prepared) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-panel/35 p-6 text-center">
        <Grid3X3 className="h-10 w-10 text-muted/30" />
        <div className="text-sm font-medium text-muted">Heatmap overlap belum tersedia</div>
        <p className="max-w-sm text-xs text-muted">
          Heatmap co-investor akan tampil saat emiten memiliki data holder yang cukup.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-panel/35 p-4">
      <div className="mb-3 overflow-auto">
        <table className="min-w-[780px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[180px] bg-panel-2/85 p-2 text-left font-medium text-muted">Holder</th>
              {overlap.holderIds.map((holderId) => (
                <th key={`h-col:${holderId}`} className="min-w-[72px] p-2 text-center">
                  <button
                    type="button"
                    onClick={() => onSelectInvestor(holderId)}
                    className="rounded px-1 py-0.5 text-[11px] text-muted transition-colors hover:bg-teal/10 hover:text-teal"
                    title={overlap.holderNamesById[holderId]}
                  >
                    {truncate(overlap.holderNamesById[holderId] ?? holderId, 10)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {overlap.holderIds.map((rowHolderId) => (
              <tr key={`row:${rowHolderId}`}>
                <th className="sticky left-0 z-10 bg-panel-2/85 p-2 text-left">
                  <button
                    type="button"
                    onClick={() => onSelectInvestor(rowHolderId)}
                    className="rounded px-1 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-teal/10 hover:text-teal"
                    title={overlap.holderNamesById[rowHolderId]}
                  >
                    {truncate(overlap.holderNamesById[rowHolderId] ?? rowHolderId, 24)}
                  </button>
                </th>
                {overlap.holderIds.map((colHolderId) => {
                  const cell = prepared.matrix.get(`${rowHolderId}:${colHolderId}`);
                  const count = cell?.commonIssuerCount ?? 0;
                  const isDiag = rowHolderId === colHolderId;
                  return (
                    <td key={`cell:${rowHolderId}:${colHolderId}`} className="p-1">
                      <button
                        type="button"
                        onClick={() => setActiveCell(cell ?? null)}
                        className="h-9 w-16 rounded border border-border/40 font-mono text-[11px] font-medium transition-all duration-150 ease-expo-out hover:z-10 hover:scale-[1.08] hover:brightness-110 hover:shadow-sm"
                        style={{
                          backgroundColor: intensityColor(count, isDiag ? prepared.maxDiagonal : prepared.maxOffDiagonal, isDiag),
                          color: count > (isDiag ? prepared.maxDiagonal * 0.5 : prepared.maxOffDiagonal * 0.5) ? "white" : "rgb(var(--text-primary))",
                        }}
                        title={isDiag ? `Portfolio: ${count} emiten` : `Overlap ${count} emiten`}
                      >
                        {count}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Legend ── */}
      <div className="mb-3 flex items-center gap-4 text-[11px] text-muted">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-8 rounded-sm" style={{ background: "linear-gradient(to right, #faf8f4, #0a8c6e)" }} />
          <span>Overlap: putih=0, semakin gelap=semakin banyak emiten bersama</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-blue/30" />
          <span>Diagonal = total emiten yang dipegang investor</span>
        </div>
      </div>

      {activeCell ? (
        <div className="rounded-xl border border-teal/20 bg-teal/5 p-3">
          <div className="mb-1 text-sm font-semibold text-foreground">
            {activeCell.investorAId === activeCell.investorBId
              ? `${activeCell.investorAName} — portfolio breadth`
              : `${activeCell.investorAName} × ${activeCell.investorBName}`}
          </div>
          <div className="mb-2 text-xs text-muted">
            {activeCell.investorAId === activeCell.investorBId
              ? `Total ${activeCell.commonIssuerCount} emiten`
              : `Overlap ${activeCell.commonIssuerCount} emiten | Weighted ${activeCell.weightedOverlap.toFixed(2)}`}
          </div>
          <div className="flex flex-wrap gap-2">
            {activeCell.commonIssuers.slice(0, 12).map((issuer) => (
              <button
                key={`${activeCell.investorAId}:${activeCell.investorBId}:${issuer.issuerId}`}
                type="button"
                onClick={() => onSelectIssuer(issuer.issuerId)}
                className="rounded-full border border-teal/20 bg-teal/5 px-2.5 py-0.5 font-mono text-[11px] font-medium text-teal transition-colors hover:bg-teal/15"
              >
                {issuer.shareCode}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
