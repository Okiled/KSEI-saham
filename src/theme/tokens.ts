export const premiumLightTokens = {
  background: {
    page: "#f4f1ec",
    panel: "#ede9e1",
    panelElevated: "#faf8f4",
    border: "rgba(0,0,0,0.08)",
    border2: "rgba(0,0,0,0.13)",
  },
  accent: {
    teal: "#0a8c6e",
    gold: "#c47c1a",
    rose: "#b83a4b",
    violet: "#6b4fa0",
    blue: "#2563a8",
    lokal: "#0a8c6e",
    asing: "#c47c1a",
    danger: "#b83a4b",
    focus: "#3c6b5f",
  },
  text: {
    primary: "#1a1814",
    secondary: "#4a4640",
    muted: "#8a8580",
    quaternary: "#b5b0aa",
  },
  heatmap: {
    low: "#f4f1ec",
    high: "#0a8c6e",
  },
} as const;

export type ColorTone = "teal" | "gold" | "rose" | "violet" | "blue" | "unknown";

export function toneByLocalForeign(value: "L" | "A" | null): "teal" | "gold" | "unknown" {
  if (value === "L") return "teal";
  if (value === "A") return "gold";
  return "unknown";
}

export function investorTypeBadgeColor(investorType: string | null): {
  bg: string;
  text: string;
  border: string;
} {
  const t = (investorType ?? "").toUpperCase().trim();
  if (t.includes("MF") || t.includes("REKSA") || t.includes("MUTUAL")) {
    return { bg: "bg-violet/10", text: "text-violet", border: "border-violet/30" };
  }
  if (t === "ID" || t === "I" || t.includes("INDIV") || t.includes("PERORANGAN")) {
    return { bg: "bg-blue/10", text: "text-blue", border: "border-blue/30" };
  }
  if (t.includes("DIREKSI") || t.includes("KOMISARIS") || t.includes("DIRECTOR")) {
    return { bg: "bg-rose/10", text: "text-rose", border: "border-rose/30" };
  }
  return { bg: "bg-teal/10", text: "text-teal", border: "border-teal/30" };
}
