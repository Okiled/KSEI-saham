import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { CommandPalette } from "../components/command-palette";
import { FiltersPanel } from "../components/filters-panel";
import { GlobalHeader } from "../components/global-header";
import { IssuerAccordion } from "../components/issuer-accordion";
import { EditorialFooter, PageShell, SectionIntro } from "../components/page-shell";
import { OwnershipTable } from "../components/ownership-table";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { useDerivedData } from "../hooks/use-derived-data";
import { getInvestorId, getIssuerId } from "../lib/graph";
import { fmtPercent } from "../lib/utils";
import { useAppStore } from "../store/app-store";
import type { ParsedOwnership, ParsedStats } from "../types/ownership";

type DatasetIndexItem = {
  fileName: string;
  pdfPath: string;
  dataPath: string;
  size: number;
  mtimeMs: number;
  rowCount: number;
  issuerCount: number;
  investorCount: number;
  pageCount: number;
  isDefault?: boolean;
  coveragePass?: boolean;
  completenessMissRows?: number;
  sanityInvalidRows?: number;
};

type DatasetIndexPayload = {
  generatedAt?: string;
  defaultFileName?: string;
  datasets: DatasetIndexItem[];
};

type LoadState = "loading-index" | "loading-dataset" | "ready" | "error";

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-12">
      <Card className="md:col-span-12">
        <CardHeader>
          <CardTitle>Workbench</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[420px] animate-pulse rounded-lg bg-white/5" />
        </CardContent>
      </Card>
      <Card className="md:col-span-12">
        <CardHeader>
          <CardTitle>Issuer Intelligence</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[320px] animate-pulse rounded-lg bg-white/5" />
        </CardContent>
      </Card>
    </div>
  );
}

function normalizeDatasetIndex(payload: unknown): DatasetIndexItem[] {
  const items = Array.isArray(payload)
    ? payload
    : typeof payload === "object" && payload !== null && Array.isArray((payload as Partial<DatasetIndexPayload>).datasets)
      ? (payload as DatasetIndexPayload).datasets
      : [];

  return items
    .filter((item): item is DatasetIndexItem => {
      if (typeof item !== "object" || item === null) return false;
      const candidate = item as Partial<DatasetIndexItem>;
      return (
        typeof candidate.fileName === "string" &&
        typeof candidate.pdfPath === "string" &&
        typeof candidate.dataPath === "string" &&
        typeof candidate.size === "number" &&
        typeof candidate.mtimeMs === "number" &&
        typeof candidate.rowCount === "number" &&
        typeof candidate.issuerCount === "number" &&
        typeof candidate.investorCount === "number" &&
        typeof candidate.pageCount === "number"
      );
    })
    .sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.fileName.localeCompare(b.fileName);
    });
}

export function ExplorePage() {
  const reduceMotion = useReducedMotion();

  const parsed = useAppStore((s) => s.parsed);
  const selection = useAppStore((s) => s.selection);
  const filters = useAppStore((s) => s.filters);
  const parseStatus = useAppStore((s) => s.parseStatus);
  const parseProgress = useAppStore((s) => s.parseProgress);
  const parseError = useAppStore((s) => s.parseError);
  const updateSelection = useAppStore((s) => s.updateSelection);
  const setParsed = useAppStore((s) => s.setParsed);
  const setFile = useAppStore((s) => s.setFile);
  const clearData = useAppStore((s) => s.clearData);
  const setParseStatus = useAppStore((s) => s.setParseStatus);
  const setParseProgress = useAppStore((s) => s.setParseProgress);
  const setParsePageInfo = useAppStore((s) => s.setParsePageInfo);
  const setParseError = useAppStore((s) => s.setParseError);

  const [loadState, setLoadState] = useState<LoadState>("loading-index");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<DatasetIndexItem[]>([]);
  const [selectedDataPath, setSelectedDataPath] = useState<string>("");
  const [activeStats, setActiveStats] = useState<ParsedStats | null>(null);

  const {
    allRows,
    filteredRows,
    filteredIssuers,
    filteredInvestors,
    selectedIssuerRows,
    activeRows,
    investorTypes,
    nationalities,
    domiciles,
  } = useDerivedData();

  const selectedDataset = useMemo(
    () => datasets.find((item) => item.dataPath === selectedDataPath) ?? null,
    [datasets, selectedDataPath],
  );

  const concentration = useMemo(() => {
    const rows = selectedIssuerRows.length > 0 ? selectedIssuerRows : filteredRows;
    const sorted = [...rows].sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0));
    return sorted.slice(0, 5).reduce((sum, row) => sum + (row.percentage ?? 0), 0);
  }, [filteredRows, selectedIssuerRows]);

  const issuerCount = useMemo(
    () => activeStats?.issuerCount ?? parsed?.graph.nodes.filter((node) => node.kind === "issuer").length ?? 0,
    [activeStats?.issuerCount, parsed?.graph.nodes],
  );

  const investorCount = useMemo(
    () => activeStats?.investorCount ?? parsed?.graph.nodes.filter((node) => node.kind === "investor").length ?? 0,
    [activeStats?.investorCount, parsed?.graph.nodes],
  );

  const coveragePass = activeStats?.coveragePass ?? true;

  useEffect(() => {
    let active = true;

    const loadIndex = async () => {
      setLoadState("loading-index");
      setLoadError(null);
      setParseStatus("parsing");
      setParseProgress(10);
      setParsePageInfo(0, 0);

      try {
        const response = await fetch("/data/index.json", { cache: "no-cache" });
        if (!response.ok) {
          throw new Error("Dataset belum tergenerate. Jalankan npm run dev (predev akan build dataset dari PDF root).");
        }

        const payload = (await response.json()) as unknown;
        if (!active) return;

        const entries = normalizeDatasetIndex(payload);
        if (entries.length === 0) {
          throw new Error("Dataset index kosong. Pastikan build-dataset.mjs berhasil.");
        }

        setDatasets(entries);
        const defaultEntry = entries.find((item) => item.isDefault) ?? entries[0];
        setSelectedDataPath(defaultEntry.dataPath);
        setParseProgress(25);
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Gagal membaca /data/index.json";
        setLoadState("error");
        setLoadError(message);
        setParseStatus("error");
        setParseError(message);
      }
    };

    void loadIndex();
    return () => {
      active = false;
    };
  }, [setParseError, setParsePageInfo, setParseProgress, setParseStatus]);

  useEffect(() => {
    if (!selectedDataset) return;
    let active = true;

    const loadDataset = async () => {
      clearData();
      setLoadState("loading-dataset");
      setLoadError(null);
      setParseStatus("parsing");
      setParseProgress(35);
      setParsePageInfo(0, selectedDataset.pageCount);
      setActiveStats(null);

      try {
        const dataResponse = await fetch(selectedDataset.dataPath, { cache: "no-cache" });
        if (!dataResponse.ok) {
          throw new Error(`Gagal membaca dataset JSON: ${selectedDataset.dataPath}`);
        }

        const dataPayload = (await dataResponse.json()) as Partial<{
          rows: ParsedOwnership["rows"];
          graph: ParsedOwnership["graph"];
          parseReport: ParsedOwnership["report"];
          report: ParsedOwnership["report"];
          stats: ParsedStats;
        }>;
        if (!active) return;

        setParseProgress(70);
        const report = dataPayload.report ?? dataPayload.parseReport;
        const stats = dataPayload.stats ?? null;
        if (!dataPayload.rows || !dataPayload.graph || !report) {
          throw new Error(`Dataset JSON invalid: ${selectedDataset.dataPath}`);
        }

        if (
          stats?.coveragePass === false ||
          (typeof stats?.completenessMissRows === "number" && stats.completenessMissRows > 0) ||
          (typeof stats?.sanityInvalidRows === "number" && stats.sanityInvalidRows > 0)
        ) {
          throw new Error(
            `DATA INCOMPLETE: coverage gate gagal (missRows=${stats?.completenessMissRows ?? "?"}, sanityInvalid=${stats?.sanityInvalidRows ?? "?"}).`,
          );
        }

        const hydrated: ParsedOwnership = {
          rows: dataPayload.rows,
          graph: dataPayload.graph,
          report,
          stats: stats ?? undefined,
        };
        setParsed(hydrated);
        setActiveStats(stats);
        setParseProgress(90);
        setParsePageInfo(report.pageCount, report.pageCount);

        const pdfResponse = await fetch(selectedDataset.pdfPath, { cache: "no-cache" });
        if (pdfResponse.ok) {
          const pdfBuffer = await pdfResponse.arrayBuffer();
          if (!active) return;
          const file = new File([pdfBuffer], selectedDataset.fileName, {
            type: "application/pdf",
            lastModified: Math.round(selectedDataset.mtimeMs),
          });
          setFile(file, pdfBuffer.slice(0));
        }

        if (!active) return;
        setLoadState("ready");
        setParseProgress(100);
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Gagal load dataset";
        setLoadState("error");
        setLoadError(message);
        setParseStatus("error");
        setParseError(message);
      }
    };

    void loadDataset();
    return () => {
      active = false;
    };
  }, [clearData, selectedDataset, setFile, setParseError, setParsePageInfo, setParseProgress, setParseStatus, setParsed]);

  useEffect(() => {
    if (!parsed || filteredRows.length === 0) return;

    const availableIssuerIds = new Set(filteredRows.map((row) => getIssuerId(row)));
    const availableInvestorIds = new Set(filteredRows.map((row) => getInvestorId(row)));

    let nextIssuerId = selection.selectedIssuerId && availableIssuerIds.has(selection.selectedIssuerId) ? selection.selectedIssuerId : null;
    let nextInvestorId =
      selection.selectedInvestorId && availableInvestorIds.has(selection.selectedInvestorId) ? selection.selectedInvestorId : null;

    const queryActive = filters.queryText.trim().length > 0;
    const investorQuery = queryActive && filters.queryMode === "investor";
    const issuerQuery = queryActive && filters.queryMode === "issuer";

    if (investorQuery) {
      if (!nextInvestorId) {
        nextInvestorId = filteredInvestors[0]?.investorId ?? null;
      }
      nextIssuerId = null;
    } else {
      if (!nextIssuerId) {
        const issuerTotals = new Map<string, number>();
        for (const row of filteredRows) {
          const key = getIssuerId(row);
          const weight = (row.totalHoldingShares ?? 0) + (row.percentage ?? 0) * 1_000_000;
          issuerTotals.set(key, (issuerTotals.get(key) ?? 0) + weight);
        }
        nextIssuerId = [...issuerTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      }
      if (issuerQuery) {
        nextInvestorId = null;
      }
    }

    if (nextIssuerId === selection.selectedIssuerId && nextInvestorId === selection.selectedInvestorId) return;
    updateSelection({
      selectedIssuerId: nextIssuerId,
      selectedInvestorId: nextInvestorId,
      selectedEdgeId: null,
    });
  }, [
    filteredInvestors,
    filteredRows,
    filters.queryMode,
    filters.queryText,
    parsed,
    selection.selectedInvestorId,
    selection.selectedIssuerId,
    updateSelection,
  ]);

  const showSkeleton = loadState === "loading-index" || loadState === "loading-dataset" || parseStatus === "parsing";

  const hasNoFilteredResult = !showSkeleton && loadState === "ready" && filteredRows.length === 0;

  return (
    <PageShell>
      <CommandPalette />
      <GlobalHeader
        title="Explore Lab"
        subtitle="Workbench untuk pipeline search, filter, evidence, dan visual modules yang lebih dalam dari Home."
        allRows={allRows}
        currentPage="explore"
        eyebrow="Flagship Lab"
        actions={[
          { label: "Browse Universe", to: "/", variant: "secondary" },
          { label: "Control Pressure", to: "/control-pressure", variant: "ghost" },
        ]}
      />

      <div className="flex flex-col gap-4">
        <section className="page-section p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <SectionIntro
                label="Explore Snapshot"
                description="Search + filter pipeline konsisten untuk semua modul visual dan tabel."
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {coveragePass ? (
                <Badge variant="coverage">
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Coverage 100%
                </Badge>
              ) : (
                <Badge variant="danger">
                  <AlertTriangle className="mr-1 h-3.5 w-3.5" /> DATA INCOMPLETE
                </Badge>
              )}
            </div>
          </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted">Total Emiten</div>
              <div className="mt-1 text-2xl font-semibold text-foreground">{issuerCount.toLocaleString("id-ID")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted">Total Pemegang</div>
              <div className="mt-1 text-2xl font-semibold text-foreground">{investorCount.toLocaleString("id-ID")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted">Rows</div>
              <div className="mt-1 text-2xl font-semibold text-foreground">{filteredRows.length.toLocaleString("id-ID")}</div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Emiten {filteredIssuers.length.toLocaleString("id-ID")}</Badge>
            <Badge>Investor {filteredInvestors.length.toLocaleString("id-ID")}</Badge>
            <Badge>Top5 concentration {fmtPercent(concentration)}</Badge>
          </div>
        </div>
        </section>

      {showSkeleton ? (
        <div className="mx-auto mb-4 max-w-[1700px] rounded-xl border border-border bg-panel/70 p-4">
          <div className="mb-2 flex items-center justify-between text-sm text-muted">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-cyan" />
              Menyiapkan dataset dari file statis
            </span>
            <span>{parseProgress}%</span>
          </div>
          <Progress value={parseProgress} className="h-2.5" />
        </div>
      ) : null}

      {loadState === "error" ? (
        <Card className="mx-auto mb-4 max-w-[1700px] border-red-500/30 bg-red-500/10">
          <CardContent className="py-4 text-sm text-red-200">
            <div className="mb-2 inline-flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" />
              {loadError ?? parseError ?? "Gagal memuat dataset"}
            </div>
            <p className="text-sm">
              Jika ini error gate, data belum 100% complete. Buka <Link to="/debug" className="underline">/debug</Link> untuk detail halaman/baris miss.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {hasNoFilteredResult ? (
        <Card className="mx-auto mb-4 max-w-[1700px] border-amber-400/30 bg-amber-400/10">
          <CardContent className="py-4 text-sm text-amber-100">
            Tidak ada data karena kombinasi filter terlalu ketat. Coba turunkan Min% atau nyalakan kembali status Lokal/Asing/Unknown.
          </CardContent>
        </Card>
      ) : null}

      <div className="mx-auto grid max-w-[1700px] grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
        <FiltersPanel
          investorTypes={investorTypes}
          nationalities={nationalities}
          domiciles={domiciles}
          resultCounts={{
            rows: filteredRows.length,
            issuers: filteredIssuers.length,
            investors: filteredInvestors.length,
          }}
        />

        <motion.section
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          className="grid gap-4 md:grid-cols-12"
        >
          {showSkeleton ? (
            <div className="md:col-span-12">
              <DashboardSkeleton />
            </div>
          ) : (
            <>
              <div className="md:col-span-12">
                <Card>
                  <CardHeader>
                    <CardTitle>Explore Workbench</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <p className="max-w-3xl text-sm leading-7 text-[#665A4F]">
                      Explore dipakai untuk filter, evidence, dan issuer list. Radar regulasi penuh dipisah ke halaman
                      tersendiri supaya tidak redundant dengan Control Pressure.
                    </p>
                    <Link
                      to="/control-pressure"
                      className="inline-flex shrink-0 rounded-full border border-[#1D4C45] bg-[#EDF4F1] px-4 py-2 text-[13px] font-semibold text-[#1D4C45] transition-colors hover:bg-[#DFECE8]"
                    >
                      Open Control Pressure
                    </Link>
                  </CardContent>
                </Card>
              </div>

              <Card className="md:col-span-12">
                <CardHeader>
                  <CardTitle>Ownership Table</CardTitle>
                </CardHeader>
                <CardContent>
                  <OwnershipTable
                    rows={activeRows}
                    selectedRowId={selection.selectedEdgeId ?? null}
                    onSelectRow={(row) =>
                      updateSelection({
                        selectedIssuerId: getIssuerId(row),
                        selectedInvestorId: getInvestorId(row),
                        selectedEdgeId: row.id,
                        focusedEvidenceRowId: null,
                      })
                    }
                  />
                </CardContent>
              </Card>

              <Card className="md:col-span-12">
                <CardHeader>
                  <CardTitle>Issuer Intelligence List</CardTitle>
                </CardHeader>
                <CardContent>
                  <IssuerAccordion
                    rows={filteredRows}
                    selectedIssuerId={selection.selectedIssuerId}
                    onSelectIssuer={(issuerId) =>
                      updateSelection({ selectedIssuerId: issuerId, selectedInvestorId: null, selectedEdgeId: null })
                    }
                    onSelectInvestor={(investorId) => updateSelection({ selectedInvestorId: investorId, selectedEdgeId: null })}
                  />
                </CardContent>
              </Card>
            </>
          )}
        </motion.section>
      </div>
      </div>
      <EditorialFooter />
    </PageShell>
  );
}
