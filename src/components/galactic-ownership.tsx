import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceRadial,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { Maximize2, Minimize2 } from "lucide-react";
import { getInvestorId, getIssuerId } from "../lib/graph";
import { useAppStore, type FiltersState } from "../store/app-store";
import type { OwnershipRow } from "../types/ownership";

type FocusType = "issuer" | "investor";

type GalaxyNode = SimulationNodeDatum & {
  id: string;
  kind: "issuer" | "investor";
  name: string;
  issuerName?: string;
  radius: number;
  pct: number | null;
  shares: number | null;
  localForeign: "L" | "A" | null;
  investorType: string | null;
  edgeId?: string;
  isIndividual?: boolean;
};

type GalaxyLink = SimulationLinkDatum<GalaxyNode> & {
  id: string;
  source: string | GalaxyNode;
  target: string | GalaxyNode;
  pct: number;
  shares: number;
  edgeId?: string;
};

type SceneStats = {
  holderCount: number;
  renderedHolderCount: number;
  individualCount: number;
  droppedByTopN: number;
  droppedByMinPct: number;
  droppedByTypeFilter: number;
  droppedByUnknownStatus: number;
  droppedByInvalidPct: number;
};

type SceneData = {
  nodes: GalaxyNode[];
  links: GalaxyLink[];
  centerId: string | null;
  centerKind: FocusType | null;
  centerPrimaryLabel: string;
  centerSecondaryLabel: string;
  emptyReason: string | null;
  stats: SceneStats;
};

type GalacticOwnershipProps = {
  rows: OwnershipRow[];
  selectedIssuerId: string | null;
  selectedInvestorId: string | null;
  focusType?: FocusType | null;
  onSelectIssuer?: (issuerId: string) => void;
  onSelectInvestor: (investorId: string) => void;
  onSelectEdge: (edgeId: string | null) => void;
  topNEdges?: number;
};

type Size = {
  width: number;
  height: number;
};

type LabelHitBox = {
  nodeId: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

const MIN_SIZE = 120;
const pctFormatter = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatPct(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "-%";
  return `${pctFormatter.format(value)}%`;
}

function normalizeInvestorType(value: string | null): string {
  const text = (value ?? "").trim().toUpperCase();
  return text || "UNKNOWN";
}

function isIndividualType(value: string | null): boolean {
  const text = normalizeInvestorType(value);
  return text.includes("INDIV") || text === "ID" || text === "I";
}

function truncate(text: string, max: number): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(1, max - 1))}...`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isValidPct(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0 && value <= 100;
}

function rowStatus(row: OwnershipRow): "L" | "A" | "U" {
  if (row.localForeign === "L") return "L";
  if (row.localForeign === "A") return "A";
  return "U";
}

function pctToOrbit(pct: number, maxPct: number, maxOrbit: number): number {
  const normalized = maxPct > 0 ? Math.max(0, Math.min(1, pct / maxPct)) : 0;
  const minOrbit = 95;
  return minOrbit + (1 - normalized) * Math.max(90, maxOrbit - minOrbit);
}

function useElementSize<T extends HTMLElement>(ref: RefObject<T | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => {
      setSize({
        width: Math.max(0, element.clientWidth),
        height: Math.max(0, element.clientHeight),
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(left + r, top);
  ctx.lineTo(left + width - r, top);
  ctx.quadraticCurveTo(left + width, top, left + width, top + r);
  ctx.lineTo(left + width, top + height - r);
  ctx.quadraticCurveTo(left + width, top + height, left + width - r, top + height);
  ctx.lineTo(left + r, top + height);
  ctx.quadraticCurveTo(left, top + height, left, top + height - r);
  ctx.lineTo(left, top + r);
  ctx.quadraticCurveTo(left, top, left + r, top);
  ctx.closePath();
}

function isStatusEnabled(filters: FiltersState, row: OwnershipRow): boolean {
  const status = rowStatus(row);
  const enabled =
    (!filters.localEnabled && !filters.foreignEnabled && !filters.unknownEnabled) ||
    (status === "L" && filters.localEnabled) ||
    (status === "A" && filters.foreignEnabled) ||
    (status === "U" && filters.unknownEnabled);
  return enabled;
}

function buildScene(
  rows: OwnershipRow[],
  allRows: OwnershipRow[],
  focusType: FocusType,
  selectedIssuerId: string | null,
  selectedInvestorId: string | null,
  topNEdges: number,
  filters: FiltersState,
): SceneData {
  const emptyStats: SceneStats = {
    holderCount: 0,
    renderedHolderCount: 0,
    individualCount: 0,
    droppedByTopN: 0,
    droppedByMinPct: 0,
    droppedByTypeFilter: 0,
    droppedByUnknownStatus: 0,
    droppedByInvalidPct: 0,
  };

  if (rows.length === 0) {
    return {
      nodes: [],
      links: [],
      centerId: null,
      centerKind: null,
      centerPrimaryLabel: "",
      centerSecondaryLabel: "",
      emptyReason: "Belum ada data graph.",
      stats: emptyStats,
    };
  }

  if (focusType === "investor") {
    const investorTotals = new Map<string, number>();
    for (const row of rows) {
      const investorId = getInvestorId(row);
      investorTotals.set(investorId, (investorTotals.get(investorId) ?? 0) + (row.percentage ?? 0));
    }
    const centerId = selectedInvestorId ?? [...investorTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    if (!centerId) {
      return {
        nodes: [],
        links: [],
        centerId: null,
        centerKind: "investor",
        centerPrimaryLabel: "",
        centerSecondaryLabel: "",
        emptyReason: "Investor tidak ditemukan.",
        stats: emptyStats,
      };
    }

    const investorRowsFiltered = rows.filter((row) => getInvestorId(row) === centerId);
    if (investorRowsFiltered.length === 0) {
      return {
        nodes: [],
        links: [],
        centerId,
        centerKind: "investor",
        centerPrimaryLabel: "",
        centerSecondaryLabel: "",
        emptyReason: "Tidak ada edge untuk investor ini. Coba turunkan Min% atau nyalakan Unknown.",
        stats: emptyStats,
      };
    }

    const investorRowsAll = allRows.filter((row) => getInvestorId(row) === centerId);
    let droppedByMinPct = 0;
    let droppedByTypeFilter = 0;
    let droppedByUnknownStatus = 0;
    let droppedByInvalidPct = 0;
    for (const row of investorRowsAll) {
      const pct = row.percentage;
      if (!isValidPct(pct)) {
        droppedByInvalidPct += 1;
        continue;
      }
      if (pct < filters.minPercentage) {
        droppedByMinPct += 1;
        continue;
      }
      if (!isStatusEnabled(filters, row)) {
        droppedByUnknownStatus += 1;
        continue;
      }
      const investorType = normalizeInvestorType(row.investorType);
      if (filters.investorTypes.size > 0 && !filters.investorTypes.has(investorType)) {
        droppedByTypeFilter += 1;
      }
    }

    const centerName = investorRowsFiltered[0]?.investorName ?? "";
    const centerType = investorRowsFiltered[0]?.investorType ?? null;
    const issuerMap = new Map<
      string,
      {
        id: string;
        shareCode: string;
        issuerName: string;
        pct: number;
        maxPct: number;
        shares: number;
        localForeign: "L" | "A" | null;
        edgeId: string;
      }
    >();

    for (const row of investorRowsFiltered) {
      if (!isValidPct(row.percentage) || row.percentage === null || row.percentage <= 0) continue;
      const issuerId = getIssuerId(row);
      if (!issuerMap.has(issuerId)) {
        issuerMap.set(issuerId, {
          id: issuerId,
          shareCode: row.shareCode,
          issuerName: row.issuerName,
          pct: 0,
          maxPct: -1,
          shares: 0,
          localForeign: row.localForeign,
          edgeId: row.id,
        });
      }
      const issuer = issuerMap.get(issuerId);
      if (!issuer) continue;
      issuer.pct += row.percentage;
      issuer.shares += row.totalHoldingShares ?? 0;
      if (row.percentage >= issuer.maxPct) {
        issuer.maxPct = row.percentage;
        issuer.edgeId = row.id;
      }
    }

    const holderCount = issuerMap.size;
    const sortedTargets = [...issuerMap.values()].sort((a, b) => b.pct - a.pct);
    const boundedTargets = topNEdges > 0 ? sortedTargets.slice(0, topNEdges) : sortedTargets;
    const droppedByTopN = topNEdges > 0 ? Math.max(0, sortedTargets.length - boundedTargets.length) : 0;

    const centerNode: GalaxyNode = {
      id: centerId,
      kind: "investor",
      name: centerName,
      issuerName: centerType ?? undefined,
      radius: 30,
      pct: null,
      shares: null,
      localForeign: investorRowsFiltered[0]?.localForeign ?? null,
      investorType: centerType,
      isIndividual: isIndividualType(centerType),
      fx: 0,
      fy: 0,
      x: 0,
      y: 0,
    };

    const targetNodes: GalaxyNode[] = boundedTargets.map((issuer) => ({
      id: issuer.id,
      kind: "issuer",
      name: issuer.shareCode,
      issuerName: issuer.issuerName,
      radius: Math.max(6, Math.min(14, 7 + issuer.pct / 5)),
      pct: issuer.pct,
      shares: issuer.shares,
      localForeign: issuer.localForeign,
      investorType: null,
      edgeId: issuer.edgeId,
      isIndividual: false,
    }));

    const links: GalaxyLink[] = targetNodes.map((node, index) => ({
      id: `galaxy:${centerId}:${node.id}:${index}`,
      source: centerId,
      target: node.id,
      pct: node.pct ?? 0,
      shares: node.shares ?? 0,
      edgeId: node.edgeId,
    }));

    return {
      nodes: [centerNode, ...targetNodes],
      links,
      centerId,
      centerKind: "investor",
      centerPrimaryLabel: centerName,
      centerSecondaryLabel: centerType ? `Type ${centerType}` : "Investor focus",
      emptyReason:
        targetNodes.length === 0
          ? "Tidak ada edge untuk filter ini. Coba turunkan Min% atau nyalakan Unknown."
          : null,
      stats: {
        holderCount,
        renderedHolderCount: targetNodes.length,
        individualCount: 0,
        droppedByTopN,
        droppedByMinPct,
        droppedByTypeFilter,
        droppedByUnknownStatus,
        droppedByInvalidPct,
      },
    };
  }

  const issuerTotals = new Map<string, number>();
  for (const row of rows) {
    const issuerId = getIssuerId(row);
    issuerTotals.set(issuerId, (issuerTotals.get(issuerId) ?? 0) + (row.percentage ?? 0));
  }

  const centerId = selectedIssuerId ?? [...issuerTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  if (!centerId) {
    return {
      nodes: [],
      links: [],
      centerId: null,
      centerKind: "issuer",
      centerPrimaryLabel: "",
      centerSecondaryLabel: "",
      emptyReason: "Issuer tidak ditemukan.",
      stats: emptyStats,
    };
  }

  const issuerRowsFiltered = rows.filter((row) => getIssuerId(row) === centerId);
  if (issuerRowsFiltered.length === 0) {
    return {
      nodes: [],
      links: [],
      centerId,
      centerKind: "issuer",
      centerPrimaryLabel: "",
      centerSecondaryLabel: "",
      emptyReason: "Tidak ada edge untuk issuer ini. Coba turunkan Min% atau nyalakan Unknown.",
      stats: emptyStats,
    };
  }

  const issuerRowsAll = allRows.filter((row) => getIssuerId(row) === centerId);
  let droppedByMinPct = 0;
  let droppedByTypeFilter = 0;
  let droppedByUnknownStatus = 0;
  let droppedByInvalidPct = 0;
  for (const row of issuerRowsAll) {
    const pct = row.percentage;
    if (!isValidPct(pct)) {
      droppedByInvalidPct += 1;
      continue;
    }
    if (pct < filters.minPercentage) {
      droppedByMinPct += 1;
      continue;
    }
    if (!isStatusEnabled(filters, row)) {
      droppedByUnknownStatus += 1;
      continue;
    }
    const investorType = normalizeInvestorType(row.investorType);
    if (filters.investorTypes.size > 0 && !filters.investorTypes.has(investorType)) {
      droppedByTypeFilter += 1;
    }
  }

  const centerCode = issuerRowsFiltered[0]?.shareCode ?? "";
  const centerName = issuerRowsFiltered[0]?.issuerName ?? "";

    const investorMap = new Map<
      string,
      {
        id: string;
        name: string;
        pct: number;
        maxPct: number;
        shares: number;
        localForeign: "L" | "A" | null;
        investorType: string | null;
        edgeId: string;
      }
  >();
  for (const row of issuerRowsFiltered) {
    if (!isValidPct(row.percentage) || row.percentage === null || row.percentage <= 0) continue;
    const investorId = getInvestorId(row);
    if (!investorMap.has(investorId)) {
      investorMap.set(investorId, {
        id: investorId,
        name: row.investorName,
        pct: 0,
        maxPct: -1,
        shares: 0,
        localForeign: row.localForeign,
        investorType: row.investorType,
        edgeId: row.id,
      });
    }
    const investor = investorMap.get(investorId);
    if (!investor) continue;
    investor.pct += row.percentage;
    investor.shares += row.totalHoldingShares ?? 0;
    if (row.percentage >= investor.maxPct) {
      investor.maxPct = row.percentage;
      investor.edgeId = row.id;
    }
  }

  const holderCount = investorMap.size;
  const sortedTargets = [...investorMap.values()].sort((a, b) => b.pct - a.pct);
  const boundedTargets = topNEdges > 0 ? sortedTargets.slice(0, topNEdges) : sortedTargets;
  const droppedByTopN = topNEdges > 0 ? Math.max(0, sortedTargets.length - boundedTargets.length) : 0;
  const individualCount = boundedTargets.reduce(
    (sum, holder) => sum + (isIndividualType(holder.investorType) ? 1 : 0),
    0,
  );

  const centerNode: GalaxyNode = {
    id: centerId,
    kind: "issuer",
    name: centerCode,
    issuerName: centerName,
    radius: 30,
    pct: null,
    shares: null,
    localForeign: null,
    investorType: null,
    fx: 0,
    fy: 0,
    x: 0,
    y: 0,
  };

  const targetNodes: GalaxyNode[] = boundedTargets.map((holder) => ({
    id: holder.id,
    kind: "investor",
    name: holder.name,
    radius: Math.max(5, Math.min(14, 6 + holder.pct / 4.8)),
    pct: holder.pct,
    shares: holder.shares,
    localForeign: holder.localForeign,
    investorType: holder.investorType,
    edgeId: holder.edgeId,
    isIndividual: isIndividualType(holder.investorType),
  }));

  const links: GalaxyLink[] = targetNodes.map((node, index) => ({
    id: `galaxy:${centerId}:${node.id}:${index}`,
    source: centerId,
    target: node.id,
    pct: node.pct ?? 0,
    shares: node.shares ?? 0,
    edgeId: node.edgeId,
  }));

  return {
    nodes: [centerNode, ...targetNodes],
    links,
    centerId,
    centerKind: "issuer",
    centerPrimaryLabel: centerCode,
    centerSecondaryLabel: centerName,
    emptyReason:
      targetNodes.length === 0
        ? "Tidak ada edge untuk filter ini. Coba turunkan Min% atau nyalakan Unknown."
        : null,
    stats: {
      holderCount,
      renderedHolderCount: targetNodes.length,
      individualCount,
      droppedByTopN,
      droppedByMinPct,
      droppedByTypeFilter,
      droppedByUnknownStatus,
      droppedByInvalidPct,
    },
  };
}

export function GalacticOwnership({
  rows,
  selectedIssuerId,
  selectedInvestorId,
  focusType,
  onSelectIssuer,
  onSelectInvestor,
  onSelectEdge,
  topNEdges = 0,
}: GalacticOwnershipProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawFrameRef = useRef<(() => void) | null>(null);
  const liveNodesRef = useRef<GalaxyNode[]>([]);
  const liveLinksRef = useRef<GalaxyLink[]>([]);
  const labelHitBoxesRef = useRef<LabelHitBox[]>([]);
  const hoveredNodeIdRef = useRef<string | null>(null);
  const hoverRafRef = useRef<number | null>(null);
  const zoomRef = useRef(1);

  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const size = useElementSize(wrapperRef);

  const parsed = useAppStore((s) => s.parsed);
  const filters = useAppStore((s) => s.filters);
  const allRows = parsed?.rows ?? [];

  const effectiveFocusType: FocusType = focusType ?? (selectedInvestorId ? "investor" : "issuer");

  const scene = useMemo(
    () =>
      buildScene(
        rows,
        allRows,
        effectiveFocusType,
        selectedIssuerId,
        selectedInvestorId,
        topNEdges,
        filters,
      ),
    [allRows, effectiveFocusType, filters, rows, selectedInvestorId, selectedIssuerId, topNEdges],
  );

  useEffect(() => {
    return () => {
      if (hoverRafRef.current !== null) {
        cancelAnimationFrame(hoverRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    zoomRef.current = zoom;
    drawFrameRef.current?.();
  }, [zoom]);

  const fitToScene = useCallback(
    (padding = 80) => {
      const nodes = liveNodesRef.current;
      if (nodes.length === 0 || size.width <= 0 || size.height <= 0) return;

      let minX = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;

      for (const node of nodes) {
        const x = node.x ?? 0;
        const y = node.y ?? 0;
        const r = node.radius + 22;
        minX = Math.min(minX, x - r);
        maxX = Math.max(maxX, x + r);
        minY = Math.min(minY, y - r);
        maxY = Math.max(maxY, y + r);
      }

      const width = Math.max(1, maxX - minX);
      const height = Math.max(1, maxY - minY);
      const availableW = Math.max(1, size.width - padding * 2);
      const availableH = Math.max(1, size.height - padding * 2);
      const nextZoom = Math.max(0.45, Math.min(2.5, Math.min(availableW / width, availableH / height)));
      setZoom(nextZoom);
    },
    [size.height, size.width],
  );

  useEffect(() => {
    if (!isFullscreen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (isFullscreen) {
      const timer = window.setTimeout(() => fitToScene(80), 180);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [fitToScene, isFullscreen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (size.width < MIN_SIZE || size.height < MIN_SIZE) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(size.width * dpr);
    canvas.height = Math.floor(size.height * dpr);
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (scene.nodes.length === 0) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.width, size.height);
      labelHitBoxesRef.current = [];
      return;
    }

    const nodes = scene.nodes.map((node) => ({ ...node }));
    const links = scene.links.map((link) => ({ ...link }));
    liveNodesRef.current = nodes;
    liveLinksRef.current = links;

    const targets = nodes.filter((node) => node.id !== scene.centerId);
    const maxPct = Math.max(1, ...targets.map((node) => node.pct ?? 0));
    const maxOrbit = Math.max(180, Math.min(520, Math.min(size.width, size.height) * 0.62));

    const sortedTargets = [...targets].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
    sortedTargets.forEach((node, index) => {
      const goldenAngle = 2.399963229728653;
      const angle = (index * goldenAngle) % (Math.PI * 2);
      const orbit = pctToOrbit(node.pct ?? 0, maxPct, maxOrbit);
      node.x = Math.cos(angle) * orbit;
      node.y = Math.sin(angle) * orbit;
      node.vx = 0;
      node.vy = 0;
      node.fx = undefined;
      node.fy = undefined;
    });

    const centerNode = nodes.find((node) => node.id === scene.centerId);
    if (centerNode) {
      centerNode.x = 0;
      centerNode.y = 0;
      centerNode.fx = 0;
      centerNode.fy = 0;
      centerNode.vx = 0;
      centerNode.vy = 0;
    }

    const simulation = forceSimulation<GalaxyNode>(nodes)
      .force("center", forceCenter<GalaxyNode>(0, 0))
      .force(
        "link",
        forceLink<GalaxyNode, GalaxyLink>(links)
          .id((node) => node.id)
          .distance((link) => pctToOrbit(link.pct, maxPct, maxOrbit))
          .strength(0.33),
      )
      .force(
        "radial",
        forceRadial<GalaxyNode>(
          (node) => {
            if (node.id === scene.centerId) return 0;
            return pctToOrbit(node.pct ?? 0, maxPct, maxOrbit);
          },
          0,
          0,
        ).strength(0.82),
      )
      .force("charge", forceManyBody<GalaxyNode>().strength((node) => (node.id === scene.centerId ? -780 : -175)))
      .force("collide", forceCollide<GalaxyNode>().radius((node) => node.radius + 13).strength(0.92))
      .alpha(1)
      .alphaDecay(0.05);

    const draw = () => {
      const currentZoom = zoomRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.width, size.height);

      ctx.save();
      ctx.translate(size.width / 2, size.height / 2);
      ctx.scale(currentZoom, currentZoom);

      const hoveredNodeId = hoveredNodeIdRef.current;

      for (const link of links) {
        const source = link.source as GalaxyNode;
        const target = link.target as GalaxyNode;
        const highlighted = hoveredNodeId !== null && (source.id === hoveredNodeId || target.id === hoveredNodeId);
        const muted = hoveredNodeId !== null && !highlighted;

        ctx.beginPath();
        ctx.moveTo(source.x ?? 0, source.y ?? 0);
        ctx.lineTo(target.x ?? 0, target.y ?? 0);
        ctx.strokeStyle = muted
          ? "rgba(113,123,141,0.12)"
          : highlighted
            ? "rgba(239,244,251,0.85)"
            : "rgba(136,151,171,0.3)";
        ctx.lineWidth = Math.max(0.8, Math.min(5.2, link.pct / 4.1));
        ctx.stroke();
      }

      for (const node of nodes) {
        const x = node.x ?? 0;
        const y = node.y ?? 0;
        const isCenter = node.id === scene.centerId;
        const isSelected = node.id === selectedInvestorId || node.id === selectedIssuerId;
        const isHovered = hoveredNodeId !== null && node.id === hoveredNodeId;
        const muted = hoveredNodeId !== null && !isHovered && !isSelected && !isCenter;

        const color =
          isCenter
            ? "rgba(132,164,246,0.9)"
            : node.localForeign === "A"
              ? "rgba(131,144,222,0.84)"
              : node.localForeign === "L"
                ? "rgba(85,186,171,0.82)"
                : "rgba(124,132,146,0.8)";

        ctx.fillStyle = muted ? "rgba(80,92,110,0.26)" : color;
        ctx.shadowBlur = isCenter ? 18 : isHovered ? 12 : 7;
        ctx.shadowColor = isCenter ? "rgba(132,164,246,0.45)" : "rgba(150,162,198,0.25)";

        if (!isCenter && node.kind === "investor" && node.isIndividual) {
          const r = node.radius;
          ctx.beginPath();
          ctx.moveTo(x, y - r);
          ctx.lineTo(x + r, y);
          ctx.lineTo(x, y + r);
          ctx.lineTo(x - r, y);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(x, y, node.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;

        if (isCenter || isSelected || isHovered) {
          ctx.beginPath();
          ctx.arc(x, y, node.radius + 3.4, 0, Math.PI * 2);
          ctx.strokeStyle = isCenter ? "rgba(239,244,251,0.72)" : "rgba(239,244,251,0.62)";
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
      }
      ctx.textBaseline = "middle";
      const labelHitBoxes: LabelHitBox[] = [];
      const worldFont = 13 / currentZoom;
      const worldPadX = 10 / currentZoom;
      const worldPadY = 5 / currentZoom;
      const labelGap = 6 / currentZoom;
      const halfW = size.width / (2 * currentZoom);
      const halfH = size.height / (2 * currentZoom);
      const sideMargin = 16 / currentZoom;
      const minY = -halfH + 24 / currentZoom;
      const maxY = halfH - 24 / currentZoom;
      const selectedIds = new Set<string>(
        [selectedIssuerId, selectedInvestorId].filter((value): value is string => Boolean(value)),
      );

      const nonCenterNodes = nodes.filter((node) => node.id !== scene.centerId);
      const rankedNodes = [...nonCenterNodes].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
      const autoLabelBudget = clamp(
        Math.round(Math.min(18, Math.max(8, Math.min(size.width, size.height) / 72))),
        8,
        18,
      );
      const featuredIds = new Set<string>(rankedNodes.slice(0, autoLabelBudget).map((node) => node.id));
      if (hoveredNodeId) featuredIds.add(hoveredNodeId);
      for (const id of selectedIds) featuredIds.add(id);

      type PlannedLabel = {
        node: GalaxyNode;
        text: string;
        width: number;
        height: number;
        side: "left" | "right";
        desiredY: number;
        left: number;
        top: number;
        y: number;
      };

      const plannedLabels: PlannedLabel[] = [];
      ctx.font = `700 ${worldFont}px "Space Grotesk", Inter, sans-serif`;
      for (const node of rankedNodes) {
        if (!featuredIds.has(node.id)) continue;
        const text =
          node.kind === "investor"
            ? `${truncate(node.name, 34)} - ${formatPct(node.pct)}`
            : `${truncate(node.name, 14)} - ${formatPct(node.pct)}`;
        const width = ctx.measureText(text).width + worldPadX * 2;
        const height = worldFont + worldPadY * 2;
        plannedLabels.push({
          node,
          text,
          width,
          height,
          side: (node.x ?? 0) >= 0 ? "right" : "left",
          desiredY: node.y ?? 0,
          left: 0,
          top: 0,
          y: node.y ?? 0,
        });
      }

      const layoutSide = (side: "left" | "right") => {
        const group = plannedLabels.filter((label) => label.side === side).sort((a, b) => a.desiredY - b.desiredY);
        let cursor = minY;
        for (const item of group) {
          const half = item.height / 2;
          item.y = clamp(item.desiredY, cursor + half, maxY - half);
          cursor = item.y + half + labelGap;
        }
        cursor = maxY;
        for (let idx = group.length - 1; idx >= 0; idx -= 1) {
          const item = group[idx];
          const half = item.height / 2;
          item.y = clamp(item.y, minY + half, cursor - half);
          cursor = item.y - half - labelGap;
        }
        for (const item of group) {
          item.left = side === "left" ? -halfW + sideMargin : halfW - sideMargin - item.width;
          item.top = item.y - item.height / 2;
        }
      };

      layoutSide("left");
      layoutSide("right");

      for (const item of plannedLabels) {
        const node = item.node;
        const nodeX = node.x ?? 0;
        const nodeY = node.y ?? 0;
        const labelEdgeX = item.side === "right" ? item.left : item.left + item.width;
        const sourceX = nodeX + (item.side === "right" ? 1 : -1) * Math.max(3, node.radius * 0.8);
        const bendX = sourceX + (labelEdgeX - sourceX) * 0.38;
        const isPinned = node.id === hoveredNodeId || selectedIds.has(node.id);

        ctx.beginPath();
        ctx.moveTo(sourceX, nodeY);
        ctx.lineTo(bendX, item.y);
        ctx.lineTo(labelEdgeX, item.y);
        ctx.strokeStyle = isPinned ? "rgba(231,240,255,0.88)" : "rgba(148,166,190,0.45)";
        ctx.lineWidth = (isPinned ? 1.25 : 1) / currentZoom;
        ctx.stroke();

        drawRoundedRect(ctx, item.left, item.top, item.width, item.height, 7 / currentZoom);
        ctx.fillStyle = isPinned ? "rgba(8,14,22,0.93)" : "rgba(5,9,14,0.78)";
        ctx.fill();
        ctx.strokeStyle = isPinned ? "rgba(215,229,248,0.78)" : "rgba(171,191,214,0.46)";
        ctx.lineWidth = 1 / currentZoom;
        ctx.stroke();

        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(244,249,255,0.98)";
        ctx.fillText(item.text, item.left + worldPadX, item.top + item.height / 2);
        labelHitBoxes.push({
          nodeId: node.id,
          left: item.left,
          top: item.top,
          width: item.width,
          height: item.height,
        });
      }

      if (scene.centerId) {
        const center = nodes.find((node) => node.id === scene.centerId);
        if (center) {
          const x = center.x ?? 0;
          const y = center.y ?? 0;
          const density = clamp(nonCenterNodes.length / 48, 0, 1);
          const worldCenterMain = (28 - density * 9) / currentZoom;
          const worldCenterSub = (14 - density * 2.5) / currentZoom;
          const title = truncate(scene.centerPrimaryLabel || center.name, 28);

          ctx.textAlign = "center";
          ctx.font = `800 ${worldCenterMain}px "Space Grotesk", Inter, sans-serif`;
          const titleWidth = ctx.measureText(title).width;
          const titlePadX = 14 / currentZoom;
          const titlePadY = 8 / currentZoom;
          drawRoundedRect(
            ctx,
            x - titleWidth / 2 - titlePadX,
            y - worldCenterMain / 2 - titlePadY,
            titleWidth + titlePadX * 2,
            worldCenterMain + titlePadY * 2,
            10 / currentZoom,
          );
          ctx.fillStyle = "rgba(6,11,18,0.72)";
          ctx.fill();
          ctx.strokeStyle = "rgba(168,188,224,0.42)";
          ctx.lineWidth = 1 / currentZoom;
          ctx.stroke();

          ctx.fillStyle = "rgba(236,244,255,0.96)";
          ctx.fillText(title, x, y);

          const sub = truncate(scene.centerSecondaryLabel || (center.issuerName ?? ""), 40);
          if (sub) {
            ctx.font = `600 ${worldCenterSub}px "Space Grotesk", Inter, sans-serif`;
            ctx.fillStyle = "rgba(211,229,255,0.95)";
            ctx.fillText(sub, x, y + center.radius + 14 / currentZoom);
          }
        }
      }

      labelHitBoxesRef.current = labelHitBoxes;
      ctx.restore();
    };

    drawFrameRef.current = draw;
    simulation.on("tick", draw);
    const stopTimer = window.setTimeout(() => simulation.stop(), 2200);
    const fitTimer = window.setTimeout(() => fitToScene(80), 680);

    return () => {
      drawFrameRef.current = null;
      labelHitBoxesRef.current = [];
      window.clearTimeout(stopTimer);
      window.clearTimeout(fitTimer);
      simulation.stop();
    };
  }, [fitToScene, scene, selectedInvestorId, selectedIssuerId, size.height, size.width]);

  const screenToWorld = (event: ReactMouseEvent<HTMLCanvasElement, MouseEvent>): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const sx = event.clientX - rect.left - rect.width / 2;
    const sy = event.clientY - rect.top - rect.height / 2;
    const currentZoom = Math.max(0.001, zoomRef.current);
    return {
      x: sx / currentZoom,
      y: sy / currentZoom,
    };
  };

  const pickNode = (event: ReactMouseEvent<HTMLCanvasElement, MouseEvent>): GalaxyNode | null => {
    const point = screenToWorld(event);

    const labelBoxes = labelHitBoxesRef.current;
    for (let i = labelBoxes.length - 1; i >= 0; i -= 1) {
      const box = labelBoxes[i];
      if (
        point.x >= box.left &&
        point.x <= box.left + box.width &&
        point.y >= box.top &&
        point.y <= box.top + box.height
      ) {
        const byLabel = liveNodesRef.current.find((node) => node.id === box.nodeId) ?? null;
        if (byLabel) return byLabel;
      }
    }

    let best: GalaxyNode | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const node of liveNodesRef.current) {
      const dx = (node.x ?? 0) - point.x;
      const dy = (node.y ?? 0) - point.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= node.radius + 5 / Math.max(0.001, zoomRef.current) && dist < bestDist) {
        bestDist = dist;
        best = node;
      }
    }
    return best;
  };

  const pickLink = (event: ReactMouseEvent<HTMLCanvasElement, MouseEvent>): GalaxyLink | null => {
    const point = screenToWorld(event);
    let bestLink: GalaxyLink | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const link of liveLinksRef.current) {
      const source = link.source as GalaxyNode;
      const target = link.target as GalaxyNode;
      const x1 = source.x ?? 0;
      const y1 = source.y ?? 0;
      const x2 = target.x ?? 0;
      const y2 = target.y ?? 0;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const denom = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((point.x - x1) * dx + (point.y - y1) * dy) / denom));
      const projX = x1 + t * dx;
      const projY = y1 + t * dy;
      const dist = Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
      if (dist < bestDist) {
        bestDist = dist;
        bestLink = link;
      }
    }
    return bestDist <= 5 / Math.max(0.001, zoomRef.current) ? bestLink : null;
  };

  const showEmpty =
    scene.nodes.length === 0 || scene.links.length === 0 || size.width < MIN_SIZE || size.height < MIN_SIZE;
  const emptyReasonDetail = useMemo(() => {
    if (!showEmpty) return null;
    const parts: string[] = [];
    if (scene.stats.droppedByTopN > 0) parts.push(`Top-N drop ${scene.stats.droppedByTopN}`);
    if (scene.stats.droppedByMinPct > 0) parts.push(`Min% drop ${scene.stats.droppedByMinPct}`);
    if (scene.stats.droppedByTypeFilter > 0) parts.push(`Type drop ${scene.stats.droppedByTypeFilter}`);
    if (scene.stats.droppedByUnknownStatus > 0) parts.push(`Status drop ${scene.stats.droppedByUnknownStatus}`);
    if (scene.stats.droppedByInvalidPct > 0) parts.push(`Invalid % ${scene.stats.droppedByInvalidPct}`);
    return parts.length > 0 ? parts.join(" | ") : null;
  }, [scene.stats.droppedByInvalidPct, scene.stats.droppedByMinPct, scene.stats.droppedByTopN, scene.stats.droppedByTypeFilter, scene.stats.droppedByUnknownStatus, showEmpty]);

  return (
    <div
      ref={wrapperRef}
      className={`relative overflow-hidden border border-border bg-background/20 ${
        isFullscreen ? "fixed inset-0 z-[80] rounded-none" : "h-[440px] rounded-xl"
      }`}
    >
      {showEmpty ? (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted">
          <div>
            <div>{scene.emptyReason ?? "Tidak ada edge untuk filter ini. Coba turunkan Min% atau nyalakan Unknown."}</div>
            {emptyReasonDetail ? <div className="mt-2 text-xs text-warning">{emptyReasonDetail}</div> : null}
          </div>
        </div>
      ) : null}

      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-pointer"
        onMouseMove={(event) => {
          const node = pickNode(event);
          if (node?.id === hoveredNodeIdRef.current) return;
          if (hoverRafRef.current !== null) cancelAnimationFrame(hoverRafRef.current);
          hoverRafRef.current = requestAnimationFrame(() => {
            hoveredNodeIdRef.current = node?.id ?? null;
            drawFrameRef.current?.();
          });
        }}
        onMouseLeave={() => {
          hoveredNodeIdRef.current = null;
          drawFrameRef.current?.();
        }}
        onClick={(event) => {
          const node = pickNode(event);
          if (node) {
            if (node.kind === "investor") {
              onSelectInvestor(node.id);
              onSelectEdge(node.edgeId ?? null);
              return;
            }
            if (node.kind === "issuer") {
              onSelectIssuer?.(node.id);
              onSelectEdge(node.edgeId ?? null);
              return;
            }
          }
          const link = pickLink(event);
          if (link) onSelectEdge(link.edgeId ?? null);
        }}
        onWheel={(event) => {
          event.preventDefault();
          const delta = event.deltaY > 0 ? -0.08 : 0.08;
          setZoom((value) => Math.max(0.45, Math.min(2.6, value + delta)));
        }}
      />

      <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-border bg-panel/90 px-2.5 py-1.5 text-xs text-muted">
        {scene.centerKind === "investor" ? "Holdings" : "Holders"}: {scene.stats.holderCount.toLocaleString("id-ID")} | Nodes:{" "}
        {scene.stats.renderedHolderCount.toLocaleString("id-ID")} | Individu: {scene.stats.individualCount.toLocaleString("id-ID")}
      </div>

      <button
        type="button"
        onClick={() => setIsFullscreen((value) => !value)}
        className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md border border-border bg-panel/88 px-2 py-1 text-xs text-muted transition-colors duration-150 hover:text-foreground"
      >
        {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        {isFullscreen ? "Exit" : "Fullscreen"}
      </button>
    </div>
  );
}
