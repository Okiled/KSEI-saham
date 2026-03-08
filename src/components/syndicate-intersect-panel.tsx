import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Info, Search, Users } from "lucide-react";
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
    const targets = [ticker1, ticker2, ticker3]
      .map((value) => value.trim().toUpperCase())
      .filter((value) => value.length > 0);

    if (targets.length < 2 || !latestDate) return null;

    const currentRows = allRows.filter((row) => row.date === latestDate);
    const investorMap = new Map<string, { investorName: string; holdings: Record<string, number> }>();

    for (const ticker of targets) {
      const issuerRows = currentRows.filter((row) => row.shareCode === ticker);
      for (const row of issuerRows) {
        const investorId = getInvestorId(row);
        if (!investorMap.has(investorId)) {
          investorMap.set(investorId, { investorName: row.investorName, holdings: {} });
        }
        investorMap.get(investorId)!.holdings[ticker] = row.percentage ?? 0;
      }
    }

    const result = [...investorMap.entries()]
      .filter(([, data]) => targets.every((ticker) => data.holdings[ticker] !== undefined))
      .map(([investorId, data]) => ({
        investorId,
        investorName: data.investorName,
        holdings: data.holdings,
        totalWeight: Object.values(data.holdings).reduce((sum, value) => sum + value, 0),
      }))
      .sort((a, b) => b.totalWeight - a.totalWeight);

    return { targets, result };
  }, [allRows, latestDate, ticker1, ticker2, ticker3]);

  return (
    <section className="space-y-4">
      <div className="mb-1 flex items-center gap-2">
        <div className="h-4 w-0.5 bg-[#996737]" />
        <span className="text-xs uppercase tracking-[0.22em] text-[#7A6E63]">Syndicate Intersect Engine</span>
      </div>
      <p className="pl-[15px] text-sm leading-7 text-[#665A4F]">
        Masukkan dua atau tiga ticker yang dicurigai bergerak dalam orbit holder yang sama. Engine ini
        mencari entitas yang muncul di semua emiten pada snapshot aktif.
      </p>

      <div className="grid items-end gap-4 rounded-[26px] border border-[#D8CDBF] bg-[linear-gradient(180deg,#FFF9F2_0%,#F6EEE2_100%)] p-5 md:grid-cols-4">
        {[ticker1, ticker2, ticker3].map((value, index) => {
          const setter = index === 0 ? setTicker1 : index === 1 ? setTicker2 : setTicker3;
          const label = index === 2 ? "Ticker 3 (Opsional)" : `Ticker ${index + 1}`;
          const placeholder = index === 0 ? "BRPT" : index === 1 ? "CUAN" : "PTRO";
          return (
            <label key={label} className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7A6E63]">{label}</span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7A6E63]" />
                <input
                  value={value}
                  onChange={(event) => setter(event.target.value)}
                  placeholder={placeholder}
                  className="editorial-input h-11 w-full pl-10 pr-3 font-mono uppercase"
                />
              </div>
            </label>
          );
        })}

        <div className="flex h-11 items-center justify-center rounded-full border border-[#1D4C45] bg-[#1D4C45] px-4 text-sm font-semibold text-[#FFF9F1] shadow-[0_16px_28px_rgba(29,76,69,0.18)]">
          <span className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4" />
            Analyse
          </span>
        </div>
      </div>

      {!intersection ? (
        <div className="flex flex-col items-center justify-center rounded-[26px] border border-dashed border-[#C4B2A0] bg-[#FFF8F0] p-12 text-center">
          <Info className="mb-3 h-8 w-8 text-[#996737]" />
          <div className="text-sm font-semibold text-[#1C1713]">Masukkan minimal 2 ticker</div>
          <p className="mt-1 max-w-xl text-sm text-[#665A4F]">
            Begitu dua ticker diisi, terminal akan memeriksa irisan holder &gt;=1% pada snapshot terakhir.
          </p>
        </div>
      ) : intersection.result.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[26px] border border-[#E7BFB5] bg-[#F8E9E4] p-12 text-center">
          <Users className="mb-3 h-8 w-8 text-[#7B312C]" />
          <div className="text-sm font-semibold text-[#7B312C]">Tidak ada irisan holder</div>
          <p className="mt-1 max-w-xl text-sm text-[#7B312C]">
            Tidak ditemukan investor yang memegang {intersection.targets.join(" + ")} secara bersamaan pada{" "}
            {latestDate}.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[26px] border border-[#D8CDBF] bg-[#FFFBF5] shadow-[0_20px_44px_rgba(95,73,47,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6DCCE] bg-[#F6EEE2] px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-[#1C1713]">
                <span className="font-mono text-[#1D4C45]">{intersection.result.length}</span> entitas ditemukan
              </div>
              <p className="mt-1 text-xs text-[#665A4F]">
                Kandidat irisan holder untuk {intersection.targets.join(" / ")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {intersection.targets.map((ticker) => (
                <span
                  key={ticker}
                  className="rounded-full border border-[#C4B2A0] bg-[#FFF8F0] px-3 py-1 font-mono text-[11px] text-[#1C1713]"
                >
                  {ticker}
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#E6DCCE] bg-[#FFF8F0] text-[11px] uppercase tracking-[0.18em] text-[#7A6E63]">
                  <th className="px-5 py-3 font-medium">Nominee / Investor</th>
                  {intersection.targets.map((ticker) => (
                    <th key={ticker} className="px-5 py-3 text-right font-medium">
                      {ticker} %
                    </th>
                  ))}
                  <th className="px-5 py-3 text-right font-medium">Agregat %</th>
                </tr>
              </thead>
              <tbody>
                {intersection.result.map((row) => (
                  <tr
                    key={row.investorId}
                    className="border-b border-[#EDE2D4] transition-colors hover:bg-[#F6EEE2]"
                  >
                    <td className="px-5 py-3">
                      <Link
                        to={`/investor/${encodeURIComponent(row.investorId)}`}
                        className="font-medium text-[#1C1713] transition-colors hover:text-[#1D4C45]"
                      >
                        {row.investorName}
                      </Link>
                    </td>
                    {intersection.targets.map((ticker) => (
                      <td key={ticker} className="px-5 py-3 text-right font-mono text-[#665A4F]">
                        {fmtPercent(row.holdings[ticker])}
                      </td>
                    ))}
                    <td className="px-5 py-3 text-right font-mono font-semibold text-[#996737]">
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
