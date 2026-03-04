import { useEffect, useMemo, useRef, useState } from "react";
import { getIssuerId } from "../lib/graph";
import { fmtPercent } from "../lib/utils";
import { useAppStore } from "../store/app-store";
import type { OwnershipRow } from "../types/ownership";

type IssuerDNA = {
  issuerId: string;
  shareCode: string;
  issuerName: string;
  totalPct: number;
  foreignPct: number;
  localPct: number;
  count: number;
};

type DNAStripProps = {
  rows: OwnershipRow[];
  selectedIssuerId: string | null;
  onSelectIssuer: (issuerId: string) => void;
};

const ROW_HEIGHT = 28;

export function DNAStrip({ rows, selectedIssuerId, onSelectIssuer }: DNAStripProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hovered, setHovered] = useState<IssuerDNA | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const queryText = useAppStore((s) => s.filters.queryText);

  const issuers = useMemo<IssuerDNA[]>(() => {
    const map = new Map<string, IssuerDNA>();
    for (const row of rows) {
      const issuerId = getIssuerId(row);
      if (!map.has(issuerId)) {
        map.set(issuerId, {
          issuerId,
          shareCode: row.shareCode,
          issuerName: row.issuerName,
          totalPct: 0,
          foreignPct: 0,
          localPct: 0,
          count: 0,
        });
      }
      const item = map.get(issuerId);
      if (!item) continue;
      const pct = row.percentage ?? 0;
      item.totalPct += pct;
      if (row.localForeign === "A") item.foreignPct += pct;
      if (row.localForeign === "L") item.localPct += pct;
      item.count += 1;
    }
    return [...map.values()].sort((a, b) => b.totalPct - a.totalPct);
  }, [rows]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const startIndex = Math.floor(scrollTop / ROW_HEIGHT);
    const visibleCount = Math.ceil(height / ROW_HEIGHT) + 3;
    const view = issuers.slice(startIndex, startIndex + visibleCount);

    view.forEach((issuer, localIndex) => {
      const index = startIndex + localIndex;
      const y = localIndex * ROW_HEIGHT - (scrollTop % ROW_HEIGHT);
      const totalWidth = Math.min(width - 8, Math.max(2, (issuer.totalPct / 100) * (width - 8)));
      const localWidth = issuer.totalPct > 0 ? (issuer.localPct / issuer.totalPct) * totalWidth : 0;
      const foreignWidth = totalWidth - localWidth;
      const selected = selectedIssuerId === issuer.issuerId;

      ctx.fillStyle = selected ? "rgba(0,245,255,0.15)" : index % 2 === 0 ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.01)";
      ctx.fillRect(0, y, width, ROW_HEIGHT - 1);

      ctx.fillStyle = "rgba(85,186,171,0.86)";
      ctx.fillRect(4, y + 4, localWidth, ROW_HEIGHT - 8);
      ctx.fillStyle = "rgba(131,144,222,0.84)";
      ctx.fillRect(4 + localWidth, y + 4, foreignWidth, ROW_HEIGHT - 8);

      ctx.fillStyle = "rgb(239,244,251)";
      ctx.font = "600 13px Inter";
      ctx.fillText(issuer.shareCode, 10, y + 14);
    });
  }, [issuers, scrollTop, selectedIssuerId]);

  const renderHighlighted = (text: string) => {
    const query = queryText.trim();
    if (!query) return text;
    const source = text.toLowerCase();
    const needle = query.toLowerCase();
    const index = source.indexOf(needle);
    if (index < 0) return text;

    const before = text.slice(0, index);
    const match = text.slice(index, index + query.length);
    const after = text.slice(index + query.length);

    return (
      <>
        {before}
        <span className="rounded bg-focus/25 px-0.5 text-foreground">{match}</span>
        {after}
      </>
    );
  };

  return (
    <div className="grid h-[340px] grid-cols-[1fr_210px] gap-3">
      <div
        className="relative overflow-auto rounded-xl border border-border bg-background/20"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div style={{ height: issuers.length * ROW_HEIGHT }} />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const y = event.clientY - rect.top + scrollTop;
            const idx = Math.floor(y / ROW_HEIGHT);
            setHovered(issuers[idx] ?? null);
          }}
          onMouseLeave={() => setHovered(null)}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const y = event.clientY - rect.top + scrollTop;
            const idx = Math.floor(y / ROW_HEIGHT);
            const item = issuers[idx];
            if (item) onSelectIssuer(item.issuerId);
          }}
        />
        {hovered ? (
          <div className="pointer-events-none absolute right-2 top-2 rounded-md border border-border bg-panel/95 px-2.5 py-1.5 text-xs text-muted">
            <div className="text-foreground">{hovered.shareCode}</div>
            <div>Total: {fmtPercent(hovered.totalPct)}</div>
            <div>L: {fmtPercent(hovered.localPct)} | A: {fmtPercent(hovered.foreignPct)}</div>
          </div>
        ) : null}
      </div>
      <div className="overflow-auto rounded-xl border border-border bg-background/25 p-2.5">
        <div className="space-y-1">
          {issuers.map((issuer) => (
            <button
              key={issuer.issuerId}
              type="button"
              onClick={() => onSelectIssuer(issuer.issuerId)}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors duration-150 ${
                selectedIssuerId === issuer.issuerId
                  ? "bg-focus/18 text-foreground"
                  : "hover:bg-panel-2/55 text-foreground"
              }`}
              title={`${issuer.issuerName} • ${fmtPercent(issuer.totalPct)}`}
            >
              <span>{renderHighlighted(issuer.shareCode)}</span>
              <span className="font-mono text-xs">{fmtPercent(issuer.totalPct)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
