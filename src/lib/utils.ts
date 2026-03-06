import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function fmtNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("id-ID").format(value);
}

export function fmtPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return `${value.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1))}…`;
}

export function freeFloatContext(pct: number): { label: string; color: string } {
  if (pct < 10) return { label: "Sangat Terbatas — likuiditas rendah, rentan goreng", color: "text-rose" };
  if (pct <= 25) return { label: "Terbatas", color: "text-gold" };
  if (pct <= 40) return { label: "Moderat", color: "text-foreground" };
  return { label: "Cukup Likuid", color: "text-teal" };
}

export function formatInvestorType(code: string | null | undefined): string {
  const norm = (code ?? "").toUpperCase().trim();
  switch (norm) {
    case "IB": return "Institusi Bank";
    case "SC": return "Perusahaan Efek";
    case "IS": return "Asuransi";
    case "MF": return "Reksadana";
    case "PF": return "Dana Pensiun";
    case "CP": return "Korporasi";
    case "IND": return "Individu";
    case "FD": return "Yayasan";
    case "OT": return "Lainnya";
    default: return norm || "UNKNOWN";
  }
}

export function formatLocalForeign(code: string | null | undefined): string {
  if (code === "A") return "Asing";
  if (code === "L") return "Lokal";
  return "Unknown";
}
