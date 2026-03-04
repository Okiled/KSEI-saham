import { get, set } from "idb-keyval";
import type { ParsedOwnership } from "../types/ownership";

export type ParseSignature = {
  name: string;
  size: number;
  lastModified: number;
};

export function toFileSignature(file: File): ParseSignature {
  return {
    name: file.name,
    size: file.size,
    lastModified: file.lastModified,
  };
}

export function fileSignatureKey(signature: ParseSignature): string {
  return `${signature.name}:${signature.size}:${signature.lastModified}`;
}

export async function readCachedParse(signature: ParseSignature): Promise<ParsedOwnership | undefined> {
  return get<ParsedOwnership>(`parse:${fileSignatureKey(signature)}`);
}

export async function writeCachedParse(signature: ParseSignature, data: ParsedOwnership): Promise<void> {
  await set(`parse:${fileSignatureKey(signature)}`, data);
}
