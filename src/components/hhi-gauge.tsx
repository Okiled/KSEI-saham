import { useMemo } from "react";
import { Gauge } from "lucide-react";

type HHIGaugeProps = {
  hhi: number;
};

const RANGES = [
  { min: 0, max: 1000, label: "Diversified", color: "#0a8c6e", bg: "bg-teal/10", text: "text-teal" },
  { min: 1000, max: 2500, label: "Moderate", color: "#c47c1a", bg: "bg-gold/10", text: "text-gold" },
  { min: 2500, max: 10000, label: "Concentrated", color: "#b83a4b", bg: "bg-rose/10", text: "text-rose" },
] as const;

function getRange(hhi: number) {
  if (hhi < 1000) return RANGES[0];
  if (hhi < 2500) return RANGES[1];
  return RANGES[2];
}

export function HHIGauge({ hhi }: HHIGaugeProps) {
  const range = useMemo(() => getRange(hhi), [hhi]);
  const normalizedPosition = Math.max(0, Math.min(1, hhi / 10000)); // 0 to 1

  return (
    <div className="rounded-2xl border border-border bg-panel/35 p-4">
      {/* ── Visual Gauge ── */}
      <div className="mb-3">
        <div className="mb-1 flex items-center gap-2">
          <Gauge className="h-4 w-4 text-muted" />
          <span className="text-[11px] uppercase tracking-[0.12em] text-muted">HHI Konsentrasi Portofolio</span>
        </div>
        <div className="relative h-5 rounded-full bg-panel-2/55">
          {/* Gradient bar */}
          <div className="absolute inset-0 flex overflow-hidden rounded-full">
            <div className="h-full bg-teal/70" style={{ width: "10%" }} />
            <div className="h-full bg-gold/60" style={{ width: "15%" }} />
            <div className="h-full bg-rose/50" style={{ width: "75%" }} />
          </div>
          {/* Pointer */}
          <div
            className="absolute top-0 h-full w-0.5 rounded-full bg-foreground shadow-md"
            style={{ left: `${normalizedPosition * 100}%` }}
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-panel px-1.5 py-0.5 text-[10px] font-mono font-semibold text-foreground shadow-sm">
              {hhi.toFixed(0)}
            </div>
          </div>

          {/* Scale labels */}
          <div className="absolute -bottom-4 left-[0%] text-[9px] text-muted">0</div>
          <div className="absolute -bottom-4 left-[10%] text-[9px] text-muted">1000</div>
          <div className="absolute -bottom-4 left-[25%] text-[9px] text-muted">2500</div>
          <div className="absolute -bottom-4 right-0 text-[9px] text-muted">10000</div>
        </div>
      </div>

      {/* ── Range Labels ── */}
      <div className="mb-3 mt-6 flex gap-2">
        {RANGES.map((r) => (
          <span
            key={r.label}
            className={`rounded-full border border-border px-2.5 py-0.5 text-[10px] font-medium ${r.label === range.label ? `${r.bg} ${r.text} border-current` : "text-muted"}`}
          >
            {r.label}
          </span>
        ))}
      </div>

      {/* ── Current Value ── */}
      <div className="flex items-center gap-3">
        <div className={`stat-hero ${range.text}`}>{hhi.toFixed(0)}</div>
        <div className={`text-sm font-semibold ${range.text}`}>{range.label}</div>
      </div>
      <p className="mt-1 text-xs text-muted">
        HHI mengukur konsentrasi portofolio — semakin tinggi, semakin fokus investor pada sedikit saham.
        Skala 0-10.000.
      </p>
    </div>
  );
}
