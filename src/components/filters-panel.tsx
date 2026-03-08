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

function buttonTone(active: boolean, tone: "teal" | "amber" | "rose" | "violet" | "neutral" = "teal") {
  if (!active) return "";
  if (tone === "amber") return "!border-[#996737] !bg-[#996737] !text-[#FFF9F1] shadow-[0_10px_20px_rgba(153,103,55,0.16)]";
  if (tone === "rose") return "!border-[#7B312C] !bg-[#7B312C] !text-[#FFF9F1] shadow-[0_10px_20px_rgba(123,49,44,0.16)]";
  if (tone === "violet") return "!border-[#685261] !bg-[#685261] !text-[#FFF9F1] shadow-[0_10px_20px_rgba(104,82,97,0.16)]";
  if (tone === "neutral") return "!border-[#6F655B] !bg-[#6F655B] !text-[#FFF9F1] shadow-[0_10px_20px_rgba(111,101,91,0.16)]";
  return "!border-[#1D4C45] !bg-[#1D4C45] !text-[#FFF9F1] shadow-[0_10px_20px_rgba(29,76,69,0.16)]";
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
  const statusFiltered = !filters.localEnabled || !filters.foreignEnabled || !filters.unknownEnabled;
  const activeFilterCount = [
    filters.minPercentage > 0,
    filters.includeUnknownPercentage,
    !filters.localEnabled,
    !filters.foreignEnabled,
    !filters.unknownEnabled,
    filters.investorTypes.size > 0,
    filters.nationalities.size > 0,
    filters.domiciles.size > 0,
    filters.tagFilters.size > 0,
  ].filter(Boolean).length;

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className="rounded-2xl border border-border bg-panel/78 transition-[border-color,box-shadow,background-color] duration-300 hover:border-border-strong/80 hover:shadow-panel"
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.09em] text-muted">Filters</h3>
          <div className="mt-1 text-xs text-muted">
            Rows: <span className="font-mono text-foreground">{resultCounts.rows.toLocaleString("id-ID")}</span> | Emiten:{" "}
            <span className="font-mono text-foreground">{resultCounts.issuers.toLocaleString("id-ID")}</span> | Investor:{" "}
            <span className="font-mono text-foreground">{resultCounts.investors.toLocaleString("id-ID")}</span>
          </div>
          {activeFilterCount > 0 ? (
            <div className="mt-2 inline-flex rounded-full border border-[#C0D6CF] bg-[#EDF4F1] px-2.5 py-1 text-[11px] font-semibold text-[#1D4C45]">
              {activeFilterCount} filter aktif
            </div>
          ) : null}
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
              className={
                statusFiltered
                  ? buttonTone(filters.localEnabled, "teal")
                  : filters.localEnabled
                    ? "!border-[#C0D6CF] !bg-[#EDF4F1] !text-[#1D4C45]"
                    : ""
              }
              onClick={() => updateFilters({ localEnabled: !filters.localEnabled })}
            >
              Lokal
            </Button>
            <Button
              size="sm"
              variant={filters.foreignEnabled ? "secondary" : "outline"}
              className={
                statusFiltered
                  ? buttonTone(filters.foreignEnabled, "amber")
                  : filters.foreignEnabled
                    ? "!border-[#E7D2B3] !bg-[#F8EEDC] !text-[#996737]"
                    : ""
              }
              onClick={() => updateFilters({ foreignEnabled: !filters.foreignEnabled })}
            >
              Asing
            </Button>
            <Button
              size="sm"
              variant={filters.unknownEnabled ? "secondary" : "outline"}
              className={
                statusFiltered
                  ? buttonTone(filters.unknownEnabled, "neutral")
                  : filters.unknownEnabled
                    ? "!border-[#D8CDBF] !bg-[#F7F0E6] !text-[#665A4F]"
                    : ""
              }
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
              className={buttonTone(filters.tagFilters.has("KONGLO"), "amber")}
              onClick={() => updateFilters({ tagFilters: toggleTagValue(filters.tagFilters, "KONGLO") })}
            >
              KONGLO
            </Button>
            <Button
              size="sm"
              variant={filters.tagFilters.has("PEP") ? "secondary" : "outline"}
              className={buttonTone(filters.tagFilters.has("PEP"), "violet")}
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
              className={buttonTone(filters.includeUnknownPercentage, "neutral")}
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
                className={buttonTone(peroranganPresetActive, "teal")}
                onClick={() => updateFilters({ investorTypes: new Set(individualTypes) })}
                disabled={individualTypes.length === 0}
              >
                Perorangan
              </Button>
              <Button
                size="sm"
                variant={institusiPresetActive ? "secondary" : "outline"}
                className={buttonTone(institusiPresetActive, "amber")}
                onClick={() => updateFilters({ investorTypes: new Set(institutionTypes) })}
                disabled={institutionTypes.length === 0}
              >
                Institusi
              </Button>
              <Button
                size="sm"
                variant={filters.investorTypes.size === 0 ? "secondary" : "outline"}
                className={buttonTone(filters.investorTypes.size === 0, "neutral")}
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
                className="h-9 min-w-0 flex-1 rounded-md border border-border bg-panel px-2.5 text-xs text-foreground outline-none transition-[border-color,background-color,box-shadow,transform] duration-200 hover:border-border-strong/80 hover:bg-panel-2/65 focus:-translate-y-[1px] focus:border-focus/65 focus:ring-2 focus:ring-focus/20"
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
                className="h-9 min-w-0 flex-1 rounded-md border border-border bg-panel px-2.5 text-xs text-foreground outline-none transition-[border-color,background-color,box-shadow,transform] duration-200 hover:border-border-strong/80 hover:bg-panel-2/65 focus:-translate-y-[1px] focus:border-focus/65 focus:ring-2 focus:ring-focus/20"
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
                className="h-9 min-w-0 flex-1 rounded-md border border-border bg-panel px-2.5 text-xs text-foreground outline-none transition-[border-color,background-color,box-shadow,transform] duration-200 hover:border-border-strong/80 hover:bg-panel-2/65 focus:-translate-y-[1px] focus:border-focus/65 focus:ring-2 focus:ring-focus/20"
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
