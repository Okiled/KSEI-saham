import { useMemo, useState } from "react";
import { Search, Info, Users, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { OwnershipRow } from "../types/ownership";
import { getInvestorId } from "../lib/graph";
import { fmtPercent } from "../lib/utils";

type SyndicateIntersectPanelProps = {
  allRows: OwnershipRow[];
};

export function SyndicateIntersectPanel({ allRows }: SyndicateIntersectPanelProps) {
  const [ticker1, setTicker1] = useState("");
  const [ticker2, setTicker2] = useState("");
  const [ticker3, setTicker3] = useState("");

  const latestDate = useMemo(() => {
    if (allRows.length === 0) return null;
    return allRows.reduce((latest, row) => (row.date > latest ? row.date : latest), allRows[0].date);
  }, [allRows]);

  const intersection = useMemo(() => {
    const t1 = ticker1.trim().toUpperCase();
    const t2 = ticker2.trim().toUpperCase();
    const t3 = ticker3.trim().toUpperCase();
    
    const targets = [t1, t2, t3].filter(t => t.length > 0);
    if (targets.length < 2) return null; // Need at least 2 to intersect

    // Filter to latest snapshot
    const currentRows = allRows.filter(r => r.date === latestDate);

    // Group by investor
    const investorMap = new Map<string, { investorName: string; holdings: Record<string, number> }>();

    for (const bg of targets) {
      const issuerRows = currentRows.filter(r => r.shareCode === bg);
      for (const row of issuerRows) {
        const invId = getInvestorId(row);
        if (!investorMap.has(invId)) {
          investorMap.set(invId, { investorName: row.investorName, holdings: {} });
        }
        investorMap.get(invId)!.holdings[bg] = row.percentage ?? 0;
      }
    }

    // Find intersection (must hold ALL target tickers)
    const result = Array.from(investorMap.entries()).filter(([_, data]) => {
      return targets.every(t => data.holdings[t] !== undefined);
    }).map(([id, data]) => ({
      investorId: id,
      investorName: data.investorName,
      holdings: data.holdings,
      totalWeight: Object.values(data.holdings).reduce((a, b) => a + b, 0)
    })).sort((a, b) => b.totalWeight - a.totalWeight);

    return { targets, result };
  }, [allRows, latestDate, ticker1, ticker2, ticker3]);

  return (
    <section className="space-y-4">
      <div className="section-title">Syndicate Intersect Engine</div>
      <p className="pl-[15px] text-sm text-muted">
        Masukkan 2 atau 3 kode saham (ticker) yang dicurigai digerakkan oleh sindikat yang sama. 
        Engine akan mendeteksi investor / nominee yang memegang saham di seluruh emiten tersebut secara bersamaan.
      </p>

      <div className="grid gap-4 md:grid-cols-4 items-end rounded-2xl border border-border bg-panel-2/45 p-6">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">Ticker 1</span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted/50" />
            <input 
              value={ticker1} 
              onChange={e => setTicker1(e.target.value)} 
              placeholder="Misal: BRPT" 
              className="h-10 w-full rounded-xl border border-border bg-panel pl-9 pr-3 text-sm text-foreground outline-none uppercase font-mono transition-colors focus:border-teal/50" 
            />
          </div>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">Ticker 2</span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted/50" />
            <input 
              value={ticker2} 
              onChange={e => setTicker2(e.target.value)} 
              placeholder="Misal: CUAN" 
              className="h-10 w-full rounded-xl border border-border bg-panel pl-9 pr-3 text-sm text-foreground outline-none uppercase font-mono transition-colors focus:border-teal/50" 
            />
          </div>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">Ticker 3 (Opsional)</span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted/50" />
            <input 
              value={ticker3} 
              onChange={e => setTicker3(e.target.value)} 
              placeholder="Misal: PTRO" 
              className="h-10 w-full rounded-xl border border-border bg-panel pl-9 pr-3 text-sm text-foreground outline-none uppercase font-mono transition-colors focus:border-teal/50" 
            />
          </div>
        </label>
        
        <div className="flex h-10 items-center justify-center rounded-xl bg-teal/10 border border-teal/20 text-teal text-sm font-semibold">
          <span className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4" /> Analyse
          </span>
        </div>
      </div>

      {!intersection ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center opacity-70">
          <Info className="h-8 w-8 text-muted/50 mb-3" />
          <div className="text-sm font-medium text-muted">Masukkan minimal 2 ticker untuk mulai mendeteksi irisan sindikat.</div>
        </div>
      ) : intersection.result.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-rose/30 bg-rose/5 p-12 text-center">
          <Users className="h-8 w-8 text-rose/50 mb-3" />
          <div className="text-sm font-medium text-rose">Tidak ada irisan holder</div>
          <p className="mt-1 text-xs text-rose/70">Tidak ditemukan investor (≥1%) yang memegang {intersection.targets.join(" + ")} secara bersamaan pada {latestDate}.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-panel/45 overflow-hidden">
          <div className="p-4 border-b border-border bg-panel-2/30 flex justify-between items-center">
            <div className="text-sm font-semibold text-foreground">
              <span className="text-teal">{intersection.result.length}</span> Entitas Ditemukan
            </div>
            <div className="text-xs text-muted flex gap-2">
              {intersection.targets.map(t => (
                <span key={t} className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 font-mono">{t}</span>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-white/5 bg-black/20 text-xs font-semibold uppercase tracking-wider text-muted">
                  <th className="px-5 py-3 font-medium">Nama Emiten / Nominee</th>
                  {intersection.targets.map(t => (
                    <th key={t} className="px-5 py-3 font-medium text-right">{t} %</th>
                  ))}
                  <th className="px-5 py-3 font-medium text-right text-teal">Agregat %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {intersection.result.map(row => (
                  <tr key={row.investorId} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <Link to={`?investor=${encodeURIComponent(row.investorId)}`} className="font-medium text-foreground hover:text-teal transition-colors focus:outline-none">
                        {row.investorName}
                      </Link>
                    </td>
                    {intersection.targets.map(t => (
                      <td key={t} className="px-5 py-3 text-right font-mono text-muted">
                        {fmtPercent(row.holdings[t])}
                      </td>
                    ))}
                    <td className="px-5 py-3 text-right font-mono font-medium text-teal">
                      {fmtPercent(row.totalWeight)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
