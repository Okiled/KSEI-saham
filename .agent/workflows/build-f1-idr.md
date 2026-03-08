---
description: Build F1 — IDR Value of Everything. Fondasi semua fitur lain. Ubah posisi dari lembar/% menjadi nilai Rupiah nyata.
---

F1 — IDR Value of Everything
Persiapan

Baca AGENTS.md — terutama DESIGN SYSTEM dan FORMAT IDR.
Baca src/lib/ownership-analytics.ts.
Baca src/components/OwnershipHolderTable.tsx.
Baca src/components/InvestorPortfolioTable.tsx.
Baca src/components/UniverseStockTable.tsx.

Build
Step 1 — format.ts
Buat atau update src/lib/format.ts:
typescriptexport const formatIDR = (value: number): string => {
  if (value >= 1e15) return `Rp ${(value / 1e15).toFixed(2)} Kuadriliun`
  if (value >= 1e12) return `Rp ${(value / 1e12).toFixed(1)}T`
  if (value >= 1e9)  return `Rp ${(value / 1e9).toFixed(1)}M`
  if (value >= 1e6)  return `Rp ${(value / 1e6).toFixed(0)}Jt`
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`
}
Step 2 — API Route
Buat app/api/prices/route.ts sesuai pola yang sudah ada di codebase:

Param: tickers comma-separated
Fetch Yahoo Finance parallel dengan next: { revalidate: 3600 }
Return: { BBCA: 9250, BMRI: 5200 }
Tidak boleh pakai DB

Step 3 — Enrich komponen existing
Tambah kolom Nilai (IDR) ke OwnershipHolderTable, InvestorPortfolioTable, UniverseStockTable.
Nilai IDR: className="font-bold text-[#D97706]"
Step 4 — InvestorLeaderboard
Buat src/components/InvestorLeaderboard.tsx:

Ranking investor by total portfolio IDR
Style ikuti design system: bg-white, border #E8E4DC, section header teal border
Kolom: rank, nama investor, jumlah emiten, total IDR (amber bold)

Step 5 — Stat makro
Tambah stat card: "Total kepemilikan 1%+ seluruh IDX: Rp X Kuadriliun"
Style: stat card dengan left border teal seperti komponen existing.
Checklist

 formatIDR() konsisten, nilai IDR selalu text-[#D97706] font-bold
 Tidak ada komponen existing yang di-rebuild
 Warna dan typography ikuti AGENTS.md
 Tidak ada DB atau paid API