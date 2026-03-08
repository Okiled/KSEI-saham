import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { formatIDR } from "../lib/format";
import { getInvestorId } from "../lib/graph";
import { getPositionValueIDR } from "../lib/market-data";
import type { OwnershipRow } from "../types/ownership";

interface InvestorLeaderboardProps {
  rows: OwnershipRow[];
  prices: Record<string, number>;
  updatedAt?: string | null;
  onSelectInvestor?: (investorId: string) => void;
}

interface LeaderboardEntry {
  investorId: string;
  investorName: string;
  investorType: string;
  totalIDR: number;
  positionCount: number;
  localForeign: "L" | "A" | null;
}

function localForeignBadge(localForeign: "L" | "A" | null): string | null {
  if (localForeign === "L") return "border-[#E7D2B3] bg-[#F8EEDC] text-[#996737]";
  if (localForeign === "A") return "border-[#C0D6CF] bg-[#EDF4F1] text-[#1D4C45]";
  return null;
}

function localForeignLabel(localForeign: "L" | "A" | null): string {
  return localForeign === "L" ? "Lokal" : "Asing";
}

export function InvestorLeaderboard({
  rows,
  prices,
  updatedAt: _updatedAt,
  onSelectInvestor,
}: InvestorLeaderboardProps) {
  const entries = useMemo<LeaderboardEntry[]>(() => {
    if (!rows.length) return [];

    const byInvestor = new Map<string, LeaderboardEntry>();

    for (const row of rows) {
      const investorId = getInvestorId(row);
      const idr = getPositionValueIDR(row.totalHoldingShares ?? 0, prices[row.shareCode]);
      if (idr === null) continue;

      const existing = byInvestor.get(investorId);
      if (existing) {
        existing.totalIDR += idr;
        existing.positionCount += 1;
        continue;
      }

      byInvestor.set(investorId, {
        investorId,
        investorName: row.investorName,
        investorType: row.investorType ?? "",
        totalIDR: idr,
        positionCount: 1,
        localForeign: row.localForeign ?? null,
      });
    }

    return [...byInvestor.values()].sort((a, b) => b.totalIDR - a.totalIDR).slice(0, 50);
  }, [prices, rows]);

  const hasPrices = Object.keys(prices).length > 0;

  return (
    <div className="overflow-hidden rounded-[22px] border border-[#D8CDBF] bg-[#FFFBF5] shadow-[0_14px_32px_rgba(95,73,47,0.07)]">
      <div className="border-b border-[#E6DCCE] bg-[linear-gradient(135deg,#FFF9F1_0%,#F6EEE2_100%)] px-4 py-3">
        <div className="mb-2 flex items-center gap-2">
          <div className="h-4 w-0.5 bg-[#996737]" />
          <span className="text-xs uppercase tracking-[0.22em] text-[#7A6E63]">Capital Ranking</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[#1C1713]">
            <TrendingUp className="h-4 w-4 text-[#1D4C45]" />
            <span className="font-semibold">Investor leaderboard by disclosed IDR value</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[48px_1fr_110px_84px_132px] gap-3 border-b border-[#E6DCCE] bg-[#F6EEE2] px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] text-[#7A6E63]">
        <span>Rank</span>
        <span>Investor</span>
        <span className="text-right">Tipe</span>
        <span className="text-right">Posisi</span>
        <span className="text-right">Total IDR</span>
      </div>

      {!hasPrices ? (
        <div className="flex h-44 flex-col items-center justify-center gap-2 text-center">
          <span className="text-sm text-[#665A4F]">Memuat data harga pasar...</span>
          <span className="text-xs text-[#A99F95]">Leaderboard akan terisi setelah quote tersedia.</span>
        </div>
      ) : null}

      {hasPrices && entries.length === 0 ? (
        <div className="flex h-44 items-center justify-center">
          <span className="text-sm text-[#665A4F]">Tidak ada data leaderboard.</span>
        </div>
      ) : null}

      {hasPrices
        ? entries.map((entry, index) => {
            const rankTone =
              index === 0 ? "text-[#996737]" : index === 1 ? "text-[#7A6E63]" : index === 2 ? "text-[#8C6A4B]" : "text-[#A99F95]";
            const badgeTone = localForeignBadge(entry.localForeign);

            return (
              <button
                key={entry.investorId}
                type="button"
                onClick={() => onSelectInvestor?.(entry.investorId)}
                className="grid w-full grid-cols-[48px_1fr_110px_84px_132px] items-center gap-3 border-b border-[#EEE3D6] px-4 py-2.5 text-left transition-colors hover:bg-[#F6EEE2]"
              >
                <span className={`font-mono text-sm font-semibold ${rankTone}`}>#{index + 1}</span>

                <span className="flex items-center gap-2 truncate">
                  <span className="truncate text-sm font-medium text-[#1C1713]">{entry.investorName}</span>
                  {badgeTone ? (
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeTone}`}>
                      {localForeignLabel(entry.localForeign)}
                    </span>
                  ) : null}
                </span>

                <span className="text-right text-[11px] text-[#665A4F]">{entry.investorType || "-"}</span>
                <span className="text-right font-mono text-[12px] text-[#665A4F]">{entry.positionCount} emiten</span>
                <span className="text-right font-mono text-[13px] font-semibold text-[#996737]">
                  {formatIDR(entry.totalIDR)}
                </span>
              </button>
            );
          })
        : null}
    </div>
  );
}
