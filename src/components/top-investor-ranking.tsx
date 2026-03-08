import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Globe2, Trophy, User } from "lucide-react";
import type { LocalForeign, OwnershipRow } from "../types/ownership";
import { getInvestorId } from "../lib/graph";
import { formatInvestorType, formatLocalForeign, truncate } from "../lib/utils";

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
  const navigate = useNavigate();

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

    const stats: InvestorStats[] = [...map.entries()].map(([id, data]) => ({
      id,
      name: data.row.investorName,
      type: data.row.investorType,
      localForeign: data.row.localForeign,
      nationality: data.row.nationality,
      issuerCount: data.set.size,
      totalPercentage: data.totalPct,
    }));

    return stats.sort((a, b) => b.issuerCount - a.issuerCount).slice(0, 50);
  }, [rows]);

  return (
    <div className="rounded-[22px] border border-[#D8CDBF] bg-[#FFFBF5] p-3.5 shadow-[0_14px_32px_rgba(95,73,47,0.07)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="h-4 w-0.5 bg-[#996737]" />
            <span className="text-xs uppercase tracking-[0.22em] text-[#7A6E63]">Breadth Ranking</span>
          </div>
          <h3 className="flex items-center gap-2 font-serif text-xl font-semibold tracking-[-0.03em] text-[#1C1713]">
            <Trophy className="h-4 w-4 text-[#996737]" />
            Top investors across IDX
          </h3>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#7A6E63]">By issuer count</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#E6DCCE] text-[11px] uppercase tracking-[0.18em] text-[#7A6E63]">
              <th className="pb-3 font-medium">Rank</th>
              <th className="pb-3 font-medium">Investor</th>
              <th className="pb-3 font-medium">Origin</th>
              <th className="pb-3 text-right font-medium">Emitens</th>
              <th className="pb-3 text-right font-medium">Cumulative %</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((investor, index) => {
              const Icon = investor.type === "IND" ? User : Building2;
              const tone =
                investor.localForeign === "A"
                  ? "border-[#C0D6CF] bg-[#EDF4F1] text-[#1D4C45]"
                  : investor.localForeign === "L"
                    ? "border-[#E7D2B3] bg-[#F8EEDC] text-[#996737]"
                    : "border-[#D8CDBF] bg-[#F7F0E6] text-[#665A4F]";

              return (
                <tr key={investor.id} className="border-b border-[#EEE3D6] transition-colors hover:bg-[#F6EEE2]">
                  <td className="py-3 pr-2 font-mono text-xs text-[#7A6E63]">#{index + 1}</td>
                  <td className="py-3 pr-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/investor/${encodeURIComponent(investor.id)}`)}
                      className="group flex w-full items-center gap-2 text-left"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-[#1C1713] transition-colors group-hover:text-[#1D4C45] group-hover:underline">
                          {truncate(investor.name, 40)}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-[10px] text-[#7A6E63]">
                          <Icon className="h-3 w-3" />
                          <span title={investor.type || "UNKNOWN"}>{formatInvestorType(investor.type)}</span>
                        </span>
                      </div>
                    </button>
                  </td>
                  <td className="py-3 pr-2">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${tone}`}>
                      {investor.localForeign === "A" ? <Globe2 className="h-3 w-3" /> : null}
                      {formatLocalForeign(investor.localForeign)}
                      {investor.nationality ? ` (${investor.nationality})` : ""}
                    </span>
                  </td>
                  <td className="py-3 text-right font-mono font-medium text-[#1C1713]">{investor.issuerCount}</td>
                  <td className="py-3 text-right font-mono text-xs text-[#665A4F]">
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
