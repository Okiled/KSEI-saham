import { z } from "zod";

export const evidenceSchema = z.object({
  pageIndex: z.number().int().nonnegative(),
  yTopNorm: z.number().min(0).max(1),
  yBottomNorm: z.number().min(0).max(1),
  rawRowText: z.string().min(1),
});

export const ownershipRowSchema = z.object({
  id: z.string().min(1),
  date: z.string().min(1),
  shareCode: z.string().min(1),
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
  evidence: evidenceSchema,
});

export const parseReportSchema = z.object({
  pageCount: z.number().int().positive(),
  detectedTablePages: z.array(z.number().int().nonnegative()),
  validRows: z.number().int().nonnegative(),
  invalidRows: z.number().int().nonnegative(),
  invalidSamples: z.array(
    z.object({
      pageIndex: z.number().int().nonnegative(),
      rawText: z.string(),
      reason: z.string(),
      yTopNorm: z.number().min(0).max(1).optional(),
      yBottomNorm: z.number().min(0).max(1).optional(),
    }),
  ),
});
