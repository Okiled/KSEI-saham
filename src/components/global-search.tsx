import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Users, Building2, FileText, X } from "lucide-react";
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

function truncate(s: string, max: number) {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

export function GlobalSearch({ allRows, currentPage, currentId, onNavigate }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce the query
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Pre-build investor index (memoized)
  const investorIndex = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const row of allRows) {
      const id = getInvestorId(row);
      const existing = map.get(id);
      if (existing) existing.count++;
      else map.set(id, { id, name: row.investorName, count: 1 });
    }
    return [...map.values()];
  }, [allRows]);

  // Pre-build emiten index (memoized)
  const emitenIndex = useMemo(() => {
    const map = new Map<string, { issuerId: string; shareCode: string; issuerName: string; holderCount: number }>();
    for (const row of allRows) {
      const id = getIssuerId(row);
      const existing = map.get(id);
      if (existing) existing.holderCount++;
      else map.set(id, { issuerId: id, shareCode: row.shareCode, issuerName: row.issuerName, holderCount: 1 });
    }
    return [...map.values()];
  }, [allRows]);

  // Search results
  const results: SearchResults | null = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q || q.length < 2) return null;

    const investors: SearchResultItem[] = investorIndex
      .filter((inv) => inv.name.toLowerCase().includes(q))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((inv) => ({
        type: "investor",
        label: inv.name,
        meta: `${inv.count} emiten`,
        path: `/investor/${encodeURIComponent(inv.id)}`,
      }));

    const emitens: SearchResultItem[] = emitenIndex
      .filter((e) => e.shareCode.toLowerCase().includes(q) || e.issuerName.toLowerCase().includes(q))
      .sort((a, b) => b.holderCount - a.holderCount)
      .slice(0, 5)
      .map((e) => ({
        type: "emiten",
        label: e.shareCode,
        meta: `${truncate(e.issuerName, 30)}  ${e.holderCount} holders`,
        path: `/emiten/${encodeURIComponent(e.shareCode)}`,
      }));

    let contextual: SearchResultItem[] = [];
    if (currentPage === "emiten" && currentId) {
      contextual = allRows
        .filter(
          (r) => r.shareCode === currentId && r.investorName.toLowerCase().includes(q),
        )
        .slice(0, 4)
        .map((r) => ({
          type: "local",
          label: r.investorName,
          meta: `${fmtPercent(r.percentage)} di ${r.shareCode}`,
          scrollToId: `holder-${encodeURIComponent(getInvestorId(r))}`,
        }));
    } else if (currentPage === "investor" && currentId) {
      contextual = allRows
        .filter(
          (r) =>
            getInvestorId(r) === currentId &&
            (r.shareCode.toLowerCase().includes(q) || r.issuerName.toLowerCase().includes(q)),
        )
        .slice(0, 4)
        .map((r) => ({
          type: "local",
          label: r.shareCode,
          meta: truncate(r.issuerName, 28),
          path: `/emiten/${encodeURIComponent(r.shareCode)}`,
        }));
    }

    return { investors, emitens, contextual };
  }, [debouncedQuery, investorIndex, emitenIndex, allRows, currentPage, currentId]);

  // Flatten results for keyboard navigation
  const flatResults = useMemo(() => {
    if (!results) return [];
    return [...results.investors, ...results.emitens, ...results.contextual];
  }, [results]);

  const totalResults = flatResults.length;

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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
          el.classList.add("!bg-teal/10", "!border-l-teal/60");
          setTimeout(() => el.classList.remove("!bg-teal/10", "!border-l-teal/60"), 2000);
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
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((prev) => (prev < totalResults - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((prev) => (prev > 0 ? prev - 1 : totalResults - 1));
        return;
      }
      if (e.key === "Enter" && activeIdx >= 0 && activeIdx < totalResults) {
        e.preventDefault();
        handleSelect(flatResults[activeIdx]);
      }
    },
    [activeIdx, totalResults, flatResults, handleSelect],
  );

  const contextLabel =
    currentPage === "emiten"
      ? "HOLDER DI EMITEN INI"
      : currentPage === "investor"
        ? "EMITEN DI PORTOFOLIO"
        : null;

  const hasResults = results && (results.investors.length > 0 || results.emitens.length > 0 || results.contextual.length > 0);

  let flatIndex = 0;

  return (
    <div ref={containerRef} className="relative w-full" style={{ zIndex: 50 }}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setActiveIdx(-1);
          }}
          onFocus={() => { if (query.length >= 2) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Cari ticker, emiten, atau investor..."
          className="h-10 w-full rounded-xl border border-border bg-panel pl-10 pr-9 text-sm text-foreground outline-none transition-colors focus:border-teal/50"
          style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 13 }}
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setIsOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isOpen && hasResults && (
        <div
          className="absolute left-0 right-0 top-full mt-1 overflow-hidden rounded-xl bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
          style={{ border: "1.5px solid rgba(0,0,0,0.1)", borderRadius: 12 }}
        >
          {/* Investor results */}
          {results.investors.length > 0 && (
            <div>
              <div
                className="flex items-center gap-1.5 border-b border-border/40 px-3.5 py-2"
                style={{ fontFamily: "DM Mono, monospace", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", color: "#8a8580" }}
              >
                <Users className="h-3 w-3" />
                INVESTOR
              </div>
              {results.investors.map((item) => {
                const idx = flatIndex++;
                return (
                  <button
                    key={`inv:${item.label}`}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="flex w-full items-center justify-between px-3.5 py-2.5 text-left transition-colors"
                    style={{ backgroundColor: activeIdx === idx ? "#f4f1ec" : "white", fontSize: 13 }}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-teal" />
                      <span className="text-foreground">{truncate(item.label, 40)}</span>
                    </div>
                    <span style={{ fontFamily: "DM Mono, monospace", fontSize: 11, color: "#8a8580" }}>{item.meta}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Emiten results */}
          {results.emitens.length > 0 && (
            <div>
              <div
                className="flex items-center gap-1.5 border-b border-t border-border/40 px-3.5 py-2"
                style={{ fontFamily: "DM Mono, monospace", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", color: "#8a8580" }}
              >
                <Building2 className="h-3 w-3" />
                EMITEN
              </div>
              {results.emitens.map((item) => {
                const idx = flatIndex++;
                return (
                  <button
                    key={`emt:${item.label}`}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="flex w-full items-center justify-between px-3.5 py-2.5 text-left transition-colors"
                    style={{ backgroundColor: activeIdx === idx ? "#f4f1ec" : "white", fontSize: 13 }}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ fontFamily: "DM Mono, monospace", fontWeight: 600, color: "#0a8c6e" }}>{item.label}</span>
                      <span className="text-muted" style={{ fontSize: 12 }}>{item.meta}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Contextual results */}
          {results.contextual.length > 0 && contextLabel && (
            <div>
              <div
                className="flex items-center gap-1.5 border-b border-t border-border/40 px-3.5 py-2"
                style={{ fontFamily: "DM Mono, monospace", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", color: "#8a8580" }}
              >
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
                    className="flex w-full items-center justify-between px-3.5 py-2.5 text-left transition-colors"
                    style={{ backgroundColor: activeIdx === idx ? "#f4f1ec" : "white", fontSize: 13 }}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    <span className="text-foreground">{truncate(item.label, 35)}</span>
                    <span style={{ fontFamily: "DM Mono, monospace", fontSize: 11, color: "#8a8580" }}>{item.meta}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
