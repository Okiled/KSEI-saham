import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import workerSrc from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

let configured = false;

export function ensurePdfClientWorker(): void {
  if (configured) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
  configured = true;
}

ensurePdfClientWorker();

export { pdfjsLib };
