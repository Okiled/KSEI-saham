import type { ParsedOwnership } from "../types/ownership";
import type { ParseWorkerRequest, ParseWorkerResponse } from "../workers/types";

export type ParseProgressCallback = (progress: { page: number; totalPages: number }) => void;
export type ParsePartialCallback = (partial: ParsedOwnership) => void;

export async function runParseWorker(
  arrayBuffer: ArrayBuffer,
  onProgress?: ParseProgressCallback,
  onPartial?: ParsePartialCallback,
): Promise<ParsedOwnership> {
  const worker = new Worker(new URL("../workers/parse-worker.ts", import.meta.url), { type: "module" });

  return new Promise<ParsedOwnership>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<ParseWorkerResponse>) => {
      const message = event.data;
      if (message.type === "progress") {
        onProgress?.(message.payload);
        return;
      }
      if (message.type === "partial") {
        onPartial?.(message.payload);
        return;
      }
      if (message.type === "done") {
        worker.terminate();
        resolve(message.payload);
        return;
      }
      if (message.type === "error") {
        worker.terminate();
        reject(new Error(message.payload.message));
      }
    };

    worker.onerror = (error) => {
      worker.terminate();
      reject(new Error(error.message || "Worker failed"));
    };

    const request: ParseWorkerRequest = { type: "parse", payload: { arrayBuffer } };
    worker.postMessage(request, [arrayBuffer]);
  });
}
