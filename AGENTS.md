# KSEI TERMINAL — KNOWLEDGE BASE
> Baca ini sebelum menulis satu baris code pun.

## PROJECT

Ownership Intelligence Terminal untuk IDX (Bursa Efek Indonesia).
Mengubah data disclosure kepemilikan KSEI menjadi market intelligence.
Bukan trading platform. Ini research terminal.

## HARD CONSTRAINTS

- Solo developer, zero budget
- Tidak boleh pakai DB, Supabase, Redis, atau storage eksternal apapun kecuali diminta eksplisit
- Tidak boleh buat microservice atau backend terpisah
- Tidak boleh pakai paid API (Sectors.app, dll)
- Solusi paling simpel yang bekerja = solusi yang benar
- Stack: Next.js + TypeScript + Tailwind + Vercel free tier
- Market data: Yahoo Finance (gratis) — ticker IDX pakai suffix .JK

## MARKET DATA — YAHOO FINANCE (GRATIS)

```typescript
const res = await fetch(
  `https://query1.finance.yahoo.com/v8/finance/chart/BBCA.JK`,
  { next: { revalidate: 3600 } }
)
const data = await res.json()
const price = data.chart.result[0].meta.regularMarketPrice
```

Fields tersedia:
- regularMarketPrice → harga saat ini (IDR)
- averageDailyVolume3Month → avg volume 30 hari (untuk DTL)
- marketCap, trailingPE, priceToBook, dividendYield, sharesOutstanding

Historical (hanya F9):
https://query1.finance.yahoo.com/v8/finance/chart/BBCA.JK?period1=UNIX&period2=UNIX&interval=1d

## JANGAN REBUILD — SUDAH ADA DI PRODUCTION

Engine (src/lib/):
- ownership-analytics.ts → buildUniverseIssuerItems(), buildIssuerOwnershipView()
- trigger-engine.ts → detectMtoSqueeze(), detectThresholdEvasion(), detectDelistingRisk()
- graph.ts, investor-tags.ts, filtering.ts, use-derived-data.ts

Komponen UI existing (jangan rebuild):
GlobalHeader, GlobalSearch/CommandPalette, DNAStrip, UniverseStockTable,
TopInvestorRanking, InvestorDemographics, SyndicateIntersectPanel,
OwnershipCompositionPanel, OwnershipHolderTable, OwnershipSankeyL2R,
CoInvestorHeatmapPanel, OwnershipTimelinePanel, SimilarIssuersPanel,
HhiGauge, InvestorPortfolioVisuals, InvestorPortfolioTable,
FrequentCoinvestorsPanel, TriggerRadarPanel, SankeyFlow

Routes: / → universe, /explore → lab, ?emiten=XYZ, ?investor=ID

## DATA SHAPE

```typescript
interface OwnershipRow {
  ticker: string
  investorId: string
  investorName: string
  investorType: string   // "Institusi" | "Individu" | "Reksa Dana" | "Asing"
  localForeign: "Local" | "Foreign"
  domicile: string
  nationality: string
  totalHoldingShares: number
  percentage: number
  date: string           // "YYYY-MM-DD"
}
```

Sejak 3 Maret 2026: KSEI disclose >=1% (sebelumnya >=5%).

## DESIGN SYSTEM — WAJIB DIIKUTI SEMUA KOMPONEN BARU

Desain existing: warm cream background, serif heading, teal accent, data-dense tapi clean.

### Warna
```
Background halaman:         #F5F2EC  (warm cream)
Card / panel:               #FFFFFF  border #E8E4DC
Hover row/card:             #F5F2EC
Text utama:                 #1A1A1A
Text sekunder:              #6B6B6B
Text muted:                 #9CA3AF
Accent teal:                #0D9488  (left border, link, ticker)
Nilai IDR / angka penting:  #D97706  (amber/orange — bold)
Return positif:             #10B981
Return negatif:             #EF4444
Warning:                    #F59E0B
```

### Typography
```
Heading halaman:   font-serif
Body / data:       font-sans, tabular-nums untuk angka
Label section:     text-xs uppercase tracking-widest text-[#6B6B6B]
                   + border-l-2 border-[#0D9488] pl-2
Angka stat besar:  text-3xl font-bold text-[#1A1A1A]
Ticker symbol:     font-bold text-[#0D9488]
Nilai IDR besar:   font-bold text-[#D97706]
```

### Section Header (pakai di semua panel)
```tsx
<div className="flex items-center gap-2 mb-3">
  <div className="w-0.5 h-4 bg-[#0D9488]" />
  <span className="text-xs uppercase tracking-widest text-[#6B6B6B]">NAMA SECTION</span>
</div>
```

### Card
```tsx
<div className="bg-white border border-[#E8E4DC] rounded-lg p-4">
```

### Tabel Row
```tsx
<tr className="border-b border-[#E8E4DC] hover:bg-[#F5F2EC] transition-colors">
  <td className="py-3 px-4 font-bold text-[#0D9488]">BBCA</td>
  <td className="py-3 px-4 font-bold text-[#D97706]">Rp 4.2T</td>
</tr>
```

### Badge Status
```
COMPLIANT / LIQUID        → bg-[#F0FDF9] text-[#065F46] border-[#99F6E4]
AT_RISK / MODERATE        → bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]
NON_COMPLIANT / TRAPPED   → bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]
ILLIQUID                  → bg-[#FFF7ED] text-[#9A3412] border-[#FED7AA]
IMMINENT_MTO              → bg-[#FEE2E2] text-[#991B1B] border-[#FECACA] animate-pulse
SWF                       → bg-[#FEF3C7] text-[#78350F] border-[#FDE68A]
BUMN                      → bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]
TAX_HAVEN                 → bg-[#F5F3FF] text-[#5B21B6] border-[#DDD6FE]
CUSTODIAN                 → bg-[#F3F4F6] text-[#374151] border-[#D1D5DB]
Asing (existing)          → bg-[#F0FDF9] text-[#0D9488] border-[#99F6E4]
Lokal (existing)          → bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]
```

### Card Grid (seperti co-investor cards)
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
  <div className="bg-white border border-[#E8E4DC] rounded-lg p-4 hover:border-[#0D9488] transition-colors cursor-pointer">
    <div className="font-semibold text-sm text-[#1A1A1A] mb-1">NAMA</div>
    <div className="text-2xl font-bold text-[#1A1A1A] mb-1">10</div>
    <div className="text-xs text-[#6B6B6B] mb-3">emiten bersama</div>
    <div className="flex flex-wrap gap-1">
      <span className="px-1.5 py-0.5 bg-[#F5F2EC] text-[#1A1A1A] text-xs rounded font-mono">BBCA</span>
    </div>
  </div>
</div>
```

### Format IDR
```typescript
export const formatIDR = (value: number): string => {
  if (value >= 1e15) return `Rp ${(value / 1e15).toFixed(2)} Kuadriliun`
  if (value >= 1e12) return `Rp ${(value / 1e12).toFixed(1)}T`
  if (value >= 1e9)  return `Rp ${(value / 1e9).toFixed(1)}M`
  if (value >= 1e6)  return `Rp ${(value / 1e6).toFixed(0)}Jt`
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`
}
// Selalu render dengan: className="font-bold text-[#D97706]"
// Return positif: className="font-bold text-[#10B981]"
// Return negatif: className="font-bold text-[#EF4444]"
```

## FITUR YANG AKAN DIBANGUN

### F1 — IDR Value of Everything
- Formula: totalHoldingShares x currentPrice
- Tambah kolom IDR ke OwnershipHolderTable, InvestorPortfolioTable, UniverseStockTable
- Baru: InvestorLeaderboard ranked by total IDR
- Baru: stat card "Total 1%+ seluruh IDX = Rp X Kuadriliun"
- API: GET /api/prices?tickers=BBCA,BMRI → { BBCA: 9250, BMRI: 5200 }

### F2 — Days-to-Liquidate (DTL)
- Formula: totalHoldingShares / averageDailyVolume3Month
- <10 → LIQUID | <30 → MODERATE | <90 → ILLIQUID | >=90 → TRAPPED
- Combo: DTL>90 + holder>80% → "SUPPLY OVERHANG"
- Combo: Foreign + DTL<5 → "FLIGHT RISK"

### F3 — Free Float 15% Compliance Scanner
- >=15% COMPLIANT | 10-15% AT RISK | <10% NON-COMPLIANT
- Hitung: sharesRequired, idrRequired, daysToComply
- Baru: FloatComplianceDashboard + total IDR overhang IDX

### F4 — Regulatory Proximity Radar + Mandatory Sell-Down
- Extend trigger-engine.ts
- 45-49% → IMMINENT MTO animate-pulse
- >80% → MANDATORY SELL-DOWN dengan IDR + DTL
- 3+ entities 4.7-4.9% → THRESHOLD EVASION PATTERN

### F5 — BUMN + Danantara Tracker
- Patterns: PERSERO, PEMERINTAH, DANANTARA, REPUBLIK INDONESIA, dst
- Baru: DanantaraTrackerPanel

### F6 — Sovereign Wealth Fund Tracker
- List: GOVERNMENT OF NORWAY, GIC, TEMASEK, EPF, KWAP, ADIA
- 2+ SWF di emiten sama → badge TIER 1 INSTITUTIONAL

### F7 — Custodian Opacity Flag
- Patterns: DBS BANK, UBS AG, JULIUS BAER, CGS, MAYBANK SECURITIES, HSBC, dst
- custodianPct > 30% → HIGH OPACITY
- Disclaimer: "Struktur kustodian lazim digunakan investor institusional."

### F8 — HNWI Portfolio in IDR
- Enrich InvestorPortfolioTable — bukan komponen baru
- Notable: LKH, SJAMSUL NURSALIM, PRAJOGO PANGESTU

### F9 — Performance Since Disclosure
- returnPct = (currentPrice - priceAtDisclosure) / priceAtDisclosure x 100
- returnIDR = (returnPct/100) x positionValueIDR
- Disclaimer WAJIB selalu visible
- Baru: DisclosureLeaderboard ranked by returnIDR

### F10 — Investor Style Profiling
- avgPE<12 && avgPB<1.5 → VALUE | avgPE>30 → GROWTH
- avgDivYield>4 → DIVIDEND | topSectorPct>60 → SECTOR SPECIALIST | else MIXED

### F11 — Domicile Intelligence + Coordinated Bloc
- TAX_HAVEN: Cayman, BVI, Mauritius, Luxembourg, Labuan
- SOVEREIGN: Norway, Singapore, Malaysia, Abu Dhabi
- WESTERN: USA, UK, Netherlands, Switzerland
- 2+ entitas domicile sama, 3-6% each → "POSSIBLE COORDINATED PATTERN"
- Disclaimer wajib

### F12 — Shadow Accumulation Detector
- Extend detectThresholdEvasion() di trigger-engine.ts
- 3+ investor, 3-5% each, combined>12% → "SHADOW ACCUMULATION — PATTERN DETECTED"

### F13 — Reksa Dana Redemption Risk
- redemptionPressureIDR = mutualFundHoldingsIDR x 0.10
- Fund house >15% → "CONCENTRATION RISK"
- 5+ fund pegang sama → "HERDING RISK"

### F14 — Network Graph Upgrade
- Extend graph.ts — node size = IDR, edge color by type
- custodian=#94a3b8, strategic=#0D9488, taxHaven=#EF4444, sovereign=#F59E0B
- Blast radius mode

### F15 — AI Search
- Groq free tier, llama3-8b-8192 — BUKAN OpenAI
- Synthesize semua layer, bukan fact retrieval
- Selalu tampilkan tanggal data, source rows, disclaimer
- Fallback rule-based untuk query sederhana

### F16 — UBO Readiness Tracker
- Infrastruktur: flag custodian positions, opacity score
- Schema siap untuk data UBO saat regulasi KSEI keluar

## DISCLAIMER WAJIB DI UI

Performance Since Disclosure: "Return dihitung sejak tanggal disclosure pertama ke KSEI, bukan tanggal beli sesungguhnya."
Coordinated Bloc: "Pola ini bukan bukti koordinasi. Lakukan due diligence independen."
Custodian: "Struktur kustodian lazim digunakan investor institusional. Bukan indikasi pelanggaran."
Footer: "Data: KSEI + Yahoo Finance. Update harian. Bukan rekomendasi investasi."

## PERTANYAAN WAJIB SEBELUM CODING

1. Bagaimana bentuk OwnershipRow yang aktual di codebase?
2. Apakah sudah ada fetch market data?
3. Di mana Zustand store dan apa polanya?
4. Apa pola API route yang sudah ada?
5. Bagaimana KSEI data di-load?