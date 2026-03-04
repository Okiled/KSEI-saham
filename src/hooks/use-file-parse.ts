import { useCallback } from "react";
import { readCachedParse, toFileSignature, type ParseSignature, writeCachedParse } from "../lib/cache";
import { runParseWorker } from "../lib/parse-worker-client";
import { useAppStore } from "../store/app-store";

type ManifestSignatureInput = {
  fileName: string;
  size: number;
  mtimeMs: number;
};

type UseFileParseResult = {
  parseFile: (file: File) => Promise<void>;
  parseManifestBuffer: (meta: ManifestSignatureInput, buffer: ArrayBuffer) => Promise<void>;
};

export function useFileParse(): UseFileParseResult {
  const setFile = useAppStore((s) => s.setFile);
  const setParsed = useAppStore((s) => s.setParsed);
  const setPartialParsed = useAppStore((s) => s.setPartialParsed);
  const setParseStatus = useAppStore((s) => s.setParseStatus);
  const setParseProgress = useAppStore((s) => s.setParseProgress);
  const setParsePageInfo = useAppStore((s) => s.setParsePageInfo);
  const setParseError = useAppStore((s) => s.setParseError);

  const parseBufferWithSignature = useCallback(
    async (signature: ParseSignature, buffer: ArrayBuffer) => {
      setParseError(null);
      setParseStatus("parsing");
      setParseProgress(0);
      setParsePageInfo(0, 0);

      const pseudoFile = new File([buffer], signature.name, {
        type: "application/pdf",
        lastModified: signature.lastModified,
      });
      setFile(pseudoFile, buffer.slice(0));

      const cached = await readCachedParse(signature);
      if (cached) {
        setParsed(cached);
        setParseProgress(100);
        setParsePageInfo(cached.report.pageCount, cached.report.pageCount);
        return;
      }

      try {
        const parsed = await runParseWorker(
          buffer.slice(0),
          ({ page, totalPages }) => {
            const progress = Math.round((page / totalPages) * 100);
            setParseProgress(progress);
            setParsePageInfo(page, totalPages);
          },
          (partial) => {
            setPartialParsed(partial);
          },
        );
        await writeCachedParse(signature, parsed);
        setParsed(parsed);
        setParseProgress(100);
        setParsePageInfo(parsed.report.pageCount, parsed.report.pageCount);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to parse file";
        setParseError(message);
        setParseStatus("error");
      }
    },
    [setFile, setParseError, setParsePageInfo, setParseProgress, setParseStatus, setParsed, setPartialParsed],
  );

  const parseFile = useCallback(
    async (file: File) => {
      const signature = toFileSignature(file);
      const buffer = await file.arrayBuffer();
      await parseBufferWithSignature(signature, buffer);
    },
    [parseBufferWithSignature],
  );

  const parseManifestBuffer = useCallback(
    async (meta: ManifestSignatureInput, buffer: ArrayBuffer) => {
      const signature: ParseSignature = {
        name: meta.fileName,
        size: meta.size,
        lastModified: Math.round(meta.mtimeMs),
      };
      await parseBufferWithSignature(signature, buffer);
    },
    [parseBufferWithSignature],
  );

  return { parseFile, parseManifestBuffer };
}
