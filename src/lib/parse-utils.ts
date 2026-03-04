export type NumberMode = "shares" | "percentage";

export type TextWord = {
  text: string;
  x: number;
  yTop: number;
  width: number;
  height: number;
};

export type RowBucket = {
  yTop: number;
  words: TextWord[];
};

const EMPTY_MARKERS = new Set(["", "-", "N/A", "NA", "NULL", "NONE"]);

export function normalizeCellText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function parseNumberID(value: string | null | undefined, mode: NumberMode): number | null {
  if (!value) return null;
  const raw = normalizeCellText(value.toUpperCase());
  if (EMPTY_MARKERS.has(raw)) return null;

  if (mode === "shares") {
    const normalized = raw.replace(/[^\d-]/g, "");
    if (!normalized || normalized === "-") return null;
    const parsed = Number.parseInt(normalized, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  let normalized = raw.replace(/[^\d,.-]/g, "");
  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
  } else {
    const dotCount = (normalized.match(/\./g) ?? []).length;
    if (dotCount > 1) normalized = normalized.replace(/\./g, "");
  }
  if (!normalized || normalized === "-" || normalized === ".") return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function groupWordsByRows(words: TextWord[], tolerance = 2.4): RowBucket[] {
  const sorted = [...words].sort((a, b) => {
    const yDiff = a.yTop - b.yTop;
    if (Math.abs(yDiff) > tolerance) return yDiff;
    return a.x - b.x;
  });

  const rows: RowBucket[] = [];
  for (const word of sorted) {
    const bucket = rows.find((row) => Math.abs(row.yTop - word.yTop) <= tolerance);
    if (bucket) {
      bucket.words.push(word);
      bucket.yTop = (bucket.yTop * (bucket.words.length - 1) + word.yTop) / bucket.words.length;
      continue;
    }
    rows.push({ yTop: word.yTop, words: [word] });
  }

  for (const row of rows) {
    row.words.sort((a, b) => a.x - b.x);
  }

  return rows.sort((a, b) => a.yTop - b.yTop);
}

export function normalizeHeaderToken(token: string): string {
  return token.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

export function isHeaderLikeText(text: string): boolean {
  const token = normalizeHeaderToken(text);
  return (
    token.includes("DATE") ||
    token.includes("SHARE_CODE") ||
    token.includes("SHARECODE") ||
    token.includes("INVESTOR_NAME")
  );
}
