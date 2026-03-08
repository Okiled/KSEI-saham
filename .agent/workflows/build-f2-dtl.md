---
description: Build F2 — Days-to-Liquidate. Bloomberg standard, IDX exclusive. Berapa hari investor butuh untuk exit tanpa crash harga
---

F2 — Days-to-Liquidate (DTL)
Persiapan

Baca AGENTS.md — badge colors.
Pastikan F1 selesai dan /api/prices tersedia.
Baca src/components/OwnershipHolderTable.tsx.
Baca src/components/InvestorPortfolioTable.tsx.

Build
Step 1 — Extend API route
Update /api/prices untuk return avgVolume30d (field: averageDailyVolume3Month).
Return shape: { BBCA: { price: 9250, avgVolume30d: 45000000 } }
Step 2 — liquidity.ts
Buat src/lib/liquidity.ts:
typescriptexport const getDTL = (shares: number, avgVolume30d: number): number => {
  if (!avgVolume30d) return Infinity
  return shares / avgVolume30d
}
export const getDTLStatus = (dtl: number) => {
  if (dtl < 10)  return { label: "LIQUID",   badge: "LIQUID" }
  if (dtl < 30)  return { label: "MODERATE", badge: "MODERATE" }
  if (dtl < 90)  return { label: "ILLIQUID", badge: "ILLIQUID" }
  return           { label: "TRAPPED",  badge: "TRAPPED" }
}
export const formatDTL = (dtl: number): string => {
  if (dtl === Infinity) return "N/A"
  if (dtl > 365) return `${(dtl/365).toFixed(1)} tahun`
  return `${Math.round(dtl)} hari`
}
Step 3 — Tambah kolom DTL
Update OwnershipHolderTable dan InvestorPortfolioTable.
Badge colors dari AGENTS.md. Format: "45 hari" + badge.
Step 4 — Combo alerts

DTL > 90 + holder > 80% → badge "SUPPLY OVERHANG" (merah)
Foreign + DTL < 5 → badge "FLIGHT RISK" (orange)

Step 5 — TrappedPositionsPanel
Buat src/components/TrappedPositionsPanel.tsx:

List semua posisi DTL > 90 di seluruh IDX, sorted descending
Tampilkan: ticker, investor, DTL, nilai IDR (dari F1)
Style: card dengan section header teal border

Checklist

 Badge colors ikuti AGENTS.md
 Tidak ada komponen existing yang di-rebuild
 Tidak ada DB