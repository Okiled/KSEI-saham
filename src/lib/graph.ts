import type { GraphEdge, GraphNode, OwnershipGraph, OwnershipRow } from "../types/ownership";
import { getInvestorCanonicalIdFromName, normalizeInvestorDisplayName } from "./investor-identity";

function issuerNodeId(row: OwnershipRow): string {
  const code = row.shareCode || row.issuerName;
  return `issuer:${code.toUpperCase()}`;
}

function investorNodeId(row: OwnershipRow): string {
  return getInvestorCanonicalIdFromName(row.investorName);
}

export function buildOwnershipGraph(rows: OwnershipRow[]): OwnershipGraph {
  const nodeMap = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  rows.forEach((row, index) => {
    const issuerId = issuerNodeId(row);
    const investorId = investorNodeId(row);

    if (!nodeMap.has(issuerId)) {
      nodeMap.set(issuerId, {
        id: issuerId,
        label: row.issuerName || row.shareCode,
        kind: "issuer",
        shareCode: row.shareCode,
      });
    }

    if (!nodeMap.has(investorId)) {
      nodeMap.set(investorId, {
        id: investorId,
        label: normalizeInvestorDisplayName(row.investorName),
        kind: "investor",
        localForeign: row.localForeign,
      });
    }

    edges.push({
      id: `edge:${index}`,
      source: issuerId,
      target: investorId,
      percentage: row.percentage,
      shares: row.totalHoldingShares,
      date: row.date,
      evidenceRef: row.evidence,
      investorType: row.investorType,
      localForeign: row.localForeign,
    });
  });

  return { nodes: [...nodeMap.values()], edges };
}

export function getIssuerId(row: OwnershipRow): string {
  return issuerNodeId(row);
}

export function getInvestorId(row: OwnershipRow): string {
  return investorNodeId(row);
}
