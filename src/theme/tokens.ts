export const premiumLightTokens = {
  background: {
    page: "#F1EADF",
    panel: "#FFFBF5",
    panelElevated: "#F7F0E6",
    border: "#D8CDBF",
    border2: "#C4B2A0",
  },
  accent: {
    teal: "#1D4C45",
    gold: "#855A30",
    rose: "#7B312C",
    violet: "#685261",
    blue: "#48607C",
    lokal: "#1D4C45",
    asing: "#996737",
    danger: "#7B312C",
    focus: "#1D4C45",
  },
  text: {
    primary: "#1C1713",
    secondary: "#665A4F",
    muted: "#A99F95",
    quaternary: "#C3B8AD",
  },
  heatmap: {
    low: "#F7F0E6",
    high: "#1D4C45",
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
    return { bg: "bg-[#F3ECF1]", text: "text-[#685261]", border: "border-[#D6C6CF]" };
  }
  if (t === "ID" || t === "I" || t.includes("INDIV") || t.includes("PERORANGAN")) {
    return { bg: "bg-[#EEF1F4]", text: "text-[#48607C]", border: "border-[#CAD3DD]" };
  }
  if (t.includes("DIREKSI") || t.includes("KOMISARIS") || t.includes("DIRECTOR")) {
    return { bg: "bg-[#F8E9E4]", text: "text-[#7B312C]", border: "border-[#E7BFB5]" };
  }
  return { bg: "bg-[#EDF4F1]", text: "text-[#1D4C45]", border: "border-[#C0D6CF]" };
}
