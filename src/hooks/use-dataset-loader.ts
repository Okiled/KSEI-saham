import { useCallback, useEffect, useMemo, useState } from "react";
import { buildInvestorTagMap, sanitizeInvestorLabelRules } from "../lib/investor-tags";
import { useAppStore } from "../store/app-store";
import type { ParsedOwnership, ParsedStats } from "../types/ownership";

export type DatasetIndexItem = {
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

type DatasetJsonPayload = Partial<{
  rows: ParsedOwnership["rows"];
  graph: ParsedOwnership["graph"];
  parseReport: ParsedOwnership["report"];
  report: ParsedOwnership["report"];
  stats: ParsedStats;
}>;

export type DatasetLoadState = "loading-index" | "loading-dataset" | "ready" | "error";

type DatasetCacheEntry = {
  parsed: ParsedOwnership;
  stats: ParsedStats | null;
  fileName: string;
  pdfPath: string;
  mtimeMs: number;
};

const datasetCache = new Map<string, DatasetCacheEntry>();
const pdfBufferCache = new Map<string, { mtimeMs: number; buffer: ArrayBuffer }>();

let cachedIndex: DatasetIndexItem[] | null = null;
let cachedSelectedDataPath: string | null = null;
let cachedLoadedDataPath: string | null = null;
let cachedLoadedMtimeMs: number | null = null;
let cachedActiveFileName = "";
let cachedActiveStats: ParsedStats | null = null;

function normalizeDatasetIndex(payload: unknown): { items: DatasetIndexItem[]; defaultFileName?: string } {
  if (Array.isArray(payload)) {
    return {
      items: payload.filter((item): item is DatasetIndexItem => {
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
      }),
      defaultFileName: undefined,
    };
  }

  if (typeof payload === "object" && payload !== null && Array.isArray((payload as Partial<DatasetIndexPayload>).datasets)) {
    const parsed = payload as DatasetIndexPayload;
    const items = parsed.datasets.filter((item): item is DatasetIndexItem => {
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
    });
    return {
      items,
      defaultFileName: parsed.defaultFileName,
    };
  }

  return { items: [], defaultFileName: undefined };
}

function sortDatasets(items: DatasetIndexItem[]): DatasetIndexItem[] {
  return [...items].sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;
    return a.fileName.localeCompare(b.fileName);
  });
}

function fallbackStats(dataset: DatasetIndexItem): ParsedStats {
  return {
    rowCount: dataset.rowCount,
    issuerCount: dataset.issuerCount,
    investorCount: dataset.investorCount,
    pageCount: dataset.pageCount,
    completenessMissRows: dataset.completenessMissRows ?? 0,
    sanityInvalidRows: dataset.sanityInvalidRows ?? 0,
    coveragePass: dataset.coveragePass ?? true,
  };
}

function decodeCoverageError(stats: ParsedStats | null): string | null {
  if (!stats) return null;
  if (stats.coveragePass === false) {
    return `DATA INCOMPLETE: coverage gate gagal (missRows=${stats.completenessMissRows ?? "?"}, sanityInvalid=${stats.sanityInvalidRows ?? "?"}).`;
  }
  if (typeof stats.completenessMissRows === "number" && stats.completenessMissRows > 0) {
    return `DATA INCOMPLETE: ditemukan ${stats.completenessMissRows} row yang tidak termap.`;
  }
  if (typeof stats.sanityInvalidRows === "number" && stats.sanityInvalidRows > 0) {
    return `DATA INCOMPLETE: ditemukan ${stats.sanityInvalidRows} row sanity-invalid.`;
  }
  return null;
}

export function useDatasetLoader() {
  const parsed = useAppStore((s) => s.parsed);
  const fileBuffer = useAppStore((s) => s.fileBuffer);
  const setParsed = useAppStore((s) => s.setParsed);
  const setFile = useAppStore((s) => s.setFile);
  const setParseStatus = useAppStore((s) => s.setParseStatus);
  const setParseProgress = useAppStore((s) => s.setParseProgress);
  const setParsePageInfo = useAppStore((s) => s.setParsePageInfo);
  const setParseError = useAppStore((s) => s.setParseError);
  const setInvestorTagsById = useAppStore((s) => s.setInvestorTagsById);

  const [loadState, setLoadState] = useState<DatasetLoadState>(
    cachedLoadedDataPath ? "ready" : cachedIndex ? "loading-dataset" : "loading-index",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<DatasetIndexItem[]>(cachedIndex ?? []);
  const [selectedDataPath, setSelectedDataPathState] = useState<string>(cachedSelectedDataPath ?? "");
  const [activeFileName, setActiveFileName] = useState<string>(cachedActiveFileName);
  const [activeStats, setActiveStats] = useState<ParsedStats | null>(cachedActiveStats);

  const selectedDataset = useMemo(
    () => datasets.find((dataset) => dataset.dataPath === selectedDataPath) ?? null,
    [datasets, selectedDataPath],
  );

  const setSelectedDataPath = useCallback((next: string) => {
    cachedSelectedDataPath = next;
    setSelectedDataPathState(next);
  }, []);

  const hydrateInvestorTags = useCallback(
    async (rows: ParsedOwnership["rows"]) => {
      try {
        const response = await fetch("/labels/investors.json", { cache: "no-cache" });
        if (!response.ok) {
          setInvestorTagsById({});
          return;
        }
        const payload = (await response.json()) as unknown;
        const rules = sanitizeInvestorLabelRules(payload);
        const tagsMap = buildInvestorTagMap(rows, rules);
        setInvestorTagsById(tagsMap);
      } catch {
        setInvestorTagsById({});
      }
    },
    [setInvestorTagsById],
  );

  useEffect(() => {
    let active = true;

    const ensureIndex = async () => {
      if (cachedIndex && cachedIndex.length > 0) {
        if (!selectedDataPath) {
          const defaultDataset = cachedIndex.find((item) => item.dataPath === cachedSelectedDataPath) ?? cachedIndex[0];
          setSelectedDataPath(defaultDataset.dataPath);
        }
        setDatasets(cachedIndex);
        if (cachedLoadedDataPath) {
          setLoadState("ready");
        }
        return;
      }

      setLoadState("loading-index");
      setLoadError(null);
      setParseStatus("parsing");
      setParseProgress(10);
      setParsePageInfo(0, 0);
      setParseError(null);

      try {
        const response = await fetch("/data/index.json", { cache: "no-cache" });
        if (!response.ok) {
          throw new Error("Dataset belum tergenerate. Jalankan npm run dev (predev akan build dataset dari PDF root).");
        }

        const payload = (await response.json()) as unknown;
        if (!active) return;

        const { items, defaultFileName } = normalizeDatasetIndex(payload);
        const sorted = sortDatasets(items);
        if (sorted.length === 0) {
          throw new Error("Dataset index kosong. Pastikan build-dataset.mjs berhasil.");
        }

        cachedIndex = sorted;
        setDatasets(sorted);

        const preferred =
          sorted.find((item) => item.dataPath === cachedSelectedDataPath) ??
          sorted.find((item) => item.isDefault) ??
          (defaultFileName ? sorted.find((item) => item.fileName === defaultFileName) : undefined) ??
          sorted[0];

        setSelectedDataPath(preferred.dataPath);
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

    void ensureIndex();

    return () => {
      active = false;
    };
  }, [selectedDataPath, setParseError, setParsePageInfo, setParseProgress, setParseStatus, setSelectedDataPath]);

  useEffect(() => {
    if (!selectedDataset) return;
    let active = true;

    const useCache = (entry: DatasetCacheEntry) => {
      const coverageError = decodeCoverageError(entry.stats);
      if (coverageError) {
        throw new Error(coverageError);
      }

      setParsed(entry.parsed);
      setActiveStats(entry.stats);
      cachedActiveStats = entry.stats;
      setActiveFileName(entry.fileName);
      cachedActiveFileName = entry.fileName;
      setParsePageInfo(entry.parsed.report.pageCount, entry.parsed.report.pageCount);
      setParseProgress(100);
      setParseStatus("ready");
      void hydrateInvestorTags(entry.parsed.rows);

      const cachedPdf = pdfBufferCache.get(selectedDataset.dataPath);
      if (cachedPdf && cachedPdf.mtimeMs === entry.mtimeMs) {
        const file = new File([cachedPdf.buffer], entry.fileName, {
          type: "application/pdf",
          lastModified: Math.round(entry.mtimeMs),
        });
        setFile(file, cachedPdf.buffer.slice(0));
      }

      cachedLoadedDataPath = selectedDataset.dataPath;
      cachedLoadedMtimeMs = entry.mtimeMs;
      setLoadState("ready");
      setLoadError(null);
      setParseError(null);
    };

    const loadDataset = async () => {
      if (
        cachedLoadedDataPath === selectedDataset.dataPath &&
        cachedLoadedMtimeMs === selectedDataset.mtimeMs &&
        parsed &&
        parsed.rows.length > 0 &&
        activeStats &&
        activeFileName
      ) {
        setLoadState("ready");
        return;
      }

      setLoadState("loading-dataset");
      setLoadError(null);
      setParseStatus("parsing");
      setParseProgress(35);
      setParsePageInfo(0, selectedDataset.pageCount);
      setParseError(null);

      try {
        const cachedEntry = datasetCache.get(selectedDataset.dataPath);
        if (cachedEntry && cachedEntry.mtimeMs === selectedDataset.mtimeMs) {
          useCache(cachedEntry);
          return;
        }

        const dataResponse = await fetch(selectedDataset.dataPath, { cache: "no-cache" });
        if (!dataResponse.ok) {
          throw new Error(`Gagal membaca dataset JSON: ${selectedDataset.dataPath}`);
        }
        const dataPayload = (await dataResponse.json()) as DatasetJsonPayload;
        if (!active) return;

        setParseProgress(70);
        const report = dataPayload.report ?? dataPayload.parseReport;
        if (!dataPayload.rows || !dataPayload.graph || !report) {
          throw new Error(`Dataset JSON invalid: ${selectedDataset.dataPath}`);
        }

        const stats = dataPayload.stats ?? fallbackStats(selectedDataset);
        const coverageError = decodeCoverageError(stats);
        if (coverageError) {
          throw new Error(coverageError);
        }

        const hydrated: ParsedOwnership = {
          rows: dataPayload.rows,
          graph: dataPayload.graph,
          report,
          stats,
        };

        const cacheEntry: DatasetCacheEntry = {
          parsed: hydrated,
          stats,
          fileName: selectedDataset.fileName,
          pdfPath: selectedDataset.pdfPath,
          mtimeMs: selectedDataset.mtimeMs,
        };
        datasetCache.set(selectedDataset.dataPath, cacheEntry);
        setParsed(hydrated);
        void hydrateInvestorTags(hydrated.rows);
        setActiveStats(stats);
        cachedActiveStats = stats;
        setActiveFileName(selectedDataset.fileName);
        cachedActiveFileName = selectedDataset.fileName;
        setParsePageInfo(report.pageCount, report.pageCount);
        setParseProgress(90);

        const pdfResponse = await fetch(selectedDataset.pdfPath, { cache: "no-cache" });
        if (pdfResponse.ok) {
          const pdfBytes = await pdfResponse.arrayBuffer();
          if (!active) return;
          pdfBufferCache.set(selectedDataset.dataPath, {
            mtimeMs: selectedDataset.mtimeMs,
            buffer: pdfBytes.slice(0),
          });
          const file = new File([pdfBytes], selectedDataset.fileName, {
            type: "application/pdf",
            lastModified: Math.round(selectedDataset.mtimeMs),
          });
          setFile(file, pdfBytes.slice(0));
        }

        if (!active) return;
        cachedLoadedDataPath = selectedDataset.dataPath;
        cachedLoadedMtimeMs = selectedDataset.mtimeMs;
        setLoadState("ready");
        setParseStatus("ready");
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
  }, [
    activeFileName,
    activeStats,
    hydrateInvestorTags,
    parsed,
    selectedDataset,
    setFile,
    setParseError,
    setParsePageInfo,
    setParseProgress,
    setParseStatus,
    setInvestorTagsById,
    setParsed,
  ]);

  return {
    datasets,
    selectedDataPath,
    setSelectedDataPath,
    selectedDataset,
    loadState,
    loadError,
    activeFileName,
    activeStats,
    hasFileBuffer: Boolean(fileBuffer),
  };
}
