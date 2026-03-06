import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import Fuse from "fuse.js";
import { Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { getInvestorId, getIssuerId } from "../lib/graph";
import { formatInvestorType } from "../lib/utils";
import { useAppStore } from "../store/app-store";
import type { InvestorTag } from "../store/app-store";
import type { OwnershipRow } from "../types/ownership";

type InvestorStatusCode = "L" | "A" | "U";

type CommandEntry = {
  id: string;
  label: string;
  type: "issuer" | "investor";
  targetId: string;
  subtitle: string;
  badges: string[];
  badgeText: string;
};

const EMPTY_ROWS: OwnershipRow[] = [];

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

function summarizeInvestorOrigin(statusSet: Set<InvestorStatusCode>): string {
  const hasL = statusSet.has("L");
  const hasA = statusSet.has("A");
  if (hasL && hasA) return "MIXED";
  if (hasL) return "LOKAL";
  if (hasA) return "ASING";
  return "UNKNOWN";
}

function paletteBadgeClass(label: string): string {
  if (label === "KONGLO") return "border-warning/45 bg-warning/14 text-warning";
  if (label === "PEP") return "border-danger/45 bg-danger/14 text-danger";
  if (label.startsWith("ASING")) return "border-foreign/45 bg-foreign/14 text-foreign";
  if (label.startsWith("LOKAL")) return "border-local/45 bg-local/14 text-local";
  if (label.startsWith("MIXED")) return "border-warning/45 bg-warning/14 text-warning";
  if (label === "PERORANGAN") return "border-focus/45 bg-focus/14 text-focus";
  return "border-border bg-panel-2 text-muted";
}

export function CommandPalette() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const updateSelection = useAppStore((s) => s.updateSelection);
  const setFocusIssuer = useAppStore((s) => s.setFocusIssuer);
  const setFocusInvestor = useAppStore((s) => s.setFocusInvestor);
  const investorTagsById = useAppStore((s) => s.investorTagsById);
  const parsed = useAppStore((s) => s.parsed);
  const allRows = parsed?.rows ?? EMPTY_ROWS;

  const entries = useMemo<CommandEntry[]>(() => {
    const issuerMap = new Map<string, CommandEntry>();
    const investorMap = new Map<
      string,
      {
        id: string;
        label: string;
        type: "investor";
        targetId: string;
        investorType: string;
        nationality: string;
        domicile: string;
        statusSet: Set<InvestorStatusCode>;
        tagSet: Set<InvestorTag>;
        isIndividual: boolean;
      }
    >();

    for (const row of allRows) {
      const issuerId = getIssuerId(row);
      const investorId = getInvestorId(row);
      if (!issuerMap.has(issuerId)) {
        issuerMap.set(issuerId, {
          id: issuerId,
          label: row.shareCode,
          type: "issuer",
          targetId: issuerId,
          subtitle: row.issuerName,
          badges: [],
          badgeText: "",
        });
      }
      if (!investorMap.has(investorId)) {
        const investorType = normalizeInvestorType(row.investorType);
        investorMap.set(investorId, {
          id: investorId,
          label: row.investorName,
          type: "investor",
          targetId: investorId,
          investorType,
          nationality: (row.nationality ?? "UNKNOWN").trim().toUpperCase() || "UNKNOWN",
          domicile: (row.domicile ?? "UNKNOWN").trim().toUpperCase() || "UNKNOWN",
          statusSet: new Set<InvestorStatusCode>(),
          tagSet: new Set<InvestorTag>(),
          isIndividual: isIndividualInvestorType(investorType),
        });
      }
      const item = investorMap.get(investorId);
      if (!item) continue;
      item.statusSet.add(toInvestorStatusCode(row.localForeign));
      const tags = investorTagsById[investorId] ?? [];
      for (const tag of tags) item.tagSet.add(tag);
    }
    const investorEntries: CommandEntry[] = [...investorMap.values()].map((item) => {
      const originLabel = summarizeInvestorOrigin(item.statusSet);
      const tags = [...item.tagSet].sort();
      const badges = [
        item.isIndividual ? "PERORANGAN" : "INSTITUSI",
        originLabel,
        `NAT ${item.nationality}`,
        ...tags,
      ];
      return {
        id: item.id,
        label: item.label,
        type: "investor",
        targetId: item.targetId,
        subtitle: `${formatInvestorType(item.investorType)} | ${item.nationality} | ${item.domicile}`,
        badges,
        badgeText: badges.join(" "),
      };
    });
    return [...issuerMap.values(), ...investorEntries];
  }, [allRows, investorTagsById]);

  const fuse = useMemo(
    () =>
      new Fuse(entries, {
        threshold: 0.35,
        keys: ["label", "subtitle", "badgeText"],
      }),
    [entries],
  );

  const filteredEntries = useMemo(() => {
    if (!query.trim()) return entries.slice(0, 60);
    return fuse.search(query).map((r) => r.item).slice(0, 80);
  }, [entries, fuse, query]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-20 z-50 w-[92vw] max-w-2xl -translate-x-1/2 rounded-2xl border border-border-strong/70 bg-panel-2 p-2 shadow-panel">
          <Command className="rounded-lg bg-transparent">
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="h-4 w-4 text-muted" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Cari ticker, nama perorangan, investor..."
                className="h-11 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
              />
            </div>
            <Command.List className="max-h-[60vh] overflow-auto p-2">
              <Command.Empty className="p-3 text-xs text-muted">Tidak ada hasil.</Command.Empty>
              {filteredEntries.map((entry) => (
                <Command.Item
                  key={entry.id}
                  value={`${entry.label} ${entry.subtitle}`}
                  onSelect={() => {
                    if (entry.type === "issuer") {
                      setFocusIssuer(entry.targetId);
                      updateSelection({
                        selectedIssuerId: entry.targetId,
                        selectedInvestorId: null,
                        selectedEdgeId: null,
                      });
                      const code = entry.label.trim().toUpperCase();
                      if (code) {
                        const nextParams = new URLSearchParams(searchParams);
                        nextParams.delete("investor");
                        nextParams.set("emiten", code);
                        setSearchParams(nextParams);
                      }
                    } else {
                      setFocusInvestor(entry.targetId);
                      updateSelection({
                        selectedInvestorId: entry.targetId,
                        selectedIssuerId: null,
                        selectedEdgeId: null,
                      });
                      const nextParams = new URLSearchParams(searchParams);
                      nextParams.delete("emiten");
                      nextParams.set("investor", entry.targetId);
                      setSearchParams(nextParams);
                    }
                    setOpen(false);
                  }}
                  className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors duration-150 aria-selected:bg-panel-3 aria-selected:text-foreground"
                >
                  <div>
                    <div>{entry.label}</div>
                    <div className="text-xs text-muted">{entry.subtitle}</div>
                    {entry.badges.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {entry.badges.map((badge) => (
                          <span
                            key={`${entry.id}-${badge}`}
                            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${paletteBadgeClass(badge)}`}
                          >
                            {badge}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <span className="text-[10px] uppercase tracking-wide text-muted">{entry.type}</span>
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
