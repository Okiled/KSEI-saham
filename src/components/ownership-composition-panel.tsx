import { fmtPercent, freeFloatContext } from "../lib/utils";
import type { CompositionBucket } from "../types/ownership";

type OwnershipCompositionPanelProps = {
  composition: CompositionBucket[];
  freeFloatEstimatePct: number;
};

function bucketColor(key: CompositionBucket["key"]): { bg: string; label: string } {
  if (key === "lokal") return { bg: "bg-teal", label: "Lokal" };
  if (key === "asing") return { bg: "bg-gold", label: "Asing" };
  if (key === "insider") return { bg: "bg-rose", label: "Insider" };
  if (key === "reksadana") return { bg: "bg-violet", label: "Reksa Dana" };
  if (key === "institusi") return { bg: "bg-blue", label: "Institusi" };
  if (key === "freeFloat") return { bg: "bg-[#b5b0aa]", label: "Free Float" };
  return { bg: "bg-[#8c8c8c]", label: "Lainnya" };
}



export function OwnershipCompositionPanel({
  composition,
  freeFloatEstimatePct,
}: OwnershipCompositionPanelProps) {
  const displayBuckets = composition.filter((bucket) => bucket.percentage > 0.01).slice(0, 7);
  const ffCtx = freeFloatContext(freeFloatEstimatePct);

  return (
    <div className="rounded-2xl border border-border bg-panel/35 p-4">
      {/* ── Segmented Free Float Bar ── */}
      <div className="mb-2 flex h-[14px] overflow-hidden rounded-full bg-panel-2/75">
        {displayBuckets.map((bucket) => {
          const info = bucketColor(bucket.key);
          return (
            <div
              key={bucket.key}
              className={`h-full ${info.bg}`}
              style={{ width: `${Math.max(0.5, Math.min(100, bucket.percentage))}%`, opacity: bucket.key === "freeFloat" ? 0.45 : 0.8 }}
              title={`${info.label}: ${fmtPercent(bucket.percentage)}`}
            />
          );
        })}
      </div>

      {/* ── Legend ── */}
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1">
        {displayBuckets.map((bucket) => {
          const info = bucketColor(bucket.key);
          return (
            <div key={bucket.key} className="flex items-center gap-1.5 text-[11px] text-muted">
              <span className={`inline-block h-2.5 w-2.5 rounded-sm ${info.bg}`} style={{ opacity: bucket.key === "freeFloat" ? 0.45 : 0.8 }} />
              <span>{info.label}</span>
              <span className="font-mono text-foreground">{fmtPercent(bucket.percentage)}</span>
            </div>
          );
        })}
      </div>

      {/* ── Key Metrics ── */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-panel-2/40 p-3">
          <div className="section-title">Free Float (Estimasi)</div>
          <div className={`stat-hero mt-2 ${ffCtx.color}`}>{fmtPercent(freeFloatEstimatePct)}</div>
          <div className={`mt-1 text-xs ${ffCtx.color}`}>{ffCtx.label}</div>
        </div>
        <div className="rounded-xl border border-border bg-panel-2/40 p-3">
          <div className="section-title">Buckets Aktif</div>
          <div className="stat-hero mt-2">{displayBuckets.length}</div>
        </div>
      </div>

      {/* ── Bucket Details ── */}
      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {displayBuckets.map((bucket) => {
          const info = bucketColor(bucket.key);
          return (
            <div key={bucket.key} className="flex items-center gap-3 rounded-lg border border-border bg-panel-2/30 px-3 py-2">
              <span className={`inline-block h-3 w-3 rounded-sm ${info.bg}`} style={{ opacity: bucket.key === "freeFloat" ? 0.45 : 0.8 }} />
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">{info.label}</div>
              </div>
              <div className="font-mono text-sm font-semibold text-foreground">{fmtPercent(bucket.percentage)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
