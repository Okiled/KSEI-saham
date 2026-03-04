import { useMemo, useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronsUpDown } from "lucide-react";
import { useAppStore } from "../store/app-store";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";

type FiltersPanelProps = {
  investorTypes: string[];
  nationalities: string[];
  domiciles: string[];
  resultCounts: {
    rows: number;
    issuers: number;
    investors: number;
  };
};

function toggleSetValue(source: Set<string>, value: string): Set<string> {
  const next = new Set(source);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function toggleTagValue(source: Set<"KONGLO" | "PEP">, value: "KONGLO" | "PEP"): Set<"KONGLO" | "PEP"> {
  const next = new Set(source);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function isIndividualInvestorType(value: string): boolean {
  return value.includes("INDIV") || value === "ID" || value === "I";
}

function isSameSetAsArray(source: Set<string>, values: string[]): boolean {
  if (source.size !== values.length) return false;
  for (const value of values) {
    if (!source.has(value)) return false;
  }
  return true;
}

function summarizeSelectedValues(selected: Set<string>, options: string[]): string {
  if (selected.size === 0) return "Semua";
  const ordered = options.filter((value) => selected.has(value));
  const shown = ordered.slice(0, 3);
  const extra = ordered.length - shown.length;
  if (extra > 0) return `${shown.join(", ")} +${extra}`;
  return shown.join(", ");
}

export function FiltersPanel({ investorTypes, nationalities, domiciles, resultCounts }: FiltersPanelProps) {
  const [open, setOpen] = useState(true);
  const filters = useAppStore((s) => s.filters);
  const updateFilters = useAppStore((s) => s.updateFilters);
  const resetFilters = useAppStore((s) => s.resetFilters);
  const individualTypes = useMemo(
    () => investorTypes.filter((type) => isIndividualInvestorType(type)),
    [investorTypes],
  );
  const institutionTypes = useMemo(
    () => investorTypes.filter((type) => !isIndividualInvestorType(type)),
    [investorTypes],
  );
  const peroranganPresetActive = isSameSetAsArray(filters.investorTypes, individualTypes);
  const institusiPresetActive = isSameSetAsArray(filters.investorTypes, institutionTypes);

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="rounded-2xl border border-border bg-panel/78">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.09em] text-muted">Filters</h3>
          <div className="mt-1 text-xs text-muted">
            Rows: <span className="font-mono text-foreground">{resultCounts.rows.toLocaleString("id-ID")}</span> | Emiten:{" "}
            <span className="font-mono text-foreground">{resultCounts.issuers.toLocaleString("id-ID")}</span> | Investor:{" "}
            <span className="font-mono text-foreground">{resultCounts.investors.toLocaleString("id-ID")}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => resetFilters()}>
            Reset
          </Button>
          <Collapsible.Trigger asChild>
            <Button size="sm" variant="outline">
              <ChevronsUpDown className="h-3.5 w-3.5" />
            </Button>
          </Collapsible.Trigger>
        </div>
      </div>

      <Collapsible.Content className="space-y-5 p-5">
        <div>
          <label className="mb-1.5 block text-[11px] uppercase tracking-[0.1em] text-muted">Status</label>
          <div className="flex flex-wrap gap-2">
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
              Include Unknown
            </Button>
          </div>
          {!filters.localEnabled && !filters.foreignEnabled && !filters.unknownEnabled ? (
            <div className="mt-1 text-xs text-warning">
              Semua toggle dimatikan. Sistem otomatis treat sebagai include all status.
            </div>
          ) : null}
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] uppercase tracking-[0.1em] text-muted">Investor Tags</label>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={filters.tagFilters.has("KONGLO") ? "secondary" : "outline"}
              onClick={() => updateFilters({ tagFilters: toggleTagValue(filters.tagFilters, "KONGLO") })}
            >
              KONGLO
            </Button>
            <Button
              size="sm"
              variant={filters.tagFilters.has("PEP") ? "secondary" : "outline"}
              onClick={() => updateFilters({ tagFilters: toggleTagValue(filters.tagFilters, "PEP") })}
            >
              PEP
            </Button>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.1em] text-muted">
            <span>Min %</span>
            <span className="font-mono text-foreground">Min {filters.minPercentage.toFixed(2)}%</span>
          </div>
          <Slider
            min={0}
            max={100}
            step={0.1}
            value={[filters.minPercentage]}
            onValueChange={(value) => updateFilters({ minPercentage: value[0] ?? 0 })}
          />
          <div className="mt-2">
            <Button
              size="sm"
              variant={filters.includeUnknownPercentage ? "secondary" : "outline"}
              onClick={() => updateFilters({ includeUnknownPercentage: !filters.includeUnknownPercentage })}
            >
              Include Unknown Percentage
            </Button>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] uppercase tracking-[0.1em] text-muted">Investor Type</label>
          <div className="space-y-2 rounded-xl border border-border bg-background/25 p-2.5">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={peroranganPresetActive ? "secondary" : "outline"}
                onClick={() => updateFilters({ investorTypes: new Set(individualTypes) })}
                disabled={individualTypes.length === 0}
              >
                Perorangan
              </Button>
              <Button
                size="sm"
                variant={institusiPresetActive ? "secondary" : "outline"}
                onClick={() => updateFilters({ investorTypes: new Set(institutionTypes) })}
                disabled={institutionTypes.length === 0}
              >
                Institusi
              </Button>
              <Button
                size="sm"
                variant={filters.investorTypes.size === 0 ? "secondary" : "outline"}
                onClick={() => updateFilters({ investorTypes: new Set<string>() })}
              >
                Semua
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <select
                value=""
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value) return;
                  updateFilters({ investorTypes: toggleSetValue(filters.investorTypes, value) });
                }}
                className="h-9 min-w-0 flex-1 rounded-md border border-border bg-panel px-2.5 text-xs text-foreground outline-none"
              >
                <option value="">Pilih tipe investor...</option>
                {investorTypes.map((type) => (
                  <option key={type} value={type}>
                    {filters.investorTypes.has(type) ? "[x] " : ""}
                    {type}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="outline" onClick={() => updateFilters({ investorTypes: new Set<string>() })}>
                Clear
              </Button>
            </div>
            <div className="text-xs text-muted">Aktif: {summarizeSelectedValues(filters.investorTypes, investorTypes)}</div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-border bg-background/25 p-2.5">
            <label className="block text-[11px] uppercase tracking-[0.1em] text-muted">Nationality</label>
            <div className="flex items-center gap-2">
              <select
                value=""
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value) return;
                  updateFilters({ nationalities: toggleSetValue(filters.nationalities, value) });
                }}
                className="h-9 min-w-0 flex-1 rounded-md border border-border bg-panel px-2.5 text-xs text-foreground outline-none"
              >
                <option value="">Pilih nationality...</option>
                {nationalities.map((value) => (
                  <option key={value} value={value}>
                    {filters.nationalities.has(value) ? "[x] " : ""}
                    {value}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="outline" onClick={() => updateFilters({ nationalities: new Set<string>() })}>
                Clear
              </Button>
            </div>
            <div className="text-xs text-muted">Aktif: {summarizeSelectedValues(filters.nationalities, nationalities)}</div>
          </div>
          <div className="space-y-2 rounded-xl border border-border bg-background/25 p-2.5">
            <label className="block text-[11px] uppercase tracking-[0.1em] text-muted">Domicile</label>
            <div className="flex items-center gap-2">
              <select
                value=""
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value) return;
                  updateFilters({ domiciles: toggleSetValue(filters.domiciles, value) });
                }}
                className="h-9 min-w-0 flex-1 rounded-md border border-border bg-panel px-2.5 text-xs text-foreground outline-none"
              >
                <option value="">Pilih domicile...</option>
                {domiciles.map((value) => (
                  <option key={value} value={value}>
                    {filters.domiciles.has(value) ? "[x] " : ""}
                    {value}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="outline" onClick={() => updateFilters({ domiciles: new Set<string>() })}>
                Clear
              </Button>
            </div>
            <div className="text-xs text-muted">Aktif: {summarizeSelectedValues(filters.domiciles, domiciles)}</div>
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-background/25 px-3 py-2.5 text-xs text-muted">
          Network mode: <span className="font-semibold text-foreground">Smart 1-Hop (Auto)</span>
          <span className="ml-1.5">tanpa setting manual tambahan.</span>
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
