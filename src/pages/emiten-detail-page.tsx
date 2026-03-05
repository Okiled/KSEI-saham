import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, Variants } from "framer-motion";
import { AlertTriangle, FileBarChart, Loader2, Lock, ShieldAlert, Layers } from "lucide-react";
import { AnimatedNumber } from "../components/animated-number";
import { GlobalHeader } from "../components/global-header";
import { OwnershipSankeyL2R } from "../components/ownership-sankey-l2r";
import { OwnershipTimelinePanel } from "../components/ownership-timeline-panel";
import { CoInvestorHeatmapPanel } from "../components/co-investor-heatmap-panel";
import { OwnershipCompositionPanel } from "../components/ownership-composition-panel";
import { OwnershipHolderTable } from "../components/ownership-holder-table";
import { useDatasetLoader } from "../hooks/use-dataset-loader";
import { useOwnershipViews } from "../hooks/use-ownership-views";
import { getIssuerId } from "../lib/graph";
import { fmtNumber, fmtPercent, freeFloatContext } from "../lib/utils";

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
  initial: { opacity: 0, y: 16 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { 
      duration: 0.35,
      ease: [0.16, 1, 0.3, 1],
      staggerChildren: 0.06
    }
  },
  exit: { 
    opacity: 0, 
    y: -8,
    transition: { duration: 0.2, ease: "easeIn" }
  }
};

export function EmitenDetailPage() {
  const navigate = useNavigate();
  const params = useParams();
  const shareCodeParam = params.shareCode?.trim().toUpperCase() ?? "";
  const selectedIssuerId = shareCodeParam ? `issuer:${shareCodeParam}` : null;

  const { loadState, loadError } = useDatasetLoader();
  const views = useOwnershipViews({ selectedIssuerId, topOverlapHolders: 12 });

  const issuer = views.issuerOwnership;

  const crossInvestorCards = useMemo(() => {
    if (!issuer) return [];
    return issuer.holders.slice(0, 8).map((holder) => ({
      holder,
      others: issuer.crossHoldingsByInvestor[holder.investorId] ?? [],
    }));
  }, [issuer]);

  const kendali = useMemo(() => strukturKendali(issuer?.holders ?? []), [issuer]);
  const ffCtx = useMemo(() => freeFloatContext(issuer?.freeFloatEstimatePct ?? 0), [issuer]);

  if (loadState !== "ready") {
    return (
      <main className="min-h-screen bg-nebula px-8 py-5">
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
    );
  }

  if (!selectedIssuerId || !issuer) {
    return (
      <main className="min-h-screen bg-nebula px-8 py-5">
        <div className="rounded-2xl border border-border bg-panel/45 p-8">
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <FileBarChart className="h-12 w-12 text-muted/40" />
            <div className="text-lg font-semibold text-foreground">Emiten tidak ditemukan</div>
            <p className="text-sm text-muted">
              Ticker <span className="font-mono text-teal">{shareCodeParam || "-"}</span> belum ada di dataset aktif.
            </p>
            <Link
              to="/"
              className="mt-2 inline-flex rounded-full border border-teal/30 bg-teal/5 px-4 py-1.5 text-sm text-teal hover:bg-teal/10"
            >
              ← Kembali ke Browse Universe
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const topHolder = issuer.holders[0] ?? null;
  const KendaliIcon = kendali.Icon;

  return (
    <motion.main 
      className="min-h-screen bg-nebula px-8 py-5"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className="flex w-full flex-col gap-4">
        <GlobalHeader
          title={`${issuer.shareCode} | ${issuer.issuerName}`}
          subtitle={`Data per ${issuer.snapshotDate ?? "—"} — ownership intelligence emiten`}
          allRows={views.allRows}
          currentPage="emiten"
          currentId={issuer.shareCode}
          activeIssuer={{ shareCode: issuer.shareCode }}
          activeInvestor={
            topHolder ? { investorId: topHolder.investorId, investorName: topHolder.investorName } : null
          }
        />

        {/* ── Hero Stat Strip ── */}
        <motion.section 
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"
          custom={0}
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <div className="rounded-xl border border-border bg-panel/45 p-4">
            <div className="section-title">Snapshot Date</div>
            <div className="stat-hero mt-2">{issuer.snapshotDate ?? "-"}</div>
          </div>
          <div className="rounded-xl border border-border bg-panel/45 p-4">
            <div className="section-title">Holders</div>
            <div className="stat-hero mt-2"><AnimatedNumber value={issuer.holders.length} formatter={fmtNumber} /></div>
          </div>
          <div className="rounded-xl border border-border bg-panel/45 p-4">
            <div className="section-title">Top Holder</div>
            <div className="mt-2 truncate text-sm font-semibold text-foreground">{topHolder?.investorName ?? "-"}</div>
            <div className="stat-inline text-teal">{topHolder ? <AnimatedNumber value={topHolder.percentage} formatter={fmtPercent} /> : "-"}</div>
          </div>
          <div className="rounded-xl border border-border bg-panel/45 p-4">
            <div className="section-title">Struktur Kendali</div>
            <div className={`mt-2 flex items-center gap-1.5 font-semibold ${kendali.color}`}>
              <KendaliIcon className="h-4 w-4" />
              <span className="text-lg">{kendali.label}</span>
            </div>
            <div className="text-xs text-muted">{kendali.description}</div>
          </div>
          <div className="rounded-xl border border-border bg-panel/45 p-4">
            <div className="section-title">Free Float (Estimasi)</div>
            <div className={`stat-hero mt-2 ${ffCtx.color}`}><AnimatedNumber value={issuer.freeFloatEstimatePct} formatter={fmtPercent} /></div>
            <div className={`mt-1 text-xs ${ffCtx.color}`}>{ffCtx.label}</div>
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
            onSelectInvestor={(investorKey) => navigate(`/investor/${encodeURIComponent(investorKey)}`)}
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
                    onClick={() => navigate(`/investor/${encodeURIComponent(card.holder.investorId)}`)}
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
                          onClick={() => navigate(`/emiten/${encodeURIComponent(position.shareCode)}`)}
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
            onSelectInvestor={(investorKey) => navigate(`/investor/${encodeURIComponent(investorKey)}`)}
            onSelectIssuer={(nextIssuerId) => {
              const row = views.allRows.find((item) => getIssuerId(item) === nextIssuerId);
              if (!row) return;
              navigate(`/emiten/${encodeURIComponent(row.shareCode)}`);
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
            onSelectInvestor={(investorId) => navigate(`/investor/${encodeURIComponent(investorId)}`)}
          />
        </motion.section>

        {/* ── Footer ── */}
        <footer className="mt-6 flex justify-center pb-4 text-xs font-mono text-muted/40">
          <a href="https://x.com/Conaax" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-teal">
            Made by CONA
          </a>
        </footer>
      </div>
    </motion.main>
  );
}