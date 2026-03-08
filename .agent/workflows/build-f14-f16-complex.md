---
description: Build F14–F16 — Network graph upgrade, AI search dengan Groq, dan UBO readiness tracker. Fitur paling kompleks, kerjakan terakhir setelah F1-F13 solid.
---

F14–F16 — Complex Features
Persiapan

Baca AGENTS.md di root project.
Pastikan F1–F13 sudah solid sebelum mulai.


F14 — Network Graph Intelligence Upgrade
Persiapan khusus
Baca src/lib/graph.ts secara penuh sebelum menyentuh apapun.
Baca komponen graph yang sudah ada di src/components/.
Yang ditambahkan (extend, jangan rebuild)
Node sizing by IDR:
typescript// Ganti: node size dari connection count → total portfolio IDR
const MAX_RADIUS = 60
node.radius = Math.sqrt(totalPortfolioIDR / MAX_IDR) * MAX_RADIUS
// Node Danantara/BUMN besar harus terlihat dominan
Edge coloring by relationship type:
typescriptconst EDGE_COLORS = {
  custodian:  "#94a3b8",  // gray
  strategic:  "#0D9488",  // teal
  taxHaven:   "#EF4444",  // red
  sovereign:  "#F59E0B",  // gold/amber
}
Threshold proximity overlay:
Nodes yang dalam 2% dari MTO threshold (48-50%) → pulsing red border.
Blast radius mode:
Toggle button "Blast Radius". Klik satu entity → highlight semua emiten yang terdampak jika entity itu exit.
Highlight: node fill #FEE2E2, edge stroke #EF4444.

F15 — AI Search (Intelligence Synthesis)
Stack
Groq free tier — BUKAN OpenAI (berbayar).
Model: llama3-8b-8192.
Endpoint: https://api.groq.com/openai/v1/chat/completions
API Route
Buat app/api/ai-search/route.ts dengan streaming response.
Flow
User query
→ Extract entitas (ticker/investor) dari query
→ Fetch ownership rows yang relevan
→ Build context dengan semua intelligence layer:
   - IDR values, DTL, compliance status
   - Domicile categories, custodian flags
   - Regulatory alerts, SWF presence, BUMN status
→ Send ke Groq dengan system prompt
→ Stream response ke client
System prompt
Kamu adalah analis market intelligence untuk Bursa Efek Indonesia.
Kamu memiliki akses ke data kepemilikan KSEI.
Untuk setiap pertanyaan, selalu sertakan:
1. Jawaban langsung
2. Flag regulasi (MTO, mandatory sell-down, free float compliance)
3. Liquidity risk (DTL)
4. Domicile intelligence jika relevan
5. Quality signals (SWF, BUMN)
Selalu sertakan tanggal data snapshot dan disclaimer relevan.
Jangan spekulas di luar data yang tersedia.
Data: {ownershipContext}
Fallback rule-based
Untuk query sederhana "siapa yang pegang X" → jangan call LLM, jawab langsung dari data.
UI: AISearchPanel
Input dengan placeholder "Tanya tentang emiten atau investor..."
Streaming response dengan typing indicator.
Tampilkan source data yang dipakai (transparency).
Disclaimer: "Data per [tanggal snapshot]. Bukan rekomendasi investasi."

F16 — UBO Readiness Tracker
Ini infrastruktur — bukan fitur user-facing penuh.
Regulasi KSEI UBO <10% sedang digodok. Bangun sekarang supaya siap.
Sekarang (build ini)

Pastikan semua custodian positions (dari F7) sudah di-flag "Beneficial Owner Unknown"
Tambah UBO Opacity Score di issuer sheet:

Score = % kepemilikan via custodian
Display: "X% kepemilikan via kustodian — beneficial owner tidak diketahui"


Siapkan TypeScript interface untuk UBO data:

typescriptinterface UBORecord {
  investorId: string       // custodian ID di KSEI
  custodianName: string    // nama bank kustodian
  uboName?: string         // null — belum tersedia
  uboNationality?: string  // null — belum tersedia
  uboType?: string         // null — belum tersedia
  uboDisclosedAt?: string  // null — belum tersedia
}
Saat regulasi keluar (nanti, plug-in)

Populate UBORecord.uboName, uboNationality, uboType
Tampilkan beneficial owner yang sesungguhnya
Tidak perlu rebuild UI — hanya isi field yang sudah null


Constraints

F14: extend graph.ts — jangan rebuild dari nol
F15: Groq free tier saja, bukan OpenAI
F15: selalu ada fallback rule-based
F16: infrastruktur only sekarang
Tidak boleh pakai DB

Sebelum commit
Tunjukkan daftar file yang diubah dan ditambahkan.