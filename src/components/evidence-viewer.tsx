import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Expand, Loader2, X } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import { ensurePdfClientWorker, pdfjsLib } from "../lib/pdf-client";
import { Button } from "./ui/button";
import type { OwnershipEvidence } from "../types/ownership";

type EvidenceViewerProps = {
  fileBuffer: ArrayBuffer | null;
  evidence: OwnershipEvidence | null;
};

async function renderPageToCanvas(pdf: PDFDocumentProxy, pageIndex: number, canvas: HTMLCanvasElement): Promise<void> {
  const page = await pdf.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: 1 });
  const parentWidth = canvas.parentElement?.clientWidth ?? viewport.width;
  const scale = Math.max(0.7, parentWidth / viewport.width);
  const scaled = page.getViewport({ scale });
  const context = canvas.getContext("2d");
  if (!context) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(scaled.width * ratio);
  canvas.height = Math.floor(scaled.height * ratio);
  canvas.style.width = `${scaled.width}px`;
  canvas.style.height = `${scaled.height}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  await page.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: context, viewport: scaled }).promise;
}

export function EvidenceViewer({ fileBuffer, evidence }: EvidenceViewerProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [fullScreen, setFullScreen] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fullscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    ensurePdfClientWorker();
  }, []);

  useEffect(() => {
    let active = true;
    if (!fileBuffer) {
      setPdf(null);
      setError(null);
      return;
    }
    const load = async () => {
      setIsLoadingPdf(true);
      setError(null);
      try {
        ensurePdfClientWorker();
        const doc = await pdfjsLib.getDocument({ data: fileBuffer.slice(0) }).promise;
        if (!active) return;
        setPdf(doc);
        setPageIndex(0);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Gagal memuat PDF evidence");
        setPdf(null);
      } finally {
        if (active) setIsLoadingPdf(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [fileBuffer]);

  useEffect(() => {
    if (!evidence) return;
    setPageIndex(evidence.pageIndex);
  }, [evidence]);

  useEffect(() => {
    const draw = async () => {
      if (!pdf || !canvasRef.current) return;
      await renderPageToCanvas(pdf, pageIndex, canvasRef.current);
    };
    void draw();
  }, [pageIndex, pdf]);

  useEffect(() => {
    const draw = async () => {
      if (!fullScreen || !pdf || !fullscreenCanvasRef.current) return;
      await renderPageToCanvas(pdf, pageIndex, fullscreenCanvasRef.current);
    };
    void draw();
  }, [fullScreen, pageIndex, pdf]);

  const highlight = useMemo(() => {
    if (!evidence || evidence.pageIndex !== pageIndex) return null;
    const top = `${evidence.yTopNorm * 100}%`;
    const height = `${Math.max(0.8, (evidence.yBottomNorm - evidence.yTopNorm) * 100)}%`;
    return { top, height };
  }, [evidence, pageIndex]);

  if (!fileBuffer) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-xl border border-border bg-background/25 px-4 text-center text-sm text-muted">
        Belum ada PDF aktif untuk evidence.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-panel-2/70 px-3 py-2">
        <div className="text-xs text-muted">
          Page <span className="font-mono text-foreground">{pageIndex + 1}</span>
          {pdf ? (
            <>
              {" "}/ <span className="font-mono text-foreground">{pdf.numPages}</span>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPageIndex((value) => Math.max(0, value - 1))}
            disabled={!pdf || pageIndex <= 0}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPageIndex((value) => Math.min((pdf?.numPages ?? 1) - 1, value + 1))}
            disabled={!pdf || pageIndex >= (pdf?.numPages ?? 1) - 1}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setFullScreen(true)}>
            <Expand className="h-3.5 w-3.5" />
            Fullscreen
          </Button>
        </div>
      </div>

      <div className="relative max-h-[420px] overflow-auto rounded-xl border border-border bg-background/25 p-2">
        {isLoadingPdf ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-panel/70 text-sm text-muted">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Memuat halaman PDF...
          </div>
        ) : null}
        {error ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-danger/12 px-4 text-center text-sm text-danger">
            {error}
          </div>
        ) : null}

        <canvas ref={canvasRef} className="mx-auto block max-w-full" />
        {highlight ? (
          <div
            className="pointer-events-none absolute left-2 right-2 rounded-sm border border-focus bg-focus/25"
            style={{ top: highlight.top, height: highlight.height }}
          />
        ) : null}
      </div>
      {evidence ? <p className="line-clamp-2 text-[12px] text-muted">{evidence.rawRowText}</p> : null}

      <Dialog.Root open={fullScreen} onOpenChange={setFullScreen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/75" />
          <Dialog.Content className="fixed inset-0 z-50 bg-background p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm text-muted">Evidence Fullscreen</div>
              <Button size="sm" variant="outline" onClick={() => setFullScreen(false)}>
                <X className="h-4 w-4" />
                Close
              </Button>
            </div>
            <div className="relative h-[calc(100vh-4.5rem)] overflow-auto rounded-xl border border-border bg-background/35 p-2">
              <canvas ref={fullscreenCanvasRef} className="mx-auto block max-w-full" />
              {highlight ? (
                <div
                  className="pointer-events-none absolute left-2 right-2 rounded-sm border border-focus bg-focus/25"
                  style={{ top: highlight.top, height: highlight.height }}
                />
              ) : null}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
