import { useEffect, useMemo, useRef, useState, type PointerEvent, type RefObject } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { getInvestorId, getIssuerId } from "../lib/graph";
import { fmtNumber, fmtPercent } from "../lib/utils";
import type { OwnershipRow } from "../types/ownership";

type FocusType = "issuer" | "investor";
type Zone = "top" | "right" | "left" | "bottom";
type LayoutMode = "strict" | "expanded";
type DensityPreset = "compact" | "balanced" | "dense";

type SankeyFlowProps = {
  rows: OwnershipRow[];
  selectedIssuerId: string | null;
  selectedInvestorId: string | null;
  focusType?: FocusType | null;
  onSelectIssuer?: (issuerId: string) => void;
  onSelectInvestor?: (investorId: string) => void;
};

type EntityNode = {
  id: string;
  kind: FocusType;
  label: string;
  investorType: string | null;
  localForeign: "L" | "A" | null;
};

type OwnershipEdge = {
  id: string;
  source: string;
  target: string;
  ownership: number | null;
  shares: number | null;
  count: number;
};

type GraphIndex = {
  nodes: Map<string, EntityNode>;
  outMap: Map<string, OwnershipEdge[]>;
  inMap: Map<string, OwnershipEdge[]>;
  topIssuerId: string | null;
  topInvestorId: string | null;
};

type DisplayNode = {
  id: string;
  kind: FocusType;
  zone: Zone | "center";
  level: 0 | 1 | 2;
  label: string;
  ownership: number | null;
  shares: number | null;
  parentId: string | null;
  isSummary: boolean;
  summaryCount: number;
  width: number;
  height: number;
};

type DisplayEdge = {
  id: string;
  source: string;
  target: string;
  ownership: number | null;
  shares: number | null;
  level: 1 | 2;
};

type DisplayScene = {
  centerId: string | null;
  nodes: DisplayNode[];
  edges: DisplayEdge[];
  hiddenByZone: Record<Zone, number>;
  zoneCounts: Record<Zone, number>;
};

type PositionedNode = DisplayNode & {
  x: number;
  y: number;
};

type Size = {
  width: number;
  height: number;
};

type TooltipState = {
  nodeId: string;
  x: number;
  y: number;
};

const ZONES: Zone[] = ["top", "right", "left", "bottom"];
const MIN_WIDTH = 760;
const MIN_HEIGHT = 460;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function safeMaxNullable(current: number | null, incoming: number | null): number | null {
  if (incoming === null || Number.isNaN(incoming)) return current;
  if (current === null || Number.isNaN(current)) return incoming;
  return Math.max(current, incoming);
}

function scoreOwnership(value: number | null): number {
  if (value === null || Number.isNaN(value)) return 0;
  return Math.max(0, value);
}

function edgeSortDesc(a: OwnershipEdge, b: OwnershipEdge): number {
  return scoreOwnership(b.ownership) - scoreOwnership(a.ownership);
}

function truncateLabel(text: string, maxChars: number): string {
  const clean = text.trim();
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, Math.max(1, maxChars - 1))}...`;
}

function normalizeInvestorType(type: string | null): string {
  const value = (type ?? "").trim().toUpperCase();
  return value || "UNKNOWN";
}

function isIndividualInvestor(type: string | null): boolean {
  const normalized = normalizeInvestorType(type);
  return normalized === "ID" || normalized === "I" || normalized.includes("INDIV");
}

function useElementSize<T extends HTMLElement>(ref: RefObject<T | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const updateSize = () => {
      setSize({
        width: Math.max(0, element.clientWidth),
        height: Math.max(0, element.clientHeight),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

function estimateNodeSize(label: string, center: boolean, summary: boolean): Pick<DisplayNode, "width" | "height"> {
  if (center) {
    const width = clamp(176 + label.length * 3.2, 180, 280);
    return { width, height: 58 };
  }
  if (summary) {
    const width = clamp(120 + label.length * 2.1, 136, 240);
    return { width, height: 42 };
  }
  const width = clamp(136 + label.length * 2.35, 140, 252);
  return { width, height: 46 };
}

function buildGraphIndex(rows: OwnershipRow[]): GraphIndex {
  const nodes = new Map<string, EntityNode>();
  const edgeMap = new Map<string, OwnershipEdge>();

  for (const row of rows) {
    const issuerId = getIssuerId(row);
    const investorId = getInvestorId(row);

    if (!nodes.has(issuerId)) {
      nodes.set(issuerId, {
        id: issuerId,
        kind: "issuer",
        label: row.shareCode?.trim() ? row.shareCode.trim().toUpperCase() : row.issuerName.trim(),
        investorType: null,
        localForeign: null,
      });
    }

    if (!nodes.has(investorId)) {
      nodes.set(investorId, {
        id: investorId,
        kind: "investor",
        label: row.investorName.trim(),
        investorType: row.investorType,
        localForeign: row.localForeign,
      });
    }

    const key = `${investorId}->${issuerId}`;
    const existing = edgeMap.get(key);
    if (existing) {
      existing.ownership = safeMaxNullable(existing.ownership, row.percentage);
      existing.shares = safeMaxNullable(existing.shares, row.totalHoldingShares);
      existing.count += 1;
      continue;
    }
    edgeMap.set(key, {
      id: key,
      source: investorId,
      target: issuerId,
      ownership: row.percentage,
      shares: row.totalHoldingShares,
      count: 1,
    });
  }

  const outMap = new Map<string, OwnershipEdge[]>();
  const inMap = new Map<string, OwnershipEdge[]>();
  const issuerWeight = new Map<string, number>();
  const investorWeight = new Map<string, number>();

  for (const edge of edgeMap.values()) {
    const outList = outMap.get(edge.source) ?? [];
    outList.push(edge);
    outMap.set(edge.source, outList);

    const inList = inMap.get(edge.target) ?? [];
    inList.push(edge);
    inMap.set(edge.target, inList);

    issuerWeight.set(edge.target, (issuerWeight.get(edge.target) ?? 0) + scoreOwnership(edge.ownership));
    investorWeight.set(edge.source, (investorWeight.get(edge.source) ?? 0) + scoreOwnership(edge.ownership));
  }

  for (const list of outMap.values()) list.sort(edgeSortDesc);
  for (const list of inMap.values()) list.sort(edgeSortDesc);

  const topIssuerId = [...issuerWeight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const topInvestorId = [...investorWeight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return { nodes, outMap, inMap, topIssuerId, topInvestorId };
}

function resolveExternalCenter(
  index: GraphIndex,
  selectedIssuerId: string | null,
  selectedInvestorId: string | null,
  focusType: FocusType | null | undefined,
): string | null {
  const preferred =
    focusType === "investor"
      ? selectedInvestorId ?? selectedIssuerId
      : focusType === "issuer"
        ? selectedIssuerId ?? selectedInvestorId
        : selectedIssuerId ?? selectedInvestorId;

  if (preferred && index.nodes.has(preferred)) return preferred;
  if (focusType === "investor" && index.topInvestorId) return index.topInvestorId;
  if (focusType === "issuer" && index.topIssuerId) return index.topIssuerId;
  return index.topIssuerId ?? index.topInvestorId ?? index.nodes.keys().next().value ?? null;
}

function zoneCapacity(width: number, density: DensityPreset): Record<Zone, number> {
  const base =
    width < 900
      ? { top: 8, right: 10, left: 8, bottom: 10 }
      : width < 1280
        ? { top: 12, right: 14, left: 12, bottom: 14 }
        : { top: 14, right: 20, left: 14, bottom: 18 };

  const factor = density === "compact" ? 0.72 : density === "dense" ? 1.4 : 1;
  return {
    top: clamp(Math.round(base.top * factor), 4, 42),
    right: clamp(Math.round(base.right * factor), 5, 56),
    left: clamp(Math.round(base.left * factor), 4, 42),
    bottom: clamp(Math.round(base.bottom * factor), 5, 50),
  };
}

function buildDisplayScene(
  index: GraphIndex,
  centerId: string | null,
  depth: 1 | 2,
  layoutMode: LayoutMode,
  density: DensityPreset,
  expandedZones: Set<Zone>,
  viewportWidth: number,
): DisplayScene {
  const hiddenByZone: Record<Zone, number> = { top: 0, right: 0, left: 0, bottom: 0 };
  const zoneCounts: Record<Zone, number> = { top: 0, right: 0, left: 0, bottom: 0 };

  if (!centerId || !index.nodes.has(centerId)) {
    return { centerId: null, nodes: [], edges: [], hiddenByZone, zoneCounts };
  }

  const centerMeta = index.nodes.get(centerId)!;
  const nodeMap = new Map<string, DisplayNode>();
  const zoneBuckets: Record<Zone, DisplayNode[]> = { top: [], right: [], left: [], bottom: [] };
  const edges: DisplayEdge[] = [];

  const centerSize = estimateNodeSize(centerMeta.label, true, false);
  nodeMap.set(centerId, {
    id: centerId,
    kind: centerMeta.kind,
    zone: "center",
    level: 0,
    label: centerMeta.label,
    ownership: null,
    shares: null,
    parentId: null,
    isSummary: false,
    summaryCount: 0,
    ...centerSize,
  });

  const addNode = (
    id: string,
    zone: Zone,
    level: 1 | 2,
    ownership: number | null,
    shares: number | null,
    parentId: string | null,
    summary = false,
    summaryCount = 0,
  ) => {
    const meta = index.nodes.get(id);
    if (!meta) return;
    const existing = nodeMap.get(id);
    if (existing) {
      existing.ownership = safeMaxNullable(existing.ownership, ownership);
      existing.shares = safeMaxNullable(existing.shares, shares);
      return;
    }
    const size = estimateNodeSize(meta.label, false, summary);
    const node: DisplayNode = {
      id,
      kind: meta.kind,
      zone,
      level,
      label: meta.label,
      ownership,
      shares,
      parentId,
      isSummary: summary,
      summaryCount,
      ...size,
    };
    nodeMap.set(id, node);
    zoneBuckets[zone].push(node);
  };

  const incoming = [...(index.inMap.get(centerId) ?? [])].sort(edgeSortDesc);
  const outgoing = [...(index.outMap.get(centerId) ?? [])].sort(edgeSortDesc);

  for (const edge of incoming) {
    addNode(edge.source, "top", 1, edge.ownership, edge.shares, centerId);
    edges.push({
      id: `l1:${edge.source}->${centerId}`,
      source: edge.source,
      target: centerId,
      ownership: edge.ownership,
      shares: edge.shares,
      level: 1,
    });
  }

  for (const edge of outgoing) {
    addNode(edge.target, "right", 1, edge.ownership, edge.shares, centerId);
    edges.push({
      id: `l1:${centerId}->${edge.target}`,
      source: centerId,
      target: edge.target,
      ownership: edge.ownership,
      shares: edge.shares,
      level: 1,
    });
  }

  const directNodeIds = new Set<string>([
    ...zoneBuckets.top.map((node) => node.id),
    ...zoneBuckets.right.map((node) => node.id),
  ]);

  const effectiveDepth = layoutMode === "strict" ? 1 : depth;

  if (effectiveDepth === 2) {
    const secondLevel = new Map<
      string,
      {
        zone: Zone;
        ownership: number | null;
        shares: number | null;
        score: number;
        parentId: string;
      }
    >();

    for (const nodeId of directNodeIds) {
      const around = [...(index.outMap.get(nodeId) ?? []), ...(index.inMap.get(nodeId) ?? [])];
      for (const edge of around) {
        const other = edge.source === nodeId ? edge.target : edge.source;
        if (other === centerId || directNodeIds.has(other)) continue;
        if (!index.nodes.has(other)) continue;

        const meta = index.nodes.get(other)!;
        const zone: Zone = meta.kind === "investor" ? "left" : "bottom";
        const score = scoreOwnership(edge.ownership);
        const existing = secondLevel.get(other);
        if (!existing || score > existing.score) {
          secondLevel.set(other, {
            zone,
            ownership: edge.ownership,
            shares: edge.shares,
            score,
            parentId: nodeId,
          });
          continue;
        }
        existing.score += score;
        existing.ownership = safeMaxNullable(existing.ownership, edge.ownership);
        existing.shares = safeMaxNullable(existing.shares, edge.shares);
      }
    }

    for (const [nodeId, item] of secondLevel.entries()) {
      addNode(nodeId, item.zone, 2, item.ownership, item.shares, item.parentId);
      edges.push({
        id: `l2:${item.parentId}->${nodeId}`,
        source: item.parentId,
        target: nodeId,
        ownership: item.ownership,
        shares: item.shares,
        level: 2,
      });
    }
  }

  const capacity = zoneCapacity(viewportWidth, density);
  const summaryNodes: DisplayNode[] = [];

  for (const zone of ZONES) {
    const sorted = [...zoneBuckets[zone]].sort((a, b) => {
      const diff = scoreOwnership(b.ownership) - scoreOwnership(a.ownership);
      return diff !== 0 ? diff : a.label.localeCompare(b.label);
    });
    zoneCounts[zone] = sorted.length;

    if (expandedZones.has(zone) || sorted.length <= capacity[zone]) {
      zoneBuckets[zone] = sorted;
      continue;
    }

    const visible = sorted.slice(0, capacity[zone]);
    const hidden = sorted.slice(capacity[zone]);
    hiddenByZone[zone] = hidden.length;
    zoneBuckets[zone] = visible;

    for (const node of hidden) {
      nodeMap.delete(node.id);
    }

    const aggregateOwnership = hidden.reduce((sum, node) => sum + scoreOwnership(node.ownership), 0);
    const ownership = hidden.length > 0 ? aggregateOwnership / hidden.length : null;
    const summaryLabel = `+${hidden.length} entities`;
    const size = estimateNodeSize(summaryLabel, false, true);
    const summaryId = `summary:${zone}`;
    const summaryNode: DisplayNode = {
      id: summaryId,
      kind: "investor",
      zone,
      level: 2,
      label: summaryLabel,
      ownership,
      shares: null,
      parentId: centerId,
      isSummary: true,
      summaryCount: hidden.length,
      ...size,
    };
    nodeMap.set(summaryId, summaryNode);
    zoneBuckets[zone].push(summaryNode);
    summaryNodes.push(summaryNode);
  }

  for (const zone of ZONES) {
    zoneBuckets[zone].sort((a, b) => {
      if (a.isSummary) return 1;
      if (b.isSummary) return -1;
      const diff = scoreOwnership(b.ownership) - scoreOwnership(a.ownership);
      return diff !== 0 ? diff : a.label.localeCompare(b.label);
    });
  }

  const visibleNodeIds = new Set<string>(nodeMap.keys());
  const visibleEdges = edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));

  for (const summaryNode of summaryNodes) {
    const source = summaryNode.zone === "top" ? summaryNode.id : centerId;
    const target = summaryNode.zone === "top" ? centerId : summaryNode.id;
    visibleEdges.push({
      id: `summary:${summaryNode.zone}`,
      source,
      target,
      ownership: summaryNode.ownership,
      shares: null,
      level: 2,
    });
  }

  const nodes: DisplayNode[] = [nodeMap.get(centerId)!, ...ZONES.flatMap((zone) => zoneBuckets[zone])];
  return { centerId, nodes, edges: visibleEdges, hiddenByZone, zoneCounts };
}

function attachmentPoint(source: PositionedNode, target: PositionedNode) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const dir = dx >= 0 ? 1 : -1;
    return {
      sx: source.x + dir * (source.width / 2),
      sy: source.y,
      tx: target.x - dir * (target.width / 2),
      ty: target.y,
    };
  }
  const dir = dy >= 0 ? 1 : -1;
  return {
    sx: source.x,
    sy: source.y + dir * (source.height / 2),
    tx: target.x,
    ty: target.y - dir * (target.height / 2),
  };
}

function orthogonalPath(source: PositionedNode, target: PositionedNode): string {
  const { sx, sy, tx, ty } = attachmentPoint(source, target);
  if (Math.abs(tx - sx) >= Math.abs(ty - sy)) {
    const elbowX = sx + (tx - sx) * 0.46;
    return `M ${sx} ${sy} H ${elbowX} V ${ty} H ${tx}`;
  }
  const elbowY = sy + (ty - sy) * 0.46;
  return `M ${sx} ${sy} V ${elbowY} H ${tx} V ${ty}`;
}

function edgeStrokeWidth(ownership: number | null): number {
  if (ownership === null || Number.isNaN(ownership)) return 1.15;
  return clamp(0.95 + ownership * 0.11, 1, 6.2);
}

function nodeFill(node: PositionedNode, active: boolean): string {
  if (node.level === 0) {
    return active ? "rgba(132,164,246,0.32)" : "rgba(132,164,246,0.22)";
  }
  if (node.isSummary) {
    return active ? "rgba(136,151,171,0.32)" : "rgba(136,151,171,0.2)";
  }
  if (node.zone === "top") {
    return active ? "rgba(85,186,171,0.28)" : "rgba(85,186,171,0.2)";
  }
  if (node.zone === "right") {
    return active ? "rgba(131,144,222,0.28)" : "rgba(131,144,222,0.2)";
  }
  if (node.zone === "left") {
    return active ? "rgba(236,185,97,0.24)" : "rgba(236,185,97,0.18)";
  }
  return active ? "rgba(124,132,146,0.3)" : "rgba(124,132,146,0.2)";
}

function nodeStroke(node: PositionedNode, active: boolean): string {
  if (node.level === 0) return active ? "rgba(132,164,246,0.9)" : "rgba(132,164,246,0.72)";
  if (node.isSummary) return active ? "rgba(185,196,212,0.88)" : "rgba(136,151,171,0.72)";
  if (node.zone === "top") return active ? "rgba(85,186,171,0.86)" : "rgba(85,186,171,0.64)";
  if (node.zone === "right") return active ? "rgba(131,144,222,0.86)" : "rgba(131,144,222,0.62)";
  if (node.zone === "left") return active ? "rgba(236,185,97,0.86)" : "rgba(236,185,97,0.62)";
  return active ? "rgba(160,170,186,0.86)" : "rgba(124,132,146,0.68)";
}

function zoneLabel(zone: Zone): string {
  if (zone === "top") return "Owner";
  if (zone === "right") return "Owned / Holding";
  if (zone === "left") return "Stakeholder";
  return "Subsidiary / Related";
}

function densityLabel(density: DensityPreset): string {
  if (density === "compact") return "Compact";
  if (density === "dense") return "Dense";
  return "Balanced";
}

export function SankeyFlow({
  rows,
  selectedIssuerId,
  selectedInvestorId,
  focusType,
  onSelectIssuer,
  onSelectInvestor,
}: SankeyFlowProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const size = useElementSize(containerRef);
  const [centerId, setCenterId] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("expanded");
  const [density, setDensity] = useState<DensityPreset>("balanced");
  const [depth, setDepth] = useState<1 | 2>(1);
  const [expandedZones, setExpandedZones] = useState<Set<Zone>>(new Set());
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const graphIndex = useMemo(() => buildGraphIndex(rows), [rows]);
  const externalCenterId = useMemo(
    () => resolveExternalCenter(graphIndex, selectedIssuerId, selectedInvestorId, focusType),
    [focusType, graphIndex, selectedInvestorId, selectedIssuerId],
  );

  useEffect(() => {
    if (!externalCenterId) {
      setCenterId(null);
      return;
    }
    setCenterId((current) => {
      if (current === externalCenterId) return current;
      return externalCenterId;
    });
    setDepth(1);
    setExpandedZones(new Set());
  }, [externalCenterId]);

  useEffect(() => {
    if (!centerId || graphIndex.nodes.has(centerId)) return;
    setCenterId(externalCenterId);
    setDepth(1);
    setExpandedZones(new Set());
  }, [centerId, externalCenterId, graphIndex.nodes]);

  useEffect(() => {
    if (layoutMode !== "strict") return;
    setDepth(1);
    setExpandedZones(new Set());
  }, [layoutMode]);

  const viewportWidth = Math.max(size.width, MIN_WIDTH);
  const viewportHeight = Math.max(size.height, MIN_HEIGHT);

  const scene = useMemo(
    () => buildDisplayScene(graphIndex, centerId, depth, layoutMode, density, expandedZones, viewportWidth),
    [centerId, density, depth, expandedZones, graphIndex, layoutMode, viewportWidth],
  );

  const [positionedNodes, setPositionedNodes] = useState<PositionedNode[]>([]);

  useEffect(() => {
    let active = true;
    const worker = new Worker(new URL("../workers/sankey-physics.worker.ts", import.meta.url), { type: "module" });
    
    worker.onmessage = (e) => {
      if (active && e.data.type === "RESULT") {
        setPositionedNodes(e.data.nodes);
        worker.terminate();
      }
    };
    
    worker.postMessage({
      type: "CALCULATE",
      scene,
      width: viewportWidth,
      height: viewportHeight
    });
    
    return () => {
      active = false;
      worker.terminate();
    };
  }, [scene, viewportWidth, viewportHeight]);

  const nodeById = useMemo(() => {
    const map = new Map<string, PositionedNode>();
    positionedNodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [positionedNodes]);

  const centerNode = scene.centerId ? nodeById.get(scene.centerId) ?? null : null;
  const zoneDistribution = useMemo(() => {
    const byZone: Record<Zone, PositionedNode[]> = { top: [], right: [], left: [], bottom: [] };
    positionedNodes.forEach((node) => {
      if (node.zone === "center") return;
      byZone[node.zone].push(node);
    });
    return byZone;
  }, [positionedNodes]);

  const emitNodeSelection = (nodeId: string) => {
    if (nodeId.startsWith("issuer:")) onSelectIssuer?.(nodeId);
    if (nodeId.startsWith("investor:")) onSelectInvestor?.(nodeId);
  };

  const handleNodeClick = (node: PositionedNode) => {
    if (node.isSummary) {
      setExpandedZones((current) => {
        const next = new Set(current);
        next.add(node.zone as Zone);
        return next;
      });
      return;
    }

    setHoveredNodeId(node.id);
    setTooltip(null);

    if (node.id !== centerId) {
      setCenterId(node.id);
      setDepth(1);
      setExpandedZones(new Set());
      emitNodeSelection(node.id);
    } else {
      emitNodeSelection(node.id);
    }
  };

  const handleNodeDoubleClick = (node: PositionedNode) => {
    if (node.isSummary) return;
    if (node.id !== centerId) {
      setCenterId(node.id);
      emitNodeSelection(node.id);
    }
    if (layoutMode === "strict") return;
    setDepth((current) => (current === 1 ? 2 : 1));
  };

  const handlePointerMove = (event: PointerEvent<SVGGElement>, nodeId: string) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      nodeId,
      x: event.clientX - rect.left + 14,
      y: event.clientY - rect.top + 14,
    });
  };

  if (rows.length === 0) {
    return (
      <div className="flex h-[520px] items-center justify-center rounded-xl border border-border bg-background/25 px-4 text-center text-sm text-muted">
        Tidak ada data relasi untuk kombinasi filter saat ini.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-gradient-to-b from-panel/80 via-background/70 to-background/85">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-md border border-focus/35 bg-focus/10 px-2 py-0.5 font-mono text-focus">
            {centerNode?.label ?? "No center"}
          </span>
          <span className="text-muted">
            Nodes {positionedNodes.length.toLocaleString("id-ID")} | Mode {layoutMode === "strict" ? "Strict" : "Expanded"} | Density{" "}
            {densityLabel(density)} | Depth {layoutMode === "strict" ? 1 : depth}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex items-center rounded-md border border-border/80 p-0.5">
            {(["strict", "expanded"] as LayoutMode[]).map((mode) => {
              const active = layoutMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setLayoutMode(mode);
                    setExpandedZones(new Set());
                  }}
                  className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                    active
                      ? "bg-focus/20 text-foreground shadow-[inset_0_0_0_1px_rgba(132,164,246,0.30)]"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {mode === "strict" ? "Strict" : "Expanded"}
                </button>
              );
            })}
          </div>

          <div className="inline-flex items-center rounded-md border border-border/80 p-0.5">
            {(["compact", "balanced", "dense"] as DensityPreset[]).map((preset) => {
              const active = density === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setDensity(preset);
                    setExpandedZones(new Set());
                  }}
                  className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                    active
                      ? "bg-panel-3/80 text-foreground shadow-[inset_0_0_0_1px_rgba(185,196,212,0.26)]"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {densityLabel(preset)}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setDepth((current) => (current === 1 ? 2 : 1))}
            disabled={layoutMode === "strict"}
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors ${
              layoutMode === "strict"
                ? "cursor-not-allowed border-border/60 text-muted2"
                : "border-border text-muted hover:border-border-strong hover:text-foreground"
            }`}
          >
            {depth === 1 ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            {depth === 1 ? "Expand L2" : "Collapse L2"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!externalCenterId) return;
              setCenterId(externalCenterId);
              setDepth(1);
              setExpandedZones(new Set());
            }}
            className="rounded-md border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-border-strong hover:text-foreground"
          >
            Reset Focus
          </button>
        </div>
      </div>

      <div ref={containerRef} className="relative h-[min(72vh,760px)] min-h-[520px] w-full overflow-hidden">
        {positionedNodes.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            Layout belum terbentuk. Coba pilih entitas lain.
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${viewportWidth} ${viewportHeight}`}
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid meet"
            className="block"
            role="img"
            aria-label="Ownership intelligence explorer"
          >
            <defs>
              <pattern id="ownership-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(91,107,130,0.10)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect x={0} y={0} width={viewportWidth} height={viewportHeight} fill="url(#ownership-grid)" />

            {scene.edges.map((edge) => {
              const source = nodeById.get(edge.source);
              const target = nodeById.get(edge.target);
              if (!source || !target) return null;

              const connected = hoveredNodeId ? edge.source === hoveredNodeId || edge.target === hoveredNodeId : false;
              const dimmed = hoveredNodeId !== null && !connected;
              const path = orthogonalPath(source, target);
              return (
                <path
                  key={edge.id}
                  d={path}
                  fill="none"
                  stroke={connected ? "rgba(132,164,246,0.88)" : "rgba(108,129,163,0.56)"}
                  strokeWidth={edgeStrokeWidth(edge.ownership)}
                  opacity={dimmed ? 0.2 : connected ? 1 : 0.74}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}

            {positionedNodes.map((node) => {
              const isCenter = node.level === 0;
              const isHovered = hoveredNodeId === node.id;
              const hasHover = hoveredNodeId !== null;
              const isConnected =
                !hasHover ||
                node.id === hoveredNodeId ||
                scene.edges.some(
                  (edge) =>
                    (edge.source === hoveredNodeId && edge.target === node.id) ||
                    (edge.target === hoveredNodeId && edge.source === node.id),
                );
              const opacity = hasHover && !isConnected ? 0.25 : 1;
              const fill = nodeFill(node, isHovered || isCenter);
              const stroke = nodeStroke(node, isHovered || isCenter);

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x - node.width / 2} ${node.y - node.height / 2})`}
                  onPointerEnter={(event) => {
                    setHoveredNodeId(node.id);
                    handlePointerMove(event, node.id);
                  }}
                  onPointerMove={(event) => handlePointerMove(event, node.id)}
                  onPointerLeave={() => {
                    setHoveredNodeId((current) => (current === node.id ? null : current));
                    setTooltip((current) => (current?.nodeId === node.id ? null : current));
                  }}
                  onClick={() => handleNodeClick(node)}
                  onDoubleClick={() => handleNodeDoubleClick(node)}
                  style={{ cursor: "pointer", opacity, transition: "opacity 160ms ease" }}
                >
                  <rect
                    x={0}
                    y={0}
                    width={node.width}
                    height={node.height}
                    rx={isCenter ? 14 : 11}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isCenter ? 1.8 : 1.2}
                  />
                  <text
                    x={10}
                    y={node.isSummary ? 17 : 16}
                    fill="rgba(239,244,251,0.96)"
                    fontSize={isCenter ? 14 : 12}
                    fontWeight={isCenter ? 700 : 600}
                    letterSpacing={0.1}
                  >
                    {truncateLabel(node.label, isCenter ? 24 : 30)}
                  </text>
                  {node.isSummary ? (
                    <text x={10} y={31} fill="rgba(185,196,212,0.85)" fontSize={11}>
                      Click untuk expand
                    </text>
                  ) : isCenter ? (
                    <text x={10} y={37} fill="rgba(185,196,212,0.82)" fontSize={11.4}>
                      Focus entity
                    </text>
                  ) : (
                    <text x={10} y={33} fill="rgba(185,196,212,0.86)" fontSize={11.2}>
                      {fmtPercent(node.ownership)}
                      {node.shares !== null ? `  |  ${fmtNumber(node.shares)} shares` : ""}
                    </text>
                  )}
                </g>
              );
            })}

            <g fontSize={11} fill="rgba(185,196,212,0.78)">
              {ZONES.map((zone) => {
                const nodes = zoneDistribution[zone];
                if (nodes.length === 0 || !centerNode) return null;
                const avgX = nodes.reduce((sum, node) => sum + node.x, 0) / nodes.length;
                const avgY = nodes.reduce((sum, node) => sum + node.y, 0) / nodes.length;
                const hidden = scene.hiddenByZone[zone];
                return (
                  <text key={`label-${zone}`} x={avgX} y={avgY - 36} textAnchor="middle" fontWeight={600}>
                    {zoneLabel(zone)} ({scene.zoneCounts[zone].toLocaleString("id-ID")}
                    {hidden > 0 ? `, +${hidden}` : ""})
                  </text>
                );
              })}
            </g>
          </svg>
        )}

        {tooltip ? (
          (() => {
            const node = nodeById.get(tooltip.nodeId);
            if (!node) return null;
            const isInvestor = node.kind === "investor";
            const title = node.label;
            const category =
              node.isSummary
                ? "Collapsed cluster"
                : node.level === 0
                  ? "Center entity"
                  : isInvestor
                    ? isIndividualInvestor(graphIndex.nodes.get(node.id)?.investorType ?? null)
                      ? "Investor individual"
                      : "Investor institusi"
                    : "Corporate entity";
            return (
              <div
                className="pointer-events-none absolute z-20 w-[260px] rounded-lg border border-border-strong/70 bg-panel-2/95 px-3 py-2 text-xs shadow-panel"
                style={{
                  left: clamp(tooltip.x, 8, viewportWidth - 268),
                  top: clamp(tooltip.y, 8, viewportHeight - 132),
                }}
              >
                <div className="mb-1 text-sm font-semibold text-foreground">{title}</div>
                <div className="text-muted">{category}</div>
                {!node.isSummary ? (
                  <>
                    <div className="mt-1 text-muted">Ownership: {fmtPercent(node.ownership)}</div>
                    <div className="text-muted">
                      Shares: {node.shares !== null ? `${fmtNumber(node.shares)} shares` : "-"}
                    </div>
                  </>
                ) : (
                  <div className="mt-1 text-muted">{node.summaryCount.toLocaleString("id-ID")} entities hidden</div>
                )}
              </div>
            );
          })()
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 px-4 py-2 text-[11px] text-muted">
        <span>Flow kepemilikan (issuer-investor network)</span>
        <span>
          Coverage visible:{" "}
          {Math.min(
            100,
            positionedNodes.length > 0 ? Math.round((scene.edges.length / Math.max(1, rows.length)) * 100) : 0,
          )}
          %
        </span>
      </div>
    </div>
  );
}
