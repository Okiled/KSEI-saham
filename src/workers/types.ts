import type { ParsedOwnership } from "../types/ownership";

export type ParseWorkerRequest = {
  type: "parse";
  payload: {
    arrayBuffer: ArrayBuffer;
  };
};

export type ParseWorkerProgress = {
  type: "progress";
  payload: {
    page: number;
    totalPages: number;
  };
};

export type ParseWorkerDone = {
  type: "done";
  payload: ParsedOwnership;
};

export type ParseWorkerPartial = {
  type: "partial";
  payload: ParsedOwnership;
};

export type ParseWorkerError = {
  type: "error";
  payload: {
    message: string;
  };
};

export type ParseWorkerResponse = ParseWorkerProgress | ParseWorkerPartial | ParseWorkerDone | ParseWorkerError;
