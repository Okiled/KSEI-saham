import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { fmtPercent, truncate } from "../lib/utils";
import type { OwnershipTimelineView } from "../types/ownership";

type OwnershipTimelinePanelProps = {
  timeline: OwnershipTimelineView | null;
};

const LINE_COLORS = [
  "#0a8c6e",
  "#c47c1a",
  "#b83a4b",
  "#6b4fa0",
  "#2563a8",
  "#3f6b5f",
  "#ab5f70",
  "#748697",
];



export function OwnershipTimelinePanel({ timeline }: OwnershipTimelinePanelProps) {
  const width = 1160;
  const height = 320;
  const pad = { top: 20, right: 220, bottom: 34, left: 42 };

  const prepared = useMemo(() => {
    if (!timeline) return null;
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const dates = timeline.snapshotDates;
    const maxPct = Math.max(
      1,
      ...timeline.series.flatMap((series) => series.points.map((point) => point.percentage)),
    );

    const xForIndex = (index: number) =>
      dates.length <= 1 ? pad.left + plotWidth * 0.5 : pad.left + (index / (dates.length - 1)) * plotWidth;
    const yForPct = (pct: number) => pad.top + plotHeight - (pct / maxPct) * plotHeight;

    const lines = timeline.series.map((series) => {
      const path = series.points
        .map((point, index) => `${index === 0 ? "M" : "L"} ${xForIndex(index)} ${yForPct(point.percentage)}`)
        .join(" ");
      return { series, path };
    });

    return {
      dates,
      maxPct,
      lines,
      xForIndex,
      yForPct,
      plotHeight,
      plotWidth,
      isSingleSnapshot: dates.length === 1,
    };
  }, [timeline]);

  if (!timeline) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-panel/35 p-6 text-center">
        <BarChart3 className="h-10 w-10 text-muted/30" />
        <div className="text-sm font-medium text-muted">Timeline belum tersedia</div>
        <p className="max-w-sm text-xs text-muted">
          Timeline membutuhkan data emiten untuk ditampilkan. Pastikan emiten sudah terpilih.
        </p>
      </div>
    );
  }

  if (!timeline.hasEnoughHistory) {
    return (
      <div className="rounded-2xl border border-border bg-panel/35 p-4">
        <div className="mb-3 hidden text-sm font-medium text-foreground">
          Data per {timeline.snapshotDates[0] ?? "—"}
        </div>
        {/* Single snapshot: show dots instead of lines */}
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {timeline.series
            .filter((s) => s.points.some((p) => p.percentage > 0))
            .slice(0, 8)
            .map((series, index) => {
              const lastPoint = series.points[series.points.length - 1];
              return (
                <div key={series.investorId} className="flex items-center gap-2 rounded-lg border border-border bg-panel-2/30 px-3 py-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: LINE_COLORS[index % LINE_COLORS.length] }} />
                  <span className="flex-1 truncate text-sm text-foreground">{truncate(series.investorName, 30)}</span>
                  <span className="font-mono text-sm font-semibold text-foreground">{fmtPercent(lastPoint?.percentage ?? 0)}</span>
                </div>
              );
            })}
        </div>
        <p className="mt-3 text-xs text-muted">
          Tambahkan snapshot periode lain untuk melihat akumulasi/distribusi investor antar waktu.
        </p>
      </div>
    );
  }

  if (!prepared) return null;

  return (
    <div className="rounded-2xl border border-border bg-panel/35 p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[320px] w-full">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const value = prepared.maxPct * tick;
          const y = prepared.yForPct(value);
          return (
            <g key={`tick:${tick}`}>
              <line x1={pad.left} y1={y} x2={pad.left + prepared.plotWidth} y2={y} stroke="rgba(0,0,0,0.06)" />
              <text x={pad.left - 10} y={y + 4} textAnchor="end" className="fill-muted font-mono text-[10px]">
                {fmtPercent(value)}
              </text>
            </g>
          );
        })}

        {/* Lines */}
        {prepared.lines.map((line, index) => (
          <g key={`line:${line.series.investorId}`}>
            <path
              d={line.path}
              fill="none"
              stroke={LINE_COLORS[index % LINE_COLORS.length]}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Dots on each data point */}
            {line.series.points.map((point, pointIndex) => (
              <circle
                key={`dot:${line.series.investorId}:${pointIndex}`}
                cx={prepared.xForIndex(pointIndex)}
                cy={prepared.yForPct(point.percentage)}
                r={3}
                fill={LINE_COLORS[index % LINE_COLORS.length]}
                stroke="white"
                strokeWidth={1.5}
              />
            ))}
          </g>
        ))}

        {/* Date labels */}
        {prepared.dates.map((date, index) => (
          <text
            key={`date:${date}`}
            x={prepared.xForIndex(index)}
            y={height - 8}
            textAnchor="middle"
            className="fill-muted text-[10px]"
          >
            {date}
          </text>
        ))}

        {/* Legend */}
        {prepared.lines.map((line, index) => {
          const lastPoint = line.series.points[line.series.points.length - 1];
          if (!lastPoint) return null;
          const x = pad.left + prepared.plotWidth + 8;
          const y = prepared.yForPct(lastPoint.percentage) + 4;
          return (
            <text key={`legend:${line.series.investorId}`} x={x} y={y} className="fill-foreground text-[11px]">
              <tspan fill={LINE_COLORS[index % LINE_COLORS.length]}>● </tspan>
              {truncate(line.series.investorName, 28)} ({fmtPercent(lastPoint.percentage)})
            </text>
          );
        })}
      </svg>
    </div>
  );
}
