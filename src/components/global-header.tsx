import { Link } from "react-router-dom";
import { Home } from "lucide-react";
import { GlobalSearch } from "./global-search";
import type { OwnershipRow } from "../types/ownership";

type GlobalHeaderProps = {
  title: string;
  subtitle: string;
  allRows: OwnershipRow[];
  currentPage: "emiten" | "investor" | "browse";
  currentId?: string;
  activeIssuer?: { shareCode: string } | null;
  activeInvestor?: { investorId: string; investorName: string } | null;
  /* Kept for backwards compat */
  issuerOptions?: unknown[];
  investorOptions?: unknown[];
};

export function GlobalHeader({
  title,
  subtitle,
  allRows,
  currentPage,
  currentId,
  activeIssuer = null,
  activeInvestor = null,
}: GlobalHeaderProps) {
  const isDetailPage = Boolean(activeIssuer || activeInvestor);

  return (
    <header className="space-y-2">
      {/* ── Back Button & Home ── */}
      {isDetailPage && (
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="relative z-10 flex items-center gap-1.5 rounded-lg bg-white transition-all duration-150 ease-out hover:-translate-x-[3px] hover:border-teal hover:text-teal"
            style={{
              minHeight: 36,
              fontFamily: "DM Mono, monospace",
              fontSize: 13,
              color: "#4a4640",
              textDecoration: "none",
              cursor: "pointer",
              border: "1.5px solid rgba(0,0,0,0.13)",
              borderRadius: 8,
              padding: "8px 16px",
            }}
          >
            <Home className="h-4 w-4" />
            <span>Home</span>
          </Link>
        </div>
      )}

      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-2" style={{ fontFamily: "DM Mono, monospace", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "#8a8580" }}>
        <Link to="/" className="transition-colors hover:text-teal">
          Browse Universe
        </Link>
        {activeIssuer && (
          <>
            <span style={{ color: "rgba(0,0,0,0.2)" }}>/</span>
            <Link to={`/emiten/${encodeURIComponent(activeIssuer.shareCode)}`} className="transition-colors hover:text-teal" style={{ color: "#0a8c6e" }}>
              {activeIssuer.shareCode}
            </Link>
          </>
        )}
        {activeInvestor && (
          <>
            <span style={{ color: "rgba(0,0,0,0.2)" }}>/</span>
            <span style={{ color: "#1a1814" }}>{activeInvestor.investorName.slice(0, 30)}</span>
          </>
        )}
      </nav>

      {/* ── Title + Search Card ── */}
      <div className="rounded-2xl border border-border bg-panel/50 px-5 py-4 shadow-[0_10px_30px_rgba(60,52,44,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-serif-display font-semibold text-foreground" style={{ fontSize: 30 }}>{title}</h1>
            <p className="mt-1" style={{ fontSize: 13, color: "#4a4640", lineHeight: 1.6 }}>
              {subtitle} <span style={{ opacity: 0.5, margin: "0 6px" }}>•</span>{" "}
              <a href="https://x.com/Conaax" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: "#0a8c6e", textDecoration: "none" }} className="hover:underline">
                Made by CONA
              </a>
            </p>
          </div>
          <div className="flex items-center gap-2" style={{ fontSize: 13 }}>
            <Link to="/" className="whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-muted transition-colors hover:border-teal/30 hover:bg-teal/5 hover:text-teal">
              Browse
            </Link>
          </div>
        </div>
        {/* ── In-page search (detail pages only — home has its own) ── */}
        {currentPage !== "browse" && (
          <div className="mt-3">
            <GlobalSearch
              allRows={allRows}
              currentPage={currentPage}
              currentId={currentId}
              onNavigate={() => {}}
            />
          </div>
        )}
      </div>
    </header>
  );
}