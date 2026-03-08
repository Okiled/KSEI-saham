import { useMemo } from "react";
import { useDerivedData } from "./use-derived-data";
import {
  buildCoInvestorOverlapView,
  buildInvestorPortfolioView,
  buildIssuerOwnershipView,
  buildOwnershipSnapshotMeta,
  buildOwnershipTimelineView,
  buildUniverseIssuerItems,
  latestSnapshotDate,
  mapConnectedInvestors,
} from "../lib/ownership-analytics";
import type {
  CoInvestorOverlapView,
  InvestorPortfolioPosition,
  IssuerOwnershipSummary,
  OwnershipRow,
  OwnershipSnapshotMeta,
  OwnershipTimelineView,
} from "../types/ownership";

type UseOwnershipViewsArgs = {
  selectedIssuerId?: string | null;
  selectedInvestorId?: string | null;
  snapshotDate?: string | null;
  topOverlapHolders?: number;
};

type UseOwnershipViewsResult = {
  snapshotMeta: OwnershipSnapshotMeta[];
  snapshotDate: string | null;
  snapshotRows: OwnershipRow[];
  universeItems: ReturnType<typeof buildUniverseIssuerItems>;
  issuerOwnership: IssuerOwnershipSummary | null;
  investorPortfolio: InvestorPortfolioPosition[];
  timelineView: OwnershipTimelineView | null;
  overlapView: CoInvestorOverlapView | null;
  connectedInvestors: ReturnType<typeof mapConnectedInvestors>;
  allRows: ReturnType<typeof useDerivedData>["allRows"];
  filteredRows: ReturnType<typeof useDerivedData>["filteredRows"];
};

export function useOwnershipViews({
  selectedIssuerId = null,
  selectedInvestorId = null,
  snapshotDate: forcedSnapshotDate = null,
  topOverlapHolders = 12,
}: UseOwnershipViewsArgs = {}): UseOwnershipViewsResult {
  const { allRows, filteredRows } = useDerivedData();

  const snapshotMeta = useMemo(() => buildOwnershipSnapshotMeta(allRows), [allRows]);

  const snapshotDate = useMemo(() => {
    if (forcedSnapshotDate) return forcedSnapshotDate;
    return latestSnapshotDate(allRows);
  }, [allRows, forcedSnapshotDate]);

  const snapshotRows = useMemo(
    () => (snapshotDate ? allRows.filter((row) => row.date === snapshotDate) : allRows),
    [allRows, snapshotDate],
  );

  const universeItems = useMemo(
    () => buildUniverseIssuerItems(filteredRows, snapshotDate),
    [filteredRows, snapshotDate],
  );

  const issuerOwnership = useMemo(
    () => (selectedIssuerId ? buildIssuerOwnershipView(allRows, selectedIssuerId, snapshotDate) : null),
    [allRows, selectedIssuerId, snapshotDate],
  );

  const investorPortfolio = useMemo(
    () => (selectedInvestorId ? buildInvestorPortfolioView(allRows, selectedInvestorId, snapshotDate) : []),
    [allRows, selectedInvestorId, snapshotDate],
  );

  const timelineView = useMemo(
    () =>
      selectedIssuerId
        ? buildOwnershipTimelineView(
            allRows,
            selectedIssuerId,
            issuerOwnership?.holders.slice(0, 6).map((holder) => holder.investorId) ?? [],
          )
        : null,
    [allRows, issuerOwnership?.holders, selectedIssuerId],
  );

  const overlapView = useMemo(
    () =>
      selectedIssuerId ? buildCoInvestorOverlapView(allRows, selectedIssuerId, snapshotDate, topOverlapHolders) : null,
    [allRows, selectedIssuerId, snapshotDate, topOverlapHolders],
  );

  const connectedInvestors = useMemo(
    () => (selectedInvestorId ? mapConnectedInvestors(allRows, selectedInvestorId, snapshotDate, 10) : []),
    [allRows, selectedInvestorId, snapshotDate],
  );

  return {
    snapshotMeta,
    snapshotDate,
    snapshotRows,
    universeItems,
    issuerOwnership,
    investorPortfolio,
    timelineView,
    overlapView,
    connectedInvestors,
    allRows,
    filteredRows,
  };
}
