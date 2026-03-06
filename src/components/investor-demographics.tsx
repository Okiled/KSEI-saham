import { useMemo } from "react";
import { Globe2 } from "lucide-react";
import type { OwnershipRow } from "../types/ownership";

type InvestorDemographicsProps = {
  rows: OwnershipRow[];
};

export function InvestorDemographics({ rows }: InvestorDemographicsProps) {
  const demographics = useMemo(() => {
    // Only look at foreign investors. We want to weight by issuer count (or percentage, but count is simpler to understand as "activeness")
    const foreignRows = rows.filter((r) => r.localForeign === "A" && r.nationality);
    
    // Total unique foreign investors
    const uniqueForeign = new Set(foreignRows.map(r => r.investorName)).size;
    if (uniqueForeign === 0) return [];

    const map = new Map<string, Set<string>>();
    for (const row of foreignRows) {
      const country = row.nationality!.toUpperCase();
      if (!map.has(country)) {
        map.set(country, new Set());
      }
      map.get(country)!.add(row.investorName); 
    }

    const stats = Array.from(map.entries()).map(([country, investors]) => ({
      country,
      count: investors.size,
      percentage: (investors.size / uniqueForeign) * 100,
    }));

    return stats.sort((a, b) => b.count - a.count).slice(0, 10);
  }, [rows]);

  if (demographics.length === 0) return null;

  const maxCount = Math.max(...demographics.map((d) => d.count), 1);

  return (
    <div className="rounded-2xl border border-border bg-panel/35 p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-foreground">
          <Globe2 className="h-4 w-4 text-cyan" />
          Demografi Asing
        </h3>
        <span className="text-xs font-mono text-muted">Berdasarkan Negara Asal (Top 10)</span>
      </div>

      <div className="space-y-3">
        {demographics.map((item) => (
          <div key={item.country} className="space-y-1">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-foreground">{item.country}</span>
              <span className="text-muted">{item.count} Investor ({item.percentage.toFixed(1)}%)</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan/40 to-cyan/80 transition-all duration-500"
                style={{ width: `${(item.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
