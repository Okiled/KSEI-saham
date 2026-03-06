import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Trophy, Building2, User, Globe2 } from "lucide-react";
import type { LocalForeign, OwnershipRow } from "../types/ownership";
import { getInvestorId } from "../lib/graph";
import { truncate, formatInvestorType, formatLocalForeign } from "../lib/utils";

type TopInvestorRankingProps = {
  rows: OwnershipRow[];
};

type InvestorStats = {
  id: string;
  name: string;
  type: string | null;
  localForeign: LocalForeign;
  nationality: string | null;
  issuerCount: number;
  totalPercentage: number;
};

export function TopInvestorRanking({ rows }: TopInvestorRankingProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const ranking = useMemo(() => {
    const map = new Map<string, { set: Set<string>; totalPct: number; row: OwnershipRow }>();

    for (const row of rows) {
      const id = getInvestorId(row);
      if (!map.has(id)) {
        map.set(id, { set: new Set(), totalPct: 0, row });
      }
      const entry = map.get(id)!;
      entry.set.add(row.shareCode);
      entry.totalPct += row.percentage ?? 0;
    }

    const stats: InvestorStats[] = Array.from(map.entries()).map(([id, data]) => ({
      id,
      name: data.row.investorName,
      type: data.row.investorType,
      localForeign: data.row.localForeign,
      nationality: data.row.nationality,
      issuerCount: data.set.size,
      totalPercentage: data.totalPct,
    }));

    return stats.sort((a, b) => b.issuerCount - a.issuerCount).slice(0, 50); // Top 50
  }, [rows]);

  return (
    <div className="rounded-2xl border border-border bg-panel/35 p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-foreground">
          <Trophy className="h-4 w-4 text-gold" />
          Top Investors di BEI
        </h3>
        <span className="text-xs font-mono text-muted">Berdasarkan jumlah emiten (Top 1% Holder)</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border/50 text-xs text-muted">
              <th className="pb-2 font-medium">Rank</th>
              <th className="pb-2 font-medium">Investor</th>
              <th className="pb-2 font-medium">Tipe</th>
              <th className="pb-2 text-right font-medium">Emiten</th>
              <th className="pb-2 text-right font-medium">Kumulatif %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {ranking.map((investor, idx) => {
              const Icon = investor.type === "IND" ? User : Building2;
              const isAsing = investor.localForeign === "A";
              const isLokal = investor.localForeign === "L";

              return (
                <tr key={investor.id} className="transition-colors hover:bg-white/5">
                  <td className="py-2.5 pr-2 font-mono text-xs text-muted">#{idx + 1}</td>
                  <td className="py-2.5 pr-2">
                    <button
                      type="button"
                      onClick={() => {
                        const next = new URLSearchParams(searchParams);
                        next.delete("emiten");
                        next.set("investor", investor.id);
                        setSearchParams(next);
                      }}
                      className="group flex w-full text-left items-center gap-2 hover:text-teal transition-colors"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground group-hover:underline">
                          {truncate(investor.name, 40)}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-muted">
                          <Icon className="h-3 w-3" />
                          <span title={investor.type || "UNKNOWN"}>
                            {formatInvestorType(investor.type)}
                          </span>
                        </span>
                      </div>
                    </button>
                  </td>
                  <td className="py-2.5 pr-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        isAsing ? "bg-gold/10 text-gold border border-gold/20" : isLokal ? "bg-teal/10 text-teal border border-teal/20" : "bg-panel-2 text-muted-foreground border border-border"
                      }`}
                    >
                      {isAsing ? <Globe2 className="h-3 w-3" /> : null}
                      {formatLocalForeign(investor.localForeign)}
                      {investor.nationality ? ` (${investor.nationality})` : ""}
                    </span>
                  </td>
                  <td className="py-2.5 text-right font-mono font-medium text-foreground">
                    {investor.issuerCount}
                  </td>
                  <td className="py-2.5 text-right font-mono text-xs text-muted">
                    {investor.totalPercentage.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
