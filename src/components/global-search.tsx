import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, FileText, Search, Users, X } from "lucide-react";
import { fmtPercent } from "../lib/utils";
import { getInvestorId, getIssuerId } from "../lib/graph";
import type { OwnershipRow } from "../types/ownership";

type SearchResultItem = {
  type: "investor" | "emiten" | "local";
  label: string;
  meta: string;
  path?: string;
  scrollToId?: string;
};

type GlobalSearchProps = {
  allRows: OwnershipRow[];
  currentPage: "emiten" | "investor" | "browse";
  currentId?: string;
  onNavigate: (path: string) => void;
};

type SearchResults = {
  investors: SearchResultItem[];
  emitens: SearchResultItem[];
  contextual: SearchResultItem[];
};

function truncate(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}...`;
}

export function GlobalSearch({ allRows, currentPage, currentId, onNavigate }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 140);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const investorIndex = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const row of allRows) {
      const id = getInvestorId(row);
      const existing = map.get(id);
      if (existing) existing.count += 1;
      else map.set(id, { id, name: row.investorName, count: 1 });
    }
    return [...map.values()];
  }, [allRows]);

  const emitenIndex = useMemo(() => {
    const map = new Map<string, { issuerId: string; shareCode: string; issuerName: string; holderCount: number }>();
    for (const row of allRows) {
      const id = getIssuerId(row);
      const existing = map.get(id);
      if (existing) existing.holderCount += 1;
      else {
        map.set(id, {
          issuerId: id,
          shareCode: row.shareCode,
          issuerName: row.issuerName,
          holderCount: 1,
        });
      }
    }
    return [...map.values()];
  }, [allRows]);

  const results: SearchResults | null = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q || q.length < 2) return null;

    const investors = investorIndex
      .filter((item) => item.name.toLowerCase().includes(q))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((item) => ({
        type: "investor" as const,
        label: item.name,
        meta: `${item.count} emiten`,
        path: `/investor/${encodeURIComponent(item.id)}`,
      }));

    const emitens = emitenIndex
      .filter((item) => item.shareCode.toLowerCase().includes(q) || item.issuerName.toLowerCase().includes(q))
      .sort((a, b) => b.holderCount - a.holderCount)
      .slice(0, 5)
      .map((item) => ({
        type: "emiten" as const,
        label: item.shareCode,
        meta: `${truncate(item.issuerName, 28)} • ${item.holderCount} holders`,
        path: `/emiten/${encodeURIComponent(item.shareCode)}`,
      }));

    let contextual: SearchResultItem[] = [];
    if (currentPage === "emiten" && currentId) {
      contextual = allRows
        .filter((row) => row.shareCode === currentId && row.investorName.toLowerCase().includes(q))
        .slice(0, 4)
        .map((row) => ({
          type: "local",
          label: row.investorName,
          meta: `${fmtPercent(row.percentage)} di ${row.shareCode}`,
          scrollToId: `holder-${encodeURIComponent(getInvestorId(row))}`,
        }));
    } else if (currentPage === "investor" && currentId) {
      contextual = allRows
        .filter(
          (row) =>
            getInvestorId(row) === currentId &&
            (row.shareCode.toLowerCase().includes(q) || row.issuerName.toLowerCase().includes(q)),
        )
        .slice(0, 4)
        .map((row) => ({
          type: "local",
          label: row.shareCode,
          meta: truncate(row.issuerName, 28),
          path: `/emiten/${encodeURIComponent(row.shareCode)}`,
        }));
    }

    return { investors, emitens, contextual };
  }, [allRows, currentId, currentPage, debouncedQuery, emitenIndex, investorIndex]);

  const flatResults = useMemo(() => {
    if (!results) return [];
    return [...results.investors, ...results.emitens, ...results.contextual];
  }, [results]);

  const totalResults = flatResults.length;

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = useCallback(
    (item: SearchResultItem) => {
      if (item.scrollToId) {
        const el = document.getElementById(item.scrollToId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("!bg-[#EDF4F1]", "!border-l-[#1D4C45]");
          setTimeout(() => el.classList.remove("!bg-[#EDF4F1]", "!border-l-[#1D4C45]"), 1800);
        }
      } else if (item.path) {
        onNavigate(item.path);
      }
      setQuery("");
      setIsOpen(false);
    },
    [onNavigate],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIdx((prev) => (prev < totalResults - 1 ? prev + 1 : 0));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIdx((prev) => (prev > 0 ? prev - 1 : totalResults - 1));
        return;
      }
      if (event.key === "Enter" && activeIdx >= 0 && activeIdx < totalResults) {
        event.preventDefault();
        handleSelect(flatResults[activeIdx]);
      }
    },
    [activeIdx, flatResults, handleSelect, totalResults],
  );

  const contextLabel =
    currentPage === "emiten"
      ? "HOLDER DI EMITEN INI"
      : currentPage === "investor"
        ? "EMITEN DI PORTOFOLIO"
        : null;

  const hasResults =
    results &&
    (results.investors.length > 0 || results.emitens.length > 0 || results.contextual.length > 0);

  let flatIndex = 0;

  return (
    <div ref={containerRef} className="relative w-full" style={{ zIndex: 50 }}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7A6E63]" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
            setActiveIdx(-1);
          }}
          onFocus={() => {
            if (query.length >= 2) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Cari ticker, emiten, atau investor..."
          className="editorial-input h-11 w-full pl-10 pr-9 text-sm outline-none"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7A6E63] transition-colors hover:text-[#1C1713]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {isOpen && hasResults ? (
        <div className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-[22px] border border-[#D8CDBF] bg-[#FFFBF5] shadow-[0_28px_60px_rgba(95,73,47,0.16)]">
          {results.investors.length > 0 ? (
            <div>
              <div className="flex items-center gap-1.5 border-b border-[#E6DCCE] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#7A6E63]">
                <Users className="h-3 w-3" />
                Investor
              </div>
              {results.investors.map((item) => {
                const idx = flatIndex++;
                return (
                  <button
                    key={`inv:${item.label}`}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors"
                    style={{ backgroundColor: activeIdx === idx ? "#F0E7DB" : "#FFFBF5" }}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#1D4C45]" />
                      <span className="text-[#1C1713]">{truncate(item.label, 38)}</span>
                    </div>
                    <span className="font-mono text-[11px] text-[#7A6E63]">{item.meta}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {results.emitens.length > 0 ? (
            <div>
              <div className="flex items-center gap-1.5 border-b border-t border-[#E6DCCE] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#7A6E63]">
                <Building2 className="h-3 w-3" />
                Emiten
              </div>
              {results.emitens.map((item) => {
                const idx = flatIndex++;
                return (
                  <button
                    key={`emt:${item.label}`}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors"
                    style={{ backgroundColor: activeIdx === idx ? "#F0E7DB" : "#FFFBF5" }}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-[#1D4C45]">{item.label}</span>
                      <span className="text-xs text-[#7A6E63]">{item.meta}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}

          {results.contextual.length > 0 && contextLabel ? (
            <div>
              <div className="flex items-center gap-1.5 border-b border-t border-[#E6DCCE] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#7A6E63]">
                <FileText className="h-3 w-3" />
                {contextLabel}
              </div>
              {results.contextual.map((item) => {
                const idx = flatIndex++;
                return (
                  <button
                    key={`ctx:${item.label}`}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors"
                    style={{ backgroundColor: activeIdx === idx ? "#F0E7DB" : "#FFFBF5" }}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    <span className="text-[#1C1713]">{truncate(item.label, 35)}</span>
                    <span className="font-mono text-[11px] text-[#7A6E63]">{item.meta}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
