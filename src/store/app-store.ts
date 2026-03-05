import { create } from "zustand";
import type { ParsedOwnership } from "../types/ownership";

export type GraphHop = 1 | 2;
export type QueryMode = "all" | "issuer" | "investor";
export type FocusType = "issuer" | "investor";
export type InvestorTag = "KONGLO" | "PEP";

export type FiltersState = {
  queryText: string;
  queryMode: QueryMode;
  minPercentage: number;
  minFreeFloat: number;
  localEnabled: boolean;
  foreignEnabled: boolean;
  unknownEnabled: boolean;
  includeUnknownPercentage: boolean;
  investorTypes: Set<string>;
  nationalities: Set<string>;
  domiciles: Set<string>;
  tagFilters: Set<InvestorTag>;
  graphHop: GraphHop;
  topNEdges: number;
};

export type FocusState = {
  focusType: FocusType | null;
  focusIssuerId: string | null;
  focusInvestorId: string | null;
  lastInteraction: FocusType | null;
};

export type UiState = {
  themeMode: "light-premium";
};

export type ViewState = {
  snapshotDate: string | null;
  universeSort: "ticker" | "holder-count" | "dominant-pct" | "total-shares";
};

export type SelectionState = {
  selectedIssuerId: string | null;
  selectedInvestorId: string | null;
  selectedEdgeId: string | null;
  hoveredIssuerId: string | null;
  hoveredInvestorId: string | null;
  focusedEvidenceRowId: string | null;
};

type ParseStatus = "idle" | "parsing" | "ready" | "error";

type AppState = {
  file: File | null;
  fileBuffer: ArrayBuffer | null;
  parsed: ParsedOwnership | null;
  parseStatus: ParseStatus;
  parseProgress: number;
  parsePage: number;
  parseTotalPages: number;
  parseError: string | null;
  filters: FiltersState;
  focus: FocusState;
  ui: UiState;
  view: ViewState;
  selection: SelectionState;
  investorTagsById: Record<string, InvestorTag[]>;
  debugRowId: string | null;
  setFile: (file: File, buffer: ArrayBuffer) => void;
  setParsed: (parsed: ParsedOwnership) => void;
  setPartialParsed: (parsed: ParsedOwnership) => void;
  setParseStatus: (status: ParseStatus) => void;
  setParseProgress: (progress: number) => void;
  setParsePageInfo: (page: number, totalPages: number) => void;
  setParseError: (error: string | null) => void;
  setInvestorTagsById: (tagsById: Record<string, InvestorTag[]>) => void;
  updateFilters: (patch: Partial<FiltersState>) => void;
  resetFilters: () => void;
  setFocusIssuer: (issuerId: string | null) => void;
  setFocusInvestor: (investorId: string | null) => void;
  clearFocus: () => void;
  updateUi: (patch: Partial<UiState>) => void;
  updateView: (patch: Partial<ViewState>) => void;
  updateSelection: (patch: Partial<SelectionState>) => void;
  setDebugRowId: (rowId: string | null) => void;
  clearData: () => void;
};

function createDefaultFilters(): FiltersState {
  return {
    queryText: "",
    queryMode: "all",
    minPercentage: 0,
    minFreeFloat: 0,
    localEnabled: true,
    foreignEnabled: true,
    unknownEnabled: true,
    includeUnknownPercentage: false,
    investorTypes: new Set<string>(),
    nationalities: new Set<string>(),
    domiciles: new Set<string>(),
    tagFilters: new Set<InvestorTag>(),
    graphHop: 1,
    topNEdges: 0,
  };
}

const defaultFocus: FocusState = {
  focusType: null,
  focusIssuerId: null,
  focusInvestorId: null,
  lastInteraction: null,
};

const defaultUi: UiState = {
  themeMode: "light-premium",
};

const defaultView: ViewState = {
  snapshotDate: null,
  universeSort: "holder-count",
};

const defaultSelection: SelectionState = {
  selectedIssuerId: null,
  selectedInvestorId: null,
  selectedEdgeId: null,
  hoveredIssuerId: null,
  hoveredInvestorId: null,
  focusedEvidenceRowId: null,
};

export const useAppStore = create<AppState>((set) => ({
  file: null,
  fileBuffer: null,
  parsed: null,
  parseStatus: "idle",
  parseProgress: 0,
  parsePage: 0,
  parseTotalPages: 0,
  parseError: null,
  filters: createDefaultFilters(),
  focus: defaultFocus,
  ui: defaultUi,
  view: defaultView,
  selection: defaultSelection,
  investorTagsById: {},
  debugRowId: null,
  setFile: (file, buffer) =>
    set({
      file,
      fileBuffer: buffer,
    }),
  setParsed: (parsed) =>
    set({
      parsed,
      parseStatus: "ready",
      parseError: null,
      parsePage: parsed.report.pageCount,
      parseTotalPages: parsed.report.pageCount,
      focus: defaultFocus,
      ui: defaultUi,
      view: defaultView,
      selection: defaultSelection,
      debugRowId: null,
    }),
  setPartialParsed: (parsed) =>
    set({
      parsed,
      parseStatus: "parsing",
      parseError: null,
    }),
  setParseStatus: (parseStatus) => set({ parseStatus }),
  setParseProgress: (parseProgress) => set({ parseProgress }),
  setParsePageInfo: (parsePage, parseTotalPages) => set({ parsePage, parseTotalPages }),
  setParseError: (parseError) => set({ parseError }),
  setInvestorTagsById: (investorTagsById) => set({ investorTagsById }),
  updateFilters: (patch) =>
    set((state) => {
      const next: FiltersState = {
        ...state.filters,
        ...patch,
        investorTypes: patch.investorTypes ? new Set(patch.investorTypes) : new Set(state.filters.investorTypes),
        nationalities: patch.nationalities ? new Set(patch.nationalities) : new Set(state.filters.nationalities),
        domiciles: patch.domiciles ? new Set(patch.domiciles) : new Set(state.filters.domiciles),
        tagFilters: patch.tagFilters ? new Set(patch.tagFilters) : new Set(state.filters.tagFilters),
      };
      return { filters: next };
    }),
  resetFilters: () => set({ filters: createDefaultFilters() }),
  setFocusIssuer: (issuerId) =>
    set((state) => {
      const nextFocus: FocusState = {
        focusType: issuerId ? "issuer" : state.focus.focusType,
        focusIssuerId: issuerId,
        focusInvestorId: issuerId ? null : state.focus.focusInvestorId,
        lastInteraction: issuerId ? "issuer" : state.focus.lastInteraction,
      };
      const nextSelection: SelectionState = {
        ...state.selection,
        selectedIssuerId: issuerId,
        selectedInvestorId: issuerId ? null : state.selection.selectedInvestorId,
        selectedEdgeId: null,
        focusedEvidenceRowId: null,
      };
      const focusUnchanged =
        state.focus.focusType === nextFocus.focusType &&
        state.focus.focusIssuerId === nextFocus.focusIssuerId &&
        state.focus.focusInvestorId === nextFocus.focusInvestorId &&
        state.focus.lastInteraction === nextFocus.lastInteraction;
      const selectionUnchanged =
        state.selection.selectedIssuerId === nextSelection.selectedIssuerId &&
        state.selection.selectedInvestorId === nextSelection.selectedInvestorId &&
        state.selection.selectedEdgeId === nextSelection.selectedEdgeId &&
        state.selection.focusedEvidenceRowId === nextSelection.focusedEvidenceRowId;
      if (focusUnchanged && selectionUnchanged) return state;
      return { focus: nextFocus, selection: nextSelection };
    }),
  setFocusInvestor: (investorId) =>
    set((state) => {
      const nextFocus: FocusState = {
        focusType: investorId ? "investor" : state.focus.focusType,
        focusIssuerId: investorId ? null : state.focus.focusIssuerId,
        focusInvestorId: investorId,
        lastInteraction: investorId ? "investor" : state.focus.lastInteraction,
      };
      const nextSelection: SelectionState = {
        ...state.selection,
        selectedInvestorId: investorId,
        selectedIssuerId: investorId ? null : state.selection.selectedIssuerId,
        selectedEdgeId: null,
        focusedEvidenceRowId: null,
      };
      const focusUnchanged =
        state.focus.focusType === nextFocus.focusType &&
        state.focus.focusIssuerId === nextFocus.focusIssuerId &&
        state.focus.focusInvestorId === nextFocus.focusInvestorId &&
        state.focus.lastInteraction === nextFocus.lastInteraction;
      const selectionUnchanged =
        state.selection.selectedIssuerId === nextSelection.selectedIssuerId &&
        state.selection.selectedInvestorId === nextSelection.selectedInvestorId &&
        state.selection.selectedEdgeId === nextSelection.selectedEdgeId &&
        state.selection.focusedEvidenceRowId === nextSelection.focusedEvidenceRowId;
      if (focusUnchanged && selectionUnchanged) return state;
      return { focus: nextFocus, selection: nextSelection };
    }),
  clearFocus: () =>
    set((state) => ({
      focus: {
        ...defaultFocus,
        lastInteraction: state.focus.lastInteraction,
      },
      selection: {
        ...state.selection,
        selectedIssuerId: null,
        selectedInvestorId: null,
        selectedEdgeId: null,
      },
    })),
  updateUi: (patch) =>
    set((state) => ({
      ui: {
        ...state.ui,
        ...patch,
      },
    })),
  updateView: (patch) =>
    set((state) => ({
      view: {
        ...state.view,
        ...patch,
      },
    })),
  updateSelection: (patch) =>
    set((state) => {
      const nextSelection: SelectionState = { ...state.selection, ...patch };
      const unchanged =
        state.selection.selectedIssuerId === nextSelection.selectedIssuerId &&
        state.selection.selectedInvestorId === nextSelection.selectedInvestorId &&
        state.selection.selectedEdgeId === nextSelection.selectedEdgeId &&
        state.selection.hoveredIssuerId === nextSelection.hoveredIssuerId &&
        state.selection.hoveredInvestorId === nextSelection.hoveredInvestorId &&
        state.selection.focusedEvidenceRowId === nextSelection.focusedEvidenceRowId;
      if (unchanged) return state;
      return { selection: nextSelection };
    }),
  setDebugRowId: (debugRowId) => set({ debugRowId }),
  clearData: () =>
    set({
      file: null,
      fileBuffer: null,
      parsed: null,
      parseStatus: "idle",
      parseProgress: 0,
      parsePage: 0,
      parseTotalPages: 0,
      parseError: null,
      filters: createDefaultFilters(),
      focus: defaultFocus,
      ui: defaultUi,
      view: defaultView,
      selection: defaultSelection,
      investorTagsById: {},
      debugRowId: null,
    }),
}));

export { createDefaultFilters, defaultFocus };
