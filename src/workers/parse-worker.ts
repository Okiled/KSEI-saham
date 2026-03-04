/// <reference lib="webworker" />

import { parseOwnershipPdf } from "../parser/parse-ownership";
import type { ParseWorkerRequest, ParseWorkerResponse } from "./types";

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = async (event: MessageEvent<ParseWorkerRequest>) => {
  if (event.data.type !== "parse") return;
  try {
    const parsed = await parseOwnershipPdf(event.data.payload.arrayBuffer, {
      onProgress: ({ page, totalPages }) => {
        const progress: ParseWorkerResponse = { type: "progress", payload: { page, totalPages } };
        self.postMessage(progress);
      },
      onPartial: (partial) => {
        const intermediate: ParseWorkerResponse = { type: "partial", payload: partial };
        self.postMessage(intermediate);
      },
    });
    const done: ParseWorkerResponse = { type: "done", payload: parsed };
    self.postMessage(done);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parse error";
    const failed: ParseWorkerResponse = { type: "error", payload: { message } };
    self.postMessage(failed);
  }
};
