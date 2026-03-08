import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { CommandPalette } from "../components/command-palette";
import { GlobalHeader } from "../components/global-header";
import { IssuerAccordion } from "../components/issuer-accordion";
import { OwnershipTable } from "../components/ownership-table";
import { EditorialFooter, PageShell } from "../components/page-shell";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { useDatasetLoader } from "../hooks/use-dataset-loader";
import { useDerivedData } from "../hooks/use-derived-data";
import { getInvestorId, getIssuerId } from "../lib/graph";
import { fmtPercent } from "../lib/utils";
import { useAppStore } from "../store/app-store";
import type { OwnershipRow } from "../types/ownership";

const SankeyFlow = lazy(async () => {
  const module = await import("../components/sankey-flow");
  return { default: module.SankeyFlow };
});

type DetailMode = "issuer" | "investor";

type DetailDashboardPageProps = {
  mode: DetailMode;
};

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-12">
      <Card className="md:col-span-12">
        <CardHeader>
          <CardTitle>Ownership Intelligence Board</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <div className="h-[360px] animate-pulse rounded-lg bg-white/5" />
            <div className="h-[420px] animate-pulse rounded-lg bg-white/5" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function safeDecodeURIComponent(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function toIssuerIdFromCode(shareCode: string | null): string | null {
  if (!shareCode) return null;
  const code = shareCode.trim().toUpperCase();
  if (!code) return null;
  return `issuer:${code}`;
}

function resolveInvestorIdFromParam(rows: OwnershipRow[], investorParam: string | null): string | null {
  if (!investorParam) return null;
  if (investorParam.toLowerCase().startsWith("investor:")) return investorParam;

  const target = investorParam.trim().toUpperCase();
  if (!target) return null;
  const exact = rows.find((row) => row.investorName.trim().toUpperCase() === target);
  if (exact) return getInvestorId(exact);
  const byContains = rows.find((row) => row.investorName.trim().toUpperCase().includes(target));
  if (byContains) return getInvestorId(byContains);
  return `investor:${target}`;
}

export function DetailDashboardPage({ mode }: DetailDashboardPageProps) {
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();

  const parsed = useAppStore((s) => s.parsed);
  const focus = useAppStore((s) => s.focus);
  const selection = useAppStore((s) => s.selection);
  const parseStatus = useAppStore((s) => s.parseStatus);
  const parseProgress = useAppStore((s) => s.parseProgress);
  const parseError = useAppStore((s) => s.parseError);
  const updateSelection = useAppStore((s) => s.updateSelection);
  const setFocusIssuer = useAppStore((s) => s.setFocusIssuer);
  const setFocusInvestor = useAppStore((s) => s.setFocusInvestor);
  const resetFilters = useAppStore((s) => s.resetFilters);

  const { selectedDataset, loadState, loadError, activeStats } = useDatasetLoader();
  const {
    allRows,
    filteredRows,
    filteredIssuers,
    filteredInvestors,
    contextRows,
    contextSummary,
    contextFocusMeta,
  } = useDerivedData();

  const shareCodeParam = mode === "issuer" ? params.shareCode?.trim().toUpperCase() ?? "" : "";
  const investorParam = mode === "investor" ? safeDecodeURIComponent(params.investorKey ?? null) ?? "" : "";
  const highlightInvestorParam = safeDecodeURIComponent(searchParams.get("highlightInvestor"));

  const routeIssuerId = useMemo(() => toIssuerIdFromCode(shareCodeParam), [shareCodeParam]);
  const resolvedInvestorId = useMemo(
    () => resolveInvestorIdFromParam(allRows, investorParam),
    [allRows, investorParam],
  );
  const resolvedHighlightInvestorId = useMemo(() => {
    if (!highlightInvestorParam) return null;
    if (highlightInvestorParam.toLowerCase().startsWith("investor:")) return highlightInvestorParam;
    return `investor:${highlightInvestorParam.trim().toUpperCase()}`;
  }, [highlightInvestorParam]);

  const didResetFiltersRef = useRef(false);
  const lastIssuerRouteRef = useRef<string | null>(mode === "issuer" ? routeIssuerId : null);

  useEffect(() => {
    if (didResetFiltersRef.current) return;
    resetFilters();
    didResetFiltersRef.current = true;
  }, [resetFilters]);

  useEffect(() => {
    if (mode !== "issuer") {
      lastIssuerRouteRef.current = null;
      return;
    }
    if (!lastIssuerRouteRef.current && routeIssuerId) {
      lastIssuerRouteRef.current = routeIssuerId;
    }
  }, [mode, routeIssuerId]);

  const sourceRowsByMode = mode === "investor" || focus.focusType === "investor" ? allRows : filteredRows;

  useEffect(() => {
    if (loadState !== "ready") return;
    if (sourceRowsByMode.length === 0) return;

    const availableIssuerIds = new Set(sourceRowsByMode.map((row) => getIssuerId(row)));
    const availableInvestorIds = new Set(sourceRowsByMode.map((row) => getInvestorId(row)));

    if (mode === "issuer") {
      const fallbackIssuerId = filteredIssuers[0]?.issuerId ?? null;
      const nextIssuerId =
        routeIssuerId && availableIssuerIds.has(routeIssuerId) ? routeIssuerId : fallbackIssuerId;
      if (!nextIssuerId) return;

      const routeKey = routeIssuerId ?? nextIssuerId;
      const routeChanged = lastIssuerRouteRef.current !== routeKey;
      if (routeChanged) {
        lastIssuerRouteRef.current = routeKey;
      }

      const focusInvestorId = focus.focusInvestorId;
      const keepInvestorOverride =
        !routeChanged &&
        focus.focusType === "investor" &&
        focusInvestorId !== null &&
        availableInvestorIds.has(focusInvestorId);

      if (keepInvestorOverride) {
        const nextInvestorId = focusInvestorId;
        if (
          selection.selectedIssuerId !== null ||
          selection.selectedInvestorId !== nextInvestorId ||
          selection.selectedEdgeId !== null ||
          selection.focusedEvidenceRowId !== null
        ) {
          updateSelection({
            selectedIssuerId: null,
            selectedInvestorId: nextInvestorId,
            selectedEdgeId: null,
            focusedEvidenceRowId: null,
          });
        }
        return;
      }

      if (focus.focusType !== "issuer" || focus.focusIssuerId !== nextIssuerId || focus.focusInvestorId) {
        setFocusIssuer(nextIssuerId);
      }

      const issuerRows = sourceRowsByMode.filter((row) => getIssuerId(row) === nextIssuerId);
      const nextInvestorId =
        resolvedHighlightInvestorId && availableInvestorIds.has(resolvedHighlightInvestorId)
          ? resolvedHighlightInvestorId
          : issuerRows[0]
            ? getInvestorId(issuerRows[0])
            : null;

      if (
        selection.selectedIssuerId !== nextIssuerId ||
        selection.selectedInvestorId !== nextInvestorId ||
        selection.selectedEdgeId !== null ||
        selection.focusedEvidenceRowId !== null
      ) {
        updateSelection({
          selectedIssuerId: nextIssuerId,
          selectedInvestorId: nextInvestorId,
          selectedEdgeId: null,
          focusedEvidenceRowId: null,
        });
      }
      return;
    }

    const fallbackInvestorId = filteredInvestors[0]?.investorId ?? null;
    const nextInvestorId =
      resolvedInvestorId && availableInvestorIds.has(resolvedInvestorId) ? resolvedInvestorId : fallbackInvestorId;
    if (!nextInvestorId) return;

    if (focus.focusType !== "investor" || focus.focusInvestorId !== nextInvestorId || focus.focusIssuerId) {
      setFocusInvestor(nextInvestorId);
    }

    const nextIssuerId: string | null = null;

    if (
      selection.selectedInvestorId !== nextInvestorId ||
      selection.selectedIssuerId !== nextIssuerId ||
      selection.selectedEdgeId !== null ||
      selection.focusedEvidenceRowId !== null
    ) {
      updateSelection({
        selectedInvestorId: nextInvestorId,
        selectedIssuerId: nextIssuerId,
        selectedEdgeId: null,
        focusedEvidenceRowId: null,
      });
    }
  }, [
    filteredInvestors,
    filteredIssuers,
    focus.focusInvestorId,
    focus.focusIssuerId,
    focus.focusType,
    loadState,
    mode,
    resolvedHighlightInvestorId,
    resolvedInvestorId,
    routeIssuerId,
    selection.selectedEdgeId,
    selection.focusedEvidenceRowId,
    selection.selectedInvestorId,
    selection.selectedIssuerId,
    setFocusInvestor,
    setFocusIssuer,
    sourceRowsByMode,
    updateSelection,
  ]);

  const focusedRow = useMemo(() => {
    if (!parsed) return null;
    if (selection.focusedEvidenceRowId) {
      const byFocus = parsed.rows.find((row) => row.id === selection.focusedEvidenceRowId);
      if (byFocus) return byFocus;
    }
    if (selection.selectedEdgeId) {
      const byEdge = parsed.rows.find((row) => row.id === selection.selectedEdgeId);
      if (byEdge) return byEdge;
    }
    if (focus.focusType === "issuer" && focus.focusIssuerId) {
      return contextRows.find((row) => getIssuerId(row) === focus.focusIssuerId) ?? contextRows[0] ?? parsed.rows[0] ?? null;
    }
    if (focus.focusType === "investor" && focus.focusInvestorId) {
      return contextRows.find((row) => getInvestorId(row) === focus.focusInvestorId) ?? contextRows[0] ?? parsed.rows[0] ?? null;
    }
    return contextRows[0] ?? parsed.rows[0] ?? null;
  }, [
    contextRows,
    focus.focusInvestorId,
    focus.focusIssuerId,
    focus.focusType,
    parsed,
    selection.focusedEvidenceRowId,
    selection.selectedEdgeId,
  ]);

  const effectiveIssuerId =
    mode === "issuer" && focus.focusType !== "investor"
      ? routeIssuerId ?? focus.focusIssuerId ?? selection.selectedIssuerId
      : null;
  const effectiveInvestorId =
    mode === "investor"
      ? resolvedInvestorId ?? focus.focusInvestorId ?? selection.selectedInvestorId
      : focus.focusType === "investor"
        ? focus.focusInvestorId ?? selection.selectedInvestorId
        : selection.selectedInvestorId;

  const pageContextRows = useMemo(() => {
    if (mode === "issuer") {
      if (focus.focusType === "investor" && effectiveInvestorId) {
        return filteredRows.filter((row) => getInvestorId(row) === effectiveInvestorId);
      }
      if (!effectiveIssuerId) return filteredRows;
      return filteredRows.filter((row) => getIssuerId(row) === effectiveIssuerId);
    }
    if (!effectiveInvestorId) return filteredRows;
    return filteredRows.filter((row) => getInvestorId(row) === effectiveInvestorId);
  }, [effectiveInvestorId, effectiveIssuerId, filteredRows, focus.focusType, mode]);

  const activeContextRows = pageContextRows;
  const focusTypeForModules = (focus.focusType ?? (mode === "investor" ? "investor" : "issuer")) as
    | "issuer"
    | "investor";
  const graphRows = filteredRows;

  const focusedRowFromContext = useMemo(() => {
    if (focusedRow) return focusedRow;
    return activeContextRows[0] ?? null;
  }, [activeContextRows, focusedRow]);
  const coveragePass = activeStats?.coveragePass ?? selectedDataset?.coveragePass ?? true;
  const showSkeleton = loadState === "loading-index" || loadState === "loading-dataset" || parseStatus === "parsing";
  const hasNoFilteredResult = !showSkeleton && loadState === "ready" && activeContextRows.length === 0;

  const issuerCount = useMemo(
    () => activeStats?.issuerCount ?? parsed?.graph.nodes.filter((node) => node.kind === "issuer").length ?? 0,
    [activeStats?.issuerCount, parsed?.graph.nodes],
  );
  const investorCount = useMemo(
    () => activeStats?.investorCount ?? parsed?.graph.nodes.filter((node) => node.kind === "investor").length ?? 0,
    [activeStats?.investorCount, parsed?.graph.nodes],
  );

  const pageTitle =
    mode === "issuer"
      ? contextFocusMeta?.type === "issuer"
        ? `${contextFocusMeta.shareCode} | ${contextFocusMeta.issuerName}`
        : shareCodeParam
          ? `${shareCodeParam} | Detail Emiten`
          : "Detail Emiten"
      : contextFocusMeta?.type === "investor"
        ? contextFocusMeta.investorName
        : "Detail Investor";

  const pageSubtitle =
    mode === "issuer" ? "Analysis workstation fokus emiten terpilih." : "Analysis workstation fokus investor terpilih.";

  const [jumpQuery, setJumpQuery] = useState("");

  const issuerJumpOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of allRows) {
      const issuerId = getIssuerId(row);
      if (!map.has(issuerId)) map.set(issuerId, row.shareCode);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [allRows]);

  const investorJumpOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of allRows) {
      const investorId = getInvestorId(row);
      if (!map.has(investorId)) map.set(investorId, row.investorName);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [allRows]);

  const navigateToIssuer = (issuerId: string) => {
    const row = allRows.find((item) => getIssuerId(item) === issuerId);
    if (!row) return;
    setFocusIssuer(issuerId);
    navigate(`/emiten/${encodeURIComponent(row.shareCode)}`);
  };

  const focusInvestorInDashboard = (investorId: string) => {
    if (!allRows.some((item) => getInvestorId(item) === investorId)) return;
    setFocusInvestor(investorId);
  };

  return (
    <PageShell>
      <CommandPalette />
      <GlobalHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        allRows={allRows}
        currentPage="workstation"
        metadata={mode === "issuer" ? "Secondary workstation for issuer deep-dive" : "Secondary workstation for investor deep-dive"}
        actions={[
          { label: "Browse Universe", to: "/", variant: "secondary" },
          { label: "Explore Lab", to: "/explore", variant: "ghost" },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border/70 bg-panel/75 px-4 py-4 backdrop-blur transition-[border-color,box-shadow,background-color] duration-300 hover:border-border-strong/75 hover:shadow-panel">
        <div>
          <div className="mb-1 inline-flex items-center gap-2 text-sm text-muted">
            <Link to="/" className="transition-colors duration-150 hover:text-foreground">
              Home
            </Link>
            <span>/</span>
            <span>{mode === "issuer" ? "Emiten" : "Investor"}</span>
          </div>
          <Link
            to="/"
            className="mb-2 inline-flex items-center gap-2 text-sm text-muted transition-colors duration-150 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Home
          </Link>
          <h1 className="text-[30px] font-semibold tracking-tight text-foreground md:text-[34px]">{pageTitle}</h1>
          <p className="mt-1 text-sm text-muted">{pageSubtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-panel px-2 py-1.5 transition-[border-color,box-shadow,background-color] duration-200 hover:border-border-strong/80 hover:bg-panel-2/70">
            <input
              list={mode === "issuer" ? "issuer-jump-list" : "investor-jump-list"}
              value={jumpQuery}
              onChange={(event) => setJumpQuery(event.target.value)}
              placeholder={mode === "issuer" ? "Jump ticker..." : "Jump investor..."}
              className="h-8 w-[220px] rounded-md bg-transparent px-2 text-sm text-foreground outline-none transition-[background-color,box-shadow,color] duration-200 placeholder:text-muted hover:bg-panel-2/45 focus:bg-panel-2/55 focus:ring-2 focus:ring-focus/25"
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                const value = jumpQuery.trim();
                if (!value) return;
                if (mode === "issuer") {
                  navigate(`/emiten/${encodeURIComponent(value.toUpperCase())}`);
                  return;
                }
                const investorId = investorJumpOptions.find(([, name]) =>
                  name.toUpperCase().includes(value.toUpperCase()),
                )?.[0];
                if (investorId) navigate(`/investor/${encodeURIComponent(investorId)}`);
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const value = jumpQuery.trim();
                if (!value) return;
                if (mode === "issuer") {
                  navigate(`/emiten/${encodeURIComponent(value.toUpperCase())}`);
                  return;
                }
                const investorId = investorJumpOptions.find(([, name]) =>
                  name.toUpperCase().includes(value.toUpperCase()),
                )?.[0];
                if (investorId) navigate(`/investor/${encodeURIComponent(investorId)}`);
              }}
            >
              Jump
            </Button>
          </div>
        </div>
      </div>

      <datalist id="issuer-jump-list">
        {issuerJumpOptions.map(([issuerId, shareCode]) => (
          <option key={issuerId} value={shareCode} />
        ))}
      </datalist>
      <datalist id="investor-jump-list">
        {investorJumpOptions.map(([investorId, investorName]) => (
          <option key={investorId} value={investorName}>
            {investorId}
          </option>
        ))}
      </datalist>

      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Card className="transition-all duration-300 hover:-translate-y-[1px] hover:border-border-strong/80 hover:shadow-panel">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted">Total Emiten</div>
            <div className="mt-1 text-2xl font-semibold text-foreground">{issuerCount.toLocaleString("id-ID")}</div>
          </CardContent>
        </Card>
        <Card className="transition-all duration-300 hover:-translate-y-[1px] hover:border-border-strong/80 hover:shadow-panel">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted">Total Pemegang</div>
            <div className="mt-1 text-2xl font-semibold text-foreground">{investorCount.toLocaleString("id-ID")}</div>
          </CardContent>
        </Card>
        <Card className="transition-all duration-300 hover:-translate-y-[1px] hover:border-border-strong/80 hover:shadow-panel">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted">Rows Context</div>
            <div className="mt-1 text-2xl font-semibold text-foreground">{contextSummary.rowCount.toLocaleString("id-ID")}</div>
          </CardContent>
        </Card>
        <Card className="transition-all duration-300 hover:-translate-y-[1px] hover:border-border-strong/80 hover:shadow-panel">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted">Top5 Concentration</div>
            <div className="mt-1 text-2xl font-semibold text-focus">{fmtPercent(contextSummary.topConcentration)}</div>
          </CardContent>
        </Card>
        <Card className="transition-all duration-300 hover:-translate-y-[1px] hover:border-border-strong/80 hover:shadow-panel">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted">Exposure Mix</div>
            <div className="mt-1 text-sm text-foreground">
              L {contextSummary.localExposurePct.toFixed(1)}% | A {contextSummary.foreignExposurePct.toFixed(1)}% | U {contextSummary.unknownExposurePct.toFixed(1)}%
            </div>
            <div className="mt-1 text-xs text-muted">
              Dominan: {contextSummary.dominantCounterpartyLabel ?? "-"} ({fmtPercent(contextSummary.dominantCounterpartyPct)})
            </div>
            <div className="mt-1 text-xs text-muted">
              KONGLO {contextSummary.kongloCount.toLocaleString("id-ID")} | PEP {contextSummary.pepCount.toLocaleString("id-ID")}
            </div>
          </CardContent>
        </Card>
      </div>

      {showSkeleton ? (
        <div className="mb-4 rounded-xl border border-border bg-panel/70 p-4">
          <div className="mb-2 flex items-center justify-between text-sm text-muted">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-focus" />
              Menyiapkan dataset dari file statis
            </span>
            <span>{parseProgress}%</span>
          </div>
          <Progress value={parseProgress} className="h-2.5" />
        </div>
      ) : null}

      {loadState === "error" ? (
        <Card className="mb-4 border-danger/35 bg-danger/12">
          <CardContent className="py-4 text-sm text-danger">
            <div className="mb-2 inline-flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" />
              {loadError ?? parseError ?? "Gagal memuat dataset"}
            </div>
            <p className="text-sm">Dataset belum siap. Coba reload atau cek file sumber data.</p>
          </CardContent>
        </Card>
      ) : null}

      {!coveragePass && loadState === "ready" ? (
        <Card className="mb-4 border-danger/35 bg-danger/12">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 py-4 text-sm text-danger">
            <span>DATA INCOMPLETE. Coverage gate gagal, analisis harus diverifikasi manual.</span>
          </CardContent>
        </Card>
      ) : null}

      {hasNoFilteredResult ? (
        <Card className="mb-4 border-warning/35 bg-warning/12">
          <CardContent className="py-4 text-sm text-warning">
            Tidak ada data karena kombinasi filter terlalu ketat. Coba turunkan Min% atau nyalakan kembali status
            Lokal/Asing/Unknown.
          </CardContent>
        </Card>
      ) : null}

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
            <Card className="md:col-span-12 overflow-hidden transition-all duration-300 hover:border-border-strong/80 hover:shadow-panel">
              <CardHeader>
                <CardTitle>Ownership Intelligence Board</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid gap-0">
                  <div className="border-b border-border/65 p-4">
                    <div className="mb-3 text-xs uppercase tracking-wide text-muted">Jaringan Koneksi</div>
                    <Suspense
                      fallback={
                        <div className="flex h-[480px] items-center justify-center rounded-xl border border-border bg-background/25 text-sm text-muted">
                          Menyiapkan scene 3D...
                        </div>
                      }
                    >
                      <SankeyFlow
                        rows={graphRows}
                        selectedIssuerId={effectiveIssuerId}
                        selectedInvestorId={effectiveInvestorId}
                        focusType={focusTypeForModules}
                        onSelectIssuer={(issuerId) => navigateToIssuer(issuerId)}
                        onSelectInvestor={(investorId) => focusInvestorInDashboard(investorId)}
                      />
                    </Suspense>
                  </div>
                  <div className="p-4">
                    <div className="mb-3 text-xs uppercase tracking-wide text-muted">Pemegang Saham</div>
                    <OwnershipTable
                      rows={activeContextRows}
                      selectedRowId={focusedRowFromContext?.id ?? null}
                      onSelectRow={(row) => {
                        const issuerId = getIssuerId(row);
                        const investorId = getInvestorId(row);
                        if (mode === "issuer") {
                          setFocusInvestor(investorId);
                          updateSelection({
                            selectedIssuerId: null,
                            selectedInvestorId: investorId,
                            selectedEdgeId: row.id,
                            focusedEvidenceRowId: row.id,
                          });
                          return;
                        }
                        setFocusInvestor(investorId);
                        updateSelection({
                          selectedIssuerId: issuerId,
                          selectedInvestorId: investorId,
                          selectedEdgeId: row.id,
                          focusedEvidenceRowId: row.id,
                        });
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-12 transition-all duration-300 hover:border-border-strong/80 hover:shadow-panel">
              <CardHeader>
                <CardTitle>Issuer Intelligence List</CardTitle>
              </CardHeader>
              <CardContent>
                <IssuerAccordion
                  rows={filteredRows}
                  selectedIssuerId={effectiveIssuerId}
                  onSelectIssuer={(issuerId) => navigateToIssuer(issuerId)}
                  onSelectInvestor={(investorId) => focusInvestorInDashboard(investorId)}
                />
              </CardContent>
            </Card>
          </>
        )}
      </motion.section>
      <EditorialFooter />
    </PageShell>
  );
}
