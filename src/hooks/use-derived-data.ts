import { useMemo } from "react";
import {
  aggregateInvestors,
  aggregateIssuers,
  applyFilters,
  buildSearchIndices,
  topRowsByPercentage,
  type FilteredInvestor,
  type FilteredIssuer,
} from "../lib/filtering";
import { getInvestorId, getIssuerId } from "../lib/graph";
import { useAppStore } from "../store/app-store";
import type { OwnershipRow } from "../types/ownership";

type ContextFocusMeta =
  | {
      type: "issuer";
      issuerId: string;
      shareCode: string;
      issuerName: string;
    }
  | {
      type: "investor";
      investorId: string;
      investorName: string;
    }
  | null;

type ContextSummary = {
  rowCount: number;
  issuerCount: number;
  investorCount: number;
  localRows: number;
  foreignRows: number;
  unknownRows: number;
  totalShares: number;
  totalPercentage: number;
  localPercentage: number;
  foreignPercentage: number;
  unknownPercentage: number;
  localExposurePct: number;
  foreignExposurePct: number;
  unknownExposurePct: number;
  hhiScore: number;
  concentrationLabel: "Low" | "Moderate" | "High";
  dominantCounterpartyLabel: string | null;
  dominantCounterpartyPct: number;
  topConcentration: number;
  kongloCount: number;
  pepCount: number;
};

type DerivedData = {
  allRows: OwnershipRow[];
  filteredRows: OwnershipRow[];
  filteredIssuers: FilteredIssuer[];
  filteredInvestors: FilteredInvestor[];
  selectedIssuerRows: OwnershipRow[];
  selectedInvestorRows: OwnershipRow[];
  contextRows: OwnershipRow[];
  contextSummary: ContextSummary;
  contextFocusMeta: ContextFocusMeta;
  activeRows: OwnershipRow[];
  topRows: OwnershipRow[];
  investorTypes: string[];
  nationalities: string[];
  domiciles: string[];
};

function bucket(value: string | null | undefined): string {
  const normalized = (value ?? "").trim().toUpperCase();
  return normalized || "UNKNOWN";
}

export function useDerivedData(): DerivedData {
  const parsed = useAppStore((s) => s.parsed);
  const filters = useAppStore((s) => s.filters);
  const focus = useAppStore((s) => s.focus);
  const selection = useAppStore((s) => s.selection);
  const investorTagsById = useAppStore((s) => s.investorTagsById);

  const allRows = parsed?.rows ?? [];

  const searchIndices = useMemo(() => buildSearchIndices(allRows), [allRows]);

  const filteredRows = useMemo(
    () => applyFilters(allRows, filters, searchIndices, investorTagsById),
    [
      allRows,
      filters.domiciles,
      filters.foreignEnabled,
      filters.includeUnknownPercentage,
      filters.investorTypes,
      filters.localEnabled,
      filters.minPercentage,
      filters.nationalities,
      filters.queryMode,
      filters.queryText,
      filters.tagFilters,
      filters.unknownEnabled,
      investorTagsById,
      searchIndices,
    ],
  );

  const filteredIssuers = useMemo(() => aggregateIssuers(filteredRows), [filteredRows]);
  const filteredInvestors = useMemo(() => aggregateInvestors(filteredRows), [filteredRows]);

  const selectedIssuerRows = useMemo(
    () =>
      selection.selectedIssuerId
        ? filteredRows.filter((row) => getIssuerId(row) === selection.selectedIssuerId)
        : [],
    [filteredRows, selection.selectedIssuerId],
  );

  const selectedInvestorRows = useMemo(
    () =>
      selection.selectedInvestorId
        ? filteredRows.filter((row) => getInvestorId(row) === selection.selectedInvestorId)
        : [],
    [filteredRows, selection.selectedInvestorId],
  );

  const contextRows = useMemo(
    () =>
      focus.focusType === "issuer" && focus.focusIssuerId
        ? filteredRows.filter((row) => getIssuerId(row) === focus.focusIssuerId)
        : focus.focusType === "investor" && focus.focusInvestorId
          ? filteredRows.filter((row) => getInvestorId(row) === focus.focusInvestorId)
          : filteredRows,
    [filteredRows, focus.focusInvestorId, focus.focusIssuerId, focus.focusType],
  );

  const topRows = useMemo(() => topRowsByPercentage(contextRows, filters.topNEdges), [contextRows, filters.topNEdges]);

  const investorTypes = useMemo(
    () => Array.from(new Set(allRows.map((row) => bucket(row.investorType)))).sort(),
    [allRows],
  );
  const nationalities = useMemo(
    () => Array.from(new Set(allRows.map((row) => bucket(row.nationality)))).sort(),
    [allRows],
  );
  const domiciles = useMemo(
    () => Array.from(new Set(allRows.map((row) => bucket(row.domicile)))).sort(),
    [allRows],
  );

  const issuerMetaById = useMemo(() => {
    const map = new Map<string, { shareCode: string; issuerName: string }>();
    for (const row of allRows) {
      const issuerId = getIssuerId(row);
      if (!map.has(issuerId)) {
        map.set(issuerId, {
          shareCode: row.shareCode,
          issuerName: row.issuerName,
        });
      }
    }
    return map;
  }, [allRows]);

  const investorNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of allRows) {
      const investorId = getInvestorId(row);
      if (!map.has(investorId)) map.set(investorId, row.investorName);
    }
    return map;
  }, [allRows]);

  const contextSummary = useMemo<ContextSummary>(() => {
    const issuerSet = new Set<string>();
    const investorSet = new Set<string>();
    let localRows = 0;
    let foreignRows = 0;
    let unknownRows = 0;
    let totalShares = 0;
    let totalPercentage = 0;
    let localPercentage = 0;
    let foreignPercentage = 0;
    let unknownPercentage = 0;
    const kongloInvestorIds = new Set<string>();
    const pepInvestorIds = new Set<string>();
    const counterpartyPctMap = new Map<string, number>();

    for (const row of contextRows) {
      issuerSet.add(getIssuerId(row));
      const investorId = getInvestorId(row);
      investorSet.add(investorId);
      if (row.localForeign === "L") localRows += 1;
      else if (row.localForeign === "A") foreignRows += 1;
      else unknownRows += 1;
      totalShares += row.totalHoldingShares ?? 0;
      totalPercentage += row.percentage ?? 0;
      if (row.localForeign === "L") localPercentage += row.percentage ?? 0;
      else if (row.localForeign === "A") foreignPercentage += row.percentage ?? 0;
      else unknownPercentage += row.percentage ?? 0;

      const counterpartyId =
        focus.focusType === "investor" && focus.focusInvestorId ? getIssuerId(row) : getInvestorId(row);
      counterpartyPctMap.set(counterpartyId, (counterpartyPctMap.get(counterpartyId) ?? 0) + (row.percentage ?? 0));

      const tags = investorTagsById[investorId] ?? [];
      if (tags.includes("KONGLO")) kongloInvestorIds.add(investorId);
      if (tags.includes("PEP")) pepInvestorIds.add(investorId);
    }

    const topConcentration = [...contextRows]
      .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))
      .slice(0, 5)
      .reduce((sum, row) => sum + (row.percentage ?? 0), 0);

    const counterpartiesSorted = [...counterpartyPctMap.entries()].sort((a, b) => b[1] - a[1]);
    const dominantCounterparty = counterpartiesSorted[0] ?? null;
    const hhiScore =
      totalPercentage > 0
        ? counterpartiesSorted.reduce((sum, [, pct]) => {
            const share = pct / totalPercentage;
            return sum + share * share;
          }, 0) * 10000
        : 0;
    const concentrationLabel: ContextSummary["concentrationLabel"] =
      hhiScore >= 2500 ? "High" : hhiScore >= 1500 ? "Moderate" : "Low";

    const dominantCounterpartyLabel =
      dominantCounterparty === null
        ? null
        : focus.focusType === "investor" && focus.focusInvestorId
          ? (issuerMetaById.get(dominantCounterparty[0])?.shareCode ?? dominantCounterparty[0].replace(/^issuer:/, ""))
          : (investorNameById.get(dominantCounterparty[0]) ?? dominantCounterparty[0].replace(/^investor:/, ""));

    return {
      rowCount: contextRows.length,
      issuerCount: issuerSet.size,
      investorCount: investorSet.size,
      localRows,
      foreignRows,
      unknownRows,
      totalShares,
      totalPercentage,
      localPercentage,
      foreignPercentage,
      unknownPercentage,
      localExposurePct: totalPercentage > 0 ? (localPercentage / totalPercentage) * 100 : 0,
      foreignExposurePct: totalPercentage > 0 ? (foreignPercentage / totalPercentage) * 100 : 0,
      unknownExposurePct: totalPercentage > 0 ? (unknownPercentage / totalPercentage) * 100 : 0,
      hhiScore,
      concentrationLabel,
      dominantCounterpartyLabel,
      dominantCounterpartyPct: dominantCounterparty?.[1] ?? 0,
      topConcentration,
      kongloCount: kongloInvestorIds.size,
      pepCount: pepInvestorIds.size,
    };
  }, [contextRows, focus.focusInvestorId, focus.focusType, investorNameById, investorTagsById, issuerMetaById]);

  const contextFocusMeta = useMemo<ContextFocusMeta>(() => {
    if (focus.focusType === "issuer" && focus.focusIssuerId) {
      const meta = issuerMetaById.get(focus.focusIssuerId);
      if (!meta) return null;
      return {
        type: "issuer",
        issuerId: focus.focusIssuerId,
        shareCode: meta.shareCode,
        issuerName: meta.issuerName,
      };
    }
    if (focus.focusType === "investor" && focus.focusInvestorId) {
      const investorName = investorNameById.get(focus.focusInvestorId);
      if (!investorName) return null;
      return {
        type: "investor",
        investorId: focus.focusInvestorId,
        investorName,
      };
    }
    return null;
  }, [focus.focusInvestorId, focus.focusIssuerId, focus.focusType, investorNameById, issuerMetaById]);

  return {
    allRows,
    filteredRows,
    filteredIssuers,
    filteredInvestors,
    selectedIssuerRows,
    selectedInvestorRows,
    contextRows,
    contextSummary,
    contextFocusMeta,
    activeRows: contextRows,
    topRows,
    investorTypes,
    nationalities,
    domiciles,
  };
}
