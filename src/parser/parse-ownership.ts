import { ensurePdfWorker, pdfjsLib } from "../lib/pdfjs";
import { buildOwnershipGraph } from "../lib/graph";
import {
  groupWordsByRows,
  isHeaderLikeText,
  normalizeCellText,
  normalizeHeaderToken,
  parseNumberID,
  type RowBucket,
  type TextWord,
} from "../lib/parse-utils";
import { ownershipRowSchema, parseReportSchema } from "./schema";
import type { ParseInvalidRow, ParseReport, ParsedOwnership } from "../types/ownership";

type ParseProgress = {
  page: number;
  totalPages: number;
};

type ParsedColumn = {
  key: ColumnKey;
  x: number;
};

type ColumnBand = {
  key: ColumnKey;
  center: number;
  left: number;
  right: number;
};

type ParseOptions = {
  onProgress?: (progress: ParseProgress) => void;
  onPartial?: (partial: ParsedOwnership) => void;
};

type PdfTextItem = {
  str?: string;
  transform: number[];
  width?: number;
  height?: number;
};

type PdfPageLike = {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  getTextContent: () => Promise<{ items: unknown[] }>;
};

type ColumnKey =
  | "date"
  | "shareCode"
  | "issuerName"
  | "investorName"
  | "investorType"
  | "localForeign"
  | "nationality"
  | "domicile"
  | "holdingsScripless"
  | "holdingsScrip"
  | "totalHoldingShares"
  | "percentage";

const columnDetectors: Array<{ key: ColumnKey; matchers: RegExp[] }> = [
  { key: "date", matchers: [/DATE/] },
  { key: "shareCode", matchers: [/SHARE.?CODE/, /KODE.?EFEK/, /SECURITY.?CODE/] },
  { key: "issuerName", matchers: [/ISSUER/, /EMITEN/, /COMPANY.?NAME/, /NAMA.?EMITEN/] },
  { key: "investorName", matchers: [/INVESTOR.?NAME/, /PEMEGANG/, /NAMA.?INVESTOR/] },
  { key: "investorType", matchers: [/INVESTOR.?TYPE/, /JENIS.?INVESTOR/, /TYPE/] },
  { key: "localForeign", matchers: [/LOCAL.?FOREIGN/, /L.?A/, /DOMESTIC.?FOREIGN/] },
  { key: "nationality", matchers: [/NATIONALITY/, /KEWARGANEGARAAN/] },
  { key: "domicile", matchers: [/DOMICILE/, /DOMISILI/] },
  { key: "holdingsScripless", matchers: [/SCRIPLESS/] },
  { key: "holdingsScrip", matchers: [/SCRIP(?!LESS)/] },
  {
    key: "totalHoldingShares",
    matchers: [/TOTAL.?HOLDING.?SHARES/, /TOTAL.?SAHAM/, /JUMLAH.?SAHAM/, /TOTAL/],
  },
  { key: "percentage", matchers: [/%/, /PERCENT/, /PERSENTASE/] },
];

const requiredColumns: ColumnKey[] = ["date", "shareCode", "investorName"];

function phraseWords(words: TextWord[]): Array<{ text: string; x: number }> {
  const phrases: Array<{ text: string; x: number }> = [];
  for (let i = 0; i < words.length; i += 1) {
    const phrase1 = normalizeHeaderToken(words[i].text);
    if (phrase1) phrases.push({ text: phrase1, x: words[i].x });
    if (i + 1 < words.length) {
      const phrase2 = normalizeHeaderToken(`${words[i].text} ${words[i + 1].text}`);
      if (phrase2) phrases.push({ text: phrase2, x: words[i].x });
    }
    if (i + 2 < words.length) {
      const phrase3 = normalizeHeaderToken(`${words[i].text} ${words[i + 1].text} ${words[i + 2].text}`);
      if (phrase3) phrases.push({ text: phrase3, x: words[i].x });
    }
  }
  return phrases;
}

function detectHeaderRow(rows: RowBucket[]): RowBucket | null {
  for (const row of rows) {
    const rowText = normalizeCellText(row.words.map((w) => w.text).join(" "));
    if (!rowText) continue;
    const normalized = normalizeHeaderToken(rowText);
    const hasDate = normalized.includes("DATE");
    const hasShare =
      (normalized.includes("SHARE") && normalized.includes("CODE")) ||
      (normalized.includes("KODE") && normalized.includes("EFEK")) ||
      normalized.includes("SHARE_CODE");
    const hasInvestor = normalized.includes("INVESTOR") && normalized.includes("NAME");
    if (hasDate && hasShare && hasInvestor) return row;
  }
  return null;
}

function detectColumns(headerRow: RowBucket): ColumnBand[] {
  const phrases = phraseWords(headerRow.words);
  const found: ParsedColumn[] = [];
  const seen = new Set<ColumnKey>();

  for (const detector of columnDetectors) {
    let bestMatch: ParsedColumn | null = null;
    let bestLength = -1;
    for (const phrase of phrases) {
      if (detector.matchers.some((matcher) => matcher.test(phrase.text))) {
        if (!bestMatch || phrase.text.length > bestLength) {
          bestLength = phrase.text.length;
          bestMatch = { key: detector.key, x: phrase.x };
        }
      }
    }
    if (bestMatch && !seen.has(bestMatch.key)) {
      seen.add(bestMatch.key);
      found.push(bestMatch);
    }
  }

  const sorted = found.sort((a, b) => a.x - b.x);
  const bands: ColumnBand[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const center = sorted[i].x;
    const prevCenter = i > 0 ? sorted[i - 1].x : center - 120;
    const nextCenter = i < sorted.length - 1 ? sorted[i + 1].x : center + 120;
    bands.push({
      key: sorted[i].key,
      center,
      left: (prevCenter + center) / 2,
      right: (center + nextCenter) / 2,
    });
  }
  return bands;
}

function pickBand(x: number, bands: ColumnBand[]): ColumnBand | null {
  if (bands.length === 0) return null;
  const inRange = bands.find((band) => x >= band.left && x < band.right);
  if (inRange) return inRange;
  return [...bands].sort((a, b) => Math.abs(a.center - x) - Math.abs(b.center - x))[0];
}

function parseLocalForeign(value: string): "L" | "A" | null {
  const normalized = normalizeHeaderToken(value);
  if (!normalized) return null;
  if (normalized === "L" || normalized.includes("LOCAL") || normalized.includes("DOMESTIC")) return "L";
  if (normalized === "A" || normalized.includes("FOREIGN") || normalized.includes("ASING")) return "A";
  return null;
}

function rowText(words: TextWord[]): string {
  return normalizeCellText(words.map((word) => word.text).join(" "));
}

function isFooterDisclaimer(raw: string): boolean {
  const normalized = raw.toLowerCase();
  return normalized.includes("*penafian:") || normalized.includes("*disclaimer:");
}

async function extractWords(page: PdfPageLike): Promise<{ words: TextWord[]; pageHeight: number }> {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const words: TextWord[] = [];

  for (const item of content.items as PdfTextItem[]) {
    const text = normalizeCellText(item.str || "");
    if (!text) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    const height = Math.abs(item.height || item.transform[3] || 10);
    const width = Math.abs(item.width || 0);
    const yTop = viewport.height - y;
    words.push({ text, x, yTop, width, height });
  }

  return { words, pageHeight: viewport.height };
}

export async function parseOwnershipPdf(arrayBuffer: ArrayBuffer, options: ParseOptions = {}): Promise<ParsedOwnership> {
  ensurePdfWorker();
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
  });
  const pdf = await loadingTask.promise;
  const invalidSamples: ParseInvalidRow[] = [];
  const rows: ParsedOwnership["rows"] = [];
  const detectedTablePages: number[] = [];
  const carry = {
    date: "",
    shareCode: "",
    issuerName: "",
  };

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    options.onProgress?.({ page: pageNumber, totalPages: pdf.numPages });
    const page = await pdf.getPage(pageNumber);
    const { words, pageHeight } = await extractWords(page);
    const grouped = groupWordsByRows(words);
    if (grouped.length === 0) continue;

    const headerRow = detectHeaderRow(grouped);
    if (!headerRow) continue;
    detectedTablePages.push(pageNumber - 1);

    const bands = detectColumns(headerRow);
    const missingRequired = requiredColumns.filter((key) => !bands.some((band) => band.key === key));
    if (missingRequired.length > 0) {
      invalidSamples.push({
        pageIndex: pageNumber - 1,
        rawText: rowText(headerRow.words),
        reason: `Header incomplete: missing ${missingRequired.join(", ")}`,
        yTopNorm: Math.max(0, Math.min(1, headerRow.yTop / pageHeight)),
        yBottomNorm: Math.max(0, Math.min(1, (headerRow.yTop + 12) / pageHeight)),
      });
      continue;
    }

    const headerY = headerRow.yTop;
    let previousRow = rows.length > 0 ? rows[rows.length - 1] : null;

    for (const groupedRow of grouped) {
      if (groupedRow.yTop <= headerY + 1) continue;
      const raw = rowText(groupedRow.words);
      if (!raw) continue;
      if (isFooterDisclaimer(raw)) break;
      if (isHeaderLikeText(raw)) continue;

      const byColumn: Partial<Record<ColumnKey, string[]>> = {};
      for (const word of groupedRow.words) {
        const band = pickBand(word.x, bands);
        if (!band) continue;
        if (!byColumn[band.key]) byColumn[band.key] = [];
        byColumn[band.key]!.push(word.text);
      }

      const getText = (key: ColumnKey): string => normalizeCellText((byColumn[key] ?? []).join(" "));

      const dateValue = getText("date");
      const shareCodeValue = getText("shareCode");
      const issuerNameValue = getText("issuerName");
      const investorNameValue = getText("investorName");

      if (!dateValue && !shareCodeValue && investorNameValue && previousRow) {
        previousRow.investorName = normalizeCellText(`${previousRow.investorName} ${investorNameValue}`);
        const investorTypeCont = getText("investorType");
        if (investorTypeCont) {
          previousRow.investorType = normalizeCellText(`${previousRow.investorType ?? ""} ${investorTypeCont}`);
        }
        previousRow.evidence.yBottomNorm = Math.max(
          previousRow.evidence.yBottomNorm,
          Math.min(1, (groupedRow.yTop + 8) / pageHeight),
        );
        previousRow.evidence.rawRowText = normalizeCellText(`${previousRow.evidence.rawRowText} ${raw}`);
        continue;
      }

      const effectiveDate = dateValue || carry.date;
      const effectiveShareCode = shareCodeValue || carry.shareCode;
      const effectiveIssuerName = issuerNameValue || carry.issuerName;
      if (!effectiveDate || !effectiveShareCode || !investorNameValue) {
        invalidSamples.push({
          pageIndex: pageNumber - 1,
          rawText: raw,
          reason: "Missing required fields DATE/SHARE_CODE/INVESTOR_NAME",
          yTopNorm: Math.max(0, Math.min(1, groupedRow.yTop / pageHeight)),
          yBottomNorm: Math.max(0, Math.min(1, (groupedRow.yTop + 10) / pageHeight)),
        });
        continue;
      }

      carry.date = effectiveDate;
      carry.shareCode = effectiveShareCode;
      carry.issuerName = effectiveIssuerName || carry.issuerName || effectiveShareCode;

      const candidate = {
        id: `row:${rows.length}`,
        date: effectiveDate,
        shareCode: effectiveShareCode,
        issuerName: effectiveIssuerName || effectiveShareCode,
        investorName: investorNameValue,
        investorType: getText("investorType") || null,
        localForeign: parseLocalForeign(getText("localForeign")),
        nationality: getText("nationality") || null,
        domicile: getText("domicile") || null,
        holdingsScripless: parseNumberID(getText("holdingsScripless"), "shares"),
        holdingsScrip: parseNumberID(getText("holdingsScrip"), "shares"),
        totalHoldingShares: parseNumberID(getText("totalHoldingShares"), "shares"),
        percentage: parseNumberID(getText("percentage"), "percentage"),
        evidence: {
          pageIndex: pageNumber - 1,
          yTopNorm: Math.max(0, Math.min(1, groupedRow.yTop / pageHeight)),
          yBottomNorm: Math.max(0, Math.min(1, (groupedRow.yTop + 10) / pageHeight)),
          rawRowText: raw,
        },
      };

      const validated = ownershipRowSchema.safeParse(candidate);
      if (!validated.success) {
        invalidSamples.push({
          pageIndex: pageNumber - 1,
          rawText: raw,
          reason: validated.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
          yTopNorm: Math.max(0, Math.min(1, groupedRow.yTop / pageHeight)),
          yBottomNorm: Math.max(0, Math.min(1, (groupedRow.yTop + 10) / pageHeight)),
        });
        continue;
      }
      rows.push(validated.data);
      previousRow = rows[rows.length - 1];
    }

    if (options.onPartial && (pageNumber % 5 === 0 || pageNumber === pdf.numPages)) {
      const partialReport: ParseReport = {
        pageCount: pdf.numPages,
        detectedTablePages: [...detectedTablePages],
        validRows: rows.length,
        invalidRows: invalidSamples.length,
        invalidSamples: invalidSamples.slice(0, 80),
      };
      options.onPartial({
        rows: rows.map((row) => ({ ...row, evidence: { ...row.evidence } })),
        graph: buildOwnershipGraph(rows),
        report: partialReport,
      });
    }
  }

  const report: ParseReport = {
    pageCount: pdf.numPages,
    detectedTablePages,
    validRows: rows.length,
    invalidRows: invalidSamples.length,
    invalidSamples: invalidSamples.slice(0, 80),
  };

  const parsedReport = parseReportSchema.parse(report);
  const graph = buildOwnershipGraph(rows);
  return { rows, graph, report: parsedReport };
}
