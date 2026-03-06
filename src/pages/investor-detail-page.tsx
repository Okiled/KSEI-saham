import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, Variants } from "framer-motion";
import { AlertTriangle, Loader2, Users, Target, Globe, Building2, BarChart3 } from "lucide-react";
import { AnimatedNumber } from "../components/animated-number";
import { InvestorPortfolioTable } from "../components/investor-portfolio-table";
import { InvestorSankey } from "../components/investor-sankey";
import { OwnershipTimelinePanel } from "../components/ownership-timeline-panel";
import { CoInvestorHeatmapPanel } from "../components/co-investor-heatmap-panel";
import { FrequentCoinvestorsPanel } from "../components/frequent-coinvestors-panel";
import { HhiGauge } from "../components/hhi-gauge";
import { useDatasetLoader } from "../hooks/use-dataset-loader";
import { useOwnershipViews } from "../hooks/use-ownership-views";
import { getInvestorId, getIssuerId } from "../lib/graph";
import { fmtNumber, fmtPercent, formatInvestorType } from "../lib/utils";
import { investorTypeBadgeColor } from "../theme/tokens";
import { buildInvestorCoInvestorOverlap } from "../lib/ownership-analytics";
import type { OwnershipRow, OwnershipTimelineView } from "../types/ownership";

/* ── Investor Heatmap Wrapper ── */
function InvestorHeatmapSection({
  allRows,
  investorId,
  snapshotDate,
  onSelectInvestor,
  onSelectIssuer,
}: {
  allRows: OwnershipRow[];
  investorId: string;
  snapshotDate: string | null;
  onSelectInvestor: (id: string) => void;
  onSelectIssuer: (issuerId: string) => void;
}) {
  const overlap = useMemo(
    () => buildInvestorCoInvestorOverlap(allRows, investorId, snapshotDate, 10),
    [allRows, investorId, snapshotDate],
  );
  return (
    <CoInvestorHeatmapPanel
      overlap={overlap}
      onSelectInvestor={onSelectInvestor}
      onSelectIssuer={onSelectIssuer}
    />
  );
}

/* ── IDX Expert: Gaya Investasi Inference ── */
function gayaInvestasiInference(identity: {
  holdingsCount: number;
  topPositionPct: number;
  localForeignMode: "L" | "A" | null;
  investorType: string;
  hhi: number;
}): { label: string; description: string; color: string; Icon: typeof Target } {
  const t = identity.investorType.toUpperCase();
  if (identity.localForeignMode === "A" && (t.includes("IB") || t.includes("IC") || t.includes("IS"))) {
    return { label: "Foreign Institution", description: "Investor asing institutional", color: "text-gold", Icon: Globe };
  }
  if (t.includes("CP") || t.includes("ID")) {
    if (identity.holdingsCount <= 3 && identity.topPositionPct > 30) {
      return { label: "Strategic/Corporate", description: "Posisi terkonsentrasi, kemungkinan pemegang strategis", color: "text-violet", Icon: Building2 };
    }
  }
  if (identity.topPositionPct >= 50) {
    return { label: "Concentrated", description: `Posisi terbesar ${fmtPercent(identity.topPositionPct)} dari portfolio`, color: "text-rose", Icon: Target };
  }
  if (identity.holdingsCount >= 20) {
    return { label: "Diversified", description: `${identity.holdingsCount} posisi tersebar`, color: "text-teal", Icon: BarChart3 };
  }
  if (identity.holdingsCount >= 5) {
    return { label: "Moderate", description: `${identity.holdingsCount} posisi, HHI ${identity.hhi.toFixed(0)}`, color: "text-foreground", Icon: BarChart3 };
  }
  return { label: "Focused", description: `${identity.holdingsCount} posisi terfokus`, color: "text-gold", Icon: Target };
}

function safeDecodeURIComponent(value: string | null): string | null {
  if (!value) return null;
  try { return decodeURIComponent(value); } catch { return value; }
}

function resolveInvestorIdFromParam(rows: ReturnType<typeof useOwnershipViews>["allRows"], param: string | null) {
  if (!param) return null;
  if (param.toLowerCase().startsWith("investor:")) {
    return rows.some((row) => getInvestorId(row) === param) ? param : null;
  }
  const target = param.trim().toUpperCase();
  if (!target) return null;
  const exact = rows.find((row) => row.investorName.trim().toUpperCase() === target);
  if (exact) return getInvestorId(exact);
  const partial = rows.find((row) => row.investorName.trim().toUpperCase().includes(target));
  return partial ? getInvestorId(partial) : null;
}



function modeLabel(values: Array<string | null>): string {
  const counts = new Map<string, number>();
  for (const v of values) { const n = (v ?? "UNKNOWN").trim() || "UNKNOWN"; counts.set(n, (counts.get(n) ?? 0) + 1); }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "UNKNOWN";
}

function localForeignLabel(v: "L" | "A" | null): string { return v === "L" ? "Lokal" : v === "A" ? "Asing" : "Unknown"; }
function localForeignColor(v: "L" | "A" | null): string { return v === "L" ? "text-teal" : v === "A" ? "text-gold" : "text-muted"; }

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }
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

export function InvestorDetailPage({ investorKey }: { investorKey: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const investorParam = safeDecodeURIComponent(investorKey);

  const handleClose = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("investor");
    setSearchParams(next);
  };

  const { loadState, loadError } = useDatasetLoader();
  const baseViews = useOwnershipViews();
  const selectedInvestorId = useMemo(
    () => resolveInvestorIdFromParam(baseViews.allRows, investorParam),
    [baseViews.allRows, investorParam],
  );
  const views = useOwnershipViews({ selectedInvestorId });

  const portfolio = views.investorPortfolio;
  const connected = views.connectedInvestors;

  const identity = useMemo(() => {
    if (portfolio.length === 0) return null;
    const first = portfolio[0];
    const sorted = [...portfolio].sort((a, b) => b.percentage - a.percentage);
    const totalShares = portfolio.reduce((sum, r) => sum + r.shares, 0);
    const totalPct = portfolio.reduce((sum, r) => sum + r.percentage, 0);
    const top3Pct = sorted.slice(0, 3).reduce((sum, r) => sum + r.percentage, 0);
    const topPositionPct = totalPct > 0 ? (sorted[0].percentage / totalPct) * 100 : 0;
    const nw = totalPct > 0 ? portfolio.map((r) => r.percentage / totalPct) : [];
    const hhi = nw.reduce((s, w) => s + w * w, 0) * 10000;
    const lfMode = modeLabel(portfolio.map((r) => r.localForeign));

    return {
      investorId: first.investorId,
      investorName: first.investorName,
      investorType: modeLabel(portfolio.map((r) => r.investorType)),
      localForeign: first.localForeign,
      localForeignMode: lfMode === "L" ? "L" as const : lfMode === "A" ? "A" as const : null,
      nationality: modeLabel(portfolio.map((r) => r.nationality)),
      domicile: modeLabel(portfolio.map((r) => r.domicile)),
      holdingsCount: portfolio.length,
      totalShares,
      totalPct,
      top3Pct,
      topPositionPct,
      hhi,
      snapshotDate: first.snapshotDate,
    };
  }, [portfolio]);

  const gayaInvestasi = useMemo(() => {
    if (!identity) return null;
    return gayaInvestasiInference(identity);
  }, [identity]);

  // Build a pseudo-timeline for investor's total portfolio
  const investorTimeline: OwnershipTimelineView | null = useMemo(() => {
    if (!identity) return null;
    // Group portfolio positions as a single series showing total % per snapshot
    const snapshotDates = [...new Set(portfolio.map((p) => p.snapshotDate))].sort();
    const totalByDate = new Map<string, number>();
    for (const p of portfolio) {
      totalByDate.set(p.snapshotDate, (totalByDate.get(p.snapshotDate) ?? 0) + p.percentage);
    }

    return {
      issuerId: identity.investorId,
      shareCode: identity.investorName,
      issuerName: identity.investorName,
      snapshotDates,
      hasEnoughHistory: snapshotDates.length > 1,
      series: [
        {
          investorId: identity.investorId,
          investorName: `Total % hold (${identity.holdingsCount} emiten)`,
          points: snapshotDates.map((date) => ({
            snapshotDate: date,
            percentage: totalByDate.get(date) ?? 0,
            shares: identity.totalShares,
          })),
        },
      ],
    };
  }, [identity, portfolio]);

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
              <div className="text-sm text-muted">Menyiapkan detail investor...</div>
            </div>
          )}
        </div>
      </main>
      </>
    );
  }

  if (!selectedInvestorId || !identity || !gayaInvestasi) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
        <main className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-4xl overflow-y-auto glass-deep px-8 py-8 border-l border-white/10">
          <button onClick={handleClose} className="absolute top-4 right-4 z-50 rounded-full bg-black/20 hover:bg-black/40 text-white/70 hover:text-white p-2">✕</button>
          <div className="rounded-2xl border border-border bg-panel/45 p-8">
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Users className="h-12 w-12 text-muted/40" />
            <div className="text-lg font-semibold text-foreground">Investor tidak ditemukan</div>
            <p className="text-sm text-muted">
              Key <span className="font-mono text-teal">{investorParam ?? "-"}</span> belum ada di dataset aktif.
            </p>
            <button type="button" onClick={handleClose} className="mt-2 inline-flex rounded-full border border-teal/30 bg-teal/5 px-4 py-1.5 text-sm text-teal hover:bg-teal/10">
              ← Tutup Panel
            </button>
          </div>
        </div>
      </main>
      </>
    );
  }

  const typeBadge = investorTypeBadgeColor(identity.investorType);
  const GayaIcon = gayaInvestasi.Icon;

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
              {identity.investorName}
            </h1>
            <p className="mt-1 text-sm text-muted">Data per {identity.snapshotDate} — profil investor dan portofolio IDX</p>
          </header>

        {/* ── Hero Section ── */}
        <motion.section
          className="rounded-2xl border border-border bg-panel/45 p-6"
          custom={0} variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span 
                  className={`rounded-full border px-3 py-0.5 text-xs font-medium cursor-help ${typeBadge.bg} ${typeBadge.text} ${typeBadge.border}`}
                  title={identity.investorType}
                >
                  {formatInvestorType(identity.investorType)}
                </span>
                <span className={`rounded-full border border-border px-3 py-0.5 text-xs font-medium ${localForeignColor(identity.localForeign)}`}>
                  {localForeignLabel(identity.localForeign)}
                </span>
                {identity.nationality !== "UNKNOWN" && (
                  <span className="rounded-full border border-border px-3 py-0.5 text-xs text-muted">{identity.nationality}</span>
                )}
                <span className={`flex items-center gap-1 rounded-full border border-border px-3 py-0.5 text-xs font-medium ${gayaInvestasi.color}`}>
                  <GayaIcon className="h-3 w-3" />
                  {gayaInvestasi.label}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">{gayaInvestasi.description}</p>
            </div>
            <div className="text-right">
              <div className="stat-hero text-teal"><AnimatedNumber value={identity.holdingsCount} /></div>
              <div className="text-sm text-muted">emiten</div>
            </div>
          </div>
        </motion.section>

        {/* ── 1) Portfolio Concentration Stats ── */}
        <motion.section
          className="rounded-2xl border border-border bg-panel/45 p-4"
          custom={1} variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }}
        >
          <div className="section-title mb-1">1) Portfolio Concentration</div>
          <p className="mb-3 pl-[15px] text-sm text-muted">
            Ukur kekuatan dan konsentrasi posisi — seberapa fokus investor pada saham tertentu?
          </p>
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[120px] rounded-xl border border-border bg-panel-2/45 p-4 flex flex-col justify-start">
              <div className="section-title mb-2">Holders</div>
              <div className="stat-hero"><AnimatedNumber value={identity.holdingsCount} /></div>
            </div>
            <div className="flex-[1.5] min-w-[170px] rounded-xl border border-border bg-panel-2/45 p-4 flex flex-col justify-start overflow-hidden">
              <div className="section-title mb-2">Total Shares</div>
              <div className="stat-hero truncate w-full" title={Intl.NumberFormat("id-ID").format(identity.totalShares)}>
                <AnimatedNumber value={identity.totalShares} formatter={fmtNumber} />
              </div>
            </div>
            <div className="flex-1 min-w-[140px] rounded-xl border border-border bg-panel-2/45 p-4 flex flex-col justify-start">
              <div className="section-title mb-2">Total % Hold</div>
              <div className="stat-hero"><AnimatedNumber value={identity.totalPct} formatter={fmtPercent} /></div>
            </div>
            <div className="flex-1 min-w-[140px] rounded-xl border border-border bg-panel-2/45 p-4 flex flex-col justify-start">
              <div className="section-title mb-2">Top 3 Weight</div>
              <div className="stat-hero"><AnimatedNumber value={identity.top3Pct} formatter={fmtPercent} /></div>
            </div>
            <div className="flex-1 min-w-[120px] rounded-xl border border-border bg-panel-2/45 p-4 flex flex-col justify-start">
              <div className="section-title mb-2">HHI</div>
              <div className="stat-hero"><AnimatedNumber value={identity.hhi} formatter={(n) => n.toFixed(0)} /></div>
            </div>
          </div>
        </motion.section>

        {/* ── 2) Ownership Sankey Flow ── */}
        <motion.section
          className="rounded-2xl border border-border bg-panel/45 p-4"
          custom={2} variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }}
        >
          <div className="section-title mb-1">2) Alur Kepemilikan ke Portofolio IDX</div>
          <p className="mb-3 pl-[15px] text-sm text-muted">
            Alur kepemilikan investor ini ke seluruh portofolio IDX — klik emiten untuk detail.
          </p>
          <InvestorSankey
            investorName={identity.investorName}
            positions={portfolio}
            onSelectEmiten={(shareCode) => {
              const next = new URLSearchParams(searchParams);
              next.delete("investor");
              next.set("emiten", shareCode);
              setSearchParams(next);
            }}
          />
        </motion.section>

        {/* ── 3) Co-Investor Heatmap ── */}
        <motion.section
          className="rounded-2xl border border-border bg-panel/45 p-4"
          custom={3} variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }}
        >
          <div className="section-title mb-1">3) Siapa sering muncul bersama?</div>
          <p className="mb-3 pl-[15px] text-sm text-muted">
            Heatmap overlap co-investor — temukan investor lain yang bergerak di emiten serupa.
          </p>
          <InvestorHeatmapSection
            allRows={views.allRows}
            investorId={selectedInvestorId}
            snapshotDate={views.snapshotDate}
            onSelectInvestor={(id) => {
              const next = new URLSearchParams(searchParams);
              next.delete("investor");
              next.set("investor", id);
              setSearchParams(next);
            }}
            onSelectIssuer={(issuerId) => {
              const row = views.allRows.find((r) => getIssuerId(r) === issuerId);
              if (row) {
                const next = new URLSearchParams(searchParams);
                next.delete("investor");
                next.set("emiten", row.shareCode);
                setSearchParams(next);
              }
            }}
          />
        </motion.section>

        {/* ── 4) Ownership Timeline ── */}
        <motion.section
          className="rounded-2xl border border-border bg-panel/45 p-4"
          custom={4} variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }}
        >
          <div className="section-title mb-1">4) Perubahan Total Kepemilikan</div>
          <p className="mb-3 pl-[15px] text-sm text-muted">
            Pantau perubahan total kepemilikan investor antar periode snapshot.
          </p>
          <OwnershipTimelinePanel timeline={investorTimeline} />
        </motion.section>

        {/* ── 5) Konsentrasi Portofolio (HHI) ── */}
        <motion.section
          className="rounded-2xl border border-border bg-panel/45 p-4"
          custom={5} variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }}
        >
          <div className="section-title mb-1">5) Konsentrasi Portofolio (HHI)</div>
          <p className="mb-3 pl-[15px] text-sm text-muted">
            Herfindahl-Hirschman Index — ukur seberapa terkonsentrasi portofolio investor pada sedikit saham.
          </p>
          <HhiGauge hhi={identity.hhi} />
        </motion.section>

        {/* ── 6) Co-Investor Network ── */}
        <motion.section
          className="rounded-2xl border border-border bg-panel/45 p-4"
          custom={6} variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }}
        >
          <div className="section-title mb-1">6) Investor yang sering muncul bersama</div>
          <p className="mb-3 pl-[15px] text-sm text-muted">
            Temukan investor yang bergerak di emiten serupa — co-investor dengan overlap tinggi menandakan pola investasi serupa.
          </p>
          {connected.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-panel-2/25 p-6 text-center">
              <Users className="h-10 w-10 text-muted/30" />
              <div className="text-sm font-medium text-muted">Belum ada overlap investor yang cukup</div>
              <p className="max-w-sm text-xs text-muted">
                Co-investor akan muncul saat investor ini hadir di lebih dari satu emiten bersama investor lain.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {connected.map((item) => (
                <div key={item.investorId} className="rounded-xl border border-border bg-panel-2/45 p-3 transition-colors hover:bg-panel-2/65">
                  <button
                    type="button"
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      next.set("investor", item.investorId);
                      setSearchParams(next);
                    }}
                    className="text-left"
                  >
                    <div className="text-sm font-semibold text-foreground">{item.investorName}</div>
                  </button>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="stat-inline text-teal">{fmtNumber(item.commonIssuerCount)}</span>
                    <span className="text-xs text-muted">emiten bersama</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.commonShareCodes.slice(0, 8).map((shareCode) => (
                      <button
                        key={`${item.investorId}:${shareCode}`}
                        type="button"
                        onClick={() => {
                          const next = new URLSearchParams(searchParams);
                          next.delete("investor");
                          next.set("emiten", shareCode);
                          setSearchParams(next);
                        }}
                        className="rounded-full border border-teal/20 bg-teal/5 px-2.5 py-0.5 font-mono text-[11px] font-medium text-teal transition-colors hover:bg-teal/15"
                      >
                        {shareCode}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {/* ── 7) Portfolio Table (Last) ── */}
        <motion.section
          className="rounded-2xl border border-border bg-panel/45 p-4"
          custom={7} variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }}
        >
          <div className="section-title mb-1">7) Portfolio IDX</div>
          <p className="mb-3 pl-[15px] text-sm text-muted">
            Semua posisi investor pada snapshot ini, urut dari kepemilikan terbesar. Klik ticker untuk lihat detail emiten.
          </p>
          <InvestorPortfolioTable
            positions={portfolio}
            onSelectPosition={(pos) => {
              const next = new URLSearchParams(searchParams);
              next.delete("investor");
              next.set("emiten", pos.shareCode);
              setSearchParams(next);
            }}
          />
        </motion.section>

        {/* ── 9) Frequent Co-investors (Afiliasi) ── */}
        <FrequentCoinvestorsPanel currentInvestorId={selectedInvestorId} allRows={views.allRows} />

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