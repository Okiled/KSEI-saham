import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import * as Collapsible from "@radix-ui/react-collapsible";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Search } from "lucide-react";
import { CommandPalette } from "../components/command-palette";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Progress } from "../components/ui/progress";
import { Slider } from "../components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useDatasetLoader } from "../hooks/use-dataset-loader";
import { useDerivedData } from "../hooks/use-derived-data";
import { getInvestorId, getIssuerId } from "../lib/graph";
import { scoreInvestorRelevance, scoreIssuerRelevance } from "../lib/filtering";
import { fmtNumber, fmtPercent } from "../lib/utils";
import { useAppStore } from "../store/app-store";
import type { InvestorTag } from "../store/app-store";

type IssuerSummary = {
  issuerId: string;
  shareCode: string;
  issuerName: string;
  holderCount: number;
  maxPercentage: number;
  totalShares: number;
  localPercentage: number;
  foreignPercentage: number;
  unknownPercentage: number;
};

type InvestorSummary = {
  investorId: string;
  investorName: string;
  investorType: string;
  originLabel: string;
  originTone: "local" | "foreign" | "mixed" | "unknown";
  isIndividual: boolean;
  tags: InvestorTag[];
  holdingsCount: number;
  maxPercentage: number;
  totalShares: number;
  nationality: string;
  domicile: string;
};

type KongloIssuerSummary = IssuerSummary & {
  taggedInvestorIds: string[];
  taggedInvestorNames: string[];
  matchedTags: string[];
};

type IssuerSortBy = "ticker" | "holder-count" | "dominant-pct" | "total-shares";

type VirtualListProps<T> = {
  items: T[];
  estimateSize?: number;
  emptyText: string;
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  onEnterItem?: (item: T) => void;
};

function VirtualList<T>({
  items,
  estimateSize = 78,
  emptyText,
  getKey,
  renderItem,
  onEnterItem,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 12,
  });

  useEffect(() => {
    setFocusedIndex((value) => Math.max(0, Math.min(items.length - 1, value)));
  }, [items.length]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (items.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = Math.min(items.length - 1, focusedIndex + 1);
      setFocusedIndex(next);
      rowVirtualizer.scrollToIndex(next, { align: "auto" });
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      const next = Math.max(0, focusedIndex - 1);
      setFocusedIndex(next);
      rowVirtualizer.scrollToIndex(next, { align: "auto" });
      return;
    }
    if (event.key === "Enter" && onEnterItem) {
      event.preventDefault();
      const item = items[focusedIndex];
      if (item) onEnterItem(item);
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex h-[520px] items-center justify-center rounded-xl border border-border bg-background/25 px-6 text-center text-sm text-muted">
        {emptyText}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="h-[520px] overflow-auto rounded-xl border border-border bg-background/25 outline-none focus-visible:ring-2 focus-visible:ring-focus/50"
    >
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          return (
            <div
              key={getKey(item)}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {renderItem(item)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function highlightMatch(text: string, query: string): ReactNode {
  const source = text.toLowerCase();
  const needle = query.trim().toLowerCase();
  if (!needle) return text;
  const index = source.indexOf(needle);
  if (index < 0) return text;

  const before = text.slice(0, index);
  const match = text.slice(index, index + needle.length);
  const after = text.slice(index + needle.length);
  return (
    <>
      {before}
      <span className="rounded bg-focus/25 px-0.5 text-foreground">{match}</span>
      {after}
    </>
  );
}

function toIssuerSort<T extends IssuerSummary>(items: T[], sortBy: IssuerSortBy): T[] {
  const sorted = [...items];
  if (sortBy === "ticker") {
    sorted.sort((a, b) => a.shareCode.localeCompare(b.shareCode));
    return sorted;
  }
  if (sortBy === "holder-count") {
    sorted.sort((a, b) => b.holderCount - a.holderCount || b.maxPercentage - a.maxPercentage);
    return sorted;
  }
  if (sortBy === "dominant-pct") {
    sorted.sort((a, b) => b.maxPercentage - a.maxPercentage || b.totalShares - a.totalShares);
    return sorted;
  }
  sorted.sort((a, b) => b.totalShares - a.totalShares || b.maxPercentage - a.maxPercentage);
  return sorted;
}

type InvestorStatusCode = "L" | "A" | "U";

function normalizeInvestorType(value: string | null | undefined): string {
  const normalized = (value ?? "").trim().toUpperCase();
  return normalized || "UNKNOWN";
}

function isIndividualInvestorType(investorType: string): boolean {
  return investorType.includes("INDIV") || investorType === "ID" || investorType === "I";
}

function toInvestorStatusCode(value: "L" | "A" | null): InvestorStatusCode {
  if (value === "L") return "L";
  if (value === "A") return "A";
  return "U";
}

function summarizeInvestorOrigin(statusSet: Set<InvestorStatusCode>): {
  label: string;
  tone: InvestorSummary["originTone"];
} {
  const hasL = statusSet.has("L");
  const hasA = statusSet.has("A");
  if (hasL && hasA) return { label: "MIXED", tone: "mixed" };
  if (hasL) return { label: "LOKAL", tone: "local" };
  if (hasA) return { label: "ASING", tone: "foreign" };
  return { label: "UNKNOWN", tone: "unknown" };
}

function isSameSet<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

function toggleStringSet(source: Set<string>, value: string): Set<string> {
  const next = new Set(source);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function summarizeSelectedValues(selected: Set<string>, options: string[]): string {
  if (selected.size === 0) return "Semua";
  const ordered = options.filter((value) => selected.has(value));
  const shown = ordered.slice(0, 3);
  const extra = ordered.length - shown.length;
  if (extra > 0) return `${shown.join(", ")} +${extra}`;
  return shown.join(", ");
}

export function HomePage() {
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const filters = useAppStore((s) => s.filters);
  const updateFilters = useAppStore((s) => s.updateFilters);
  const updateSelection = useAppStore((s) => s.updateSelection);
  const setFocusIssuer = useAppStore((s) => s.setFocusIssuer);
  const setFocusInvestor = useAppStore((s) => s.setFocusInvestor);
  const resetFilters = useAppStore((s) => s.resetFilters);
  const parseProgress = useAppStore((s) => s.parseProgress);
  const parseStatus = useAppStore((s) => s.parseStatus);
  const parseError = useAppStore((s) => s.parseError);
  const investorTagsById = useAppStore((s) => s.investorTagsById);

  const {
    selectedDataset,
    loadState,
    loadError,
    activeStats,
  } = useDatasetLoader();

  const { allRows, filteredRows, investorTypes, nationalities, domiciles } = useDerivedData();

  const [queryDraft, setQueryDraft] = useState(filters.queryText);
  const [issuerSortBy, setIssuerSortBy] = useState<IssuerSortBy>("holder-count");
  const [activeTab, setActiveTab] = useState<"emiten" | "investor" | "konglo">("emiten");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [kongloTags, setKongloTags] = useState<Set<"KONGLO" | "PEP">>(new Set(["KONGLO", "PEP"]));

  useEffect(() => {
    setQueryDraft(filters.queryText);
  }, [filters.queryText]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (queryDraft !== filters.queryText) {
        updateFilters({ queryText: queryDraft });
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [filters.queryText, queryDraft, updateFilters]);

  const globalStats = useMemo(() => {
    const issuerIds = new Set<string>();
    const investorStatus = new Map<string, "L" | "A" | "U">();
    for (const row of allRows) {
      issuerIds.add(getIssuerId(row));
      const investorId = getInvestorId(row);
      if (investorStatus.has(investorId)) continue;
      if (row.localForeign === "L") investorStatus.set(investorId, "L");
      else if (row.localForeign === "A") investorStatus.set(investorId, "A");
      else investorStatus.set(investorId, "U");
    }

    let local = 0;
    let foreign = 0;
    let unknown = 0;
    for (const status of investorStatus.values()) {
      if (status === "L") local += 1;
      else if (status === "A") foreign += 1;
      else unknown += 1;
    }

    return {
      issuerCount: issuerIds.size,
      investorCount: investorStatus.size,
      local,
      foreign,
      unknown,
    };
  }, [allRows]);

  const issuerSummaries = useMemo<IssuerSummary[]>(() => {
    const map = new Map<
      string,
      IssuerSummary & {
        holderIds: Set<string>;
      }
    >();

    for (const row of filteredRows) {
      const issuerId = getIssuerId(row);
      if (!map.has(issuerId)) {
        map.set(issuerId, {
          issuerId,
          shareCode: row.shareCode,
          issuerName: row.issuerName,
          holderCount: 0,
          maxPercentage: 0,
          totalShares: 0,
          localPercentage: 0,
          foreignPercentage: 0,
          unknownPercentage: 0,
          holderIds: new Set<string>(),
        });
      }

      const item = map.get(issuerId);
      if (!item) continue;
      const pct = row.percentage ?? 0;
      item.totalShares += row.totalHoldingShares ?? 0;
      item.maxPercentage = Math.max(item.maxPercentage, pct);
      item.holderIds.add(getInvestorId(row));
      if (row.localForeign === "L") item.localPercentage += pct;
      else if (row.localForeign === "A") item.foreignPercentage += pct;
      else item.unknownPercentage += pct;
    }

    return toIssuerSort(
      [...map.values()].map((item) => ({
        issuerId: item.issuerId,
        shareCode: item.shareCode,
        issuerName: item.issuerName,
        holderCount: item.holderIds.size,
        maxPercentage: item.maxPercentage,
        totalShares: item.totalShares,
        localPercentage: item.localPercentage,
        foreignPercentage: item.foreignPercentage,
        unknownPercentage: item.unknownPercentage,
      })),
      issuerSortBy,
    );
  }, [filteredRows, issuerSortBy]);

  const investorSummaries = useMemo<InvestorSummary[]>(() => {
    const map = new Map<
      string,
      InvestorSummary & {
        issuerIds: Set<string>;
        statusSet: Set<InvestorStatusCode>;
        tagSet: Set<InvestorTag>;
      }
    >();

    for (const row of filteredRows) {
      const investorId = getInvestorId(row);
      const investorType = normalizeInvestorType(row.investorType);
      if (!map.has(investorId)) {
        map.set(investorId, {
          investorId,
          investorName: row.investorName,
          investorType,
          originLabel: "UNKNOWN",
          originTone: "unknown",
          isIndividual: isIndividualInvestorType(investorType),
          tags: [],
          holdingsCount: 0,
          maxPercentage: 0,
          totalShares: 0,
          nationality: (row.nationality ?? "UNKNOWN").trim().toUpperCase() || "UNKNOWN",
          domicile: (row.domicile ?? "UNKNOWN").trim().toUpperCase() || "UNKNOWN",
          issuerIds: new Set<string>(),
          statusSet: new Set<InvestorStatusCode>(),
          tagSet: new Set<InvestorTag>(),
        });
      }

      const item = map.get(investorId);
      if (!item) continue;
      const pct = row.percentage ?? 0;
      item.totalShares += row.totalHoldingShares ?? 0;
      item.maxPercentage = Math.max(item.maxPercentage, pct);
      item.issuerIds.add(getIssuerId(row));
      item.statusSet.add(toInvestorStatusCode(row.localForeign));
      const tags = investorTagsById[investorId] ?? [];
      for (const tag of tags) item.tagSet.add(tag);
    }

    return [...map.values()]
      .map((item) => {
        const origin = summarizeInvestorOrigin(item.statusSet);
        return {
          investorId: item.investorId,
          investorName: item.investorName,
          investorType: item.investorType,
          originLabel: origin.label,
          originTone: origin.tone,
          isIndividual: item.isIndividual,
          tags: [...item.tagSet].sort(),
          holdingsCount: item.issuerIds.size,
          maxPercentage: item.maxPercentage,
          totalShares: item.totalShares,
          nationality: item.nationality,
          domicile: item.domicile,
        };
      })
      .sort((a, b) => b.holdingsCount - a.holdingsCount || b.maxPercentage - a.maxPercentage || a.investorName.localeCompare(b.investorName));
  }, [filteredRows, investorTagsById]);

  const individualInvestorTypes = useMemo(
    () => new Set(investorTypes.filter((type) => isIndividualInvestorType(type))),
    [investorTypes],
  );
  const institutionInvestorTypes = useMemo(
    () => new Set(investorTypes.filter((type) => !isIndividualInvestorType(type))),
    [investorTypes],
  );
  const peroranganPresetActive = isSameSet(filters.investorTypes, individualInvestorTypes);
  const institusiPresetActive = isSameSet(filters.investorTypes, institutionInvestorTypes);

  const applyInvestorTypePreset = (preset: "all" | "individual" | "institution") => {
    if (preset === "all") {
      updateFilters({ investorTypes: new Set<string>() });
      return;
    }
    if (preset === "individual") {
      updateFilters({ investorTypes: new Set(individualInvestorTypes) });
      return;
    }
    updateFilters({ investorTypes: new Set(institutionInvestorTypes) });
  };

  const kongloIssuerSummaries = useMemo<KongloIssuerSummary[]>(() => {
    const activeTags = kongloTags.size === 0 ? new Set<"KONGLO" | "PEP">(["KONGLO", "PEP"]) : kongloTags;
    const map = new Map<
      string,
      KongloIssuerSummary & {
        taggedInvestorIdSet: Set<string>;
        tagSet: Set<string>;
      }
    >();

    for (const row of filteredRows) {
      const investorId = getInvestorId(row);
      const tags = investorTagsById[investorId] ?? [];
      if (tags.length === 0) continue;

      const matchedTags = tags.filter((tag) => activeTags.has(tag));
      if (matchedTags.length === 0) continue;

      const issuerId = getIssuerId(row);
      if (!map.has(issuerId)) {
        map.set(issuerId, {
          issuerId,
          shareCode: row.shareCode,
          issuerName: row.issuerName,
          holderCount: 0,
          maxPercentage: 0,
          totalShares: 0,
          localPercentage: 0,
          foreignPercentage: 0,
          unknownPercentage: 0,
          taggedInvestorIds: [],
          taggedInvestorNames: [],
          matchedTags: [],
          taggedInvestorIdSet: new Set<string>(),
          tagSet: new Set<string>(),
        });
      }

      const item = map.get(issuerId);
      if (!item) continue;
      const pct = row.percentage ?? 0;
      item.maxPercentage = Math.max(item.maxPercentage, pct);
      item.totalShares += row.totalHoldingShares ?? 0;
      if (row.localForeign === "L") item.localPercentage += pct;
      else if (row.localForeign === "A") item.foreignPercentage += pct;
      else item.unknownPercentage += pct;
      item.taggedInvestorIdSet.add(investorId);
      if (!item.taggedInvestorNames.includes(row.investorName)) item.taggedInvestorNames.push(row.investorName);
      for (const tag of matchedTags) item.tagSet.add(tag);
    }

    return toIssuerSort(
      [...map.values()].map((item) => ({
        issuerId: item.issuerId,
        shareCode: item.shareCode,
        issuerName: item.issuerName,
        holderCount: item.taggedInvestorIdSet.size,
        maxPercentage: item.maxPercentage,
        totalShares: item.totalShares,
        localPercentage: item.localPercentage,
        foreignPercentage: item.foreignPercentage,
        unknownPercentage: item.unknownPercentage,
        taggedInvestorIds: [...item.taggedInvestorIdSet],
        taggedInvestorNames: item.taggedInvestorNames,
        matchedTags: [...item.tagSet],
      })),
      issuerSortBy,
    );
  }, [filteredRows, investorTagsById, issuerSortBy, kongloTags]);

  const rankedIssuerSummaries = useMemo(() => {
    const query = filters.queryText.trim();
    if (!query) return issuerSummaries;
    return [...issuerSummaries].sort((a, b) => {
      const scoreA = scoreIssuerRelevance(query, a.shareCode, a.issuerName);
      const scoreB = scoreIssuerRelevance(query, b.shareCode, b.issuerName);
      return scoreB - scoreA || b.maxPercentage - a.maxPercentage || b.totalShares - a.totalShares;
    });
  }, [filters.queryText, issuerSummaries]);

  const rankedInvestorSummaries = useMemo(() => {
    const query = filters.queryText.trim();
    if (!query) return investorSummaries;
    return [...investorSummaries].sort((a, b) => {
      const scoreA = scoreInvestorRelevance(query, a.investorName, a.investorType, a.nationality, a.domicile);
      const scoreB = scoreInvestorRelevance(query, b.investorName, b.investorType, b.nationality, b.domicile);
      return scoreB - scoreA || b.maxPercentage - a.maxPercentage || b.totalShares - a.totalShares;
    });
  }, [filters.queryText, investorSummaries]);

  const rankedKongloIssuerSummaries = useMemo(() => {
    const query = filters.queryText.trim();
    if (!query) return kongloIssuerSummaries;
    return [...kongloIssuerSummaries].sort((a, b) => {
      const scoreA = scoreIssuerRelevance(query, a.shareCode, a.issuerName);
      const scoreB = scoreIssuerRelevance(query, b.shareCode, b.issuerName);
      return scoreB - scoreA || b.maxPercentage - a.maxPercentage || b.totalShares - a.totalShares;
    });
  }, [filters.queryText, kongloIssuerSummaries]);

  const resultIssuerCount = rankedIssuerSummaries.length;
  const resultInvestorCount = rankedInvestorSummaries.length;
  const coveragePass = activeStats?.coveragePass ?? selectedDataset?.coveragePass ?? true;
  const showSkeleton = loadState === "loading-index" || loadState === "loading-dataset" || parseStatus === "parsing";
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.queryMode !== "all") count += 1;
    if (filters.minPercentage > 0) count += 1;
    if (!filters.localEnabled || !filters.foreignEnabled || !filters.unknownEnabled) count += 1;
    if (filters.includeUnknownPercentage) count += 1;
    if (filters.investorTypes.size > 0) count += 1;
    if (filters.nationalities.size > 0) count += 1;
    if (filters.domiciles.size > 0) count += 1;
    return count;
  }, [
    filters.queryMode,
    filters.minPercentage,
    filters.localEnabled,
    filters.foreignEnabled,
    filters.unknownEnabled,
    filters.includeUnknownPercentage,
    filters.investorTypes.size,
    filters.nationalities.size,
    filters.domiciles.size,
  ]);

  return (
    <main className="min-h-screen bg-nebula py-5">
      <CommandPalette />

      <div className="w-full space-y-4 px-0">
        <div className="sticky top-2 z-20 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border/70 bg-panel/75 px-4 py-4 backdrop-blur">
          <div>
            <h1 className="text-balance-soft text-[32px] font-semibold tracking-tight text-foreground md:text-[38px]">
              Financial Intelligence Design
            </h1>
            <p className="mt-1 text-[15px] text-muted">
              Browse emiten dan investor, lalu klik untuk masuk detail visual intelligence.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2" />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted">Total Emiten</div>
              <div className="mt-1 text-2xl font-semibold text-foreground">
                {(activeStats?.issuerCount ?? globalStats.issuerCount).toLocaleString("id-ID")}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted">Total Pemegang Saham</div>
              <div className="mt-1 text-2xl font-semibold text-foreground">
                {(activeStats?.investorCount ?? globalStats.investorCount).toLocaleString("id-ID")}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted">Asing</div>
              <div className="mt-1 text-2xl font-semibold text-foreign">
                {globalStats.foreign.toLocaleString("id-ID")}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted">Lokal</div>
              <div className="mt-1 text-2xl font-semibold text-local">{globalStats.local.toLocaleString("id-ID")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted">Tidak Terklasifikasi</div>
              <div className="mt-1 text-2xl font-semibold text-foreground">
                {globalStats.unknown.toLocaleString("id-ID")}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/70 bg-gradient-to-r from-panel-2/65 to-panel/25">
            <div>
              <CardTitle>Discovery Controls</CardTitle>
              <p className="mt-1 text-xs text-muted">Mode expert: quick filters di depan, detail filter saat dibutuhkan.</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={activeFilterCount > 0 ? "warning" : "neutral"} className="px-2.5 py-1 text-[11px] tracking-wide">
                {activeFilterCount} FILTER AKTIF
              </Badge>
              <Button size="sm" variant="ghost" onClick={() => resetFilters()}>
                Reset
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid items-end gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-muted">Global Search</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <Input
                    value={queryDraft}
                    onChange={(event) => setQueryDraft(event.target.value)}
                    placeholder="Cari kode saham, emiten, atau pemegang saham..."
                    className="h-12 pl-10 text-[15px]"
                  />
                </div>
              </div>
              <div className="rounded-xl border border-border/80 bg-panel/45 p-1.5">
                <div className="grid grid-cols-3 gap-1">
                  <Button
                    size="sm"
                    variant={filters.queryMode === "issuer" ? "secondary" : "ghost"}
                    className="h-8"
                    onClick={() => updateFilters({ queryMode: "issuer" })}
                  >
                    Emiten
                  </Button>
                  <Button
                    size="sm"
                    variant={filters.queryMode === "investor" ? "secondary" : "ghost"}
                    className="h-8"
                    onClick={() => updateFilters({ queryMode: "investor" })}
                  >
                    Investor
                  </Button>
                  <Button
                    size="sm"
                    variant={filters.queryMode === "all" ? "secondary" : "ghost"}
                    className="h-8"
                    onClick={() => updateFilters({ queryMode: "all" })}
                  >
                    Semua
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral" className="font-mono text-[11px] uppercase tracking-wide">
                Rows {filteredRows.length.toLocaleString("id-ID")}
              </Badge>
              <Badge variant="neutral" className="font-mono text-[11px] uppercase tracking-wide">
                Emiten {resultIssuerCount.toLocaleString("id-ID")}
              </Badge>
              <Badge variant="neutral" className="font-mono text-[11px] uppercase tracking-wide">
                Investor {resultInvestorCount.toLocaleString("id-ID")}
              </Badge>
            </div>

            <div className="space-y-3 rounded-xl border border-border/80 bg-background/20 p-3">
              <div>
                <div className="mb-2 text-[11px] uppercase tracking-wide text-muted">Quick Filters</div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={filters.localEnabled ? "secondary" : "outline"}
                    onClick={() => updateFilters({ localEnabled: !filters.localEnabled })}
                  >
                    Lokal
                  </Button>
                  <Button
                    size="sm"
                    variant={filters.foreignEnabled ? "secondary" : "outline"}
                    onClick={() => updateFilters({ foreignEnabled: !filters.foreignEnabled })}
                  >
                    Asing
                  </Button>
                  <Button
                    size="sm"
                    variant={filters.unknownEnabled ? "secondary" : "outline"}
                    onClick={() => updateFilters({ unknownEnabled: !filters.unknownEnabled })}
                  >
                    Unknown
                  </Button>
                  <Button
                    size="sm"
                    variant={filters.includeUnknownPercentage ? "secondary" : "outline"}
                    onClick={() => updateFilters({ includeUnknownPercentage: !filters.includeUnknownPercentage })}
                  >
                    Include Unknown %
                  </Button>
                </div>
              </div>

              <Collapsible.Root open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <Collapsible.Trigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-panel px-2.5 py-1.5 text-xs text-muted hover:text-foreground"
                  >
                    Detail Filters
                    <ChevronDown className={`h-3.5 w-3.5 transition ${advancedOpen ? "rotate-180" : ""}`} />
                  </button>
                </Collapsible.Trigger>
                <Collapsible.Content className="mt-3 space-y-3">
                  <div className="rounded-lg border border-border/75 bg-background/20 p-3">
                    <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-muted">
                      <span>Min % Holding</span>
                      <span className="font-mono text-foreground">{filters.minPercentage.toFixed(2)}%</span>
                    </div>
                    <Slider
                      min={0}
                      max={100}
                      step={0.1}
                      value={[filters.minPercentage]}
                      onValueChange={(value) => updateFilters({ minPercentage: value[0] ?? 0 })}
                    />
                  </div>

                  <div className="rounded-lg border border-border/75 bg-background/20 p-3">
                    <div className="mb-2 text-xs uppercase tracking-wide text-muted">Investor Type</div>
                    <div className="mb-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={peroranganPresetActive ? "secondary" : "outline"}
                        onClick={() => applyInvestorTypePreset("individual")}
                        disabled={individualInvestorTypes.size === 0}
                      >
                        Perorangan
                      </Button>
                      <Button
                        size="sm"
                        variant={institusiPresetActive ? "secondary" : "outline"}
                        onClick={() => applyInvestorTypePreset("institution")}
                        disabled={institutionInvestorTypes.size === 0}
                      >
                        Institusi
                      </Button>
                      <Button
                        size="sm"
                        variant={filters.investorTypes.size === 0 ? "secondary" : "outline"}
                        onClick={() => applyInvestorTypePreset("all")}
                      >
                        Semua Tipe
                      </Button>
                    </div>
                    <div className="rounded-lg border border-border bg-background/30 p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value=""
                          onChange={(event) => {
                            const value = event.target.value;
                            if (!value) return;
                            updateFilters({ investorTypes: toggleStringSet(filters.investorTypes, value) });
                          }}
                          className="h-9 min-w-[260px] rounded-md border border-border bg-panel px-2.5 text-xs text-foreground outline-none"
                        >
                          <option value="">Pilih tipe investor...</option>
                          {investorTypes.map((type) => {
                            const label = isIndividualInvestorType(type) ? `${type} (Perorangan)` : type;
                            const prefix = filters.investorTypes.has(type) ? "[x] " : "";
                            return (
                              <option key={type} value={type}>
                                {prefix}
                                {label}
                              </option>
                            );
                          })}
                        </select>
                        <Button size="sm" variant="outline" onClick={() => updateFilters({ investorTypes: new Set<string>() })}>
                          Clear
                        </Button>
                      </div>
                      <div className="mt-2 text-xs text-muted">
                        Aktif: {summarizeSelectedValues(filters.investorTypes, investorTypes)}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-border/75 bg-background/20 p-3">
                      <div className="mb-1.5 text-xs uppercase tracking-wide text-muted">Nationality</div>
                      <div className="rounded-lg border border-border bg-background/30 p-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value=""
                            onChange={(event) => {
                              const value = event.target.value;
                              if (!value) return;
                              updateFilters({ nationalities: toggleStringSet(filters.nationalities, value) });
                            }}
                            className="h-9 min-w-[240px] rounded-md border border-border bg-panel px-2.5 text-xs text-foreground outline-none"
                          >
                            <option value="">Pilih nationality...</option>
                            {nationalities.map((value) => {
                              const prefix = filters.nationalities.has(value) ? "[x] " : "";
                              return (
                                <option key={value} value={value}>
                                  {prefix}
                                  {value}
                                </option>
                              );
                            })}
                          </select>
                          <Button size="sm" variant="outline" onClick={() => updateFilters({ nationalities: new Set<string>() })}>
                            Clear
                          </Button>
                        </div>
                        <div className="mt-2 text-xs text-muted">
                          Aktif: {summarizeSelectedValues(filters.nationalities, nationalities)}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/75 bg-background/20 p-3">
                      <div className="mb-1.5 text-xs uppercase tracking-wide text-muted">Domicile</div>
                      <div className="rounded-lg border border-border bg-background/30 p-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value=""
                            onChange={(event) => {
                              const value = event.target.value;
                              if (!value) return;
                              updateFilters({ domiciles: toggleStringSet(filters.domiciles, value) });
                            }}
                            className="h-9 min-w-[240px] rounded-md border border-border bg-panel px-2.5 text-xs text-foreground outline-none"
                          >
                            <option value="">Pilih domicile...</option>
                            {domiciles.map((value) => {
                              const prefix = filters.domiciles.has(value) ? "[x] " : "";
                              return (
                                <option key={value} value={value}>
                                  {prefix}
                                  {value}
                                </option>
                              );
                            })}
                          </select>
                          <Button size="sm" variant="outline" onClick={() => updateFilters({ domiciles: new Set<string>() })}>
                            Clear
                          </Button>
                        </div>
                        <div className="mt-2 text-xs text-muted">
                          Aktif: {summarizeSelectedValues(filters.domiciles, domiciles)}
                        </div>
                      </div>
                    </div>
                  </div>
                </Collapsible.Content>
              </Collapsible.Root>
            </div>
          </CardContent>
        </Card>

        {showSkeleton ? (
          <div className="rounded-xl border border-border bg-panel/70 p-4">
            <div className="mb-2 flex items-center justify-between text-sm text-muted">
              <span>Menyiapkan dataset...</span>
              <span>{parseProgress}%</span>
            </div>
            <Progress value={parseProgress} className="h-2.5" />
          </div>
        ) : null}

        {loadState === "error" ? (
          <Card className="border-danger/35 bg-danger/12">
            <CardContent className="py-4 text-sm text-danger">
              <div className="mb-1 font-medium">{loadError ?? parseError ?? "Gagal memuat dataset"}</div>
              <p>Dataset belum siap atau gate coverage gagal. Coba reload dataset atau cek file sumber.</p>
            </CardContent>
          </Card>
        ) : null}

        {!coveragePass && loadState === "ready" ? (
          <Card className="border-danger/35 bg-danger/12">
            <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm text-danger">
              <span>DATA INCOMPLETE. Coverage gate gagal, hasil analisis tidak boleh dianggap final.</span>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Browse Universe</CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted">
                <span>Sort</span>
                <select
                  className="h-9 rounded-md border border-border bg-panel px-2.5 text-sm text-foreground"
                  value={issuerSortBy}
                  onChange={(event) => setIssuerSortBy(event.target.value as IssuerSortBy)}
                >
                  <option value="ticker">Ticker</option>
                  <option value="holder-count">Holder Count</option>
                  <option value="dominant-pct">Dominant Holder %</option>
                  <option value="total-shares">Total Shares</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "emiten" | "investor" | "konglo")}>
              <TabsList>
                <TabsTrigger value="emiten">Ringkasan Saham</TabsTrigger>
                <TabsTrigger value="investor">Per Investor</TabsTrigger>
                <TabsTrigger value="konglo">Konglo Stocks</TabsTrigger>
              </TabsList>

              <TabsContent value="emiten" className="mt-4">
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <VirtualList
                    items={rankedIssuerSummaries}
                    getKey={(item) => item.issuerId}
                    emptyText="Tidak ada emiten untuk kombinasi filter ini."
                    onEnterItem={(issuer) => {
                      setFocusIssuer(issuer.issuerId);
                      navigate(`/emiten/${encodeURIComponent(issuer.shareCode.toUpperCase())}`);
                    }}
                    renderItem={(issuer) => {
                      const splitTotal =
                        issuer.localPercentage + issuer.foreignPercentage + issuer.unknownPercentage;
                      const localWidth = splitTotal > 0 ? (issuer.localPercentage / splitTotal) * 100 : 0;
                      const foreignWidth = splitTotal > 0 ? (issuer.foreignPercentage / splitTotal) * 100 : 0;
                      const unknownWidth = Math.max(0, 100 - localWidth - foreignWidth);
                      return (
                        <button
                          type="button"
                          className="grid h-full w-full grid-cols-[1fr_auto] items-center gap-4 border-b border-border/60 px-4 text-left transition-colors duration-150 hover:bg-panel-2/45"
                          onClick={() => {
                            setFocusIssuer(issuer.issuerId);
                            updateSelection({
                              selectedIssuerId: issuer.issuerId,
                              selectedInvestorId: null,
                              selectedEdgeId: null,
                            });
                            navigate(`/emiten/${encodeURIComponent(issuer.shareCode.toUpperCase())}`);
                          }}
                        >
                          <div className="min-w-0">
                            <div className="text-base font-semibold text-foreground">
                              {highlightMatch(issuer.shareCode, queryDraft)}
                            </div>
                            <div className="truncate text-sm text-muted" title={issuer.issuerName}>
                              {highlightMatch(issuer.issuerName, queryDraft)}
                            </div>
                            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                              <div className="flex h-full">
                                <div className="bg-local" style={{ width: `${localWidth}%` }} />
                                <div className="bg-foreign" style={{ width: `${foreignWidth}%` }} />
                                <div className="bg-unknown" style={{ width: `${unknownWidth}%` }} />
                              </div>
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <div className="text-muted">Holders</div>
                            <div className="font-mono text-foreground">{issuer.holderCount.toLocaleString("id-ID")}</div>
                            <div className="mt-1 text-muted">Max %</div>
                            <div className="font-mono text-foreground">{fmtPercent(issuer.maxPercentage)}</div>
                          </div>
                        </button>
                      );
                    }}
                  />
                </motion.div>
              </TabsContent>

              <TabsContent value="investor" className="mt-4">
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <VirtualList
                    items={rankedInvestorSummaries}
                    getKey={(item) => item.investorId}
                    emptyText="Tidak ada investor untuk kombinasi filter ini."
                    onEnterItem={(investor) => {
                      setFocusInvestor(investor.investorId);
                      navigate(`/investor/${encodeURIComponent(investor.investorId)}`);
                    }}
                    renderItem={(investor) => (
                      <button
                        type="button"
                        className="grid h-full w-full grid-cols-[1fr_auto] items-center gap-4 border-b border-border/60 px-4 text-left transition-colors duration-150 hover:bg-panel-2/45"
                        onClick={() => {
                          setFocusInvestor(investor.investorId);
                          updateSelection({
                            selectedInvestorId: investor.investorId,
                            selectedIssuerId: null,
                            selectedEdgeId: null,
                          });
                          navigate(`/investor/${encodeURIComponent(investor.investorId)}`);
                        }}
                      >
                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <div className="text-base font-semibold text-foreground">
                              {highlightMatch(investor.investorName, queryDraft)}
                            </div>
                            <Badge
                              className={
                                investor.originTone === "foreign"
                                  ? "border border-foreign/70 bg-foreign/15 px-2.5 py-1 text-[11px] font-semibold text-foreign"
                                  : investor.originTone === "local"
                                    ? "border border-local/70 bg-local/15 px-2.5 py-1 text-[11px] font-semibold text-local"
                                    : investor.originTone === "mixed"
                                      ? "border border-warning/70 bg-warning/15 px-2.5 py-1 text-[11px] font-semibold text-warning"
                                      : "border border-border/75 bg-panel-2 px-2.5 py-1 text-[11px] font-semibold text-muted"
                              }
                            >
                              {investor.originLabel}
                            </Badge>
                            <Badge className="border border-border/75 bg-panel-2 px-2.5 py-1 text-[11px] font-semibold text-foreground">
                              {investor.isIndividual ? "PERORANGAN" : "INSTITUSI"}
                            </Badge>
                            <Badge className="border border-border/75 bg-panel-2 px-2.5 py-1 text-[11px] font-semibold text-muted">
                              NAT {investor.nationality}
                            </Badge>
                            {investor.tags.map((tag) => (
                              <Badge
                                key={`${investor.investorId}-${tag}`}
                                className={
                                  tag === "KONGLO"
                                    ? "border border-warning/70 bg-warning/15 px-2.5 py-1 text-[11px] font-semibold text-warning"
                                    : "border border-danger/70 bg-danger/15 px-2.5 py-1 text-[11px] font-semibold text-danger"
                                }
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          <div className="truncate text-sm text-muted">
                            {investor.investorType} | {investor.nationality} | {investor.domicile}
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-muted">Emiten</div>
                          <div className="font-mono text-foreground">{investor.holdingsCount.toLocaleString("id-ID")}</div>
                          <div className="mt-1 text-muted">Max %</div>
                          <div className="font-mono text-foreground">{fmtPercent(investor.maxPercentage)}</div>
                        </div>
                      </button>
                    )}
                  />
                </motion.div>
              </TabsContent>

              <TabsContent value="konglo" className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={kongloTags.has("KONGLO") ? "secondary" : "outline"}
                    onClick={() => {
                      const next = new Set(kongloTags);
                      if (next.has("KONGLO")) next.delete("KONGLO");
                      else next.add("KONGLO");
                      setKongloTags(next);
                    }}
                  >
                    KONGLO
                  </Button>
                  <Button
                    size="sm"
                    variant={kongloTags.has("PEP") ? "secondary" : "outline"}
                    onClick={() => {
                      const next = new Set(kongloTags);
                      if (next.has("PEP")) next.delete("PEP");
                      else next.add("PEP");
                      setKongloTags(next);
                    }}
                  >
                    PEP
                  </Button>
                </div>

                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <VirtualList
                    items={rankedKongloIssuerSummaries}
                    getKey={(item) => item.issuerId}
                    emptyText="Belum ada emiten dengan investor bertag KONGLO/PEP pada filter saat ini."
                    onEnterItem={(issuer) => {
                      setFocusIssuer(issuer.issuerId);
                      navigate(`/emiten/${encodeURIComponent(issuer.shareCode.toUpperCase())}`);
                    }}
                    renderItem={(issuer) => (
                      <button
                        type="button"
                        className="grid h-full w-full grid-cols-[1fr_auto] items-center gap-4 border-b border-border/60 px-4 text-left transition-colors duration-150 hover:bg-panel-2/45"
                        onClick={() => {
                          const firstTagged = issuer.taggedInvestorIds[0];
                          setFocusIssuer(issuer.issuerId);
                          updateSelection({
                            selectedIssuerId: issuer.issuerId,
                            selectedInvestorId: firstTagged ?? null,
                            selectedEdgeId: null,
                          });
                          const query = firstTagged ? `?highlightInvestor=${encodeURIComponent(firstTagged)}` : "";
                          navigate(`/emiten/${encodeURIComponent(issuer.shareCode.toUpperCase())}${query}`);
                        }}
                      >
                        <div className="min-w-0">
                          <div className="text-base font-semibold text-foreground">{issuer.shareCode}</div>
                          <div className="truncate text-sm text-muted" title={issuer.issuerName}>
                            {issuer.issuerName}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {issuer.matchedTags.map((tag) => (
                              <Badge key={`${issuer.issuerId}-${tag}`} className="border-warning/45 bg-warning/14 text-warning">
                                {tag}
                              </Badge>
                            ))}
                            {issuer.taggedInvestorNames.slice(0, 2).map((name) => (
                              <Badge key={`${issuer.issuerId}-${name}`} className="border-border bg-panel-2 text-muted">
                                {name}
                              </Badge>
                            ))}
                            {issuer.taggedInvestorNames.length > 2 ? (
                              <Badge className="border-border bg-panel-2 text-muted">
                                +{issuer.taggedInvestorNames.length - 2} lainnya
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-muted">Tagged Investors</div>
                          <div className="font-mono text-foreground">
                            {issuer.taggedInvestorIds.length.toLocaleString("id-ID")}
                          </div>
                          <div className="mt-1 text-muted">Shares</div>
                          <div className="font-mono text-foreground">{fmtNumber(issuer.totalShares)}</div>
                        </div>
                      </button>
                    )}
                  />
                </motion.div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}



