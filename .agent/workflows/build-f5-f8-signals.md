---
description: Build F5–F8 — BUMN/Danantara tracker, SWF tracker, custodian opacity flag, dan HNWI portfolio enrichment. Semua berbasis classifier di investor-tags.ts.
---

F5–F8 — Signals & Classifiers
Persiapan

Baca AGENTS.md di root project.
Baca src/lib/investor-tags.ts secara penuh — semua classifier baru ditambah di sini.
Pastikan F1 (IDR) sudah selesai.


F5 — BUMN + Danantara Tracker
1. Tambah classifier ke investor-tags.ts
typescriptconst BUMN_PATTERNS = [
  "PERSERO", "PEMERINTAH", "DANANTARA",
  "REPUBLIK INDONESIA", "REPUBLIC OF INDONESIA",
  "PERUSAHAAN PENGELOLA ASET", "LEMBAGA PENGELOLA INVESTASI"
]
export const isBUMN = (name: string): boolean =>
  BUMN_PATTERNS.some(p => name.toUpperCase().includes(p))
2. Badge BUMN
tsx<span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE]">
  🇮🇩 BUMN
</span>
3. Komponen DanantaraTrackerPanel

Stat card: Total IDR kepemilikan negara seluruh IDX
Tabel Danantara trajectory: GIAA, BBRI, TLKM, BMRI + semua yang terdeteksi
Breakdown konsentrasi per sektor
Design: section header dengan left border teal, card bg-white border-[#E8E4DC]


F6 — Sovereign Wealth Fund Tracker
1. Tambah classifier ke investor-tags.ts
typescriptconst SWF_LIST = [
  "GOVERNMENT OF NORWAY", "GIC PRIVATE LIMITED", "TEMASEK",
  "EMPLOYEES PROVIDENT FUND", "KWAP", "ADIA"
]
export const isSWF = (name: string): boolean =>
  SWF_LIST.some(p => name.toUpperCase().includes(p))
2. Badge Tier 1 Institutional
Jika 2+ SWF hadir di satu emiten:
tsx<span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#FEF3C7] text-[#78350F] border border-[#FDE68A]">
  🏆 Tier 1 Institutional
</span>
3. Panel SWFTrackerPanel

List semua SWF dengan total IDR per entitas
Total IDR exposure SWF ke IDX per negara
Co-presence: emiten yang dipegang 2+ SWF sekaligus


F7 — Custodian Opacity Flag
1. Tambah classifier ke investor-tags.ts
typescriptconst CUSTODIAN_PATTERNS = [
  "DBS BANK", "UBS AG", "JULIUS BAER", "JULIUS BÄR",
  "CGS INTERNATIONAL", "CGS-CIMB", "MAYBANK SECURITIES",
  "HSBC", "CITIBANK", "STANDARD CHARTERED", "BNP PARIBAS"
]
export const isCustodian = (name: string): boolean =>
  CUSTODIAN_PATTERNS.some(p => name.toUpperCase().includes(p))
2. Opacity score
typescriptcustodianPct = custodianShares / totalDisclosedShares * 100
// <10% LOW | 10-30% MEDIUM | >30% HIGH OPACITY
3. Badge custodian di holder table
tsx<span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#F3F4F6] text-[#374151] border border-[#D1D5DB]">
  Kustodian
</span>
4. Disclaimer wajib di mana pun opacity flag muncul
"Struktur kustodian lazim digunakan investor institusional. Bukan indikasi pelanggaran hukum."

F8 — HNWI Portfolio in IDR
Enrich InvestorPortfolioTable yang sudah ada — bukan komponen baru.

Pastikan kolom IDR (F1) sudah ada
Pastikan kolom DTL (F2) sudah ada
Notable investors list untuk quick-access:

typescriptconst NOTABLE_INVESTORS = ["LKH", "SJAMSUL NURSALIM", "PRAJOGO PANGESTU"]
Jika investor match, pin ke atas atau beri badge subtle.

Constraints

Semua classifier masuk investor-tags.ts — jangan buat file baru
Tidak boleh pakai DB
F8: enrich existing, jangan rebuild
Design mengikuti AGENTS.md sepenuhnya

Sebelum commit
Tunjukkan daftar file yang diubah dan ditambahkan.