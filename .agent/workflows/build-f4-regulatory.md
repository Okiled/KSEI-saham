---
description: Build F4 — Regulatory Proximity Radar + Mandatory Sell-Down. Extend trigger-engine.ts dengan sell-down logic dan IDR calculation.
---

F4 — Regulatory Proximity Radar + Mandatory Sell-Down
Persiapan

Baca AGENTS.md.
Baca src/lib/trigger-engine.ts secara penuh — extend, JANGAN rebuild.
Baca src/components/TriggerRadarPanel.tsx.
Pastikan F1 dan F2 selesai.

Build
Step 1 — Extend trigger-engine.ts
Tambah dua fungsi baru, jangan ubah yang sudah ada:
typescriptexport const detectMandatorySellDown = (rows, prices, volumes) =>
  rows.filter(r => r.percentage > 80).map(r => {
    const price = prices[r.ticker] ?? 0
    const volume = volumes[r.ticker] ?? 0
    const targetShares = r.totalHoldingShares * 0.20
    return {
      ...r,
      idrToSell: targetShares * price,
      dtlToComply: volume > 0 ? targetShares / volume : Infinity,
      alertType: "MANDATORY_SELLDOWN"
    }
  })

export const detectImminentMTO = (rows) =>
  rows.filter(r => r.percentage >= 45 && r.percentage < 50).map(r => ({
    ...r,
    distanceToMTO: (50 - r.percentage).toFixed(1),
    alertType: "IMMINENT_MTO"
  }))
Step 2 — Update TriggerRadarPanel
Tambah section baru, jangan hapus yang sudah ada:

IMMINENT MTO: badge merah animate-pulse "🚨 IMMINENT MTO — Xpersen away"
MANDATORY SELL-DOWN: badge merah + IDR yang harus dijual + DTL
THRESHOLD EVASION: badge purple (sudah ada, pastikan style ikuti AGENTS.md)

Checklist

 detectMtoSqueeze() dan detectThresholdEvasion() tidak diubah
 animate-pulse hanya untuk IMMINENT MTO
 IDR pakai formatIDR() dari F1, DTL pakai formatDTL() dari F2