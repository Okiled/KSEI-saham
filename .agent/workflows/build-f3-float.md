---
description: Build F3 — Free Float 15% Compliance Scanner. OJK deadline Mei 2026. 327 emiten non-compliant. Supply calendar IDX.
---

F3 — Free Float 15% Compliance Scanner
Persiapan

Baca AGENTS.md.
Baca src/lib/ownership-analytics.ts — cari free float estimator di buildUniverseIssuerItems().
Pastikan /api/prices return price dan avgVolume30d.

Build
Step 1 — float-compliance.ts
Buat src/lib/float-compliance.ts:
typescriptexport type FloatStatus = "COMPLIANT" | "AT_RISK" | "NON_COMPLIANT"

export const getFloatStatus = (floatPct: number): FloatStatus => {
  if (floatPct >= 15) return "COMPLIANT"
  if (floatPct >= 10) return "AT_RISK"
  return "NON_COMPLIANT"
}

export const calcFloatCompliance = (
  floatPct: number,
  outstandingShares: number,
  currentPrice: number,
  avgVolume30d: number
) => ({
  status: getFloatStatus(floatPct),
  sharesRequired: Math.max(0, (0.15 - floatPct/100) * outstandingShares),
  idrRequired: Math.max(0, (0.15 - floatPct/100) * outstandingShares * currentPrice),
  daysToComply: avgVolume30d > 0
    ? Math.max(0, (0.15 - floatPct/100) * outstandingShares / avgVolume30d)
    : Infinity
})
Step 2 — Badge di UniverseStockTable
Tambah kolom compliance badge. Jangan rebuild tabel.

COMPLIANT → hijau | AT RISK → kuning | NON-COMPLIANT → merah

Step 3 — FloatComplianceDashboard
Buat src/components/FloatComplianceDashboard.tsx:

Filter tabs: SEMUA / COMPLIANT / AT RISK / NON-COMPLIANT
Tabel: ticker, float %, status, IDR yang harus dilepas, hari untuk comply
Sort default: idrRequired descending
Style: bg #F5F2EC, card putih, border #E8E4DC, section header teal

Step 4 — Stat makro
Stat card: "Total IDR supply overhang IDX jika semua comply: Rp X T"
Checklist

 Float estimator existing di-reuse, tidak di-rebuild
 Badge colors ikuti AGENTS.md
 Tidak ada DB