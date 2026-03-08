import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { EvidenceViewer } from "../components/evidence-viewer";
import { GlobalHeader } from "../components/global-header";
import { EditorialFooter, PageShell } from "../components/page-shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { useDatasetLoader } from "../hooks/use-dataset-loader";
import { useAppStore } from "../store/app-store";
import type { OwnershipEvidence, ParseCoveragePage } from "../types/ownership";

function buildCoverageEvidence(page: ParseCoveragePage | null, index: number | null): OwnershipEvidence | null {
  if (!page || index === null) return null;
  const sample = page.missSamples[index] ?? null;
  if (!sample) return null;
  return {
    pageIndex: page.pageIndex,
    yTopNorm: sample.yTopNorm,
    yBottomNorm: Math.min(1, sample.yTopNorm + 0.03),
    rawRowText: sample.rawText,
  };
}

export function DebugPage() {
  const navigate = useNavigate();
  const parseStatus = useAppStore((s) => s.parseStatus);
  const parseProgress = useAppStore((s) => s.parseProgress);
  const parseError = useAppStore((s) => s.parseError);
  const { loadState, loadError } = useDatasetLoader();
  const parsed = useAppStore((s) => s.parsed);
  const fileBuffer = useAppStore((s) => s.fileBuffer);
  const [selectedInvalid, setSelectedInvalid] = useState<number | null>(null);
  const [selectedValidRowId, setSelectedValidRowId] = useState<string | null>(null);
  const [selectedCoveragePage, setSelectedCoveragePage] = useState<number | null>(null);
  const [selectedCoverageMiss, setSelectedCoverageMiss] = useState<number | null>(null);

  const coveragePages = parsed?.report.tableCoverage ?? [];
  const selectedCoverage = useMemo(
    () => (selectedCoveragePage === null ? null : coveragePages[selectedCoveragePage] ?? null),
    [coveragePages, selectedCoveragePage],
  );

  const evidence = useMemo<OwnershipEvidence | null>(() => {
    if (!parsed) return null;

    const coverageEvidence = buildCoverageEvidence(selectedCoverage, selectedCoverageMiss);
    if (coverageEvidence) return coverageEvidence;

    if (selectedValidRowId) {
      const row = parsed.rows.find((item) => item.id === selectedValidRowId);
      if (row) return row.evidence;
    }

    if (selectedInvalid !== null) {
      const sample = parsed.report.invalidSamples[selectedInvalid];
      if (sample) {
        return {
          pageIndex: sample.pageIndex,
          yTopNorm: sample.yTopNorm ?? 0.05,
          yBottomNorm: sample.yBottomNorm ?? 0.12,
          rawRowText: sample.rawText,
        };
      }
    }

    return parsed.rows[0]?.evidence ?? null;
  }, [parsed, selectedCoverage, selectedCoverageMiss, selectedInvalid, selectedValidRowId]);

  if (!parsed && (loadState === "loading-index" || loadState === "loading-dataset" || parseStatus === "parsing")) {
    return (
      <PageShell>
        <GlobalHeader
          title="Debug"
          subtitle="Tool operasional untuk verifikasi coverage, invalid rows, dan evidence."
          allRows={[]}
          currentPage="debug"
          actions={[{ label: "Back to Explore", to: "/explore", variant: "secondary" }]}
        />
        <Card className="mx-auto w-full max-w-lg">
          <CardContent className="space-y-4 py-8">
            <p className="text-sm text-muted">Memuat dataset debug...</p>
            <Progress value={parseProgress} className="h-2.5" />
          </CardContent>
        </Card>
        <EditorialFooter />
      </PageShell>
    );
  }

  if (!parsed) {
    return (
      <PageShell>
        <GlobalHeader
          title="Debug"
          subtitle="Tool operasional untuk verifikasi coverage, invalid rows, dan evidence."
          allRows={[]}
          currentPage="debug"
          actions={[{ label: "Back to Explore", to: "/explore", variant: "secondary" }]}
        />
        <Card className="mx-auto w-full max-w-lg">
          <CardContent className="space-y-3 py-8">
            <p className="text-sm text-muted">{loadError ?? parseError ?? "Belum ada data parse."}</p>
            <Button onClick={() => navigate("/")}>Kembali ke Dashboard</Button>
          </CardContent>
        </Card>
        <EditorialFooter />
      </PageShell>
    );
  }

  const coveragePass =
    parsed.stats?.coveragePass ??
    (coveragePages.length > 0
      ? coveragePages.every((page) => page.missCount === 0 && (page.invalidCriticalCount ?? 0) === 0)
      : parsed.report.invalidRows === 0);

  return (
    <PageShell>
      <GlobalHeader
        title="Debug"
        subtitle="Coverage report, miss samples, invalid rows, dan evidence viewer untuk quality control parser."
        allRows={parsed.rows}
        currentPage="debug"
        actions={[
          { label: "Back to Explore", to: "/explore", variant: "secondary" },
          { label: "Browse Universe", to: "/", variant: "ghost" },
        ]}
      />
      <div className="mx-auto mb-4 flex max-w-[1700px] items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Dashboard
        </Link>

        {coveragePass ? (
          <Badge variant="coverage">Coverage 100%</Badge>
        ) : (
          <Badge variant="danger">DATA INCOMPLETE</Badge>
        )}
      </div>

      <div className="mx-auto grid max-w-[1700px] gap-4 lg:grid-cols-[520px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Parse Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border border-border bg-background/25 p-3">
                <div className="text-muted">Pages</div>
                <div className="mt-1 font-mono text-foreground">{parsed.report.pageCount}</div>
              </div>
              <div className="rounded-md border border-border bg-background/25 p-3">
                <div className="text-muted">Table Pages</div>
                <div className="mt-1 font-mono text-foreground">{parsed.report.detectedTablePages.length}</div>
              </div>
              <div className="rounded-md border border-border bg-background/25 p-3">
                <div className="text-muted">Valid Rows</div>
                <div className="mt-1 font-mono text-local">{parsed.report.validRows.toLocaleString("id-ID")}</div>
              </div>
              <div className="rounded-md border border-border bg-background/25 p-3">
                <div className="text-muted">Invalid Rows</div>
                <div className="mt-1 font-mono text-foreign">{parsed.report.invalidRows.toLocaleString("id-ID")}</div>
              </div>
            </div>

            <div className="grid gap-2 text-sm">
              <div className="rounded-md border border-border bg-background/25 p-3">
                <div className="text-muted">Miss Rows</div>
                <div className="mt-1 font-mono text-foreground">{parsed.stats?.completenessMissRows ?? 0}</div>
              </div>
              <div className="rounded-md border border-border bg-background/25 p-3">
                <div className="text-muted">Sanity Invalid Rows</div>
                <div className="mt-1 font-mono text-foreground">{parsed.stats?.sanityInvalidRows ?? 0}</div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs uppercase tracking-wide text-muted">Coverage Per Table Page</h4>
              <div className="max-h-[260px] space-y-1 overflow-auto rounded-lg border border-border bg-background/25 p-2">
                {coveragePages.length === 0 ? (
                  <p className="text-sm text-muted">Belum ada tableCoverage di report.</p>
                ) : (
                  coveragePages.map((page, index) => (
                    <button
                      type="button"
                      key={`page-${page.pageIndex}`}
                      onClick={() => {
                        setSelectedCoveragePage(index);
                        setSelectedCoverageMiss(0);
                        setSelectedInvalid(null);
                        setSelectedValidRowId(null);
                      }}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                        selectedCoveragePage === index ? "border-focus/60 bg-focus/16" : "border-border hover:bg-panel-2/55"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-foreground">Page {page.pageIndex + 1}</span>
                        {page.missCount === 0 && (page.invalidCriticalCount ?? 0) === 0 ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-danger" />
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted">
                        candidate={page.candidateCount} mapped={page.mappedCount} miss={page.missCount} invalid={page.invalidCriticalCount ?? 0}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {selectedCoverage ? (
              <div className="space-y-2 rounded-lg border border-border bg-background/25 p-2">
                <h4 className="text-xs uppercase tracking-wide text-muted">Miss Samples (up to 20)</h4>
                <div className="max-h-[180px] space-y-1 overflow-auto">
                  {selectedCoverage.missSamples.length === 0 ? (
                    <p className="text-sm text-muted">Tidak ada miss sample pada halaman ini.</p>
                  ) : (
                    selectedCoverage.missSamples.map((sample, index) => (
                      <button
                        key={sample.groupId}
                        type="button"
                        onClick={() => setSelectedCoverageMiss(index)}
                        className={`w-full rounded-md border px-2 py-1.5 text-left text-xs ${
                          selectedCoverageMiss === index ? "border-focus/60 bg-focus/16" : "border-border hover:bg-panel-2/55"
                        }`}
                      >
                        <div className="font-mono text-[11px] text-muted">{sample.groupId}</div>
                        <div className="line-clamp-2 text-foreground">{sample.rawText}</div>
                      </button>
                    ))
                  )}
                </div>

                <div className="rounded-md border border-border bg-background/25 p-2">
                  <div className="mb-1 text-xs uppercase tracking-wide text-muted">Column Bands Snapshot</div>
                  <div className="max-h-[120px] space-y-1 overflow-auto text-[11px] text-muted">
                    {selectedCoverage.columnBands.map((band) => (
                      <div key={band.key} className="font-mono">
                        {band.key}: L {band.left.toFixed(1)} | C {band.center.toFixed(1)} | R {band.right.toFixed(1)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <h4 className="text-xs uppercase tracking-wide text-muted">Invalid Samples</h4>
              <div className="max-h-[220px] space-y-1 overflow-auto rounded-lg border border-border bg-background/25 p-2">
                {parsed.report.invalidSamples.length === 0 ? (
                  <p className="text-sm text-muted">No invalid rows.</p>
                ) : (
                  parsed.report.invalidSamples.map((sample, index) => (
                    <button
                      type="button"
                      key={`${sample.pageIndex}-${index}`}
                      onClick={() => {
                        setSelectedInvalid(index);
                        setSelectedValidRowId(null);
                        setSelectedCoveragePage(null);
                        setSelectedCoverageMiss(null);
                      }}
                      className={`w-full rounded-md border px-2 py-2 text-left text-xs ${
                        selectedInvalid === index ? "border-focus/60 bg-focus/16" : "border-border hover:bg-panel-2/55"
                      }`}
                    >
                      <div className="font-mono text-[11px] text-muted">page {sample.pageIndex + 1}</div>
                      <div className="line-clamp-2 text-foreground">{sample.rawText}</div>
                      <div className="line-clamp-2 text-[11px] text-muted">{sample.reason}</div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs uppercase tracking-wide text-muted">Valid Rows (sample)</h4>
              <div className="max-h-[220px] space-y-1 overflow-auto rounded-lg border border-border bg-background/25 p-2">
                {parsed.rows.slice(0, 120).map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => {
                      setSelectedValidRowId(row.id);
                      setSelectedInvalid(null);
                      setSelectedCoveragePage(null);
                      setSelectedCoverageMiss(null);
                    }}
                    className={`w-full rounded-md border px-2 py-1.5 text-left text-xs ${
                      selectedValidRowId === row.id ? "border-focus/60 bg-focus/16" : "border-border hover:bg-panel-2/55"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-foreground">{row.shareCode}</span>
                      <span className="font-mono text-[11px] text-muted">p.{row.evidence.pageIndex + 1}</span>
                    </div>
                    <div className="line-clamp-1 text-[12px] text-muted">{row.investorName}</div>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evidence Viewer</CardTitle>
          </CardHeader>
          <CardContent>
            <EvidenceViewer fileBuffer={fileBuffer} evidence={evidence} />
          </CardContent>
        </Card>
      </div>
      <EditorialFooter />
    </PageShell>
  );
}

