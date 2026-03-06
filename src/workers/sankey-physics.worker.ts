import {
  forceCollide,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from "d3-force";

type Zone = "top" | "right" | "left" | "bottom" | "center";
type FocusType = "issuer" | "investor";

type DisplayNode = {
  id: string;
  kind: FocusType;
  zone: Zone;
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

type PositionedNode = DisplayNode & {
  x: number;
  y: number;
};

type SimulationLayoutNode = SimulationNodeDatum & {
  id: string;
  isCenter: boolean;
  targetX: number;
  targetY: number;
  width: number;
  height: number;
  radius: number;
};

const MIN_WIDTH = 760;
const MIN_HEIGHT = 460;
const ZONES: Zone[] = ["top", "right", "left", "bottom"];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clusterTargets(
  zone: Zone,
  count: number,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
): Array<{ x: number; y: number }> {
  if (count <= 0) return [];

  const maxRadius = Math.min(width, height) * 0.35;
  const horizontalOffset = clamp(maxRadius * 0.9, 140, width * 0.34);
  const verticalOffset = clamp(maxRadius * 0.75, 110, height * 0.29);
  const clusterCenter =
    zone === "top"
      ? { x: centerX, y: centerY - verticalOffset }
      : zone === "right"
        ? { x: centerX + horizontalOffset, y: centerY }
        : zone === "left"
          ? { x: centerX - horizontalOffset, y: centerY }
          : { x: centerX, y: centerY + verticalOffset };

  const points: Array<{ x: number; y: number }> = [];
  const colGap = zone === "top" || zone === "bottom" ? 176 : 162;
  const rowGap = 58;

  if (zone === "left" || zone === "right") {
    const rows = Math.max(1, Math.ceil(Math.sqrt(count * 1.9)));
    const cols = Math.max(1, Math.ceil(count / rows));
    for (let index = 0; index < count; index += 1) {
      const row = index % rows;
      const col = Math.floor(index / rows);
      const x = clusterCenter.x + (col - (cols - 1) / 2) * colGap;
      const y = clusterCenter.y + (row - (rows - 1) / 2) * rowGap;
      points.push({ x, y });
    }
    return points;
  }

  const cols = Math.max(1, Math.ceil(Math.sqrt(count * 1.4)));
  const rows = Math.max(1, Math.ceil(count / cols));
  for (let index = 0; index < count; index += 1) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const x = clusterCenter.x + (col - (cols - 1) / 2) * colGap + ((row % 2) * colGap) / 6;
    const y = clusterCenter.y + (row - (rows - 1) / 2) * rowGap;
    points.push({ x, y });
  }
  return points;
}

self.onmessage = (event) => {
  if (event.data.type === "CALCULATE") {
    const { scene, width, height } = event.data;
    
    if (!scene.centerId || scene.nodes.length === 0) {
      self.postMessage({ type: "RESULT", nodes: [] });
      return;
    }

    const graphWidth = Math.max(width, MIN_WIDTH);
    const graphHeight = Math.max(height, MIN_HEIGHT);
    const centerX = graphWidth / 2;
    const centerY = graphHeight / 2;

    const targetById = new Map<string, { x: number; y: number }>();
    targetById.set(scene.centerId, { x: centerX, y: centerY });

    for (const zone of ZONES) {
      const zoneNodes = scene.nodes.filter((node: DisplayNode) => node.zone === zone);
      const targets = clusterTargets(zone, zoneNodes.length, centerX, centerY, graphWidth, graphHeight);
      zoneNodes.forEach((node: DisplayNode, index: number) => {
        targetById.set(node.id, targets[index] ?? { x: centerX, y: centerY });
      });
    }

    const simulationNodes: SimulationLayoutNode[] = scene.nodes.map((node: DisplayNode) => {
      const target = targetById.get(node.id) ?? { x: centerX, y: centerY };
      const radius = Math.sqrt(node.width * node.width + node.height * node.height) * 0.28 + 10;
      return {
        id: node.id,
        isCenter: node.id === scene.centerId,
        targetX: target.x,
        targetY: target.y,
        width: node.width,
        height: node.height,
        radius,
        x: target.x,
        y: target.y,
        vx: 0,
        vy: 0,
        fx: node.id === scene.centerId ? centerX : undefined,
        fy: node.id === scene.centerId ? centerY : undefined,
      };
    });

    const simulation = forceSimulation(simulationNodes)
      .alpha(1)
      .alphaDecay(0.06)
      .force("charge", forceManyBody<SimulationLayoutNode>().strength((node) => (node.isCenter ? -12 : -32)))
      .force("collision", forceCollide<SimulationLayoutNode>().radius((node) => node.radius).iterations(2))
      .force("x", forceX<SimulationLayoutNode>((node) => node.targetX).strength((node) => (node.isCenter ? 1 : 0.28)))
      .force("y", forceY<SimulationLayoutNode>((node) => node.targetY).strength((node) => (node.isCenter ? 1 : 0.28)))
      .stop();

    for (let tick = 0; tick < 150; tick += 1) {
      simulation.tick();
    }

    const byId = new Map<string, SimulationLayoutNode>();
    simulationNodes.forEach((node) => byId.set(node.id, node));

    const padding = 34;
    const positionedNodes = scene.nodes.map((node: DisplayNode) => {
      const simulated = byId.get(node.id);
      const rawX = simulated?.x ?? centerX;
      const rawY = simulated?.y ?? centerY;
      const x =
        node.id === scene.centerId
          ? centerX
          : clamp(rawX, padding + node.width / 2, graphWidth - padding - node.width / 2);
      const y =
        node.id === scene.centerId
          ? centerY
          : clamp(rawY, padding + node.height / 2, graphHeight - padding - node.height / 2);
      return { ...node, x, y };
    });

    self.postMessage({ type: "RESULT", nodes: positionedNodes });
  }
};
