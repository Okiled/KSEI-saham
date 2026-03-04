export type RootPdfManifestItem = {
  fileName: string;
  publicPath: string;
  size: number;
  mtimeMs: number;
  isDefault?: boolean;
  relevanceScore?: number;
};

type ManifestObject = {
  defaultFileName?: string;
  files?: unknown[];
};

function keywordScore(fileName: string): number {
  const lower = fileName.toLowerCase();
  let score = 0;
  if (lower.includes("ksei")) score += 8;
  if (lower.includes("semua emiten")) score += 6;
  if (lower.includes("pengumuman bursa")) score += 6;
  if (lower.includes("lamp")) score += 3;
  return score;
}

export function normalizeManifestPayload(payload: unknown): RootPdfManifestItem[] {
  const rawItems = Array.isArray(payload)
    ? payload
    : typeof payload === "object" && payload !== null && Array.isArray((payload as ManifestObject).files)
      ? (payload as ManifestObject).files ?? []
      : [];

  const defaultFileName =
    typeof payload === "object" && payload !== null && typeof (payload as ManifestObject).defaultFileName === "string"
      ? (payload as ManifestObject).defaultFileName
      : null;

  const items = rawItems
    .filter((item): item is RootPdfManifestItem => {
      if (typeof item !== "object" || item === null) return false;
      const candidate = item as Partial<RootPdfManifestItem>;
      return (
        typeof candidate.fileName === "string" &&
        typeof candidate.publicPath === "string" &&
        typeof candidate.size === "number" &&
        typeof candidate.mtimeMs === "number"
      );
    })
    .filter((item) => item.fileName.toLowerCase().endsWith(".pdf"))
    .map((item) => ({
      ...item,
      isDefault: item.isDefault || item.fileName === defaultFileName,
      relevanceScore: item.relevanceScore ?? keywordScore(item.fileName),
    }));

  return items.sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;
    const scoreDiff = (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    if (b.size !== a.size) return b.size - a.size;
    return a.fileName.localeCompare(b.fileName);
  });
}

export function pickDefaultManifestItem(items: RootPdfManifestItem[]): RootPdfManifestItem | null {
  if (items.length === 0) return null;
  return items[0];
}
