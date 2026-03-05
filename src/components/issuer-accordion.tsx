import { useMemo } from "react";
import { getInvestorId, getIssuerId } from "../lib/graph";
import { fmtNumber, fmtPercent } from "../lib/utils";
import type { OwnershipRow } from "../types/ownership";

type IssuerAccordionProps = {
  rows: OwnershipRow[];
  selectedIssuerId: string | null;
  onSelectIssuer: (issuerId: string) => void;
  onSelectInvestor: (investorId: string) => void;
};

type IssuerSummary = {
  issuerId: string;
  shareCode: string;
  issuerName: string;
  totalPct: number;
  totalShares: number;
  foreignPct: number;
  localPct: number;
  unknownPct: number;
  holderCount: number;
  holders: Array<{
    investorId: string;
    investorName: string;
    pct: number;
    shares: number;
    localForeign: "L" | "A" | null;
  }>;
};

export function IssuerAccordion({ rows, selectedIssuerId, onSelectIssuer, onSelectInvestor }: IssuerAccordionProps) {
  const issuers = useMemo<IssuerSummary[]>(() => {
    const issuerMap = new Map<
      string,
      IssuerSummary & {
        holderMap: Map<string, IssuerSummary["holders"][number]>;
      }
    >();

    for (const row of rows) {
      const issuerId = getIssuerId(row);
      if (!issuerMap.has(issuerId)) {
        issuerMap.set(issuerId, {
          issuerId,
          shareCode: row.shareCode,
          issuerName: row.issuerName,
          totalPct: 0,
          totalShares: 0,
          foreignPct: 0,
          localPct: 0,
          unknownPct: 0,
          holderCount: 0,
          holders: [],
          holderMap: new Map<string, IssuerSummary["holders"][number]>(),
        });
      }
      const issuer = issuerMap.get(issuerId);
      if (!issuer) continue;

      const pct = row.percentage ?? 0;
      issuer.totalPct += pct;
      issuer.totalShares += row.totalHoldingShares ?? 0;
      if (row.localForeign === "A") issuer.foreignPct += pct;
      else if (row.localForeign === "L") issuer.localPct += pct;
      else issuer.unknownPct += pct;

      const investorId = getInvestorId(row);
      if (!issuer.holderMap.has(investorId)) {
        issuer.holderMap.set(investorId, {
          investorId,
          investorName: row.investorName,
          pct: 0,
          shares: 0,
          localForeign: row.localForeign,
        });
      }
      const holder = issuer.holderMap.get(investorId);
      if (!holder) continue;
      holder.pct += row.percentage ?? 0;
      holder.shares += row.totalHoldingShares ?? 0;
    }

    const summaries = [...issuerMap.values()].map(({ holderMap, ...issuer }) => ({
      ...issuer,
      holders: [...holderMap.values()].sort((a, b) => b.pct - a.pct).slice(0, 8),
      holderCount: holderMap.size,
    }));

    return summaries
      .sort((a, b) => b.totalShares - a.totalShares || b.totalPct - a.totalPct)
      .slice(0, 14);
  }, [rows]);

  if (issuers.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-background/25 px-4 py-6 text-center text-sm text-muted">
        Tidak ada data issuer untuk ditampilkan.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {issuers.map((issuer) => (
      <details
          key={issuer.issuerId}
          open={selectedIssuerId === issuer.issuerId}
          className={`group overflow-hidden rounded-xl border bg-background/25 transition-[border-color,box-shadow,transform,background-color] duration-200 ${
            selectedIssuerId === issuer.issuerId
              ? "border-focus/55 shadow-[0_14px_30px_rgba(0,0,0,0.24)]"
              : "border-border hover:-translate-y-[1px] hover:border-border-strong/80 hover:shadow-[0_10px_24px_rgba(0,0,0,0.2)]"
          }`}
        >
          <summary
            className="cursor-pointer list-none px-4 py-3 transition-colors duration-200 group-hover:bg-panel-2/22"
            onClick={(event) => {
              event.preventDefault();
              onSelectIssuer(issuer.issuerId);
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-foreground">{issuer.shareCode}</div>
                <div className="text-sm text-muted" title={issuer.issuerName}>{issuer.issuerName}</div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-muted">Holders: <span className="font-mono text-foreground">{issuer.holderCount}</span></span>
                <span className="text-muted">Shares: <span className="font-mono text-foreground">{fmtNumber(issuer.totalShares)}</span></span>
                <span className="text-local">Lokal {fmtPercent(issuer.localPct)}</span>
                <span className="text-foreign">Asing {fmtPercent(issuer.foreignPct)}</span>
              </div>
            </div>
          </summary>

          <div className="border-t border-border px-4 py-3">
            <div className="mb-2 text-xs uppercase tracking-wide text-muted">Top Holders + Mini Network Preview</div>
            <div className="space-y-2">
              {issuer.holders.map((holder) => {
                const width = Math.max(2, Math.min(100, holder.pct));
                return (
                  <button
                    key={holder.investorId}
                    type="button"
                    onClick={() => {
                      onSelectIssuer(issuer.issuerId);
                      onSelectInvestor(holder.investorId);
                    }}
                    className="w-full rounded-lg border border-border bg-panel/35 px-3 py-2 text-left transition-[border-color,background-color,transform,box-shadow] duration-200 hover:-translate-y-[1px] hover:border-focus/45 hover:bg-panel-2/50 hover:shadow-[0_10px_20px_rgba(0,0,0,0.18)]"
                    title={holder.investorName}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-foreground">{holder.investorName}</span>
                      <span className="font-mono text-xs text-muted">{fmtPercent(holder.pct)}</span>
                    </div>
                    <div className="mb-1 h-2.5 w-full rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full ${
                          holder.localForeign === "A"
                            ? "bg-foreign"
                            : holder.localForeign === "L"
                              ? "bg-local"
                              : "bg-unknown"
                        } transition-[width,filter] duration-300`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted">Shares {fmtNumber(holder.shares)}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
