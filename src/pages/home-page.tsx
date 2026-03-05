import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Database, Loader2, Users } from "lucide-react";
import { GlobalHeader } from "../components/global-header";
import { UniverseStockTable, type UniverseStockRow } from "../components/universe-stock-table";
import { useDatasetLoader } from "../hooks/use-dataset-loader";
import { useOwnershipViews } from "../hooks/use-ownership-views";
import { fmtNumber } from "../lib/utils";
import { getInvestorId } from "../lib/graph";
import { useAppStore } from "../store/app-store";

type SignalFilter = "all" | "concentrated" | "foreign" | "low-free-float";

function uniqueInvestorOptions(rows: ReturnType<typeof useOwnershipViews>["allRows"]) {
  const map = new Map<string, { investorId: string; investorName: string }>();
  for (const row of rows) {
    const investorId = getInvestorId(row);
    if (!map.has(investorId)) {
      map.set(investorId, {
        investorId,
        investorName: row.investorName,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.investorName.localeCompare(b.investorName));
}

function applySignalFilter(rows: UniverseStockRow[], signalFilter: SignalFilter): UniverseStockRow[] {
  if (signalFilter === "all") return rows;
  if (signalFilter === "concentrated") return rows.filter((row) => row.topHolderPct >= 45);
  if (signalFilter === "foreign") return rows.filter((row) => row.foreignPct >= 35);
  return rows.filter((row) => row.freeFloatPct <= 20);
}

function sortUniverseRows(rows: UniverseStockRow[], sortBy: ReturnType<typeof useAppStore.getState>["view"]["universeSort"]) {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (sortBy === "ticker") return a.shareCode.localeCompare(b.shareCode);
    if (sortBy === "holder-count") return b.holderCount - a.holderCount || b.topHolderPct - a.topHolderPct;
    if (sortBy === "total-shares") return b.totalShares - a.totalShares || b.topHolderPct - a.topHolderPct;
    return b.topHolderPct - a.topHolderPct || b.holderCount - a.holderCount;
  });
  return copy;
}

const pageVariants: import("framer-motion").Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { 
      duration: 0.35,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
      staggerChildren: 0.06
    }
  },
  exit: { 
    opacity: 0, 
    y: -8,
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] as [number, number, number, number] }
  }
};

export function HomePage() {
  const navigate = useNavigate();
  const [signalFilter, setSignalFilter] = useState<SignalFilter>("all");

  const filters = useAppStore((state) => state.filters);
  const updateFilters = useAppStore((state) => state.updateFilters);
  const setFocusIssuer = useAppStore((state) => state.setFocusIssuer);
  const updateSelection = useAppStore((state) => state.updateSelection);
  const view = useAppStore((state) => state.view);
  const updateView = useAppStore((state) => state.updateView);

  const { loadState, loadError, selectedDataset } = useDatasetLoader();
  const { allRows, universeItems } = useOwnershipViews({
    snapshotDate: view.snapshotDate,
  });

  const investorOptions = useMemo(() => uniqueInvestorOptions(allRows), [allRows]);

  const searchFilteredItems = useMemo(() => {
    let items = universeItems;
    if (filters.minFreeFloat > 0) {
      items = items.filter((row) => row.freeFloatPct >= filters.minFreeFloat);
    }
    const q = filters.queryText.trim().toUpperCase();
    if (!q) return items;
    return items.filter(
      (row) => row.shareCode.toUpperCase().includes(q) || row.issuerName.toUpperCase().includes(q),
    );
  }, [filters.queryText, filters.minFreeFloat, universeItems]);

  // Investor matches for the search query
  const investorMatches = useMemo(() => {
    const q = filters.queryText.trim().toUpperCase();
    if (!q || q.length < 2) return [];
    return investorOptions
      .filter((inv) => inv.investorName.toUpperCase().includes(q))
      .slice(0, 8);
  }, [filters.queryText, investorOptions]);

  const displayRows = useMemo(
    () => sortUniverseRows(applySignalFilter(searchFilteredItems, signalFilter), view.universeSort),
    [searchFilteredItems, signalFilter, view.universeSort],
  );



  const ready = loadState === "ready";

  return (
    <motion.main 
      className="min-h-screen bg-nebula px-8 py-5"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className="flex w-full flex-col gap-4">
        <GlobalHeader
          title="IDX Ownership Intelligence"
          subtitle="Scan 900+ emiten, baca struktur pemegang saham, dan temukan koneksi lintas entitas dengan cepat."
          allRows={allRows}
          currentPage="browse"
        />

        <section className="rounded-2xl border border-border bg-panel/45 p-4">
          <div className="mb-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-panel-2/45 p-3">
              <div className="section-title">Emiten</div>
              <div className="stat-hero mt-1">
                {fmtNumber(selectedDataset?.issuerCount ?? universeItems.length)}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-panel-2/45 p-3">
              <div className="section-title">Investor</div>
              <div className="stat-hero mt-1">
                {fmtNumber(selectedDataset?.investorCount ?? investorOptions.length)}
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
            <div className="flex flex-col gap-1 text-sm">
              <span className="section-title">Search emiten & investor</span>
              <input
                value={filters.queryText}
                onChange={(event) => updateFilters({ queryText: event.target.value, queryMode: "all" })}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  // If investor matches exist and no emiten matches, navigate to first investor
                  if (searchFilteredItems.length === 0 && investorMatches.length > 0) {
                    navigate(`/investor/${encodeURIComponent(investorMatches[0].investorId)}`);
                  }
                }}
                placeholder="Cari ticker, nama emiten, atau nama investor..."
                className="h-10 rounded-xl border border-border bg-panel px-3 text-sm text-foreground outline-none focus:border-teal/45"
              />
              {investorMatches.length > 0 && (
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted" />
                  <span className="text-[11px] text-muted">Investor:</span>
                  {investorMatches.map((inv) => (
                    <button
                      key={inv.investorId}
                      type="button"
                      onClick={() => navigate(`/investor/${encodeURIComponent(inv.investorId)}`)}
                      className="rounded-full border border-teal/20 bg-teal/5 px-2.5 py-0.5 font-mono text-[11px] font-medium text-teal transition-colors hover:bg-teal/15"
                    >
                      {inv.investorName.length > 30 ? `${inv.investorName.slice(0, 28)}…` : inv.investorName}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="section-title">Sort</span>
              <select
                className="h-10 rounded-xl border border-border bg-panel px-3 text-sm text-foreground outline-none focus:border-teal/45"
                value={view.universeSort}
                onChange={(event) =>
                  updateView({
                    universeSort: event.target.value as ReturnType<typeof useAppStore.getState>["view"]["universeSort"],
                  })
                }
              >
                <option value="dominant-pct">Top holder %</option>
                <option value="holder-count">Holder count</option>
                <option value="total-shares">Total shares</option>
                <option value="ticker">Ticker</option>
              </select>
            </label>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_2fr]">
            <label className="flex flex-col gap-1 text-sm">
              <span className="section-title">Min freefloat %</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={filters.minFreeFloat}
                onChange={(event) => updateFilters({ minFreeFloat: Number.parseFloat(event.target.value) || 0 })}
              />
              <span className="font-mono text-xs text-muted">{filters.minFreeFloat.toFixed(0)}%</span>
            </label>

            <div className="flex flex-wrap items-end gap-2 text-sm">
              <button
                type="button"
                onClick={() => updateFilters({ localEnabled: !filters.localEnabled })}
                aria-pressed={filters.localEnabled}
                className={`rounded-full border px-3 py-1 ${filters.localEnabled ? "border-teal/45 bg-teal/10 text-teal" : "border-border text-muted"}`}
              >
                Lokal
              </button>
              <button
                type="button"
                onClick={() => updateFilters({ foreignEnabled: !filters.foreignEnabled })}
                aria-pressed={filters.foreignEnabled}
                className={`rounded-full border px-3 py-1 ${filters.foreignEnabled ? "border-gold/45 bg-gold/10 text-gold" : "border-border text-muted"}`}
              >
                Asing
              </button>
              <button
                type="button"
                onClick={() => updateFilters({ unknownEnabled: !filters.unknownEnabled })}
                aria-pressed={filters.unknownEnabled}
                className={`rounded-full border px-3 py-1 ${filters.unknownEnabled ? "border-warning/45 bg-warning/10 text-warning" : "border-border text-muted"}`}
              >
                Unknown
              </button>
              <button
                type="button"
                onClick={() => setSignalFilter("all")}
                className={`rounded-full border px-3 py-1 ${signalFilter === "all" ? "border-teal/45 bg-teal/10 text-teal" : "border-border text-muted"}`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setSignalFilter("concentrated")}
                className={`rounded-full border px-3 py-1 ${signalFilter === "concentrated" ? "border-rose/45 bg-rose/10 text-rose" : "border-border text-muted"}`}
              >
                Konsentrasi Tinggi
              </button>
              <button
                type="button"
                onClick={() => setSignalFilter("foreign")}
                className={`rounded-full border px-3 py-1 ${signalFilter === "foreign" ? "border-gold/45 bg-gold/10 text-gold" : "border-border text-muted"}`}
              >
                Asing Dominan
              </button>
              <button
                type="button"
                onClick={() => setSignalFilter("low-free-float")}
                className={`rounded-full border px-3 py-1 ${signalFilter === "low-free-float" ? "border-rose/45 bg-rose/10 text-rose" : "border-border text-muted"}`}
              >
                Free Float Rendah
              </button>
            </div>
          </div>
        </section>

        {!ready ? (
          <section className="rounded-2xl border border-border bg-panel/45 p-10">
            {loadState === "error" ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <AlertTriangle className="h-10 w-10 text-rose/60" />
                <div className="text-sm font-semibold text-rose">{loadError ?? "Gagal memuat dataset"}</div>
                <p className="max-w-md text-xs text-muted">
                  Pastikan dataset sudah tergenerate dengan menjalankan <code className="font-mono text-foreground">npm run dev</code>.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-teal/50" />
                <div className="text-sm text-muted">Menyiapkan dataset...</div>
              </div>
            )}
          </section>
        ) : displayRows.length === 0 ? (
          <section className="rounded-2xl border border-border bg-panel/45 p-10">
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Database className="h-10 w-10 text-muted/40" />
              <div className="text-sm font-semibold text-muted">Tidak ada emiten untuk filter saat ini</div>
              <p className="max-w-md text-xs text-muted">
                Coba reset filter atau ubah parameter pencarian untuk melihat daftar emiten.
              </p>
            </div>
          </section>
        ) : (
          <section className="space-y-2">
            <div className="section-title">Browse Universe</div>
            <p className="pl-[15px] text-sm text-muted">
              Scan cepat emiten berdasarkan konsentrasi holder, komposisi lokal/asing, dan estimasi free float.
            </p>
            <UniverseStockTable
              rows={displayRows}
              onSelectIssuer={(issuerId) => {
                const match = displayRows.find((item) => item.issuerId === issuerId);
                if (!match) return;
                setFocusIssuer(issuerId);
                updateSelection({
                  selectedIssuerId: issuerId,
                  selectedInvestorId: null,
                  selectedEdgeId: null,
                  focusedEvidenceRowId: null,
                });
                navigate(`/emiten/${encodeURIComponent(match.shareCode)}`);
              }}
            />
          </section>
        )}

        {/* ── Footer ── */}
        <footer className="mt-6 flex justify-center pb-4 text-xs font-mono text-muted/40">
          <a href="https://x.com/Conaax" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-teal">
            Made by CONA
          </a>
        </footer>
      </div>
    </motion.main>
  );
}