import { Link } from "react-router-dom";
import { ArrowUpRight, Compass, FlaskConical, Home, Radar } from "lucide-react";
import { Button } from "./ui/button";
import { GlobalSearch } from "./global-search";
import type { OwnershipRow } from "../types/ownership";

type HeaderPage =
  | "browse"
  | "control-pressure"
  | "explore"
  | "emiten"
  | "investor"
  | "debug"
  | "workstation";

type HeaderAction = {
  label: string;
  to: string;
  variant?: "primary" | "secondary" | "ghost";
};

type GlobalHeaderProps = {
  title: string;
  subtitle: string;
  allRows: OwnershipRow[];
  currentPage: HeaderPage;
  heroVariant?: "full" | "compact";
  currentId?: string;
  activeIssuer?: { shareCode: string } | null;
  activeInvestor?: { investorId: string; investorName: string } | null;
  eyebrow?: string;
  metadata?: string;
  actions?: HeaderAction[];
  onNavigate?: (path: string) => void;
};

const primaryNav = [
  { key: "browse" as const, label: "Home", to: "/", icon: Home },
  { key: "control-pressure" as const, label: "Control Pressure", to: "/control-pressure", icon: Radar },
  { key: "explore" as const, label: "Explore Lab", to: "/explore", icon: FlaskConical },
];

function navTone(currentPage: HeaderPage, key: (typeof primaryNav)[number]["key"]) {
  if (currentPage === key) {
    return "border-[#1D4C45] bg-[#1D4C45] text-[#FFF9F1] shadow-[0_12px_24px_rgba(29,76,69,0.18)]";
  }
  return "border-[#D8CDBF] bg-[#FFF8F0] text-[#665A4F] hover:border-[#C4B2A0] hover:bg-[#F0E7DB] hover:text-[#1C1713]";
}

function breadcrumbLabel(currentPage: HeaderPage) {
  if (currentPage === "control-pressure") return "Control Pressure";
  if (currentPage === "explore") return "Explore Lab";
  if (currentPage === "emiten") return "Issuer";
  if (currentPage === "investor") return "Investor";
  if (currentPage === "debug") return "Debug";
  if (currentPage === "workstation") return "Workstation";
  return "Home";
}

export function GlobalHeader({
  title,
  subtitle,
  allRows,
  currentPage,
  heroVariant = "full",
  currentId,
  activeIssuer = null,
  activeInvestor = null,
  eyebrow = "IDX Ownership Terminal",
  metadata,
  actions = [],
  onNavigate,
}: GlobalHeaderProps) {
  const showContextSearch = currentPage === "emiten" || currentPage === "investor";
  const showContextBadge = currentPage === "debug" || currentPage === "workstation";
  const navigate = onNavigate ?? (() => {});

  return (
    <header className="space-y-3">
      <div className="shell-topbar px-3 py-2.5 md:px-4">
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-[#C4B2A0] bg-[#FFFBF5] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#1C1713] transition-colors hover:bg-[#F7F0E6]"
            >
              <Compass className="h-3.5 w-3.5 text-[#996737]" />
              IDX Terminal
            </Link>
            {showContextBadge ? (
              <span className="inline-flex items-center rounded-full border border-[#D6C6CF] bg-[#F3ECF1] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#685261]">
                Secondary Tool
              </span>
            ) : null}
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            {primaryNav.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  to={item.to}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] font-semibold transition-all duration-200 ${navTone(currentPage, item.key)}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {heroVariant === "full" ? (
        <div className="page-section overflow-hidden">
          <div className="shell-contextbar px-4 py-4 md:px-5 md:py-5">
            <div className="min-w-0">
              <div className="hero-kicker">{eyebrow}</div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[#7A6E63]">
                <Link to="/" className="transition-colors hover:text-[#1D4C45]">
                  Home
                </Link>
                {currentPage !== "browse" ? (
                  <>
                    <span>/</span>
                    <span>{breadcrumbLabel(currentPage)}</span>
                  </>
                ) : null}
                {activeIssuer ? (
                  <>
                    <span>/</span>
                    <Link
                      to={`/emiten/${encodeURIComponent(activeIssuer.shareCode)}`}
                      className="text-[#1D4C45] transition-colors hover:underline"
                    >
                      {activeIssuer.shareCode}
                    </Link>
                  </>
                ) : null}
                {activeInvestor ? (
                  <>
                    <span>/</span>
                    <span className="text-[#1C1713]">{activeInvestor.investorName}</span>
                  </>
                ) : null}
              </div>

              <h1 className="hero-display mt-3 max-w-4xl text-[2.45rem] text-[#1C1713] md:text-[3.45rem]">
                {title}
              </h1>
              <p className="hero-subcopy mt-2 max-w-3xl">{subtitle}</p>
              {metadata ? <p className="hidden mt-2 text-sm text-[#665A4F]">{metadata}</p> : null}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {actions.map((action) => (
                  <Link key={`${action.to}:${action.label}`} to={action.to}>
                    <Button variant={action.variant ?? "secondary"} size="sm" className="gap-1.5">
                      {action.label}
                      {action.variant === "ghost" ? null : <ArrowUpRight className="h-3.5 w-3.5" />}
                    </Button>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {showContextSearch ? (
            <div className="border-t border-[#D8CDBF] bg-[#FFF8F0] px-4 py-3 md:px-5">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0 text-sm text-[#665A4F]">
                  Gunakan search kontekstual untuk pindah cepat tanpa kembali ke halaman sebelumnya.
                </div>
                {showContextSearch ? (
                  <div className="w-full xl:max-w-[440px]">
                    <GlobalSearch
                      allRows={allRows}
                      currentPage={currentPage}
                      currentId={currentId}
                      onNavigate={navigate}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
