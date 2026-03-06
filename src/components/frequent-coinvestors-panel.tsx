import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Network, Users } from "lucide-react";
import type { OwnershipRow } from "../types/ownership";
import { getInvestorId, getIssuerId } from "../lib/graph";
import { truncate, formatInvestorType } from "../lib/utils";

type FrequentCoinvestorsPanelProps = {
  currentInvestorId: string;
  allRows: OwnershipRow[];
};

export function FrequentCoinvestorsPanel({ currentInvestorId, allRows }: FrequentCoinvestorsPanelProps) {
  const coinvestors = useMemo(() => {
    // 1. Find all issuers held by current investor
    const targetIssuers = new Set<string>();
    
    for (const row of allRows) {
      if (getInvestorId(row) === currentInvestorId) {
        targetIssuers.add(getIssuerId(row));
      }
    }

    if (targetIssuers.size === 0) return [];

    // 2. Find all other investors in those same issuers
    const matchCounts = new Map<string, { count: number; name: string; type: string | null; overlapIssuers: string[] }>();
    
    for (const row of allRows) {
      const invId = getInvestorId(row);
      if (invId === currentInvestorId) continue;
      
      const issId = getIssuerId(row);
      if (targetIssuers.has(issId)) {
        if (!matchCounts.has(invId)) {
          matchCounts.set(invId, { count: 0, name: row.investorName, type: row.investorType, overlapIssuers: [] });
        }
        const data = matchCounts.get(invId)!;
        data.count += 1;
        data.overlapIssuers.push(row.shareCode);
      }
    }

    // 3. Filter for meaningful overlaps (e.g. they appear together in multiple issuers)
    // If the target investor only has 1 issuer, we just show the top co-investors in that 1 issuer.
    // If they have >= 2, we strongly rank those who co-invest in >= 2.
    const threshold = targetIssuers.size >= 2 ? 2 : 1;
    
    return Array.from(matchCounts.entries())
      .filter(([_, data]) => data.count >= threshold)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8); // Top 8 highest conviction
      
  }, [allRows, currentInvestorId]);

  if (coinvestors.length === 0) return null;

  return (
    <div className="mt-8 rounded-2xl border border-border bg-panel/35 p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-violet" />
          <h3 className="text-lg font-semibold text-foreground">Dugaan Afiliasi & Frequent Co-investors</h3>
        </div>
        <span className="text-xs font-mono text-muted">Investor yang sering muncul bersamaan</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {coinvestors.map((match) => (
          <Link
            key={match.id}
            to={`/investor/${encodeURIComponent(match.id)}`}
            className="group block rounded-xl border border-border/50 bg-white/5 p-4 transition-all hover:border-violet/30 hover:bg-violet/5"
          >
            <div className="flex items-center justify-between mb-2">
              <Users className="h-4 w-4 text-muted group-hover:text-violet transition-colors" />
              <div className="rounded-full bg-border/50 px-2 py-0.5 text-[10px] font-mono font-medium text-muted">
                {match.count} Irisan
              </div>
            </div>
            
            <div className="mb-1 text-sm font-semibold leading-tight text-foreground transition-colors group-hover:text-violet">
              {truncate(match.name, 35)}
            </div>
            <div className="text-[10px] text-muted" title={match.type ?? "UNKNOWN"}>
              {formatInvestorType(match.type)}
            </div>
            
            <div className="mt-3 flex flex-wrap gap-1">
              {match.overlapIssuers.slice(0, 4).map((ticker) => (
                <span key={ticker} className="rounded border border-border/30 bg-black/20 px-1.5 py-0.5 text-[9px] font-mono text-muted/80">
                  {ticker}
                </span>
              ))}
              {match.overlapIssuers.length > 4 && (
                <span className="rounded border border-border/30 bg-black/20 px-1.5 py-0.5 text-[9px] font-mono text-muted/80">
                  +{match.overlapIssuers.length - 4}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
