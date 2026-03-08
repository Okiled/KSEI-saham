import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Radar } from "lucide-react";
import { runTriggerEngine, type TriggerAlert, type TriggerAlertType } from "../lib/trigger-engine";
import { useAppStore } from "../store/app-store";
import type { OwnershipRow } from "../types/ownership";
import type { UniverseIssuerItem } from "../lib/ownership-analytics";
import type { MarketDataMap } from "../lib/market-data";
import { formatIDR } from "../lib/format";
import { formatLiquidityDays, getFloatStatus } from "../lib/float-pressure";

type TriggerRadarPanelProps = {
  allRows: OwnershipRow[];
  snapshotDate: string | null;
  universeItems: UniverseIssuerItem[];
  marketData: MarketDataMap;
  updatedAt?: string | null;
  maxItemsPerSection?: number;
  actionHref?: string;
  actionLabel?: string;
  visibleTypes?: TriggerAlertType[];
};

function badgeClass(label: string): string {
  if (label === "IMMINENT_MTO") {
    return "border border-[#E7BFB5] bg-[#F8E9E4] text-[#7B312C] animate-pulse";
  }
  if (label === "MANDATORY_SELLDOWN" || label === "NON_COMPLIANT") {
    return "border border-[#E7BFB5] bg-[#F8E9E4] text-[#7B312C]";
  }
  if (label === "AT_RISK") {
    return "border border-[#E7D2B3] bg-[#F8EEDC] text-[#996737]";
  }
  if (label === "THRESHOLD_EVASION") {
    return "border border-[#D6C6CF] bg-[#F3ECF1] text-[#685261]";
  }
  if (label === "SHADOW_ACCUMULATION") {
    return "border border-[#E7D2B3] bg-[#F8EEDC] text-[#996737]";
  }
  if (label === "COORDINATED_BLOC") {
    return "border border-[#D6C6CF] bg-[#F3ECF1] text-[#685261]";
  }
  return "border border-[#D8CDBF] bg-[#F7F0E6] text-[#665A4F]";
}

function sectionTitle(label: string) {
  return (
      <div className="mb-3 flex items-center gap-2">
      <div className="h-4 w-0.5 bg-[#996737]" />
      <span className="text-xs uppercase tracking-[0.22em] text-[#7A6E63]">{label}</span>
    </div>
  );
}

function formatPercent(value: number | undefined): string {
  if (!Number.isFinite(value)) return "-";
  return `${(value ?? 0).toFixed(2)}%`;
}

function formatPositionValue(value: number | undefined): string {
  if (!Number.isFinite(value)) return "-";
  return formatIDR(value ?? 0);
}

function formatDomicileCategoryLabel(value: string | undefined): string {
  if (!value) return "-";
  return value.replace(/_/g, " ");
}

function SummaryStat({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="border-l border-[#D8CDBF] pl-3 first:border-l-0 first:pl-0">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#7A6E63]">{label}</div>
      <div className={`mt-1.5 font-serif text-[1.2rem] font-semibold tracking-[-0.04em] ${emphasis ? "text-[#996737]" : "text-[#1C1713]"}`}>{value}</div>
    </div>
  );
}

function CardShell({
  title,
  shareCode,
  issuerName,
  badge,
  badgeClassName,
  toneClassName,
  children,
}: {
  title: string;
  shareCode: string;
  issuerName: string;
  badge: string;
  badgeClassName: string;
  toneClassName: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-[18px] border bg-[#FFFBF5] p-3 shadow-[0_10px_24px_rgba(95,73,47,0.05)] ${toneClassName}`}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[#1C1713]">
            <Link to={`/emiten/${encodeURIComponent(shareCode)}`} className="font-bold text-[#1D4C45] hover:underline">
              {shareCode}
            </Link>{" "}
            <span className="text-[#665A4F]">{issuerName}</span>
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[#7A6E63]">{title}</div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClassName}`}>{badge}</span>
      </div>
      {children}
    </div>
  );
}

function MandatorySellDownCard({ alert }: { alert: TriggerAlert }) {
  const investor = alert.details.investors?.[0];
  return (
    <CardShell
      title="Who must sell next"
      shareCode={alert.shareCode}
      issuerName={alert.issuerName}
      badge="MANDATORY SELL-DOWN"
      badgeClassName={badgeClass("MANDATORY_SELLDOWN")}
      toneClassName="border-[#E7BFB5]"
    >
      <div className="space-y-3 text-sm">
        <div className="rounded-[18px] bg-[#F6EEE2] px-3 py-2">
          <div className="text-[11px] uppercase tracking-[0.12em] text-[#7A6E63]">Controller</div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <Link to={`/investor/${encodeURIComponent(investor?.id ?? "")}`} className="truncate font-medium text-[#1C1713] hover:text-[#1D4C45]">
              {investor?.name ?? alert.details.topHolderName ?? "-"}
            </Link>
            <span className="font-mono font-bold text-[#7B312C]">{formatPercent(alert.details.topHolderPct)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <div>
            <div className="text-[#665A4F]">Excess di atas 80%</div>
            <div className="mt-1 font-mono font-bold text-[#1C1713]">{formatPercent(alert.details.distance)}</div>
          </div>
          <div>
            <div className="text-[#665A4F]">IDR yang harus dilepas</div>
            <div className="mt-1 font-mono font-bold text-[#996737]">{formatPositionValue(alert.details.idrToSell)}</div>
          </div>
          <div>
            <div className="text-[#665A4F]">Shares to sell</div>
            <div className="mt-1 font-mono text-[#1C1713]">
              {Number.isFinite(alert.details.sharesToSell)
                ? Math.round(alert.details.sharesToSell ?? 0).toLocaleString("id-ID")
                : "-"}
            </div>
          </div>
          <div>
            <div className="text-[#665A4F]">Hari untuk absorb</div>
            <div className="mt-1 font-mono text-[#1C1713]">{formatLiquidityDays(alert.details.daysToAbsorb)}</div>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

function ImminentMtoCard({ alert }: { alert: TriggerAlert }) {
  const investor = alert.details.investors?.[0];
  return (
    <CardShell
      title="Threshold pressure"
      shareCode={alert.shareCode}
      issuerName={alert.issuerName}
      badge="IMMINENT_MTO"
      badgeClassName={badgeClass("IMMINENT_MTO")}
      toneClassName="border-[#E7BFB5]"
    >
      <div className="space-y-3 text-sm">
        <div className="rounded-[18px] bg-[#F6EEE2] px-3 py-2">
          <div className="text-[11px] uppercase tracking-[0.12em] text-[#7A6E63]">Holder mendekati 50%</div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <Link to={`/investor/${encodeURIComponent(investor?.id ?? "")}`} className="truncate font-medium text-[#1C1713] hover:text-[#1D4C45]">
              {investor?.name ?? "-"}
            </Link>
            <span className="font-mono font-bold text-[#7B312C]">{formatPercent(investor?.percentage)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <div>
            <div className="text-[#665A4F]">Jarak ke 50%</div>
            <div className="mt-1 font-mono font-bold text-[#1C1713]">{formatPercent(alert.details.distance)}</div>
          </div>
          <div>
            <div className="text-[#665A4F]">Threshold</div>
            <div className="mt-1 font-mono text-[#1C1713]">{formatPercent(alert.details.threshold)}</div>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

function FloatPressureCard({ alert }: { alert: TriggerAlert }) {
  const status = getFloatStatus(alert.details.freeFloat ?? 0);
  return (
    <CardShell
      title="Who controls the float"
      shareCode={alert.shareCode}
      issuerName={alert.issuerName}
      badge={status}
      badgeClassName={badgeClass(status)}
      toneClassName={status === "NON_COMPLIANT" ? "border-[#E7BFB5]" : "border-[#E7D2B3]"}
    >
      <div className="space-y-3 text-sm">
        <div className="rounded-[18px] bg-[#F6EEE2] px-3 py-2">
          <div className="text-[11px] uppercase tracking-[0.12em] text-[#7A6E63]">Top holder</div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <span className="truncate font-medium text-[#1C1713]">{alert.details.topHolderName ?? "-"}</span>
            <span className="font-mono font-bold text-[#1C1713]">{formatPercent(alert.details.topHolderPct)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <div>
            <div className="text-[#665A4F]">Free float sekarang</div>
            <div className="mt-1 font-mono font-bold text-[#1C1713]">{formatPercent(alert.details.freeFloat)}</div>
          </div>
          <div>
            <div className="text-[#665A4F]">IDR overhang ke 15%</div>
            <div className="mt-1 font-mono font-bold text-[#996737]">{formatPositionValue(alert.details.idrRequired)}</div>
          </div>
          <div>
            <div className="text-[#665A4F]">Shares required</div>
            <div className="mt-1 font-mono text-[#1C1713]">
              {Number.isFinite(alert.details.sharesRequired)
                ? Math.round(alert.details.sharesRequired ?? 0).toLocaleString("id-ID")
                : "-"}
            </div>
          </div>
          <div>
            <div className="text-[#665A4F]">Hari untuk comply</div>
            <div className="mt-1 font-mono text-[#1C1713]">{formatLiquidityDays(alert.details.daysToComply)}</div>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

function ThresholdEvasionCard({ alert }: { alert: TriggerAlert }) {
  return (
    <CardShell
      title="Where shadow moves are"
      shareCode={alert.shareCode}
      issuerName={alert.issuerName}
      badge="THRESHOLD EVASION"
      badgeClassName={badgeClass("THRESHOLD_EVASION")}
      toneClassName="border-[#D6C6CF]"
    >
      <div className="space-y-3 text-sm">
        <p className="text-[#665A4F]">{alert.message}</p>
        <div className="space-y-2">
          {alert.details.investors?.slice(0, 4).map((investor) => (
            <div key={investor.id} className="flex items-center justify-between rounded-[18px] bg-[#F6EEE2] px-3 py-2">
              <Link to={`/investor/${encodeURIComponent(investor.id)}`} className="truncate font-medium text-[#1C1713] hover:text-[#1D4C45]">
                {investor.name}
              </Link>
              <div className="flex items-center gap-2">
                {investor.tags?.includes("KONGLO") && (
                  <span className="rounded-full border border-[#E7D2B3] bg-[#F8EEDC] px-2 py-0.5 text-[10px] font-semibold text-[#996737]">
                    KONGLO
                  </span>
                )}
                <span className="font-mono font-bold text-[#685261]">{formatPercent(investor.percentage)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CardShell>
  );
}

function ShadowAccumulationCard({ alert }: { alert: TriggerAlert }) {
  return (
    <CardShell
      title="Detected from disclosure clustering"
      shareCode={alert.shareCode}
      issuerName={alert.issuerName}
      badge="SHADOW ACCUMULATION"
      badgeClassName={badgeClass("SHADOW_ACCUMULATION")}
      toneClassName="border-[#E7D2B3]"
    >
      <div className="space-y-3 text-sm">
        <p className="text-[#665A4F]">{alert.message}</p>
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <div>
            <div className="text-[#665A4F]">Combined disclosed stake</div>
            <div className="mt-1 font-mono font-bold text-[#996737]">{formatPercent(alert.details.combinedPct)}</div>
          </div>
          <div>
            <div className="text-[#665A4F]">Entity count</div>
            <div className="mt-1 font-mono font-bold text-[#1C1713]">
              {(alert.details.entityCount ?? 0).toLocaleString("id-ID")}
            </div>
          </div>
        </div>
        <div className="space-y-2">
          {alert.details.investors?.slice(0, 4).map((investor) => (
            <div key={investor.id} className="flex items-center justify-between rounded-[18px] bg-[#F6EEE2] px-3 py-2">
              <Link to={`/investor/${encodeURIComponent(investor.id)}`} className="truncate font-medium text-[#1C1713] hover:text-[#1D4C45]">
                {investor.name}
              </Link>
              <span className="font-mono font-bold text-[#996737]">{formatPercent(investor.percentage)}</span>
            </div>
          ))}
        </div>
      </div>
    </CardShell>
  );
}

function CoordinatedBlocCard({ alert }: { alert: TriggerAlert }) {
  return (
    <CardShell
      title="Possible pattern from raw domicile clustering"
      shareCode={alert.shareCode}
      issuerName={alert.issuerName}
      badge="POSSIBLE COORDINATED PATTERN"
      badgeClassName={badgeClass("COORDINATED_BLOC")}
      toneClassName="border-[#D6C6CF]"
    >
      <div className="space-y-3 text-sm">
        <p className="text-[#665A4F]">{alert.message}</p>
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <div>
            <div className="text-[#665A4F]">Domicile category</div>
            <div className="mt-1 font-mono font-bold text-[#685261]">
              {formatDomicileCategoryLabel(alert.details.domicileCategory)}
            </div>
          </div>
          <div>
            <div className="text-[#665A4F]">Combined disclosed stake</div>
            <div className="mt-1 font-mono font-bold text-[#685261]">{formatPercent(alert.details.combinedPct)}</div>
          </div>
          <div>
            <div className="text-[#665A4F]">Entity count</div>
            <div className="mt-1 font-mono text-[#1C1713]">
              {(alert.details.entityCount ?? 0).toLocaleString("id-ID")}
            </div>
          </div>
          <div>
            <div className="text-[#665A4F]">Pattern basis</div>
            <div className="mt-1 text-[#1C1713]">Raw domicile field only</div>
          </div>
        </div>
        <div className="space-y-2">
          {alert.details.investors?.slice(0, 4).map((investor) => (
            <div key={investor.id} className="rounded-[18px] bg-[#F6EEE2] px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <Link to={`/investor/${encodeURIComponent(investor.id)}`} className="truncate font-medium text-[#1C1713] hover:text-[#1D4C45]">
                  {investor.name}
                </Link>
                <span className="font-mono font-bold text-[#685261]">{formatPercent(investor.percentage)}</span>
              </div>
              <div className="mt-1 text-[12px] text-[#665A4F]">{investor.domicile ?? "-"}</div>
            </div>
          ))}
        </div>
      </div>
    </CardShell>
  );
}

function DelistingRiskCard({ alert }: { alert: TriggerAlert }) {
  const freeFloat = alert.details.freeFloat ?? 0;
  const width = Math.max(4, Math.min(100, (freeFloat / 15) * 100));

  return (
    <CardShell
      title="Tail risk"
      shareCode={alert.shareCode}
      issuerName={alert.issuerName}
      badge="DELISTING RISK"
      badgeClassName="border border-[#D8CDBF] bg-[#F7F0E6] text-[#665A4F]"
      toneClassName="border-[#D8CDBF]"
    >
      <div className="space-y-3 text-sm">
        <p className="text-[#665A4F]">{alert.message}</p>
        <div className="rounded-[18px] bg-[#F6EEE2] px-3 py-2">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-[#665A4F]">Free float</span>
            <span className="font-mono font-bold text-[#996737]">{formatPercent(freeFloat)}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#D8CDBF]">
            <div className="h-full bg-[#996737]" style={{ width: `${width}%` }} />
          </div>
        </div>
      </div>
    </CardShell>
  );
}

function Section({
  label,
  count,
  description,
  notice,
  children,
}: {
  label: string;
  count: number;
  description?: string;
  notice?: string;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="border-t border-[#E6DCCE] px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>{sectionTitle(label)}</div>
        <span className="rounded-full border border-[#D8CDBF] bg-[#F7F0E6] px-2 py-0.5 text-[10px] font-semibold text-[#665A4F]">
          {count} cases
        </span>
      </div>
      {description ? <p className="mb-2 text-sm text-[#665A4F]">{description}</p> : null}
      {notice ? (
        <div className="mb-2 rounded-[16px] border border-[#D6C6CF] bg-[#F3ECF1] px-3 py-2 text-xs text-[#685261]">
          {notice}
        </div>
      ) : null}
      <div className="grid gap-2.5 lg:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

export function TriggerRadarPanel({
  allRows,
  snapshotDate,
  universeItems,
  marketData,
  updatedAt: _updatedAt = null,
  maxItemsPerSection = 4,
  actionHref,
  actionLabel,
  visibleTypes,
}: TriggerRadarPanelProps) {
  const investorTagsById = useAppStore((state) => state.investorTagsById);

  const alerts = useMemo(
    () => runTriggerEngine(allRows, snapshotDate, universeItems, marketData, investorTagsById),
    [allRows, snapshotDate, universeItems, marketData, investorTagsById],
  );
  const visibleTypeSet = useMemo(() => (visibleTypes ? new Set(visibleTypes) : null), [visibleTypes]);
  const visibleAlerts = useMemo(
    () => (visibleTypeSet ? alerts.filter((alert) => visibleTypeSet.has(alert.type)) : alerts),
    [alerts, visibleTypeSet],
  );

  const allMandatorySellDownAlerts = visibleAlerts.filter((alert) => alert.type === "mandatory-sell-down");
  const allMtoAlerts = visibleAlerts.filter((alert) => alert.type === "mto-squeeze");
  const allFloatPressureAlerts = visibleAlerts.filter((alert) => alert.type === "float-pressure");
  const allShadowAlerts = visibleAlerts.filter((alert) => alert.type === "shadow-accumulation");
  const allCoordinatedBlocAlerts = visibleAlerts.filter((alert) => alert.type === "coordinated-bloc");
  const allEvasionAlerts = visibleAlerts.filter((alert) => alert.type === "evasion-cluster");
  const allDelistingAlerts = visibleAlerts.filter((alert) => alert.type === "delisting-risk");

  const mandatorySellDownAlerts = allMandatorySellDownAlerts.slice(0, maxItemsPerSection);
  const mtoAlerts = allMtoAlerts.slice(0, maxItemsPerSection);
  const floatPressureAlerts = allFloatPressureAlerts.slice(0, maxItemsPerSection);
  const shadowAlerts = allShadowAlerts.slice(0, maxItemsPerSection);
  const coordinatedBlocAlerts = allCoordinatedBlocAlerts.slice(0, maxItemsPerSection);
  const evasionAlerts = allEvasionAlerts.slice(0, maxItemsPerSection);
  const delistingAlerts = allDelistingAlerts.slice(0, maxItemsPerSection);

  const nonCompliantCount = allFloatPressureAlerts.filter(
    (alert) => getFloatStatus(alert.details.freeFloat ?? 0) === "NON_COMPLIANT",
  ).length;

  const totalSupplyOverhang = visibleAlerts.reduce((total, alert) => {
    const idrRequired = Number.isFinite(alert.details.idrRequired) ? (alert.details.idrRequired ?? 0) : 0;
    const idrToSell = Number.isFinite(alert.details.idrToSell) ? (alert.details.idrToSell ?? 0) : 0;
    return total + idrRequired + idrToSell;
  }, 0);

  const hasAnySection =
    allMandatorySellDownAlerts.length > 0 ||
    allMtoAlerts.length > 0 ||
    allFloatPressureAlerts.length > 0 ||
    allShadowAlerts.length > 0 ||
    allCoordinatedBlocAlerts.length > 0 ||
    allEvasionAlerts.length > 0 ||
    allDelistingAlerts.length > 0;

  if (!hasAnySection) return null;

  return (
    <div className="overflow-hidden rounded-[22px] border border-[#D8CDBF] bg-[#FFFBF5] shadow-[0_16px_36px_rgba(95,73,47,0.08)]">
      <div className="border-b border-[#E6DCCE] bg-[linear-gradient(135deg,#FFF9F1_0%,#F6EEE2_100%)] px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            {sectionTitle("Control Pressure Radar")}
            <div className="flex items-center gap-2 text-lg font-semibold text-[#1C1713]">
              <Radar className="h-5 w-5 text-[#1D4C45]" />
              <span>Who controls what, who must sell next, and where threshold pressure builds.</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {actionHref && actionLabel ? (
              <Link
                to={actionHref}
                className="rounded-full border border-[#1D4C45] bg-[#EDF4F1] px-3 py-1 text-[11px] font-semibold text-[#1D4C45] transition-colors hover:bg-[#DFECE8]"
              >
                {actionLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-3 border-b border-[#E6DCCE] bg-[#F6EEE2] px-4 py-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryStat label="Non-compliant issuers" value={nonCompliantCount.toLocaleString("id-ID")} />
        <SummaryStat label="Total supply overhang" value={formatIDR(totalSupplyOverhang)} emphasis />
        <SummaryStat label="Mandatory sell-down cases" value={allMandatorySellDownAlerts.length.toLocaleString("id-ID")} />
        <SummaryStat label="Near-MTO cases" value={allMtoAlerts.length.toLocaleString("id-ID")} />
      </div>

      <Section label="Mandatory Sell-Down" count={allMandatorySellDownAlerts.length}>
        {mandatorySellDownAlerts.map((alert) => (
          <MandatorySellDownCard key={alert.id} alert={alert} />
        ))}
      </Section>

      <Section label="Imminent MTO" count={allMtoAlerts.length}>
        {mtoAlerts.map((alert) => (
          <ImminentMtoCard key={alert.id} alert={alert} />
        ))}
      </Section>

      <Section label="Float Pressure" count={allFloatPressureAlerts.length}>
        {floatPressureAlerts.map((alert) => (
          <FloatPressureCard key={alert.id} alert={alert} />
        ))}
      </Section>

      <Section
        label="Shadow Accumulation"
        count={allShadowAlerts.length}
        description="Cluster 3% sampai di bawah 5% yang menumpuk pada issuer yang sama di snapshot aktif."
      >
        {shadowAlerts.map((alert) => (
          <ShadowAccumulationCard key={alert.id} alert={alert} />
        ))}
      </Section>

      <Section
        label="Domicile Bloc"
        count={allCoordinatedBlocAlerts.length}
        description="Possible pattern detected from disclosure clustering by raw domicile field."
        notice="Kesamaan domisili bukan bukti koordinasi. Lakukan due diligence independen."
      >
        {coordinatedBlocAlerts.map((alert) => (
          <CoordinatedBlocCard key={alert.id} alert={alert} />
        ))}
      </Section>

      <Section label="Threshold Evasion" count={allEvasionAlerts.length}>
        {evasionAlerts.map((alert) => (
          <ThresholdEvasionCard key={alert.id} alert={alert} />
        ))}
      </Section>

      <Section label="Delisting Risk" count={allDelistingAlerts.length}>
        {delistingAlerts.map((alert) => (
          <DelistingRiskCard key={alert.id} alert={alert} />
        ))}
      </Section>
    </div>
  );
}
