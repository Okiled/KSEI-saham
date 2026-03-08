import { useState } from "react";
import { GlobalHeader } from "../components/global-header";
import { EditorialFooter, PageShell, SectionIntro } from "../components/page-shell";
import { TriggerRadarPanel } from "../components/trigger-radar-panel";
import { useDatasetLoader } from "../hooks/use-dataset-loader";
import { useMarketData } from "../hooks/use-market-data";
import { useOwnershipViews } from "../hooks/use-ownership-views";
import { buildUniverseIssuerItems } from "../lib/ownership-analytics";
import { normalizeTickerList } from "../lib/market-data";
import type { TriggerAlertType } from "../lib/trigger-engine";
import { useAppStore } from "../store/app-store";

const RETAIL_RADAR_TYPES: TriggerAlertType[] = [
  "mandatory-sell-down",
  "mto-squeeze",
  "float-pressure",
  "shadow-accumulation",
  "coordinated-bloc",
];

export function ControlPressurePage() {
  const [mode, setMode] = useState<"retail" | "full">("retail");
  const view = useAppStore((state) => state.view);
  const { loadState, loadError } = useDatasetLoader();
  const { allRows, snapshotDate, snapshotRows } = useOwnershipViews({
    snapshotDate: view.snapshotDate,
  });

  const snapshotUniverseItems = buildUniverseIssuerItems(snapshotRows, null);
  const snapshotTickers = normalizeTickerList(snapshotUniverseItems.map((item) => item.shareCode));
  const { marketData, updatedAt, loading } = useMarketData(snapshotTickers);

  return (
    <PageShell>
      <GlobalHeader
        title="Control Pressure Radar"
        subtitle="Lihat siapa mengunci float, siapa mendekati threshold, dan emiten mana yang paling dekat memicu supply event berikutnya."
        allRows={allRows}
        currentPage="control-pressure"
        eyebrow="Flagship Radar"
        actions={[{ label: "Browse Universe", to: "/", variant: "secondary" }]}
      />

      {loadState !== "ready" ? (
        <div className="page-section px-5 py-8 text-center text-sm text-[#6B6B6B]">
          {loadState === "error" ? loadError ?? "Gagal memuat dataset." : "Menyiapkan radar control pressure..."}
        </div>
      ) : (
        <>
          {loading && (
            <div className="page-section bg-[#FFF8F0] px-4 py-2.5 text-sm text-[#665A4F]">
              Memuat data pasar untuk radar regulasi...
            </div>
          )}

          <section className="space-y-3">
            <SectionIntro
              label="Flagship Radar"
              description={
                mode === "retail"
                  ? "Mode ringkas menampilkan alert yang paling gampang dibaca dulu: siapa harus jual, siapa dekat threshold, dan pattern yang perlu dicek."
                  : "Mode penuh membuka seluruh radar termasuk alert yang lebih teknikal dan tail-risk."
              }
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setMode("retail")}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                  mode === "retail"
                    ? "border-[#1D4C45] bg-[#1D4C45] text-[#FFF9F1]"
                    : "border-[#D8CDBF] bg-[#FFF8F0] text-[#665A4F] hover:bg-[#F0E7DB]"
                }`}
              >
                Retail View
              </button>
              <button
                type="button"
                onClick={() => setMode("full")}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                  mode === "full"
                    ? "border-[#1D4C45] bg-[#1D4C45] text-[#FFF9F1]"
                    : "border-[#D8CDBF] bg-[#FFF8F0] text-[#665A4F] hover:bg-[#F0E7DB]"
                }`}
              >
                Full Radar
              </button>
            </div>
            <TriggerRadarPanel
              allRows={snapshotRows}
              snapshotDate={snapshotDate}
              universeItems={snapshotUniverseItems}
              marketData={marketData}
              updatedAt={updatedAt}
              maxItemsPerSection={mode === "retail" ? 4 : 8}
              visibleTypes={mode === "retail" ? RETAIL_RADAR_TYPES : undefined}
            />
          </section>
        </>
      )}

      <EditorialFooter />
    </PageShell>
  );
}
