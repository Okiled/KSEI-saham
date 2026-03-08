import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, Variants } from "framer-motion";
import { AlertTriangle, FileBarChart, Loader2, Lock, ShieldAlert, Layers, Sparkles } from "lucide-react";
import { AnimatedNumber } from "../components/animated-number";
import { EditorialFooter, PageShell } from "../components/page-shell";
import { GlobalHeader } from "../components/global-header";
import { OwnershipSankeyL2R } from "../components/ownership-sankey-l2r";
import { OwnershipTimelinePanel } from "../components/ownership-timeline-panel";
import { CoInvestorHeatmapPanel } from "../components/co-investor-heatmap-panel";
import { SimilarIssuersPanel } from "../components/similar-issuers-panel";
import { OwnershipCompositionPanel } from "../components/ownership-composition-panel";
import { OwnershipHolderTable } from "../components/ownership-holder-table";
import { HhiGauge } from "../components/hhi-gauge";
import { useDatasetLoader } from "../hooks/use-dataset-loader";
import { useMarketData } from "../hooks/use-market-data";
import { useOwnershipViews } from "../hooks/use-ownership-views";
import { detectCoordinatedBloc } from "../lib/domicile-intelligence";
import { formatIDR } from "../lib/format";
import { getIssuerId } from "../lib/graph";
import { calcRedemptionRisk } from "../lib/redemption-risk";
import { detectShadowAccumulation } from "../lib/trigger-engine";
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

function formatPatternCategory(value: string | undefined): string {
  if (!value) return "-";
  return value.replace(/_/g, " ");
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

const pageVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
      staggerChildren: 0.06,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] as [number, number, number, number] },
  },
};

export function EmitenDetailPage({ shareCode }: { shareCode: string }) {
  const navigate = useNavigate();
  const shareCodeParam = shareCode?.trim().toUpperCase() ?? "";
  const selectedIssuerId = shareCodeParam ? `issuer:${shareCodeParam}` : null;

  const { loadState, loadError } = useDatasetLoader();
  const views = useOwnershipViews({ selectedIssuerId, topOverlapHolders: 12 });

  const issuer = views.issuerOwnership;
  const { prices, marketData } = useMarketData(issuer ? [issuer.shareCode] : shareCodeParam ? [shareCodeParam] : []);
  const navigateToInvestor = (investorId: string) => {
    navigate(`/investor/${encodeURIComponent(investorId)}`);
  };
  const navigateToIssuer = (nextShareCode: string) => {
    navigate(`/emiten/${encodeURIComponent(nextShareCode.trim().toUpperCase())}`);
  };
  const navigateToIssuerId = (issuerId: string) => {
    const row = views.allRows.find((item) => getIssuerId(item) === issuerId);
    if (row) navigateToIssuer(row.shareCode);
  };

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

  const fundPressure = useMemo(
    () => (issuer ? calcRedemptionRisk(issuer.holders, marketData[issuer.shareCode] ?? null) : null),
    [issuer, marketData],
  );

  const patternAlerts = useMemo(() => {
    if (!issuer) return [];

    const shadowAlerts = detectShadowAccumulation(views.snapshotRows, issuer.snapshotDate)
      .filter((alert) => alert.issuerId === issuer.issuerId)
      .map((alert) => ({
        id: alert.id,
        label: "SHADOW ACCUMULATION",
        tone: "shadow" as const,
        message: alert.message,
        combinedPct: alert.details.combinedPct ?? 0,
        entityCount: alert.details.entityCount ?? 0,
        domicileCategory: alert.details.domicileCategory,
        investors: alert.details.investors ?? [],
        disclaimerKey: alert.details.disclaimerKey,
      }));

    const domicileBlocAlerts = detectCoordinatedBloc(views.snapshotRows, issuer.snapshotDate)
      .filter((alert) => alert.issuerId === issuer.issuerId)
      .map((alert) => ({
        id: alert.id,
        label: "POSSIBLE COORDINATED PATTERN",
        tone: "pattern" as const,
        message: "Possible pattern detected from disclosure clustering by raw domicile field.",
        combinedPct: alert.combinedPct,
        entityCount: alert.entityCount,
        domicileCategory: alert.domicileCategory,
        investors: alert.investors,
        disclaimerKey: alert.disclaimerKey,
      }));

    return [...shadowAlerts, ...domicileBlocAlerts].sort((left, right) => {
      if (right.combinedPct !== left.combinedPct) return right.combinedPct - left.combinedPct;
      return right.entityCount - left.entityCount;
    });
  }, [issuer, views.snapshotRows]);

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
      <PageShell>
        <GlobalHeader
          title={shareCodeParam ? `${shareCodeParam} | Detail Emiten` : "Detail Emiten"}
          subtitle="Ownership intelligence emiten dengan struktur, overlap, dan holder table penuh."
          allRows={views.allRows}
          currentPage="emiten"
          currentId={shareCodeParam}
          activeIssuer={shareCodeParam ? { shareCode: shareCodeParam } : null}
          actions={[
            { label: "Browse Universe", to: "/", variant: "secondary" },
            { label: "Open Workstation", to: `/workstation/emiten/${encodeURIComponent(shareCodeParam)}`, variant: "ghost" },
          ]}
          onNavigate={navigate}
        />
        <div className="page-section p-6">
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
        <EditorialFooter />
      </PageShell>
    );
  }

  if (!selectedIssuerId || !issuer) {
    return (
      <PageShell>
        <GlobalHeader
          title={shareCodeParam ? `${shareCodeParam} | Detail Emiten` : "Detail Emiten"}
          subtitle="Ownership intelligence emiten dengan struktur, overlap, dan holder table penuh."
          allRows={views.allRows}
          currentPage="emiten"
          currentId={shareCodeParam}
          activeIssuer={shareCodeParam ? { shareCode: shareCodeParam } : null}
          actions={[{ label: "Browse Universe", to: "/", variant: "secondary" }]}
          onNavigate={navigate}
        />
        <div className="page-section p-6">
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <FileBarChart className="h-12 w-12 text-muted/40" />
              <div className="text-lg font-semibold text-foreground">Emiten tidak ditemukan</div>
              <p className="text-sm text-muted">
                Ticker <span className="font-mono text-teal">{shareCodeParam || "-"}</span> belum ada di dataset aktif.
              </p>
              <button type="button" onClick={() => navigate("/")} className="mt-2 inline-flex rounded-full border border-[#0D9488] bg-[#F0FDF9] px-4 py-1.5 text-sm text-[#0D9488] hover:bg-[#D7F3EE]">
                Kembali ke Home
              </button>
            </div>
        </div>
        <EditorialFooter />
      </PageShell>
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
    <PageShell>
      <GlobalHeader
        title={`${issuer.shareCode} | ${issuer.issuerName}`}
        subtitle="Ownership intelligence emiten: struktur kendali, overlap investor, timeline, dan holder table penuh."
        allRows={views.allRows}
        currentPage="emiten"
        currentId={issuer.shareCode}
        activeIssuer={{ shareCode: issuer.shareCode }}
        metadata={`Data per ${issuer.snapshotDate ?? "-"}`}
        actions={[
          { label: "Browse Universe", to: "/", variant: "secondary" },
          { label: "Open Workstation", to: `/workstation/emiten/${encodeURIComponent(issuer.shareCode)}`, variant: "ghost" },
        ]}
        onNavigate={navigate}
      />
      <motion.div
        className="flex w-full flex-col gap-4"
        variants={pageVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >

          {/* ── Auto Intel Brief ── */}
        <div className="mb-4 rounded-xl border border-teal/30 bg-teal/5 p-4 shadow-sm relative overflow-hidden">
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
              navigateToInvestor(investorKey);
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
                      navigateToInvestor(card.holder.investorId);
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
                            navigateToIssuer(position.shareCode);
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
              navigateToInvestor(investorKey);
            }}
            onSelectIssuer={(nextIssuerId) => {
              navigateToIssuerId(nextIssuerId);
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
            freeFloatEstimatePct={issuer.freeFloatEstimatePct}
          />
        </motion.section>

        {/* ── 6) Full Holder Table ── */}
        {fundPressure ? (
          <motion.section
            className="rounded-2xl border border-border bg-panel/45 p-4"
            custom={6}
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
          >
            <div className="section-title mb-1">Reksa dana pressure</div>
            <p className="mb-3 pl-[15px] text-sm text-muted">
              Proxy tekanan jual dari posisi reksa dana disclosed 1%+ pada snapshot aktif. Skenario dasar memakai haircut 10%.
            </p>
            <div className="grid gap-3 lg:grid-cols-4">
              <div className="rounded-xl border border-border bg-panel-2/45 p-3">
                <div className="section-title mb-1">MF disclosed %</div>
                <div className="font-mono text-lg font-semibold text-foreground">{fmtPercent(fundPressure.mutualFundPct)}</div>
              </div>
              <div className="rounded-xl border border-border bg-panel-2/45 p-3">
                <div className="section-title mb-1">MF holders</div>
                <div className="font-mono text-lg font-semibold text-foreground">
                  {fundPressure.mutualFundCount.toLocaleString("id-ID")}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-panel-2/45 p-3">
                <div className="section-title mb-1">MF value (IDR)</div>
                <div className="font-mono text-lg font-semibold text-[#855A30]">
                  {fundPressure.mutualFundValueIDR !== null ? formatIDR(fundPressure.mutualFundValueIDR) : "-"}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-panel-2/45 p-3">
                <div className="section-title mb-1">10% redemption</div>
                <div className="font-mono text-lg font-semibold text-[#855A30]">
                  {fundPressure.redemption10pctIDR !== null ? formatIDR(fundPressure.redemption10pctIDR) : "-"}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {fundPressure.concentrationRisk ? (
                <span className="rounded-full border border-[#FECACA] bg-[#FEE2E2] px-3 py-1 text-xs font-semibold text-[#991B1B]">
                  CONCENTRATION RISK
                </span>
              ) : null}
              {fundPressure.herdingRisk ? (
                <span className="rounded-full border border-[#FDE68A] bg-[#FEF3C7] px-3 py-1 text-xs font-semibold text-[#92400E]">
                  HERDING RISK
                </span>
              ) : null}
              {fundPressure.topMutualFundName ? (
                <span className="rounded-full border border-border bg-panel-2/45 px-3 py-1 text-xs text-muted">
                  Top mutual fund: {fundPressure.topMutualFundName} ({fmtPercent(fundPressure.topMutualFundPct)})
                </span>
              ) : null}
            </div>
          </motion.section>
        ) : null}

        {patternAlerts.length > 0 ? (
          <motion.section
            className="rounded-2xl border border-border bg-panel/45 p-4"
            custom={7}
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
          >
            <div className="section-title mb-1">Pattern intelligence</div>
            <p className="mb-3 pl-[15px] text-sm text-muted">
              Pattern ketat dari clustering disclosure snapshot aktif. Ini context tambahan, bukan bukti koordinasi.
            </p>
            <div className="grid gap-3 lg:grid-cols-2">
              {patternAlerts.map((alert) => (
                <div key={alert.id} className="rounded-xl border border-border bg-panel-2/45 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                        alert.tone === "shadow"
                          ? "border-[#E7D2B3] bg-[#F8EEDC] text-[#996737]"
                          : "border-[#D6C6CF] bg-[#F3ECF1] text-[#685261]"
                      }`}
                    >
                      {alert.label}
                    </span>
                    <div className="text-right text-[12px] text-muted">
                      <div className="font-mono font-semibold text-foreground">{fmtPercent(alert.combinedPct)}</div>
                      <div>{alert.entityCount.toLocaleString("id-ID")} entitas</div>
                    </div>
                  </div>

                  <p className="mt-2 text-sm text-muted">{alert.message}</p>

                  {alert.domicileCategory ? (
                    <div className="mt-2 text-[12px] text-muted">
                      Kategori domisili:{" "}
                      <span className="font-semibold text-foreground">
                        {formatPatternCategory(alert.domicileCategory)}
                      </span>
                    </div>
                  ) : null}

                  <div className="mt-3 space-y-2">
                    {alert.investors.slice(0, 5).map((investor) => (
                      <div
                        key={investor.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-panel/30 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => {
                              navigateToInvestor(investor.id);
                            }}
                            className="truncate text-left text-sm font-semibold text-foreground hover:text-teal"
                          >
                            {investor.name}
                          </button>
                          {investor.domicile ? (
                            <div className="mt-0.5 text-[12px] text-muted">{investor.domicile}</div>
                          ) : null}
                        </div>
                        <div className="shrink-0 font-mono text-sm font-semibold text-foreground">
                          {fmtPercent(investor.percentage)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {patternAlerts.some((alert) => alert.disclaimerKey === "coordinated-bloc") ? (
              <div className="mt-3 rounded-lg border border-[#D6C6CF] bg-[#F3ECF1] px-3 py-2 text-xs text-[#685261]">
                Kesamaan domisili bukan bukti koordinasi. Lakukan due diligence independen.
              </div>
            ) : null}
          </motion.section>
        ) : null}

        <motion.section 
          className="rounded-2xl border border-border bg-panel/45 p-4"
          custom={8}
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
            prices={prices}
            onSelectInvestor={(investorId: string) => {
              navigateToInvestor(investorId);
            }}
          />
        </motion.section>

        {/* ── Similar Issuers (Emiten Mirip) ── */}
        <SimilarIssuersPanel currentIssuerId={issuer.issuerId} allIssuers={views.universeItems} />

      </motion.div>
      <EditorialFooter />
    </PageShell>
  );
}
