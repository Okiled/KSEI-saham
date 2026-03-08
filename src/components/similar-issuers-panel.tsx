import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight } from "lucide-react";
import type { UniverseIssuerItem } from "../lib/ownership-analytics";
import { fmtPercent } from "../lib/utils";

type SimilarIssuersPanelProps = {
  currentIssuerId: string;
  allIssuers: UniverseIssuerItem[];
};

export function SimilarIssuersPanel({ currentIssuerId, allIssuers }: SimilarIssuersPanelProps) {
  const similar = useMemo(() => {
    const current = allIssuers.find((i) => i.issuerId === currentIssuerId);
    if (!current) return [];

    // Distance function using HHI, Local Ratio, and Free Float
    const score = (other: UniverseIssuerItem) => {
      const hhiDiff = Math.abs(current.hhi - other.hhi) / 10000; // Normalize 0-1
      const localDiff = Math.abs(current.localPct - other.localPct) / 100;
      const ffDiff = Math.abs(current.freeFloatPct - other.freeFloatPct) / 100;
      
      // We weight HHI slightly higher since it defines the structural shape
      return (hhiDiff * 1.5) + localDiff + ffDiff;
    };

    return allIssuers
      .filter((i) => i.issuerId !== currentIssuerId && i.holderCount > 0)
      .map((i) => ({ issuer: i, distance: score(i) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4); // Top 4 matches
  }, [allIssuers, currentIssuerId]);

  if (similar.length === 0) return null;

  return (
    <div className="mt-8 rounded-2xl border border-border bg-panel/35 p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-5 w-5 text-teal" />
        <h3 className="text-lg font-semibold text-foreground">Emiten dengan Struktur Kepemilikan Serupa</h3>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {similar.map((match) => (
          <Link
            key={match.issuer.issuerId}
            to={`/emiten/${encodeURIComponent(match.issuer.shareCode || match.issuer.issuerId.replace(/^issuer:/, ""))}`}
            className="group flex flex-col justify-between rounded-xl border border-border/50 bg-white/5 p-4 transition-all hover:border-teal/30 hover:bg-teal/5"
          >
            <div>
              <div className="flex items-start justify-between">
                <div className="font-mono text-lg font-bold text-foreground transition-colors group-hover:text-teal">
                  {match.issuer.issuerId.split(":")[1]}
                </div>
                <ArrowRight className="h-4 w-4 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted">HHI</span>
                  <span className="font-mono text-foreground">{match.issuer.hhi.toFixed(0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Lokal/Asing</span>
                  <span className="font-mono text-foreground">{match.issuer.localPct.toFixed(0)} / {(100 - match.issuer.localPct).toFixed(0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Free Float Est.</span>
                  <span className="font-mono text-foreground">{fmtPercent(match.issuer.freeFloatPct)}</span>
                </div>
              </div>
            </div>
            
            <div className="mt-3 pt-3 border-t border-border/50 text-[10px] text-muted italic">
              Distance Score: {match.distance.toFixed(3)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
