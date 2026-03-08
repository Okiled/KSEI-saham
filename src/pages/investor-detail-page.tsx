import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, Variants } from "framer-motion";
import { AlertTriangle, Loader2, Users } from "lucide-react";
import { AnimatedNumber } from "../components/animated-number";
import { EditorialFooter, PageShell } from "../components/page-shell";
import { InvestorPortfolioTable } from "../components/investor-portfolio-table";
import { InvestorSankey } from "../components/investor-sankey";
import { GlobalHeader } from "../components/global-header";
import { OwnershipTimelinePanel } from "../components/ownership-timeline-panel";
import { CoInvestorHeatmapPanel } from "../components/co-investor-heatmap-panel";
import { FrequentCoinvestorsPanel } from "../components/frequent-coinvestors-panel";
import { HhiGauge } from "../components/hhi-gauge";
import { useDatasetLoader } from "../hooks/use-dataset-loader";
import { useMarketData } from "../hooks/use-market-data";
import { useOwnershipViews } from "../hooks/use-ownership-views";
import { getInvestorId, getIssuerId } from "../lib/graph";
import { formatIDR } from "../lib/format";
import { getPositionValueIDR } from "../lib/market-data";
import { normalizeTickerList } from "../lib/market-data";
import { buildInvestorStyleProfile, type InvestorStyle } from "../lib/style-profiling";
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
function styleBadgeClass(style: InvestorStyle): string {
  if (style === "VALUE") return "border-[#BFDBFE] bg-[#EFF6FF] text-[#1E40AF]";
  if (style === "GROWTH") return "border-[#BBF7D0] bg-[#F0FDF4] text-[#065F46]";
  if (style === "DIVIDEND") return "border-[#FDE68A] bg-[#FEF3C7] text-[#78350F]";
  if (style === "SECTOR_SPECIALIST") return "border-[#DDD6FE] bg-[#F5F3FF] text-[#5B21B6]";
  return "border-border bg-panel-2/45 text-foreground";
}

function styleLabel(style: InvestorStyle): string {
  return style === "SECTOR_SPECIALIST" ? "Sector Specialist" : style;
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

const pageVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number], staggerChildren: 0.06 },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] as [number, number, number, number] },
  },
};

export function InvestorDetailPage({ investorKey }: { investorKey: string }) {
  const navigate = useNavigate();
  const investorParam = safeDecodeURIComponent(investorKey);

  const { loadState, loadError } = useDatasetLoader();
  const baseViews = useOwnershipViews();
  const selectedInvestorId = useMemo(
    () => resolveInvestorIdFromParam(baseViews.allRows, investorParam),
    [baseViews.allRows, investorParam],
  );
  const views = useOwnershipViews({ selectedInvestorId });

  const portfolio = views.investorPortfolio;
  const connected = views.connectedInvestors;
  const portfolioTickers = useMemo(
    () => normalizeTickerList(portfolio.map((position) => position.shareCode)),
    [portfolio],
  );
  const { prices, marketData } = useMarketData(portfolioTickers);
  const navigateToInvestor = (investorId: string) => {
    navigate(`/investor/${encodeURIComponent(investorId)}`);
  };
  const navigateToIssuer = (shareCode: string) => {
    navigate(`/emiten/${encodeURIComponent(shareCode.trim().toUpperCase())}`);
  };
  const navigateToIssuerId = (issuerId: string) => {
    const row = views.allRows.find((r) => getIssuerId(r) === issuerId);
    if (row) navigateToIssuer(row.shareCode);
  };

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

  const styleProfile = useMemo(
    () => buildInvestorStyleProfile(portfolio, marketData),
    [portfolio, marketData],
  );
  const portfolioValueIDR = useMemo(
    () => portfolio.reduce((sum, position) => sum + (getPositionValueIDR(position.shares, prices[position.shareCode]) ?? 0), 0),
    [portfolio, prices],
  );

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
      <PageShell>
        <GlobalHeader
          title="Detail Investor"
          subtitle="Profil investor, portofolio IDX, dan relasi co-investor dalam satu halaman."
          allRows={views.allRows}
          currentPage="investor"
          currentId={investorParam ?? undefined}
          actions={[{ label: "Browse Universe", to: "/", variant: "secondary" }]}
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
              <div className="text-sm text-muted">Menyiapkan detail investor...</div>
            </div>
          )}
        </div>
        <EditorialFooter />
      </PageShell>
    );
  }

  if (!selectedInvestorId || !identity) {
    return (
      <PageShell>
        <GlobalHeader
          title="Detail Investor"
          subtitle="Profil investor, portofolio IDX, dan relasi co-investor dalam satu halaman."
          allRows={views.allRows}
          currentPage="investor"
          currentId={investorParam ?? undefined}
          actions={[{ label: "Browse Universe", to: "/", variant: "secondary" }]}
          onNavigate={navigate}
        />
        <div className="page-section p-6">
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Users className="h-12 w-12 text-muted/40" />
            <div className="text-lg font-semibold text-foreground">Investor tidak ditemukan</div>
            <p className="text-sm text-muted">
              Key <span className="font-mono text-teal">{investorParam ?? "-"}</span> belum ada di dataset aktif.
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

  const typeBadge = investorTypeBadgeColor(identity.investorType);

  return (
    <PageShell>
      <GlobalHeader
        title={identity.investorName}
        subtitle="Profil investor, konsentrasi portofolio, overlap co-investor, dan semua posisi IDX pada snapshot aktif."
        allRows={views.allRows}
        currentPage="investor"
        currentId={selectedInvestorId}
        activeInvestor={{ investorId: selectedInvestorId, investorName: identity.investorName }}
        metadata={`Data per ${identity.snapshotDate}`}
        actions={[
          { label: "Browse Universe", to: "/", variant: "secondary" },
          { label: "Open Workstation", to: `/workstation/investor/${encodeURIComponent(selectedInvestorId)}`, variant: "ghost" },
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

        {/* ── Hero Section ── */}
        <motion.section
          className="rounded-2xl border border-border bg-panel/45 p-4"
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
                <span className={`rounded-full border px-3 py-0.5 text-xs font-medium ${styleBadgeClass(styleProfile.style)}`}>
                  {styleLabel(styleProfile.style)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">{styleProfile.reason}</p>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Portfolio IDR</div>
              <div className="mt-1 max-w-[260px] text-right text-[1.7rem] font-semibold leading-none tracking-tight text-[#855A30]">
                {portfolioValueIDR > 0 ? formatIDR(portfolioValueIDR) : "-"}
              </div>
              <div className="mt-2 text-sm text-muted">{identity.holdingsCount} emiten disclosed</div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 border-t border-border/70 pt-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <div className="section-title mb-1">Weighted PE</div>
              <div className="font-mono text-sm font-semibold text-foreground">
                {styleProfile.avgPE !== null ? `${styleProfile.avgPE.toFixed(1)}x` : "-"}
              </div>
            </div>
            <div>
              <div className="section-title mb-1">Weighted PB</div>
              <div className="font-mono text-sm font-semibold text-foreground">
                {styleProfile.avgPB !== null ? `${styleProfile.avgPB.toFixed(2)}x` : "-"}
              </div>
            </div>
            <div>
              <div className="section-title mb-1">Avg Div Yield</div>
              <div className="font-mono text-sm font-semibold text-foreground">
                {styleProfile.avgDivYieldPct !== null ? `${styleProfile.avgDivYieldPct.toFixed(1)}%` : "-"}
              </div>
            </div>
            <div>
              <div className="section-title mb-1">Market Coverage</div>
              <div className="font-mono text-sm font-semibold text-foreground">
                {styleProfile.coveragePct > 0 ? `${styleProfile.coveragePct.toFixed(0)}%` : "-"}
              </div>
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
              navigateToIssuer(shareCode);
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
              navigateToInvestor(id);
            }}
            onSelectIssuer={(issuerId) => {
              navigateToIssuerId(issuerId);
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
                      navigateToInvestor(item.investorId);
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
                          navigateToIssuer(shareCode);
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
            prices={prices}
            onSelectPosition={(pos) => {
              navigateToIssuer(pos.shareCode);
            }}
          />
        </motion.section>

        {/* ── 9) Frequent Co-investors (Afiliasi) ── */}
        <FrequentCoinvestorsPanel currentInvestorId={selectedInvestorId} allRows={views.allRows} />

      </motion.div>
      <EditorialFooter />
    </PageShell>
  );
}
