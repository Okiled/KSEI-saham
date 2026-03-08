---
description: Build F9 — Performance Since Disclosure. Track harga saham sejak investor pertama kali muncul di data KSEI. Fitur paling viral — screenshot-worthy.
---

F9 — Performance Since Disclosure
Persiapan

Baca AGENTS.md di root project.
Baca src/lib/ownership-analytics.ts — pahami bagaimana data historis disimpan.
Baca src/components/InvestorPortfolioTable.tsx.
Pastikan F1 (IDR value) sudah selesai.

Yang harus dibangun
1. Fungsi getFirstDisclosureDate
Dari data historis rows, cari tanggal pertama investor muncul untuk ticker tertentu:
typescript// src/lib/disclosure-performance.ts
export const getFirstDisclosureDate = (
  rows: OwnershipRow[],
  investorId: string,
  ticker: string
): string | null => {
  const matches = rows
    .filter(r => r.investorId === investorId && r.ticker === ticker)
    .sort((a, b) => a.date.localeCompare(b.date))
  return matches[0]?.date ?? null
}
2. Fetch historical price
typescript// Harga pada tanggal disclosure pertama
// Yahoo Finance historical endpoint:
const unixDate = Math.floor(new Date(date).getTime() / 1000)
const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.JK?period1=${unixDate}&period2=${unixDate + 86400}&interval=1d`
const price = data.chart.result[0].indicators.quote[0].close[0]
3. Hitung performance
typescriptexport interface DisclosurePerformance {
  investorId: string
  investorName: string
  ticker: string
  disclosureDate: string
  priceAtDisclosure: number
  currentPrice: number
  returnPct: number   // (current - disclosure) / disclosure * 100
  returnIDR: number   // (returnPct/100) * positionValueIDR
  positionValueIDR: number
}
4. Komponen DisclosureLeaderboard
Tabel ranked by returnIDR descending. Kolom:

Investor name
Ticker (font-bold text-[#0D9488])
Disclosed date
Harga saat itu
Harga sekarang
Return % — positif: text-[#10B981], negatif: text-[#EF4444]
Return IDR — positif: font-bold text-[#10B981], negatif: font-bold text-[#EF4444]

Row hover: bg-[#F5F2EC]. Border rows: border-[#E8E4DC].
5. Tab di investor detail sheet
Tambah tab "Performance" di investor overlay yang sudah ada.
Tampilkan per posisi: disclosed at X, now Y, return Z%.
6. Disclaimer WAJIB — selalu visible, tidak bisa disembunyikan
tsx<div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-lg p-3 mb-4">
  <p className="text-xs text-[#92400E]">
    ⚠️ Return dihitung sejak tanggal disclosure pertama ke KSEI, bukan tanggal beli sesungguhnya.
    Investor mungkin sudah memiliki saham ini jauh sebelum disclosure.
  </p>
</div>
Constraints

Tidak boleh pakai DB — hitung on-demand atau cache in-memory
Disclaimer wajib selalu visible
Positif → #10B981 | Negatif → #EF4444 konsisten

Sebelum commit
Tunjukkan daftar file yang diubah dan ditambahkan.