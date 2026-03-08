---
description: Build F10–F13 — Investor style profiling, domicile intelligence, shadow accumulation detector, reksa dana redemption risk.
---

F10–F13 — Advanced Analytics
Persiapan

Baca AGENTS.md di root project.
Pastikan F1 (IDR), F2 (DTL), F7 (custodian classifier) sudah selesai.
Baca src/lib/trigger-engine.ts — F12 akan extend ini.
Baca src/lib/investor-tags.ts — F11 classifier masuk di sini.


F10 — Investor Style Profiling
src/lib/style-profiling.ts
typescriptexport type InvestorStyle = "VALUE" | "GROWTH" | "DIVIDEND" | "SECTOR_SPECIALIST" | "MIXED"

export const classifyInvestorStyle = (
  avgPE: number,
  avgPB: number,
  avgDivYield: number,
  topSectorPct: number
): InvestorStyle => {
  if (avgPE < 12 && avgPB < 1.5)  return "VALUE"
  if (avgPE > 30)                  return "GROWTH"
  if (avgDivYield > 4)             return "DIVIDEND"
  if (topSectorPct > 60)           return "SECTOR_SPECIALIST"
  return "MIXED"
}
Fetch PE, PB, divYield dari Yahoo Finance — extend /api/prices/route.ts.
Badge style di investor detail sheet:

VALUE → bg-[#EFF6FF] text-[#1E40AF] "📊 Value"
GROWTH → bg-[#F0FDF4] text-[#065F46] "🚀 Growth"
DIVIDEND → bg-[#FEF3C7] text-[#78350F] "💰 Dividend"
SECTOR SPECIALIST → bg-[#F5F3FF] text-[#5B21B6] "🎯 Sektor Fokus"


F11 — Domicile Intelligence + Coordinated Bloc
1. Tambah classifier ke investor-tags.ts
typescriptexport const DOMICILE_CATEGORIES = {
  TAX_HAVEN: ["CAYMAN ISLANDS", "BRITISH VIRGIN ISLANDS", "MAURITIUS", "LUXEMBOURG", "LABUAN"],
  SOVEREIGN: ["NORWAY", "SINGAPORE", "MALAYSIA", "ABU DHABI"],
  WESTERN:   ["UNITED STATES", "UNITED KINGDOM", "NETHERLANDS", "SWITZERLAND"],
} as const

export const getDomicileCategory = (domicile: string) => {
  const d = domicile.toUpperCase()
  for (const [cat, list] of Object.entries(DOMICILE_CATEGORIES)) {
    if (list.some(p => d.includes(p))) return cat
  }
  return "OTHER"
}
Badge:

TAX_HAVEN → bg-[#F5F3FF] text-[#5B21B6] border-[#DDD6FE] "⚠️ Tax Haven"
SOVEREIGN → bg-[#FEF3C7] text-[#78350F] border-[#FDE68A] "🏛 Sovereign"
WESTERN → bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE] "🌍 Western Inst."

2. Fungsi coordinated bloc detection
typescript// src/lib/domicile-intelligence.ts
export const detectCoordinatedBloc = (ticker: string, rows: OwnershipRow[]) => {
  const tickerRows = rows.filter(r => r.ticker === ticker)
  const byCategory = groupBy(tickerRows, r => getDomicileCategory(r.domicile))
  return Object.entries(byCategory)
    .filter(([cat, group]) =>
      cat !== "OTHER" &&
      group.length >= 2 &&
      group.every(r => r.percentage >= 3 && r.percentage <= 6)
    )
    .map(([cat, group]) => ({
      category: cat,
      entities: group,
      combinedPct: sum(group.map(r => r.percentage)),
      alert: "POSSIBLE COORDINATED PATTERN"
    }))
}
PENTING: Selalu gunakan "POSSIBLE" atau "PATTERN DETECTED" — jangan assert sebagai fakta.
Disclaimer wajib: "Kesamaan domisili bukan bukti koordinasi. Lakukan due diligence independen."

F12 — Shadow Accumulation Detector
Extend detectThresholdEvasion() di trigger-engine.ts:
typescript// Tambah logika: 3+ investor, masing-masing 3-5%, combined > 12%
export const detectShadowAccumulation = (ticker: string, rows: OwnershipRow[]) => {
  const suspects = rows.filter(r =>
    r.ticker === ticker &&
    r.percentage >= 3 &&
    r.percentage < 5
  )
  if (suspects.length < 3) return null
  const combinedPct = suspects.reduce((sum, r) => sum + r.percentage, 0)
  if (combinedPct < 12) return null
  return {
    ticker,
    suspects,
    combinedPct,
    alert: "SHADOW ACCUMULATION — PATTERN DETECTED"
  }
}
Tambah ke TriggerRadarPanel yang sudah ada.
Badge: bg-[#FEF3C7] text-[#92400E] border-[#FDE68A] animate-pulse

F13 — Reksa Dana Redemption Risk
src/lib/redemption-risk.ts
typescriptexport const calcRedemptionRisk = (
  ticker: string,
  rows: OwnershipRow[],
  prices: MarketDataMap
) => {
  const mutualFundRows = rows.filter(r =>
    r.ticker === ticker &&
    r.investorType.toLowerCase().includes("reksa dana")
  )
  const price = prices[ticker]?.price ?? 0
  const totalMFShares = sum(mutualFundRows.map(r => r.totalHoldingShares))
  const mutualFundIDR = totalMFShares * price
  const redemption10pct = mutualFundIDR * 0.10

  // Check concentration
  const byFundHouse = groupBy(mutualFundRows, r => extractFundHouse(r.investorName))
  const maxConcentration = Math.max(...Object.values(byFundHouse).map(g =>
    sum(g.map(r => r.percentage))
  ))

  return {
    mutualFundPct: (totalMFShares / prices[ticker]?.sharesOutstanding) * 100,
    mutualFundCount: mutualFundRows.length,
    redemption10pctIDR: redemption10pct,
    concentrationRisk: maxConcentration > 15,
    herdingRisk: mutualFundRows.length >= 5,
  }
}
Tampilkan di issuer detail sheet. Badge:

CONCENTRATION RISK → bg-[#FEE2E2] text-[#991B1B]
HERDING RISK → bg-[#FEF3C7] text-[#92400E]


Constraints

F11 classifier masuk investor-tags.ts
F12 extend trigger-engine.ts — jangan rebuild
Tidak boleh pakai DB
Design mengikuti AGENTS.md

Sebelum commit
Tunjukkan daftar file yang diubah dan ditambahkan.