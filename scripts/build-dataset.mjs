import { readFile, readdir, mkdir, copyFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { z } from "zod";

const rootDir = process.cwd();
const publicDir = path.join(rootDir, "public");
const publicPdfDir = path.join(publicDir, "pdfs");
const publicDataDir = path.join(publicDir, "data");
const outReportDir = path.join(rootDir, "data", "out");
const standardFontDataUrl = `${path
  .join(rootDir, "node_modules", "pdfjs-dist", "standard_fonts")
  .replace(/\\/g, "/")}/`;

const REQUIRED_KEYS = ["date", "shareCode", "investorName", "percentage"];
const KEYWORDS = ["semua emiten", "pengumuman bursa", "lamp", "ksei"];
const TYPE_CODES = new Set(["ID", "CP", "IB", "IS", "IC", "FD", "IF", "PF", "TR", "SV", "OT", "MF", "SC"]);
const NUMERIC_KEYS = new Set(["holdingsScripless", "holdingsScrip", "totalHoldingShares", "percentage"]);

const rowSchema = z
  .object({
    id: z.string(),
    date: z.string().min(1),
    shareCode: z.string().min(2),
    issuerName: z.string().min(1),
    investorName: z.string().min(1),
    investorType: z.string().nullable(),
    localForeign: z.union([z.literal("L"), z.literal("A"), z.null()]),
    nationality: z.string().nullable(),
    domicile: z.string().nullable(),
    holdingsScripless: z.number().nullable(),
    holdingsScrip: z.number().nullable(),
    totalHoldingShares: z.number().nullable(),
    percentage: z.number().nullable(),
    evidence: z.object({
      pageIndex: z.number().int().nonnegative(),
      yTopNorm: z.number().min(0).max(1),
      yBottomNorm: z.number().min(0).max(1),
      rawRowText: z.string().min(1),
    }),
  })
  .refine((row) => row.totalHoldingShares !== null || row.percentage !== null, {
    message: "TOTAL_HOLDING_SHARES or PERCENTAGE required",
  });

function normalizeText(value) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeInvestorTokenText(value) {
  return normalizeText(value)
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalizeInvestorName(value) {
  const normalized = normalizeInvestorTokenText(value);
  if (!normalized) return "UNKNOWN";
  return normalized;
}

function normalizeHeader(value) {
  return normalizeText(value).toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

function isPdf(fileName) {
  return /\.pdf$/i.test(fileName);
}

function normalizePdfIdentity(fileName) {
  return fileName
    .replace(/\s*\(\d+\)(?=\.pdf$)/i, "")
    .toLowerCase();
}

function isCleanPdfFileName(fileName) {
  return !/\s\(\d+\)(?=\.pdf$)/i.test(fileName);
}

function choosePreferredPdf(existing, incoming) {
  if (incoming.relevance !== existing.relevance) {
    return incoming.relevance > existing.relevance ? incoming : existing;
  }
  const existingClean = isCleanPdfFileName(existing.fileName);
  const incomingClean = isCleanPdfFileName(incoming.fileName);
  if (incomingClean !== existingClean) {
    return incomingClean ? incoming : existing;
  }
  if (incoming.size !== existing.size) {
    return incoming.size > existing.size ? incoming : existing;
  }
  if (incoming.mtimeMs !== existing.mtimeMs) {
    return incoming.mtimeMs > existing.mtimeMs ? incoming : existing;
  }
  return incoming.fileName.localeCompare(existing.fileName) < 0 ? incoming : existing;
}

function toSafeName(fileName) {
  return fileName
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function relevanceScore(fileName) {
  const lower = fileName.toLowerCase();
  let score = 0;
  for (const keyword of KEYWORDS) {
    if (lower.includes(keyword)) score += 5;
  }
  if (lower.includes("ksei")) score += 4;
  return score;
}

function parseNumberID(value, mode) {
  const raw = normalizeText(value).toUpperCase();
  if (!raw || raw === "-" || raw === "N/A" || raw === "NA") return null;

  if (mode === "shares") {
    const normalized = raw.replace(/[^0-9-]/g, "");
    if (!normalized || normalized === "-") return null;
    const parsed = Number.parseInt(normalized, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  let normalized = raw.replace(/[^0-9,.-]/g, "");
  if (!normalized || normalized === "-" || normalized === "." || normalized === ",") return null;
  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
  } else {
    const dotCount = (normalized.match(/\./g) ?? []).length;
    if (dotCount > 1) {
      normalized = normalized.replace(/\./g, "");
    }
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function detectHeaderRow(groupedRows) {
  for (const row of groupedRows) {
    const text = normalizeHeader(row.words.map((word) => word.text).join(" "));
    const hasDate = text.includes("DATE");
    const hasShare =
      text.includes("SHARE_CODE") ||
      (text.includes("SHARE") && text.includes("CODE")) ||
      (text.includes("KODE") && text.includes("EFEK"));
    const hasInvestor = text.includes("INVESTOR") && text.includes("NAME");
    const hasPercentage = text.includes("PERCENT") || text.includes("PERCENTAGE") || text.includes("PERSENTASE") || text.includes("%");
    if (hasDate && hasShare && hasInvestor && hasPercentage) return row;
  }
  return null;
}

function isHeaderLikeText(text) {
  const token = normalizeHeader(text);
  return token.includes("DATE") || token.includes("SHARE_CODE") || token.includes("INVESTOR_NAME") || token.includes("PERCENTAGE");
}

function isFooterText(text) {
  const lower = normalizeText(text).toLowerCase();
  return lower.includes("*penafian:") || lower.includes("*disclaimer:");
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

function computeTolerance(words) {
  const ys = [...new Set(words.map((word) => Number(word.yTop.toFixed(2))))].sort((a, b) => a - b);
  const deltas = [];
  for (let index = 1; index < ys.length; index += 1) {
    const delta = ys[index] - ys[index - 1];
    if (delta > 0.35 && delta < 20) deltas.push(delta);
  }
  const medianDelta = median(deltas);
  if (medianDelta !== null) {
    return Math.max(1.9, Math.min(5.2, medianDelta * 0.38));
  }

  const heights = words
    .map((word) => word.height)
    .filter((height) => Number.isFinite(height) && height > 0)
    .sort((a, b) => a - b);
  if (heights.length === 0) return 2.4;
  const medianHeight = heights[Math.floor(heights.length / 2)];
  return Math.max(2, Math.min(5.5, medianHeight * 0.45));
}

function groupWordsByRows(words, tolerance) {
  const sorted = [...words].sort((a, b) => {
    const yDiff = a.yTop - b.yTop;
    if (Math.abs(yDiff) > tolerance) return yDiff;
    return a.x - b.x;
  });

  const rows = [];
  for (const word of sorted) {
    const existing = rows.find((row) => Math.abs(row.yTop - word.yTop) <= tolerance);
    if (existing) {
      existing.words.push(word);
      existing.yTop = (existing.yTop * (existing.words.length - 1) + word.yTop) / existing.words.length;
    } else {
      rows.push({ yTop: word.yTop, words: [word] });
    }
  }

  for (const row of rows) {
    row.words.sort((a, b) => a.x - b.x);
  }
  return rows.sort((a, b) => a.yTop - b.yTop);
}

const columnDetectors = [
  { key: "date", patterns: [/\bDATE\b/] },
  { key: "shareCode", patterns: [/SHARE_?CODE/, /KODE_?EFEK/, /SECURITY_?CODE/] },
  { key: "issuerName", patterns: [/ISSUER_?NAME/, /NAMA_?EMITEN/, /\bISSUER\b/, /\bEMITEN\b/] },
  { key: "investorName", patterns: [/INVESTOR_?NAME/, /NAMA_?INVESTOR/, /\bPEMEGANG\b/] },
  { key: "investorType", patterns: [/INVESTOR_?TYPE/, /JENIS_?INVESTOR/] },
  { key: "localForeign", patterns: [/LOCAL_?FOREIGN/, /DOMESTIC_?FOREIGN/] },
  { key: "nationality", patterns: [/\bNATIONALITY\b/, /KEWARGANEGARAAN/] },
  { key: "domicile", patterns: [/\bDOMICILE\b/, /DOMISILI/] },
  { key: "holdingsScripless", patterns: [/HOLDINGS_?SCRIPLESS/, /\bSCRIPLESS\b/] },
  { key: "holdingsScrip", patterns: [/HOLDINGS_?SCRIP$/, /\bSCRIP\b/] },
  { key: "totalHoldingShares", patterns: [/TOTAL_?HOLDING_?SHARES/, /TOTAL_?SAHAM/, /JUMLAH_?SAHAM/] },
  { key: "percentage", patterns: [/\bPERCENTAGE\b/, /\bPERCENT\b/, /PERSENTASE/, /%/] },
];

function detectBands(headerRow) {
  const found = [];
  const seen = new Set();

  for (const detector of columnDetectors) {
    let best = null;
    let bestLength = -1;

    for (const word of headerRow.words) {
      const token = normalizeHeader(word.text);
      if (!token) continue;
      if (detector.patterns.some((pattern) => pattern.test(token))) {
        if (token.length > bestLength) {
          bestLength = token.length;
          best = {
            key: detector.key,
            center: word.x + word.width / 2,
          };
        }
      }
    }

    if (best && !seen.has(best.key)) {
      seen.add(best.key);
      found.push(best);
    }
  }

  const sorted = found.sort((a, b) => a.center - b.center);
  const bands = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index];
    const previousCenter = index > 0 ? sorted[index - 1].center : current.center - 110;
    const nextCenter = index < sorted.length - 1 ? sorted[index + 1].center : current.center + 110;

    let left = (previousCenter + current.center) / 2;
    let right = (current.center + nextCenter) / 2;

    if (current.key === "issuerName" && sorted[index + 1]?.key === "investorName") {
      right = current.center + (sorted[index + 1].center - current.center) * 0.25;
    }
    if (current.key === "investorName" && sorted[index - 1]?.key === "issuerName") {
      left = sorted[index - 1].center + (current.center - sorted[index - 1].center) * 0.25;
    }

    bands.push({
      key: current.key,
      center: current.center,
      left,
      right,
    });
  }

  return bands;
}

function pickBand(word, bands) {
  if (bands.length === 0) return null;

  const numericRegionLeft = (bands.find((band) => band.key === "holdingsScripless")?.left ?? Number.POSITIVE_INFINITY) - 3;
  const anchorX = word.x >= numericRegionLeft ? word.x : word.x + word.width / 2;
  const inRange = bands.find((band) => anchorX >= band.left && anchorX < band.right);
  if (inRange) return inRange;

  return [...bands].sort((a, b) => Math.abs(a.center - anchorX) - Math.abs(b.center - anchorX))[0];
}

function parseLocalForeign(value) {
  const token = normalizeHeader(value);
  if (!token) return null;
  if (token === "L" || token.includes("LOCAL") || token.includes("DOMESTIC")) return "L";
  if (token === "A" || token.includes("FOREIGN") || token.includes("ASING")) return "A";
  return null;
}

function normalizeShareCode(value) {
  const token = normalizeText(value)
    .split(" ")
    .find((item) => /^[A-Z0-9.-]{2,10}$/i.test(item));
  return token ? token.toUpperCase() : "";
}

function tokenize(value) {
  return normalizeText(value).split(" ").filter(Boolean);
}

function extractSharesToken(raw) {
  const tokens = tokenize(raw);
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const candidate = tokens[index].replace(/[^0-9.]/g, "");
    if (!candidate) continue;
    if (/^\d{1,3}(?:\.\d{3})+$/.test(candidate) || /^\d+$/.test(candidate)) {
      return candidate;
    }
  }
  return null;
}

function extractPercentageToken(raw) {
  const tokens = tokenize(raw);
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const candidate = tokens[index].replace(/[^0-9,.-]/g, "");
    if (!candidate) continue;
    if (/^\d{1,3},\d{1,4}$/.test(candidate) || /^\d{1,3}\.\d{1,4}$/.test(candidate) || /^\d{1,3}$/.test(candidate)) {
      return candidate;
    }
  }
  return null;
}

function extractTailNumbers(rawText) {
  const tokens = tokenize(rawText);
  const shareTokens = [];
  let percentageToken = null;

  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const token = tokens[index].replace(/[^0-9,.-]/g, "");
    if (!token) continue;

    if (!percentageToken && (/^\d{1,3},\d{1,4}$/.test(token) || /^\d{1,3}\.\d{1,4}$/.test(token) || /^\d{1,3}$/.test(token))) {
      percentageToken = token;
      continue;
    }

    const shareCandidate = token.replace(/[^0-9.]/g, "");
    if (/^\d{1,3}(?:\.\d{3})+$/.test(shareCandidate) || /^\d+$/.test(shareCandidate)) {
      shareTokens.push(shareCandidate);
      if (shareTokens.length >= 3) break;
    }
  }

  return {
    percentageToken,
    totalHoldingToken: shareTokens[0] ?? null,
    holdingsScripToken: shareTokens[1] ?? null,
    holdingsScriplessToken: shareTokens[2] ?? null,
  };
}

function parseIssuerInvestor({ issuerText, investorText, shareCode, carryIssuer, knownIssuerByCode }) {
  const issuerCombined = normalizeText(issuerText);
  const investorDirect = normalizeText(investorText);
  const knownIssuer = knownIssuerByCode || carryIssuer || "";

  if (investorDirect) {
    return {
      issuerName: issuerCombined || knownIssuer || shareCode,
      investorName: investorDirect,
    };
  }

  if (!issuerCombined) {
    return {
      issuerName: knownIssuer || shareCode,
      investorName: "",
    };
  }

  if (knownIssuer && issuerCombined.toUpperCase().startsWith(knownIssuer.toUpperCase())) {
    return {
      issuerName: knownIssuer,
      investorName: normalizeText(issuerCombined.slice(knownIssuer.length)),
    };
  }

  const tokens = issuerCombined.split(" ").filter(Boolean);
  const tbkIndex = tokens.findIndex((token) => /TBK\.?$/i.test(token.replace(/[(),]/g, "")));
  if (tbkIndex >= 0) {
    return {
      issuerName: normalizeText(tokens.slice(0, tbkIndex + 1).join(" ")),
      investorName: normalizeText(tokens.slice(tbkIndex + 1).join(" ")),
    };
  }

  return {
    issuerName: knownIssuer || issuerCombined || shareCode,
    investorName: "",
  };
}

function validateRowSanity(row, rawFields) {
  const reasons = [];

  if (row.percentage !== null) {
    if (row.percentage < 0 || row.percentage > 100) {
      reasons.push(`percentage out of range: ${row.percentage}`);
    }
    if (rawFields.percentageToken && !/^\d{1,3}(?:[,.]\d{1,4})?$/.test(rawFields.percentageToken)) {
      reasons.push(`percentage token suspicious: ${rawFields.percentageToken}`);
    }
  }

  for (const [label, value] of [
    ["holdingsScripless", row.holdingsScripless],
    ["holdingsScrip", row.holdingsScrip],
    ["totalHoldingShares", row.totalHoldingShares],
  ]) {
    if (value !== null) {
      if (!Number.isInteger(value) || value < 0) {
        reasons.push(`${label} invalid: ${value}`);
      }
    }
  }

  if (row.investorName.replace(/[^A-Za-z]/g, "").length === 0) {
    reasons.push("investorName has no alphabetic token");
  }

  if (!/^[A-Z0-9.-]{2,10}$/.test(row.shareCode)) {
    reasons.push(`shareCode suspicious: ${row.shareCode}`);
  }

  return reasons;
}

function buildGraph(rows) {
  const nodeMap = new Map();
  const edges = [];
  for (const [index, row] of rows.entries()) {
    const issuerId = `issuer:${row.shareCode.toUpperCase()}`;
    const investorId = `investor:${canonicalizeInvestorName(row.investorName)}`;
    if (!nodeMap.has(issuerId)) {
      nodeMap.set(issuerId, { id: issuerId, label: row.issuerName, kind: "issuer", shareCode: row.shareCode });
    }
    if (!nodeMap.has(investorId)) {
      nodeMap.set(investorId, { id: investorId, label: row.investorName, kind: "investor", localForeign: row.localForeign });
    }
    edges.push({
      id: `edge:${index}`,
      source: issuerId,
      target: investorId,
      percentage: row.percentage,
      shares: row.totalHoldingShares,
      date: row.date,
      evidenceRef: row.evidence,
      investorType: row.investorType,
      localForeign: row.localForeign,
    });
  }
  return { nodes: [...nodeMap.values()], edges };
}

async function parsePdf(filePath, fileMeta) {
  const bytes = await readFile(filePath);
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
    standardFontDataUrl,
  });
  const pdf = await loadingTask.promise;

  const rows = [];
  const invalidSamples = [];
  const detectedTablePages = [];
  const tableCoverage = [];
  const carry = { date: "", shareCode: "", issuerName: "" };
  const issuerByCode = new Map();

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    const words = content.items
      .map((item) => {
        const text = normalizeText(item.str ?? "");
        if (!text) return null;
        const x = item.transform?.[4] ?? 0;
        const y = item.transform?.[5] ?? 0;
        const width = Math.abs(item.width ?? 0);
        const height = Math.abs(item.height ?? item.transform?.[3] ?? 10);
        const yTop = viewport.height - y;
        return { text, x, width, height, yTop };
      })
      .filter(Boolean);

    const tolerance = computeTolerance(words);
    const grouped = groupWordsByRows(words, tolerance);
    const headerRow = detectHeaderRow(grouped);
    if (!headerRow) continue;

    detectedTablePages.push(pageNumber - 1);
    const bands = detectBands(headerRow);
    const missingRequired = REQUIRED_KEYS.filter((key) => !bands.some((band) => band.key === key));

    const pageCoverage = {
      pageIndex: pageNumber - 1,
      candidateCount: 0,
      mappedCount: 0,
      missCount: 0,
      invalidCriticalCount: 0,
      missSamples: [],
      invalidSamples: [],
      columnBands: bands.map((band) => ({
        key: band.key,
        left: Number(band.left.toFixed(2)),
        center: Number(band.center.toFixed(2)),
        right: Number(band.right.toFixed(2)),
      })),
      mappings: [],
    };

    if (missingRequired.length > 0) {
      invalidSamples.push({
        pageIndex: pageNumber - 1,
        rawText: normalizeText(headerRow.words.map((word) => word.text).join(" ")),
        reason: `Header incomplete: ${missingRequired.join(", ")}`,
      });
      pageCoverage.invalidCriticalCount += 1;
      pageCoverage.invalidSamples.push({
        reason: `Header incomplete: ${missingRequired.join(", ")}`,
        rawText: normalizeText(headerRow.words.map((word) => word.text).join(" ")),
      });
      tableCoverage.push(pageCoverage);
      continue;
    }

    const headerY = headerRow.yTop;
    let previousRow = rows.length > 0 ? rows[rows.length - 1] : null;
    const candidates = [];
    const mappedIds = new Set();

    for (let index = 0; index < grouped.length; index += 1) {
      const groupedRow = grouped[index];
      if (groupedRow.yTop <= headerY + 1) continue;

      const rawText = normalizeText(groupedRow.words.map((word) => word.text).join(" "));
      if (!rawText) continue;
      if (isFooterText(rawText)) break;
      if (isHeaderLikeText(rawText)) continue;

      const byColumn = {};
      for (const word of groupedRow.words) {
        const band = pickBand(word, bands);
        if (!band) continue;
        if (!byColumn[band.key]) byColumn[band.key] = [];
        byColumn[band.key].push(word.text);
      }

      const textBy = (key) => normalizeText((byColumn[key] ?? []).join(" "));
      const dateValue = textBy("date");
      const shareCodeValue = normalizeShareCode(textBy("shareCode"));
      const issuerNameValue = textBy("issuerName");
      const investorNameValue = textBy("investorName");
      const groupId = `p${pageNumber - 1}-g${index}`;

      const isCandidate = Boolean(shareCodeValue || investorNameValue || (!dateValue && !shareCodeValue && issuerNameValue));
      if (!isCandidate) continue;

      pageCoverage.candidateCount += 1;
      candidates.push({
        groupId,
        rawText,
        yTopNorm: Number((groupedRow.yTop / viewport.height).toFixed(4)),
        mappedToRowId: null,
      });

      if (!dateValue && !shareCodeValue && previousRow) {
        const continuationText = normalizeText([investorNameValue, issuerNameValue].filter(Boolean).join(" "));
        if (continuationText) {
          previousRow.investorName = normalizeText(`${previousRow.investorName} ${continuationText}`);
          previousRow.evidence.yBottomNorm = Math.max(
            previousRow.evidence.yBottomNorm,
            Math.min(1, (groupedRow.yTop + 8) / viewport.height),
          );
          previousRow.evidence.rawRowText = normalizeText(`${previousRow.evidence.rawRowText} ${rawText}`);
          mappedIds.add(groupId);
          const candidate = candidates[candidates.length - 1];
          candidate.mappedToRowId = previousRow.id;
          continue;
        }
      }

      const effectiveDate = dateValue || carry.date;
      const effectiveShareCode = shareCodeValue || carry.shareCode;
      if (!effectiveDate || !effectiveShareCode) {
        invalidSamples.push({
          pageIndex: pageNumber - 1,
          rawText,
          reason: "Missing DATE/SHARE_CODE",
        });
        pageCoverage.invalidCriticalCount += 1;
        pageCoverage.invalidSamples.push({ reason: "Missing DATE/SHARE_CODE", rawText });
        continue;
      }

      const knownIssuerByCode = issuerByCode.get(effectiveShareCode.toUpperCase()) ?? null;
      const names = parseIssuerInvestor({
        issuerText: issuerNameValue,
        investorText: investorNameValue,
        shareCode: effectiveShareCode,
        carryIssuer: carry.issuerName,
        knownIssuerByCode,
      });

      const investorNameResolved = names.investorName || investorNameValue;
      const issuerNameResolved = names.issuerName || knownIssuerByCode || carry.issuerName || effectiveShareCode;
      if (!investorNameResolved) {
        invalidSamples.push({
          pageIndex: pageNumber - 1,
          rawText,
          reason: "Missing INVESTOR_NAME",
        });
        pageCoverage.invalidCriticalCount += 1;
        pageCoverage.invalidSamples.push({ reason: "Missing INVESTOR_NAME", rawText });
        continue;
      }

      const tail = extractTailNumbers(rawText);
      const holdingsScriplessToken = extractSharesToken(textBy("holdingsScripless")) ?? tail.holdingsScriplessToken;
      const holdingsScripToken = extractSharesToken(textBy("holdingsScrip")) ?? tail.holdingsScripToken;
      const totalHoldingToken = extractSharesToken(textBy("totalHoldingShares")) ?? tail.totalHoldingToken;
      const percentageToken = extractPercentageToken(textBy("percentage")) ?? tail.percentageToken;

      const candidateRow = {
        id: `row:${rows.length}`,
        date: effectiveDate,
        shareCode: effectiveShareCode,
        issuerName: issuerNameResolved,
        investorName: investorNameResolved,
        investorType: textBy("investorType") || null,
        localForeign: parseLocalForeign(textBy("localForeign")),
        nationality: textBy("nationality") || null,
        domicile: textBy("domicile") || null,
        holdingsScripless: parseNumberID(holdingsScriplessToken, "shares"),
        holdingsScrip: parseNumberID(holdingsScripToken, "shares"),
        totalHoldingShares: parseNumberID(totalHoldingToken, "shares"),
        percentage: parseNumberID(percentageToken, "percentage"),
        evidence: {
          pageIndex: pageNumber - 1,
          yTopNorm: Math.max(0, Math.min(1, groupedRow.yTop / viewport.height)),
          yBottomNorm: Math.max(0, Math.min(1, (groupedRow.yTop + 10) / viewport.height)),
          rawRowText: rawText,
        },
      };

      const parsedRow = rowSchema.safeParse(candidateRow);
      if (!parsedRow.success) {
        const reason = parsedRow.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
        invalidSamples.push({
          pageIndex: pageNumber - 1,
          rawText,
          reason,
        });
        pageCoverage.invalidCriticalCount += 1;
        pageCoverage.invalidSamples.push({ reason, rawText });
        continue;
      }

      const sanityReasons = validateRowSanity(parsedRow.data, {
        percentageToken,
      });
      if (sanityReasons.length > 0) {
        const reason = sanityReasons.join("; ");
        invalidSamples.push({
          pageIndex: pageNumber - 1,
          rawText,
          reason,
        });
        pageCoverage.invalidCriticalCount += 1;
        pageCoverage.invalidSamples.push({ reason, rawText });
        continue;
      }

      rows.push(parsedRow.data);
      previousRow = rows[rows.length - 1];
      carry.date = parsedRow.data.date;
      carry.shareCode = parsedRow.data.shareCode;
      carry.issuerName = parsedRow.data.issuerName;
      issuerByCode.set(parsedRow.data.shareCode.toUpperCase(), parsedRow.data.issuerName);
      mappedIds.add(groupId);
      const candidate = candidates[candidates.length - 1];
      candidate.mappedToRowId = parsedRow.data.id;
    }

    const misses = candidates.filter((item) => !mappedIds.has(item.groupId));
    pageCoverage.mappedCount = mappedIds.size;
    pageCoverage.missCount = misses.length;
    pageCoverage.missSamples = misses.slice(0, 20).map((item) => ({
      groupId: item.groupId,
      yTopNorm: item.yTopNorm,
      rawText: item.rawText,
    }));
    pageCoverage.invalidSamples = pageCoverage.invalidSamples.slice(0, 20);
    pageCoverage.mappings = candidates.slice(0, 80).map((item) => ({
      groupId: item.groupId,
      mappedToRowId: item.mappedToRowId,
      yTopNorm: item.yTopNorm,
    }));
    tableCoverage.push(pageCoverage);
  }

  const graph = buildGraph(rows);
  const issuerCount = graph.nodes.filter((node) => node.kind === "issuer").length;
  const investorCount = graph.nodes.filter((node) => node.kind === "investor").length;

  const parseReport = {
    pageCount: pdf.numPages,
    detectedTablePages,
    validRows: rows.length,
    invalidRows: invalidSamples.length,
    invalidSamples: invalidSamples.slice(0, 120),
    tableCoverage,
  };

  const missPages = tableCoverage.filter((page) => page.missCount > 0);
  const invalidPages = tableCoverage.filter((page) => page.invalidCriticalCount > 0);
  const stats = {
    rowCount: rows.length,
    issuerCount,
    investorCount,
    pageCount: pdf.numPages,
    tablePageCount: detectedTablePages.length,
    completenessMissPages: missPages.length,
    completenessMissRows: missPages.reduce((sum, page) => sum + page.missCount, 0),
    sanityInvalidPages: invalidPages.length,
    sanityInvalidRows: invalidPages.reduce((sum, page) => sum + page.invalidCriticalCount, 0),
    coveragePass: missPages.length === 0 && invalidPages.length === 0,
  };

  return {
    meta: {
      fileName: fileMeta.fileName,
      pdfPath: `/pdfs/${fileMeta.fileName}`,
      size: fileMeta.size,
      mtimeMs: fileMeta.mtimeMs,
      generatedAt: new Date().toISOString(),
    },
    rows,
    graph,
    stats,
    parseReport,
    dataNotes: {
      parser: "build-dataset.mjs",
      mode: "precomputed-node-parser",
      disclaimerIgnored: ["*Penafian:", "*Disclaimer:"],
      completenessGate: "candidateRowGroups - mappedRowGroups must be 0 miss and 0 sanity invalid",
    },
    missPages,
    invalidPages,
  };
}

async function scanPdfsInDir(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const pdfFileNames = entries.filter((entry) => entry.isFile() && isPdf(entry.name)).map((entry) => entry.name);
  const pdfs = [];
  for (const fileName of pdfFileNames) {
    const absolutePath = path.join(dirPath, fileName);
    const meta = await stat(absolutePath);
    pdfs.push({
      fileName,
      absolutePath,
      size: meta.size,
      mtimeMs: meta.mtimeMs,
      relevance: relevanceScore(fileName),
    });
  }
  return pdfs;
}

async function scanAvailablePdfs() {
  const fromRoot = await scanPdfsInDir(rootDir);
  const fromPublic = await scanPdfsInDir(publicPdfDir);
  const dedup = new Map();

  for (const pdf of [...fromRoot, ...fromPublic]) {
    const identity = normalizePdfIdentity(pdf.fileName);
    const existing = dedup.get(identity);
    if (!existing) {
      dedup.set(identity, pdf);
      continue;
    }
    dedup.set(identity, choosePreferredPdf(existing, pdf));
  }

  const pdfs = [...dedup.values()];
  pdfs.sort((a, b) => {
    if (b.relevance !== a.relevance) return b.relevance - a.relevance;
    if (b.size !== a.size) return b.size - a.size;
    return a.fileName.localeCompare(b.fileName);
  });
  if (pdfs.length > 0) {
    pdfs[0].isDefault = true;
  }
  return pdfs;
}

async function hasExistingDataIndex() {
  try {
    const indexPath = path.join(publicDataDir, "index.json");
    await stat(indexPath);
    return true;
  } catch {
    return false;
  }
}

async function writeCompletenessReports(safeName, parsed) {
  const reportJsonPath = path.join(publicDataDir, `${safeName}-report.json`);
  const missLines = parsed.missPages.flatMap((page) => [
    `## Page ${page.pageIndex + 1}`,
    `candidate=${page.candidateCount}, mapped=${page.mappedCount}, miss=${page.missCount}, invalid=${page.invalidCriticalCount}`,
    ...page.missSamples.map((sample) => `- [${sample.groupId}] ${sample.rawText}`),
    ...page.invalidSamples.map((sample) => `- [invalid] ${sample.reason} :: ${sample.rawText}`),
    "",
  ]);

  const invalidOnlyLines = parsed.invalidPages
    .filter((page) => page.missCount === 0)
    .flatMap((page) => [
      `## Page ${page.pageIndex + 1} (Invalid Rows)` ,
      `candidate=${page.candidateCount}, mapped=${page.mappedCount}, miss=${page.missCount}, invalid=${page.invalidCriticalCount}`,
      ...page.invalidSamples.map((sample) => `- [invalid] ${sample.reason} :: ${sample.rawText}`),
      "",
    ]);

  const markdown = [
    `# Completeness Report: ${parsed.meta.fileName}`,
    "",
    `Generated: ${new Date().toISOString()}`,
    `Rows: ${parsed.stats.rowCount}`,
    `Coverage pass: ${parsed.stats.coveragePass ? "YES" : "NO"}`,
    `Miss pages: ${parsed.missPages.length}`,
    `Miss rows: ${parsed.stats.completenessMissRows}`,
    `Sanity invalid pages: ${parsed.stats.sanityInvalidPages}`,
    `Sanity invalid rows: ${parsed.stats.sanityInvalidRows}`,
    "",
    ...missLines,
    ...invalidOnlyLines,
  ].join("\n");

  await writeFile(
    reportJsonPath,
    `${JSON.stringify(
      {
        fileName: parsed.meta.fileName,
        stats: parsed.stats,
        parseReport: parsed.parseReport,
        missPages: parsed.missPages,
        invalidPages: parsed.invalidPages,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(path.join(outReportDir, `${safeName}-report.md`), `${markdown}\n`, "utf8");
}

async function main() {
  await mkdir(publicPdfDir, { recursive: true });
  await mkdir(publicDataDir, { recursive: true });
  await mkdir(outReportDir, { recursive: true });

  const pdfs = await scanAvailablePdfs();
  if (pdfs.length === 0) {
    const hasDataIndex = await hasExistingDataIndex();
    if (hasDataIndex) {
      console.warn("[build-dataset] tidak ada PDF. Menggunakan dataset JSON yang sudah ada di public/data.");
      return;
    }
    throw new Error("Tidak menemukan file PDF (root repo/public/pdfs) dan belum ada public/data/index.json.");
  }

  for (const pdf of pdfs) {
    const destinationPath = path.join(publicPdfDir, pdf.fileName);
    if (path.resolve(pdf.absolutePath) !== path.resolve(destinationPath)) {
      await copyFile(pdf.absolutePath, destinationPath);
    }
  }

  const index = [];
  let hasCompletenessError = false;

  for (const pdf of pdfs) {
    const safeName = toSafeName(pdf.fileName);
    const parsed = await parsePdf(pdf.absolutePath, pdf);
    const dataPath = `/data/${safeName}.json`;
    const pdfPath = `/pdfs/${pdf.fileName}`;

    await writeFile(
      path.join(publicDataDir, `${safeName}.json`),
      `${JSON.stringify(
        {
          meta: { ...parsed.meta, dataPath, pdfPath, isDefault: Boolean(pdf.isDefault) },
          rows: parsed.rows,
          graph: parsed.graph,
          stats: parsed.stats,
          parseReport: parsed.parseReport,
          dataNotes: parsed.dataNotes,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    await writeCompletenessReports(safeName, parsed);

    index.push({
      fileName: pdf.fileName,
      pdfPath,
      dataPath,
      size: pdf.size,
      mtimeMs: pdf.mtimeMs,
      rowCount: parsed.stats.rowCount,
      issuerCount: parsed.stats.issuerCount,
      investorCount: parsed.stats.investorCount,
      pageCount: parsed.stats.pageCount,
      isDefault: Boolean(pdf.isDefault),
      coveragePass: parsed.stats.coveragePass,
      completenessMissRows: parsed.stats.completenessMissRows,
      sanityInvalidRows: parsed.stats.sanityInvalidRows,
    });

    if (!parsed.stats.coveragePass) {
      hasCompletenessError = true;
      console.error(
        `[build-dataset] completeness gate failed for ${pdf.fileName}: missRows=${parsed.stats.completenessMissRows}, sanityInvalid=${parsed.stats.sanityInvalidRows}`,
      );
    } else {
      console.log(
        `[build-dataset] parsed ${pdf.fileName}: rows=${parsed.stats.rowCount}, pages=${parsed.stats.pageCount}, coverage=100%`,
      );
    }
  }

  const defaultFileName = index.find((item) => item.isDefault)?.fileName ?? index[0]?.fileName ?? null;
  await writeFile(
    path.join(publicDataDir, "index.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        defaultFileName,
        datasets: index,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  if (hasCompletenessError) {
    throw new Error("Completeness gate failed. Check public/data/*-report.json or data/out/*-report.md.");
  }
}

main().catch((error) => {
  console.error("[build-dataset] failed:", error);
  process.exitCode = 1;
});
