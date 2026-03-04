import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { sankey, sankeyLinkHorizontal, type SankeyGraph } from "d3-sankey";
import { getInvestorId, getIssuerId } from "../lib/graph";
import { fmtNumber, fmtPercent } from "../lib/utils";
import type { OwnershipRow } from "../types/ownership";

type FocusType = "issuer" | "investor";

type SankeyFlowProps = {
  rows: OwnershipRow[];
  selectedIssuerId: string | null;
  selectedInvestorId: string | null;
  focusType?: FocusType | null;
  onSelectInvestor: (investorId: string) => void;
  onSelectIssuer?: (issuerId: string) => void;
};

type NodeDatum = {
  id: string;
  label: string;
  kind: "issuer" | "investor";
  isBucket?: boolean;
};

type LinkDatum = {
  source: string;
  target: string;
  value: number;
};

type NodeMetric = {
  pct: number;
  shares: number;
};

const LAYOUT_WIDTH = 1280;
const LABEL_AREA_WIDTH = 360;
const CHART_RIGHT_EDGE = LAYOUT_WIDTH - LABEL_AREA_WIDTH;
const MAX_TARGET_NODES = 18;
const MIN_CHART_HEIGHT = 220;
const MAX_CHART_HEIGHT = 620;

function isValidPct(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0 && value <= 100;
}

function toShares(value: number | null | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Number(value)) : 0;
}

function calcChartHeight(linkCount: number): number {
  const preferred = 170 + linkCount * 16;
  return Math.max(MIN_CHART_HEIGHT, Math.min(MAX_CHART_HEIGHT, preferred));
}

function toLayoutWeight(pct: number, linkCount: number): number {
  const compressed = Math.pow(Math.max(0, pct), 0.72);
  const densityAdjust = linkCount > 12 ? 0.86 : 1;
  return Math.max(0.35, compressed * densityAdjust);
}

export function SankeyFlow({
  rows,
  selectedIssuerId,
  selectedInvestorId,
  focusType,
  onSelectInvestor,
  onSelectIssuer,
}: SankeyFlowProps) {
  const prepared = useMemo(() => {
    let invalidValueCount = 0;
    const nodes: NodeDatum[] = [];
    const links: LinkDatum[] = [];
    const rightNodeMetrics = new Map<string, NodeMetric>();
    const effectiveFocus: FocusType = focusType ?? (selectedInvestorId ? "investor" : "issuer");

    if (rows.length === 0) {
      return {
        graph: null,
        invalidValueCount,
        totalValue: 0,
        effectiveFocus,
        emptyReason: "Tidak ada row context.",
        layoutHeight: MIN_CHART_HEIGHT,
        rightNodeMetrics,
      };
    }

    if (effectiveFocus === "investor") {
      const centerInvestorId = selectedInvestorId ?? rows.map((row) => getInvestorId(row))[0] ?? null;
      if (!centerInvestorId) {
        return {
          graph: null,
          invalidValueCount,
          totalValue: 0,
          effectiveFocus,
          emptyReason: "Investor context tidak ditemukan.",
          layoutHeight: MIN_CHART_HEIGHT,
          rightNodeMetrics,
        };
      }

      const investorRows = rows.filter((row) => getInvestorId(row) === centerInvestorId);
      if (investorRows.length === 0) {
        return {
          graph: null,
          invalidValueCount,
          totalValue: 0,
          effectiveFocus,
          emptyReason: "Investor context tidak punya holdings untuk filter aktif.",
          layoutHeight: MIN_CHART_HEIGHT,
          rightNodeMetrics,
        };
      }

      nodes.push({
        id: centerInvestorId,
        label: investorRows[0].investorName,
        kind: "investor",
      });

      const issuerAgg = new Map<string, { label: string; pct: number; shares: number }>();
      for (const row of investorRows) {
        if (!isValidPct(row.percentage)) {
          invalidValueCount += 1;
          continue;
        }
        const issuerId = getIssuerId(row);
        if (!issuerAgg.has(issuerId)) issuerAgg.set(issuerId, { label: row.shareCode, pct: 0, shares: 0 });
        const current = issuerAgg.get(issuerId);
        if (!current) continue;
        current.pct += row.percentage;
        current.shares += toShares(row.totalHoldingShares);
      }

      const sorted = [...issuerAgg.entries()].sort((a, b) => b[1].pct - a[1].pct);
      const top = sorted.slice(0, MAX_TARGET_NODES);
      const othersPct = sorted.slice(MAX_TARGET_NODES).reduce((sum, [, item]) => sum + item.pct, 0);
      const othersShares = sorted.slice(MAX_TARGET_NODES).reduce((sum, [, item]) => sum + item.shares, 0);

      for (const [issuerId, item] of top) {
        nodes.push({ id: issuerId, label: item.label, kind: "issuer" });
        if (item.pct > 0) links.push({ source: centerInvestorId, target: issuerId, value: item.pct });
        rightNodeMetrics.set(issuerId, { pct: item.pct, shares: item.shares });
      }
      if (othersPct > 0) {
        nodes.push({ id: "__others__", label: "Others", kind: "issuer", isBucket: true });
        links.push({ source: centerInvestorId, target: "__others__", value: othersPct });
        rightNodeMetrics.set("__others__", { pct: othersPct, shares: othersShares });
      }
    } else {
      const centerIssuerId = selectedIssuerId ?? rows.map((row) => getIssuerId(row))[0] ?? null;
      if (!centerIssuerId) {
        return {
          graph: null,
          invalidValueCount,
          totalValue: 0,
          effectiveFocus,
          emptyReason: "Issuer context tidak ditemukan.",
          layoutHeight: MIN_CHART_HEIGHT,
          rightNodeMetrics,
        };
      }

      const issuerRows = rows.filter((row) => getIssuerId(row) === centerIssuerId);
      if (issuerRows.length === 0) {
        return {
          graph: null,
          invalidValueCount,
          totalValue: 0,
          effectiveFocus,
          emptyReason: "Issuer context tidak punya holders untuk filter aktif.",
          layoutHeight: MIN_CHART_HEIGHT,
          rightNodeMetrics,
        };
      }

      nodes.push({ id: centerIssuerId, label: issuerRows[0].shareCode, kind: "issuer" });

      const investorAgg = new Map<string, { label: string; pct: number; shares: number }>();
      for (const row of issuerRows) {
        if (!isValidPct(row.percentage)) {
          invalidValueCount += 1;
          continue;
        }
        const investorId = getInvestorId(row);
        if (!investorAgg.has(investorId)) {
          investorAgg.set(investorId, { label: row.investorName, pct: 0, shares: 0 });
        }
        const current = investorAgg.get(investorId);
        if (!current) continue;
        current.pct += row.percentage;
        current.shares += toShares(row.totalHoldingShares);
      }

      const sorted = [...investorAgg.entries()].sort((a, b) => b[1].pct - a[1].pct);
      const top = sorted.slice(0, MAX_TARGET_NODES);
      const othersPct = sorted.slice(MAX_TARGET_NODES).reduce((sum, [, item]) => sum + item.pct, 0);
      const othersShares = sorted.slice(MAX_TARGET_NODES).reduce((sum, [, item]) => sum + item.shares, 0);

      for (const [investorId, item] of top) {
        nodes.push({ id: investorId, label: item.label, kind: "investor" });
        if (item.pct > 0) links.push({ source: centerIssuerId, target: investorId, value: item.pct });
        rightNodeMetrics.set(investorId, { pct: item.pct, shares: item.shares });
      }
      if (othersPct > 0) {
        nodes.push({ id: "__others__", label: "Others", kind: "investor", isBucket: true });
        links.push({ source: centerIssuerId, target: "__others__", value: othersPct });
        rightNodeMetrics.set("__others__", { pct: othersPct, shares: othersShares });
      }
    }

    if (links.length === 0) {
      return {
        graph: null,
        invalidValueCount,
        totalValue: 0,
        effectiveFocus,
        emptyReason:
          invalidValueCount > 0
            ? "Semua edge ter-drop karena nilai persentase invalid."
            : "Tidak ada edge setelah filtering/top-bucket.",
        layoutHeight: MIN_CHART_HEIGHT,
        rightNodeMetrics,
      };
    }

    const rawLinkCount = links.length;
    const totalValue = links.reduce((sum, link) => sum + (link.value ?? 0), 0);
    const layoutHeight = calcChartHeight(rawLinkCount);
    const denseMode = links.length > 14;
    const layoutLinks: LinkDatum[] = links.map((link) => ({
      ...link,
      value: toLayoutWeight(link.value, rawLinkCount),
    }));
    const sankeyLayout = sankey<NodeDatum, LinkDatum>()
      .nodeId((d) => d.id)
      .nodeWidth(denseMode ? 12 : 14)
      .nodePadding(denseMode ? 6 : 12)
      .extent([
        [24, 14],
        [CHART_RIGHT_EDGE - 24, layoutHeight - 44],
      ]);

    const graph = sankeyLayout({
      nodes: nodes.map((node) => ({ ...node })),
      links: layoutLinks.map((link) => ({ ...link })),
    } as SankeyGraph<NodeDatum, LinkDatum>);

    return {
      graph,
      invalidValueCount,
      totalValue,
      effectiveFocus,
      emptyReason: null,
      layoutHeight,
      rightNodeMetrics,
    };
  }, [focusType, rows, selectedInvestorId, selectedIssuerId]);

  if (!prepared.graph) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-border bg-background/25 px-4 text-center text-sm text-muted"
        style={{ height: `${prepared.layoutHeight}px` }}
      >
        <div>
          <div>{prepared.emptyReason ?? "Tidak ada edge untuk context ini. Coba turunkan Min% atau pilih focus lain."}</div>
          {prepared.invalidValueCount > 0 ? (
            <div className="mt-2 text-xs text-warning">Invalid parse rows: {prepared.invalidValueCount}.</div>
          ) : null}
        </div>
      </div>
    );
  }

  const linkPath = sankeyLinkHorizontal<NodeDatum, LinkDatum>();

  return (
    <div className="space-y-2">
      {prepared.invalidValueCount > 0 ? (
        <div className="inline-flex items-center gap-2 rounded-md border border-warning/40 bg-warning/12 px-3 py-1.5 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5" />
          Invalid value from parse ({prepared.invalidValueCount} rows)
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-background/20">
        <svg
          viewBox={`0 0 ${LAYOUT_WIDTH} ${prepared.layoutHeight}`}
          className="w-full"
          style={{ height: `${prepared.layoutHeight}px` }}
          preserveAspectRatio="xMidYMid meet"
        >
          {prepared.graph.links.map((link, idx) => (
            <path
              key={`link-${idx}`}
              d={linkPath(link) ?? ""}
              fill="none"
              stroke={prepared.effectiveFocus === "investor" ? "rgba(131,144,222,0.64)" : "rgba(85,186,171,0.64)"}
              strokeWidth={Math.max(1.2, link.width ?? 1)}
              opacity={0.9}
            />
          ))}

          {prepared.graph.nodes.map((node, idx) => {
            const x0 = node.x0 ?? 0;
            const x1 = node.x1 ?? 0;
            const y0 = node.y0 ?? 0;
            const y1 = node.y1 ?? 0;
            const nameForCenter = node.label.length > 42 ? `${node.label.slice(0, 41)}...` : node.label;
            const nameForRight = node.label.length > 28 ? `${node.label.slice(0, 27)}...` : node.label;
            const isCenter = idx === 0;
            const labelY = (y0 + y1) / 2;
            const labelX = CHART_RIGHT_EDGE + 12;
            const metrics = prepared.rightNodeMetrics.get(node.id);
            const nodePct = metrics?.pct ?? 0;
            const nodeShares = metrics?.shares ?? 0;
            const rightLabel = `${nameForRight} | ${fmtPercent(nodePct)} | ${fmtNumber(nodeShares)} shares`;

            return (
              <g key={`node-${idx}`}>
                <title>{node.label}</title>
                <rect
                  x={x0}
                  y={y0}
                  width={Math.max(1, x1 - x0)}
                  height={Math.max(1, y1 - y0)}
                  fill={
                    node.isBucket
                      ? "rgba(124,132,146,0.72)"
                      : node.kind === "issuer"
                        ? "rgba(85,186,171,0.9)"
                        : "rgba(131,144,222,0.88)"
                  }
                  rx={4}
                  onClick={() => {
                    if (node.isBucket || isCenter) return;
                    if (node.kind === "investor") onSelectInvestor(node.id);
                    if (node.kind === "issuer") onSelectIssuer?.(node.id);
                  }}
                  className={node.isBucket || isCenter ? "" : "cursor-pointer"}
                />
                {isCenter ? (
                  <text
                    x={x1 + 8}
                    y={labelY}
                    textAnchor="start"
                    dominantBaseline="middle"
                    fill="rgb(239,244,251)"
                    fontSize={13}
                    fontWeight={650}
                    style={{ paintOrder: "stroke", stroke: "rgba(7,12,19,0.8)", strokeWidth: 3 }}
                  >
                    {nameForCenter}
                  </text>
                ) : !node.isBucket ? (
                  <g>
                    <line
                      x1={x1 + 2}
                      y1={labelY}
                      x2={labelX - 8}
                      y2={labelY}
                      stroke={node.kind === "issuer" ? "rgba(85,186,171,0.32)" : "rgba(131,144,222,0.32)"}
                      strokeWidth={1}
                    />
                    <text
                      x={labelX}
                      y={labelY}
                      textAnchor="start"
                      dominantBaseline="middle"
                      fill="rgb(239,244,251)"
                      fontSize={13.2}
                      fontWeight={700}
                      onClick={() => {
                        if (node.kind === "investor") onSelectInvestor(node.id);
                        if (node.kind === "issuer") onSelectIssuer?.(node.id);
                      }}
                      className="cursor-pointer"
                      style={{ paintOrder: "stroke", stroke: "rgba(7,12,19,0.8)", strokeWidth: 3 }}
                    >
                      {rightLabel}
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}

          <text x={12} y={prepared.layoutHeight - 9} fill="rgb(136,151,171)" fontSize={11}>
            Flow kepemilikan ({prepared.effectiveFocus === "investor" ? "Investor-centric" : "Issuer-centric"})
          </text>
          <text x={LAYOUT_WIDTH - 12} y={prepared.layoutHeight - 9} fill="rgb(136,151,171)" textAnchor="end" fontSize={11}>
            {fmtPercent(prepared.totalValue)}
          </text>
        </svg>
      </div>
    </div>
  );
}
