import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, Variants } from "framer-motion";
import { AlertTriangle, FileBarChart, Loader2, Lock, ShieldAlert, Layers, Sparkles } from "lucide-react";
import { AnimatedNumber } from "../components/animated-number";
import { OwnershipSankeyL2R } from "../components/ownership-sankey-l2r";
import { OwnershipTimelinePanel } from "../components/ownership-timeline-panel";
import { CoInvestorHeatmapPanel } from "../components/co-investor-heatmap-panel";
import { SimilarIssuersPanel } from "../components/similar-issuers-panel";
import { OwnershipCompositionPanel } from "../components/ownership-composition-panel";
import { OwnershipHolderTable } from "../components/ownership-holder-table";
import { HhiGauge } from "../components/hhi-gauge";
import { useDatasetLoader } from "../hooks/use-dataset-loader";
import { useOwnershipViews } from "../hooks/use-ownership-views";
import { getIssuerId } from "../lib/graph";
import { fmtNumber, fmtPercent, freeFloatContext } from "../lib/utils";
import type { GhostAccumulationResponse, GhostAccumulationRequest } from "../workers/ghost-accumulation.worker";
import type { OwnershipRow } from "../types/ownership";

/* ── IDX Expert: Struktur Kendali ── */
function strukturKendali(holders: Array<{ percentage: number }>): {
  label: string;
  description: string;
  color: string;
  Icon: typeof Lock;
} {
  if (holders.length === 0) return { label: "—", description: "", color: "text-muted", Icon: Layers };
  const sorted = [...holders].sort((a, b) => b.percentage - a.percentage);
  const top1 = sorted[0]?.percentage ?? 0;
  const top3Sum = sorted.slice(0, 3).reduce((sum, h) => sum + h.percentage, 0);
  if (top1 >= 50) return { label: "Kendali Tunggal", description: `1 entity holds ${fmtPercent(top1)}`, color: "text-rose", Icon: Lock };
  if (top3Sum >= 66) return { label: "Oligopoli", description: `Top 3 hold ${fmtPercent(top3Sum)}`, color: "text-gold", Icon: ShieldAlert };
  return { label: "Tersebar", description: `Top 3 hold ${fmtPercent(top3Sum)}`, color: "text-teal", Icon: Layers };
}

/* ── IDX Expert: Free Float Context ── */



/* ── Auto Intel Brief Generator ── */
function generateIntelBrief(
  issuerName: string,
  holders: Array<{ percentage: number; investorType: string | null; localForeign: "L" | "A" | "U" }>,
  ffPct: number,
  hhi: number,
  ghostRisk: GhostAccumulationResponse | null,
  rbi: { isBagholding: boolean; instDrop: number; retailGain: number } | null
): string {
  if (holders.length === 0) return "Tidak ada data kepemilikan material (>5%) yang tercatat.";
  const top1 = holders[0];
  const domType = top1.investorType === "IND" ? "individu" : top1.investorType === "MF" ? "reksadana" : "institusi/korporasi";
  const domLoc = top1.localForeign === "A" ? "asing" : "lokal";
  
  let brief = `Kepemilikan ${issuerName.split(" ")[0]} dikendalikan oleh 1 entitas ${domType} ${domLoc} (${(top1.percentage ?? 0).toFixed(1)}%). `;
  if (holders.length >= 2) {
    const top2 = holders[0].percentage! + holders[1].percentage!;
    if (top2 > 80) brief = `Sebanyak ${top2.toFixed(1)}% saham dikuasai oleh 2 pihak utama. `;
  }
  
  if (ffPct < 15) brief += `Likuiditas publik / free float terpantau sangat minim (${ffPct.toFixed(1)}%) sehingga rentan volatilitas. `;
  else if (ffPct > 40) brief += `Distribusi saham relatif menyebar dengan free float tinggi (${ffPct.toFixed(1)}%). `;
  
  if (hhi > 6000) brief += "Risiko konsentrasi ekstrem (High HHI). ";
  else if (hhi < 3000) brief += "Risiko konsentrasi moderat (Low-Med HHI). ";

  if (ghostRisk?.isHighRisk) {
    brief += `\n🚨 PERINGATAN (Ghost Accumulation): Terdeteksi ${ghostRisk.totalDroppedPct.toFixed(1)}% kepemilikan menguap dari batas pelaporan institusional ke akun ritel (<1%) dalam satu periode terakhir. Indikasi pecah nominee (evasion).`;
  }

  if (rbi?.isBagholding) {
    brief += `\n⚠️ RETAIL BAGHOLDER INDEX: Distribusi masif terdeteksi. Institusi keluar ${rbi.instDrop.toFixed(1)}%, Ritel menadah ${rbi.retailGain.toFixed(1)}%.`;
  }
  
  return brief;
}

function calculateRBI(allRows: OwnershipRow[], issuerId: string, snapshotDates: string[]) {
  if (snapshotDates.length < 2) return null;
  const recentDate = snapshotDates[snapshotDates.length - 1];
  const oldDate = snapshotDates[snapshotDates.length - 2];

  let instRecent = 0, instOld = 0;
  let retRecent = 0, retOld = 0;

  const isRetail = (r: OwnershipRow) => {
    const type = r.investorType?.toUpperCase() || "";
    return type.includes("ID") || r.investorName.toUpperCase().includes("INDIVIDUAL");
  };

  for (const r of allRows) {
    if (r.shareCode !== issuerId && getIssuerId(r) !== issuerId) continue;
    if (r.date === oldDate) {
      if (isRetail(r)) retOld += (r.percentage || 0); else instOld += (r.percentage || 0);
    } else if (r.date === recentDate) {
      if (isRetail(r)) retRecent += (r.percentage || 0); else instRecent += (r.percentage || 0);
    }
  }

  const instDiff = instRecent - instOld;
  const retDiff = retRecent - retOld;

  if (instDiff <= -1.0 && retDiff >= 1.0) {
    return { isBagholding: true, instDrop: Math.abs(instDiff), retailGain: retDiff };
  }
  return { isBagholding: false, instDrop: Math.abs(instDiff), retailGain: retDiff };
}

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.07,
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1]
    }
  })
};

const sheetVariants: Variants = {
  hidden: { x: "100%", opacity: 0 },
  visible: { 
    x: 0, 
    opacity: 1, 
    transition: { type: "spring", damping: 26, stiffness: 220, staggerChildren: 0.06 } 
  },
  exit: { 
    x: "100%", 
    opacity: 0, 
    transition: { duration: 0.25, ease: "easeInOut" } 
  }
};

export function EmitenDetailPage({ shareCode }: { shareCode: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const shareCodeParam = shareCode?.trim().toUpperCase() ?? "";
  const selectedIssuerId = shareCodeParam ? `issuer:${shareCodeParam}` : null;

  const handleClose = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("emiten");
    setSearchParams(next);
  };

  const { loadState, loadError } = useDatasetLoader();
  const views = useOwnershipViews({ selectedIssuerId, topOverlapHolders: 12 });

  const issuer = views.issuerOwnership;

  const [ghostData, setGhostData] = useState<GhostAccumulationResponse | null>(null);

  const crossInvestorCards = useMemo(() => {
    if (!issuer) return [];
    return issuer.holders.slice(0, 8).map((holder) => ({
      holder,
      others: issuer.crossHoldingsByInvestor[holder.investorId] ?? [],
    }));
  }, [issuer]);

  const kendali = useMemo(() => strukturKendali(issuer?.holders ?? []), [issuer]);
  const ffCtx = useMemo(() => freeFloatContext(issuer?.freeFloatEstimatePct ?? 0), [issuer]);
  const hhi = useMemo(() => {
    if (!issuer) return 0;
    return views.universeItems.find(i => i.issuerId === issuer.issuerId)?.hhi ?? 0;
  }, [issuer, views.universeItems]);

  const rbi = useMemo(() => {
    if (!issuer || !views.timelineView) return null;
    return calculateRBI(views.allRows, issuer.issuerId, views.timelineView.snapshotDates);
  }, [issuer, views.allRows, views.timelineView]);

  const intelBrief = useMemo(() => {
    if (!issuer) return "";
    return generateIntelBrief(issuer.issuerName, issuer.holders as any, issuer.freeFloatEstimatePct, hhi, ghostData, rbi);
  }, [issuer, hhi, ghostData, rbi]);

  useEffect(() => {
    if (!issuer || !views.timelineView) return;
    const worker = new Worker(new URL("../workers/ghost-accumulation.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<GhostAccumulationResponse>) => {
      setGhostData(e.data);
    };
    const req: GhostAccumulationRequest = {
      issuerId: issuer.issuerId,
      shareCode: issuer.shareCode,
      timelineSeries: views.timelineView.series,
      snapshotDates: views.timelineView.snapshotDates,
    };
    worker.postMessage(req);
    return () => worker.terminate();
  }, [issuer, views.timelineView]);

  if (loadState !== "ready") {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
        <main className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-4xl overflow-y-auto glass-deep px-8 py-8 border-l border-white/10">
          <button onClick={handleClose} className="absolute top-4 right-4 z-50 rounded-full bg-black/20 hover:bg-black/40 text-white/70 hover:text-white p-2">✕</button>
          <div className="rounded-2xl border border-border bg-panel/45 p-8">
            {loadState === "error" ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <AlertTriangle className="h-10 w-10 text-rose/60" />
                <div className="text-sm font-semibold text-rose">{loadError ?? "Gagal memuat dataset"}</div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-teal/50" />
                <div className="text-sm text-muted">Menyiapkan detail emiten...</div>
              </div>
            )}
          </div>
        </main>
      </>
    );
  }

  if (!selectedIssuerId || !issuer) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
        <main className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-4xl overflow-y-auto glass-deep px-8 py-8 border-l border-white/10">
          <button onClick={handleClose} className="absolute top-4 right-4 z-50 rounded-full bg-black/20 hover:bg-black/40 text-white/70 hover:text-white p-2">✕</button>
          <div className="rounded-2xl border border-border bg-panel/45 p-8">
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <FileBarChart className="h-12 w-12 text-muted/40" />
              <div className="text-lg font-semibold text-foreground">Emiten tidak ditemukan</div>
              <p className="text-sm text-muted">
                Ticker <span className="font-mono text-teal">{shareCodeParam || "-"}</span> belum ada di dataset aktif.
              </p>
              <button
                type="button"
                onClick={handleClose}
                className="mt-2 inline-flex rounded-full border border-teal/30 bg-teal/5 px-4 py-1.5 text-sm text-teal hover:bg-teal/10"
              >
                ← Tutup Panel
              </button>
            </div>
          </div>
        </main>
      </>
    );
  }

  const topHolder = issuer.holders[0] ?? null;
  const KendaliIcon = kendali.Icon;

  const isRepoVulnerable =
    hhi >= 6500 &&
    topHolder &&
    topHolder.percentage >= 30 &&
    topHolder.investorType?.toUpperCase()?.includes("ID") &&
    topHolder.localForeign === "L";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <motion.main 
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-5xl overflow-y-auto glass-deep px-6 py-6 border-l border-white/10"
        variants={sheetVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <button onClick={handleClose} className="absolute top-4 right-4 z-50 rounded-full bg-black/20 hover:bg-black/40 text-white/70 hover:text-white p-2">✕</button>
        <div className="flex w-full flex-col gap-6 pt-4">
          <header className="pr-12">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {issuer.shareCode} <span className="text-muted font-normal">| {issuer.issuerName}</span>
            </h1>
            <p className="mt-1 text-sm text-muted">Data per {issuer.snapshotDate ?? "—"} — ownership intelligence emiten</p>
          </header>

          {/* ── Auto Intel Brief ── */}
        <div className="mb-6 rounded-xl border border-teal/30 bg-teal/5 p-4 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-10">
            <Sparkles className="h-24 w-24 text-teal" />
          </div>
          <div className="flex items-start gap-3 relative z-10">
            <div className="mt-0.5 min-w-[20px]">
              <Sparkles className="h-5 w-5 text-teal" />
            </div>
            <div>
              <div className="mb-1 text-xs font-bold uppercase tracking-wider text-teal">Auto Intel Brief</div>
              <p className="text-sm font-medium leading-relaxed text-foreground text-balance-soft">
                {intelBrief}
              </p>
            </div>
          </div>
        </div>

        {/* ── Hero Stat Strip ── */}
        <motion.section 
          className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:flex xl:flex-wrap"
          custom={0}
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <div className="flex-1 min-w-[140px] rounded-xl border border-border bg-panel/45 p-4">
            <div className="section-title mb-2">Snapshot Date</div>
            <div className="whitespace-nowrap text-lg font-bold text-foreground font-mono leading-none tracking-tight">{issuer.snapshotDate ?? "-"}</div>
          </div>
          <div className="flex-1 min-w-[120px] rounded-xl border border-border bg-panel/45 p-4">
            <div className="section-title mb-2">Holders</div>
            <div className="stat-hero"><AnimatedNumber value={issuer.holders.length} formatter={fmtNumber} /></div>
          </div>
          <div className="flex-[1.5] min-w-[160px] rounded-xl border border-border bg-panel/45 p-4 overflow-hidden">
            <div className="section-title mb-2">Top Holder</div>
            <div className="stat-hero text-teal">
              {topHolder ? <AnimatedNumber value={topHolder.percentage} formatter={fmtPercent} /> : "-"}
            </div>
            <div className="mt-1 text-[11px] font-medium text-muted uppercase tracking-wider leading-tight" title={topHolder?.investorName}>{topHolder?.investorName ?? "-"}</div>
          </div>
          <div className="flex-[1.5] min-w-[180px] rounded-xl border border-border bg-panel/45 p-4 overflow-hidden">
            <div className="section-title mb-2">Struktur Kendali</div>
            <div className={`flex items-center gap-1.5 font-bold text-lg font-mono leading-none tracking-tight ${kendali.color}`}>
              <KendaliIcon className="h-5 w-5 shrink-0" />
              <span className="break-words">{kendali.label}</span>
            </div>
            <div className="mt-1.5 text-[11px] text-muted leading-tight">{kendali.description}</div>
          </div>
          <div className="flex-1 min-w-[140px] rounded-xl border border-border bg-panel/45 p-4">
            <div className="section-title mb-2">Free Float (Estimasi)</div>
            <div className={`stat-hero ${ffCtx.color}`}>
              <AnimatedNumber value={issuer.freeFloatEstimatePct} formatter={fmtPercent} />
            </div>
            <div className={`mt-1.5 text-[11px] font-medium leading-tight ${ffCtx.color}`}>{ffCtx.label}</div>
          </div>
          <div className="flex-1 min-w-[140px] rounded-xl border border-border bg-panel/45 p-4 flex flex-col">
            <div className="section-title w-full mb-2">Konsentrasi (HHI)</div>
            <div className="flex-1 flex items-center justify-center pt-2">
              <HhiGauge hhi={hhi} repoRisk={Boolean(isRepoVulnerable)} />
            </div>
          </div>
        </motion.section>

        {/* ── 1) Ownership Structure (Sankey) ── */}
        <motion.section 
          className="rounded-2xl border border-border bg-panel/45 p-4"
          custom={1}
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <div className="section-title mb-1">1) Siapa yang pegang saham ini?</div>
          <p className="mb-3 pl-[15px] text-sm text-muted">
            Struktur pemegang saham dari kategori Lokal/Asing ke holder individual — baca dominasi ownership.
          </p>
          <OwnershipSankeyL2R
            issuerLabel={issuer.shareCode}
            holders={issuer.holders.map((holder) => ({
              investorId: holder.investorId,
              investorName: holder.investorName,
              localForeign: holder.localForeign,
              percentage: holder.percentage,
              shares: holder.shares,
            }))}
            onSelectInvestor={(investorKey) => {
              const next = new URLSearchParams(searchParams);
              next.delete("emiten");
              next.set("investor", investorKey);
              setSearchParams(next);
            }}
          />
        </motion.section>

        {/* ── 2) Cross-IDX Holdings ── */}
        <motion.section 
          className="rounded-2xl border border-border bg-panel/45 p-4"
          custom={2}
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <div className="section-title mb-1">2) Investor besar ini mainnya di mana lagi?</div>
          <p className="mb-3 pl-[15px] text-sm text-muted">
            Lihat emiten lain yang dimiliki holder utama — temukan eksposur silang dan pola akumulasi lintas IDX.
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {crossInvestorCards.length === 0 ? (
              <div className="col-span-full flex flex-col items-center gap-2 rounded-xl border border-border bg-panel-2/45 py-6 text-center">
                <FileBarChart className="h-8 w-8 text-muted/30" />
                <div className="text-sm text-muted">Belum ada data cross-holding pada snapshot ini.</div>
              </div>
            ) : (
              crossInvestorCards.map((card) => (
                <div key={card.holder.investorId} className="rounded-xl border border-border bg-panel-2/45 p-3 transition-colors hover:bg-panel-2/65">
                  <button
                    type="button"
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      next.delete("emiten");
                      next.set("investor", card.holder.investorId);
                      setSearchParams(next);
                    }}
                    className="text-left"
                  >
                    <div className="text-sm font-semibold text-foreground">{card.holder.investorName}</div>
                    <div className="stat-inline text-teal">{fmtPercent(card.holder.percentage)}</div>
                  </button>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {card.others.length === 0 ? (
                      <span className="text-xs italic text-muted">Hanya 1 emiten pada snapshot ini.</span>
                    ) : (
                      card.others.slice(0, 8).map((position) => (
                        <button
                          key={`${card.holder.investorId}:${position.issuerId}`}
                          type="button"
                          onClick={() => {
                            const next = new URLSearchParams(searchParams);
                            next.delete("investor");
                            next.set("emiten", position.shareCode);
                            setSearchParams(next);
                          }}
                          className="rounded-full border border-teal/20 bg-teal/5 px-2.5 py-0.5 font-mono text-[11px] font-medium text-teal transition-colors hover:bg-teal/15"
                        >
                          {position.shareCode}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.section>

        {/* ── 3) Ownership Timeline ── */}
        <motion.section 
          className="rounded-2xl border border-border bg-panel/45 p-4"
          custom={3}
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <div className="section-title mb-1">3) Ada akumulasi atau distribusi?</div>
          <p className="mb-3 pl-[15px] text-sm text-muted">
            Pantau perubahan kepemilikan antar periode untuk deteksi tren akumulasi atau distribusi.
          </p>
          <OwnershipTimelinePanel timeline={views.timelineView} />
        </motion.section>

        {/* ── 4) Co-Investor Overlap Heatmap ── */}
        <motion.section 
          className="rounded-2xl border border-border bg-panel/45 p-4"
          custom={4}
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <div className="section-title mb-1">4) Apakah investor besar sering gerak bareng?</div>
          <p className="mb-3 pl-[15px] text-sm text-muted">
            Irisan kepemilikan antar holder utama — temukan pola co-movement dan jaringan investor.
          </p>
          <CoInvestorHeatmapPanel
            overlap={views.overlapView}
            onSelectInvestor={(investorKey) => {
              const next = new URLSearchParams(searchParams);
              next.delete("emiten");
              next.set("investor", investorKey);
              setSearchParams(next);
            }}
            onSelectIssuer={(nextIssuerId) => {
              const row = views.allRows.find((item) => getIssuerId(item) === nextIssuerId);
              if (!row) return;
              const next = new URLSearchParams(searchParams);
              next.delete("investor");
              next.set("emiten", row.shareCode);
              setSearchParams(next);
            }}
          />
        </motion.section>

        {/* ── 5) Composition + Free Float ── */}
        <motion.section 
          className="rounded-2xl border border-border bg-panel/45 p-4"
          custom={5}
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <div className="section-title mb-1">5) Seberapa likuid saham ini?</div>
          <p className="mb-3 pl-[15px] text-sm text-muted">
            Komposisi kepemilikan + estimasi free float untuk mengukur kualitas likuiditas dan basis holder.
          </p>
          <OwnershipCompositionPanel
            composition={issuer.composition}
            totalKnownPct={issuer.totalKnownPercentage}
            freeFloatEstimatePct={issuer.freeFloatEstimatePct}
          />
        </motion.section>

        {/* ── 6) Full Holder Table ── */}
        <motion.section 
          className="rounded-2xl border border-border bg-panel/45 p-4"
          custom={6}
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <div className="section-title mb-1">6) Tabel lengkap pemegang saham</div>
          <p className="mb-3 pl-[15px] text-sm text-muted">
            Review detail persentase dan jumlah shares per investor. Klik nama investor untuk lihat profil lengkap.
          </p>
          <OwnershipHolderTable
            holders={issuer.holders}
            onSelectInvestor={(investorId: string) => {
              const next = new URLSearchParams(searchParams);
              next.delete("emiten");
              next.set("investor", investorId);
              setSearchParams(next);
            }}
          />
        </motion.section>

        {/* ── Similar Issuers (Emiten Mirip) ── */}
        <SimilarIssuersPanel currentIssuerId={issuer.issuerId} allIssuers={views.universeItems} />

        {/* ── Footer ── */}
        <footer className="mt-6 flex justify-center pb-4 text-xs font-mono text-muted/40">
          <a href="https://x.com/Conaax" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-teal">
            Made by CONA
          </a>
        </footer>
      </div>
    </motion.main>
    </>
  );
}