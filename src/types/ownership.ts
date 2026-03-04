export type LocalForeign = "L" | "A" | null;

export type OwnershipEvidence = {
  pageIndex: number;
  yTopNorm: number;
  yBottomNorm: number;
  rawRowText: string;
};

export type OwnershipRow = {
  id: string;
  date: string;
  shareCode: string;
  issuerName: string;
  investorName: string;
  investorType: string | null;
  localForeign: LocalForeign;
  nationality: string | null;
  domicile: string | null;
  holdingsScripless: number | null;
  holdingsScrip: number | null;
  totalHoldingShares: number | null;
  percentage: number | null;
  evidence: OwnershipEvidence;
};

export type ParseInvalidRow = {
  pageIndex: number;
  rawText: string;
  reason: string;
  yTopNorm?: number;
  yBottomNorm?: number;
};

export type ParseCoverageMapping = {
  groupId: string;
  mappedToRowId: string | null;
  yTopNorm: number;
};

export type ParseCoverageMissSample = {
  groupId: string;
  yTopNorm: number;
  rawText: string;
};

export type ParseCoverageInvalidSample = {
  reason: string;
  rawText: string;
};

export type ParseCoveragePage = {
  pageIndex: number;
  candidateCount: number;
  mappedCount: number;
  missCount: number;
  invalidCriticalCount?: number;
  missSamples: ParseCoverageMissSample[];
  invalidSamples?: ParseCoverageInvalidSample[];
  columnBands: Array<{
    key: string;
    left: number;
    center: number;
    right: number;
  }>;
  mappings?: ParseCoverageMapping[];
};

export type ParseReport = {
  pageCount: number;
  detectedTablePages: number[];
  validRows: number;
  invalidRows: number;
  invalidSamples: ParseInvalidRow[];
  tableCoverage?: ParseCoveragePage[];
};

export type ParsedStats = {
  rowCount: number;
  issuerCount: number;
  investorCount: number;
  pageCount: number;
  tablePageCount?: number;
  completenessMissPages?: number;
  completenessMissRows?: number;
  sanityInvalidPages?: number;
  sanityInvalidRows?: number;
  coveragePass?: boolean;
};

export type GraphNodeKind = "issuer" | "investor";

export type GraphNode = {
  id: string;
  label: string;
  kind: GraphNodeKind;
  shareCode?: string;
  localForeign?: LocalForeign;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  percentage: number | null;
  shares: number | null;
  date: string;
  evidenceRef: OwnershipEvidence;
  investorType: string | null;
  localForeign: LocalForeign;
};

export type OwnershipGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type ParsedOwnership = {
  rows: OwnershipRow[];
  graph: OwnershipGraph;
  report: ParseReport;
  stats?: ParsedStats;
};
