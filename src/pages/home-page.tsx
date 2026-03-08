import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Database, Loader2, RotateCcw } from "lucide-react";
import { GlobalHeader } from "../components/global-header";
import { EditorialFooter, PageShell, SectionIntro } from "../components/page-shell";
import { UniverseStockTable, type UniverseStockRow } from "../components/universe-stock-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { TopInvestorRanking } from "../components/top-investor-ranking";
import { InvestorDemographics } from "../components/investor-demographics";
import { SyndicateIntersectPanel } from "../components/syndicate-intersect-panel";
import { useDatasetLoader } from "../hooks/use-dataset-loader";
import { useOwnershipViews } from "../hooks/use-ownership-views";
import { useMarketData } from "../hooks/use-market-data";
import { InvestorLeaderboard } from "../components/investor-leaderboard";
import { fmtNumber } from "../lib/utils";
import { getInvestorId } from "../lib/graph";
import { normalizeTickerList } from "../lib/market-data";
import { buildUniverseIssuerItems } from "../lib/ownership-analytics";
import { useAppStore } from "../store/app-store";
import { MacroIDRStat } from "../components/macro-idr-stat";
import { TriggerRadarPanel } from "../components/trigger-radar-panel";

type SignalFilter = "all" | "concentrated" | "foreign" | "low-free-float";

function inputTone(active: boolean, tone: "teal" | "amber" | "rose" = "teal") {
  if (!active) return "";
  if (tone === "amber") return "border-[#C98A3E] bg-[#FFF8ED] shadow-[0_0_0_3px_rgba(201,138,62,0.12)]";
  if (tone === "rose") return "border-[#B45C55] bg-[#FFF4F2] shadow-[0_0_0_3px_rgba(180,92,85,0.12)]";
  return "border-[#1D4C45] bg-[#F9FFFD] shadow-[0_0_0_3px_rgba(29,76,69,0.12)]";
}

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

export function HomePage() {
  const navigate = useNavigate();
  const [signalFilter, setSignalFilter] = useState<SignalFilter>("all");

  const filters = useAppStore((state) => state.filters);
  const updateFilters = useAppStore((state) => state.updateFilters);
  const setFocusIssuer = useAppStore((state) => state.setFocusIssuer);
  const updateSelection = useAppStore((state) => state.updateSelection);
  const view = useAppStore((state) => state.view);
  const updateView = useAppStore((state) => state.updateView);
  const resetFilters = useAppStore((state) => state.resetFilters);

  const { loadState, loadError, selectedDataset } = useDatasetLoader();
  const { allRows, snapshotDate, snapshotRows, universeItems } = useOwnershipViews({
    snapshotDate: view.snapshotDate,
  });

  const snapshotTickers = useMemo(
    () => normalizeTickerList(snapshotRows.map((row) => row.shareCode)),
    [snapshotRows],
  );
  const { prices, marketData, updatedAt, loading: marketLoading } = useMarketData(snapshotTickers);
  const intelligenceUniverseItems = useMemo(() => buildUniverseIssuerItems(snapshotRows, null), [snapshotRows]);

  const investorOptions = useMemo(() => uniqueInvestorOptions(allRows), [allRows]);

  const filteredUniverse = useMemo(() => {
    let items = universeItems;

    items = items.filter((row) => {
      if (filters.localEnabled && row.foreignPct < 50) return true;
      if (filters.foreignEnabled && row.foreignPct >= 50) return true;
      if (filters.unknownEnabled && row.freeFloatPct == null) return true;
      return false;
    });

    if (filters.freeFloatEnabled) {
      items = items.filter((row) => row.freeFloatPct != null && row.freeFloatPct >= filters.minFreeFloat);
    }

    if (filters.minPercentage && filters.minPercentage > 0) {
      items = items.filter((row) => row.topHolderPct >= filters.minPercentage);
    }

    const q = filters.queryText.trim().toUpperCase();
    if (!q) return items;
    return items.filter(
      (row) => row.shareCode.toUpperCase().includes(q) || row.issuerName.toUpperCase().includes(q),
    );
  }, [
    filters.queryText,
    filters.minFreeFloat,
    filters.freeFloatEnabled,
    universeItems,
    filters.localEnabled,
    filters.foreignEnabled,
    filters.unknownEnabled,
    filters.minPercentage,
  ]);

  const investorMatches = useMemo(() => {
    const q = filters.queryText.trim().toUpperCase();
    if (!q || q.length < 2) return [];
    return investorOptions
      .filter((inv) => inv.investorName.toUpperCase().includes(q))
      .slice(0, 8);
  }, [filters.queryText, investorOptions]);

  const suggestedInvestor = useMemo(() => {
    if (filteredUniverse.length > 0) return null;
    return investorMatches[0] ?? null;
  }, [filteredUniverse.length, investorMatches]);

  const displayRows = useMemo(
    () => sortUniverseRows(applySignalFilter(filteredUniverse, signalFilter), view.universeSort),
    [filteredUniverse, signalFilter, view.universeSort],
  );

  const hasActiveRefinement =
    filters.queryText.trim().length > 0 ||
    filters.freeFloatEnabled ||
    filters.minFreeFloat > 0 ||
    filters.minPercentage > 0 ||
    !filters.localEnabled ||
    !filters.foreignEnabled ||
    !filters.unknownEnabled ||
    signalFilter !== "all";

  const activeRefinementCount = [
    filters.queryText.trim().length > 0,
    filters.freeFloatEnabled,
    filters.minPercentage > 0,
    !filters.localEnabled,
    !filters.foreignEnabled,
    !filters.unknownEnabled,
    signalFilter !== "all",
  ].filter(Boolean).length;

  const signalTone =
    signalFilter === "foreign"
      ? inputTone(true, "amber")
      : signalFilter === "concentrated" || signalFilter === "low-free-float"
        ? inputTone(true, "rose")
        : "";
  const coverageFiltered = !filters.localEnabled || !filters.foreignEnabled || !filters.unknownEnabled;

  const ready = loadState === "ready";

  return (
    <PageShell>
      <GlobalHeader
        title="IDX Ownership Intelligence"
        subtitle="Research terminal untuk membaca siapa mengontrol apa di IDX, siapa mengunci float, dan ke mana modal besar berputar."
        allRows={allRows}
        currentPage="browse"
        heroVariant="compact"
        actions={[
          { label: "Open Control Pressure", to: "/control-pressure", variant: "primary" },
          { label: "Open Explore Lab", to: "/explore", variant: "secondary" },
        ]}
      />

      <section className="page-section p-4 md:p-5">
        <div className="grid gap-4">
          <div className="max-w-[1080px]">
            <h2 className="font-serif text-[2.3rem] font-semibold leading-[0.95] tracking-[-0.05em] text-[#1C1713] md:text-[3.2rem]">
              Who controls what across IDX.
            </h2>
            <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[#665A4F]">
              Home difokuskan untuk tiga hal: scan cepat universe, baca radar pressure, lalu masuk ke detail.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate("/control-pressure")}
                className="inline-flex items-center gap-2 rounded-full border border-[#1D4C45] bg-[#1D4C45] px-4 py-2 text-[13px] font-semibold text-[#FFF9F1] transition-colors hover:bg-[#173C37]"
              >
                Open Control Pressure
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate("/explore")}
                className="inline-flex items-center gap-2 rounded-full border border-[#D8CDBF] bg-[#FFF8F0] px-4 py-2 text-[13px] font-semibold text-[#1C1713] transition-colors hover:bg-[#F0E7DB]"
              >
                Open Explore Lab
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3 xl:max-w-[880px]">
            <div className="shell-metric p-4">
              <div className="shell-metric-label">Emiten</div>
              <div className="shell-metric-value mt-2">{fmtNumber(selectedDataset?.issuerCount ?? universeItems.length)}</div>
            </div>
            <div className="shell-metric p-4">
              <div className="shell-metric-label">Investor Base</div>
              <div className="shell-metric-value mt-2">{fmtNumber(selectedDataset?.investorCount ?? investorOptions.length)}</div>
            </div>
            <div className="shell-metric p-4">
              <div className="shell-metric-label">Snapshot</div>
              <div className="mt-2 font-mono text-lg font-semibold text-[#1D4C45]">{snapshotDate ?? "-"}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-section p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <SectionIntro
            label="Refine Universe"
            description="Kontrol kerja dibuat lebih ringkas: cari cepat, ubah urutan baca, lalu sempitkan scan hanya saat perlu."
          />
          <div className="flex items-center gap-2 self-start">
            {hasActiveRefinement ? (
              <span className="rounded-full border border-[#C0D6CF] bg-[#EDF4F1] px-2.5 py-1 text-[11px] font-semibold text-[#1D4C45] shadow-[0_8px_18px_rgba(29,76,69,0.08)]">
                {activeRefinementCount} filter aktif
              </span>
            ) : null}
            {hasActiveRefinement ? (
              <button
                type="button"
                onClick={() => {
                  resetFilters();
                  setSignalFilter("all");
                }}
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-[#7B312C] transition-colors hover:bg-[#F8E9E4]"
                title="Reset seluruh filter"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_200px_220px]">
          <label className="flex flex-col gap-2 text-sm">
            <span className="section-title">Search</span>
            <input
              value={filters.queryText}
              onChange={(event) => updateFilters({ queryText: event.target.value, queryMode: "all" })}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                if (filteredUniverse.length === 0 && investorMatches.length > 0) {
                  navigate(`/investor/${encodeURIComponent(investorMatches[0].investorId)}`);
                }
              }}
              placeholder="Cari ticker, nama emiten, atau nama investor..."
              className={`editorial-input px-3 text-sm outline-none ${inputTone(filters.queryText.trim().length > 0)}`}
            />
            {suggestedInvestor ? (
              <p className="pl-[15px] text-xs text-[#665A4F]">
                Tekan Enter untuk buka investor terdekat:
                <span className="ml-1 font-medium text-[#1D4C45]">{suggestedInvestor.investorName}</span>
              </p>
            ) : (
              <p className="pl-[15px] text-xs text-[#8B7E72]">Gunakan satu kolom untuk scan emiten sekaligus investor.</p>
            )}
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="section-title">Sort</span>
            <select
              className="editorial-input px-3 text-sm outline-none"
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

          <label className="flex flex-col gap-2 text-sm">
            <span className="section-title">Signal Focus</span>
            <select
              className={`editorial-input px-3 text-sm outline-none ${signalTone}`}
              value={signalFilter}
              onChange={(event) => setSignalFilter(event.target.value as SignalFilter)}
            >
              <option value="all">Balanced scan</option>
              <option value="concentrated">Konsentrasi tinggi</option>
              <option value="foreign">Asing dominan</option>
              <option value="low-free-float">Free float rendah</option>
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-4 border-t border-[#E6DCCE] pt-4 xl:grid-cols-[minmax(0,1.1fr)_360px]">
          <div className={`grid gap-2 rounded-[18px] px-3 py-2 transition-all ${filters.freeFloatEnabled ? "border border-[#E7D2B3] bg-[#FFF7ED] shadow-[0_10px_22px_rgba(153,103,55,0.08)]" : ""}`}>
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded border-[#D8CDBF] bg-[#FFFBF5] text-[#1D4C45] focus:ring-[#1D4C45]"
                  checked={filters.freeFloatEnabled}
                  onChange={(event) => updateFilters({ freeFloatEnabled: event.target.checked })}
                />
                <span className="section-title">Min freefloat %</span>
              </label>
              <span className={`w-10 text-right font-mono text-xs ${filters.freeFloatEnabled ? "font-semibold text-[#996737]" : "text-[#665A4F]"}`}>
                {filters.minFreeFloat.toFixed(0)}%
              </span>
            </div>
            <div className={`flex items-center gap-3 transition-opacity ${filters.freeFloatEnabled ? "opacity-100" : "pointer-events-none opacity-40"}`}>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                className="flex-1 accent-[#1D4C45]"
                value={filters.minFreeFloat}
                onChange={(event) => updateFilters({ minFreeFloat: Number.parseFloat(event.target.value) || 0 })}
              />
            </div>
          </div>

          <div className={`flex flex-col gap-2 rounded-[18px] px-3 py-2 transition-all ${coverageFiltered ? "border border-[#C0D6CF] bg-[#F5FBF9] shadow-[0_10px_22px_rgba(29,76,69,0.07)]" : ""}`}>
            <span className="section-title">Coverage</span>
            <div className="inline-flex w-full flex-wrap rounded-full border border-[#D8CDBF] bg-[#F7F0E6] p-1">
              <button
                type="button"
                onClick={() => updateFilters({ localEnabled: !filters.localEnabled })}
                aria-pressed={filters.localEnabled}
                className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                  filters.localEnabled
                    ? coverageFiltered
                      ? "bg-[#1D4C45] text-[#FFF9F1] shadow-[0_8px_18px_rgba(29,76,69,0.16)]"
                      : "bg-[#EDF4F1] text-[#1D4C45] shadow-[inset_0_0_0_1px_rgba(192,214,207,1)]"
                    : "text-[#665A4F] hover:bg-[#FFF8F0]"
                }`}
              >
                Lokal
              </button>
              <button
                type="button"
                onClick={() => updateFilters({ foreignEnabled: !filters.foreignEnabled })}
                aria-pressed={filters.foreignEnabled}
                className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                  filters.foreignEnabled
                    ? coverageFiltered
                      ? "bg-[#996737] text-[#FFF9F1] shadow-[0_8px_18px_rgba(153,103,55,0.16)]"
                      : "bg-[#F8EEDC] text-[#996737] shadow-[inset_0_0_0_1px_rgba(231,210,179,1)]"
                    : "text-[#665A4F] hover:bg-[#FFF8F0]"
                }`}
              >
                Asing
              </button>
              <button
                type="button"
                onClick={() => updateFilters({ unknownEnabled: !filters.unknownEnabled })}
                aria-pressed={filters.unknownEnabled}
                className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                  filters.unknownEnabled
                    ? coverageFiltered
                      ? "bg-[#6F655B] text-[#FFF9F1] shadow-[0_8px_18px_rgba(111,101,91,0.16)]"
                      : "bg-[#F7F0E6] text-[#665A4F] shadow-[inset_0_0_0_1px_rgba(216,205,191,1)]"
                    : "text-[#665A4F] hover:bg-[#FFF8F0]"
                }`}
              >
                Unknown
              </button>
            </div>
            {coverageFiltered ? (
              <p className="text-[11px] text-[#665A4F]">
                Status yang dimatikan sedang dikeluarkan dari hasil scan.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {ready && (
        <MacroIDRStat
          rows={snapshotRows}
          prices={prices}
          loading={marketLoading}
          updatedAt={updatedAt}
        />
      )}

      {!ready ? (
        <section className="page-section p-8">
          {loadState === "error" ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <AlertTriangle className="h-10 w-10 text-[#991B1B]" />
              <div className="text-sm font-semibold text-[#991B1B]">{loadError ?? "Gagal memuat dataset"}</div>
              <p className="max-w-md text-xs text-[#6B6B6B]">
                Pastikan dataset sudah tergenerate dengan menjalankan <code className="font-mono text-[#1A1A1A]">npm run dev</code>.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#0D9488]" />
              <div className="text-sm text-[#6B6B6B]">Menyiapkan dataset...</div>
            </div>
          )}
        </section>
      ) : displayRows.length === 0 ? (
        <section className="page-section p-8">
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Database className="h-10 w-10 text-[#9CA3AF]" />
            <div className="text-sm font-semibold text-[#6B6B6B]">Tidak ada emiten untuk filter saat ini</div>
            <p className="max-w-md text-xs text-[#6B6B6B]">
              Coba reset filter atau ubah parameter pencarian untuk melihat daftar emiten.
            </p>
          </div>
        </section>
      ) : (
        <Tabs defaultValue="browse" className="space-y-3">
          <TabsList>
            <TabsTrigger value="browse">Browse Universe</TabsTrigger>
            <TabsTrigger value="intelligence">Market Intelligence</TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="min-h-[400px]">
            <section className="space-y-1.5">
              <div className="mb-4 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <SectionIntro
                    label="Browse Universe"
                    description="Scan cepat emiten berdasarkan konsentrasi holder, komposisi lokal/asing, dan estimasi free float."
                  />
                </div>
                <div className="flex items-center gap-2">
                  {!filters.localEnabled && <span className="chip-soft px-2 py-0.5 text-[10px] font-medium">Tanpa Lokal</span>}
                  {!filters.foreignEnabled && <span className="chip-soft px-2 py-0.5 text-[10px] font-medium">Tanpa Asing</span>}
                  {filters.freeFloatEnabled && <span className="rounded-full border border-[#99F6E4] bg-[#F0FDF9] px-2 py-0.5 text-[10px] font-medium text-[#0D9488]">FF &gt;= {filters.minFreeFloat}%</span>}
                  {filters.minPercentage > 0 && <span className="rounded-full border border-[#FDE68A] bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-medium text-[#92400E]">Top &gt;= {filters.minPercentage}%</span>}
                  <span className="rounded-md border border-[#E8E4DC] bg-[#FCFBF8] px-2 py-1 text-xs font-mono font-medium text-[#1A1A1A] shadow-sm">
                    {filteredUniverse.length} Matches
                  </span>
                </div>
              </div>

              <UniverseStockTable
                rows={displayRows}
                targetFreeFloat={filters.freeFloatEnabled ? filters.minFreeFloat : undefined}
                prices={prices}
                onSelectIssuer={(issuerId) => {
                  const match = universeItems.find((item) => item.issuerId === issuerId);
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
          </TabsContent>

          <TabsContent value="intelligence" className="min-h-[400px]">
            <section className="space-y-3">
              <SectionIntro label="Market Intelligence" description="Analisis makro dari seluruh pemegang saham di bursa." />
              <TriggerRadarPanel
                allRows={snapshotRows}
                snapshotDate={snapshotDate}
                universeItems={intelligenceUniverseItems}
                marketData={marketData}
                updatedAt={updatedAt}
                maxItemsPerSection={3}
                actionHref="/control-pressure"
                actionLabel="Open Full Radar"
              />
              <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr_1.3fr]">
                <InvestorDemographics rows={allRows} />
                <TopInvestorRanking rows={allRows} />
                <InvestorLeaderboard
                  rows={snapshotRows}
                  prices={prices}
                  updatedAt={updatedAt}
                  onSelectInvestor={(investorId) => navigate(`/investor/${encodeURIComponent(investorId)}`)}
                />
              </div>
            </section>

            <div className="mt-8 border-t border-[#E8E4DC] pt-8">
              <SyndicateIntersectPanel allRows={allRows} />
            </div>
          </TabsContent>
        </Tabs>
      )}

      <EditorialFooter />
    </PageShell>
  );
}
