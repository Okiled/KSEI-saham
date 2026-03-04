function normalizeIdText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toUpperCase();
}

export function normalizeInvestorDisplayName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

// Keep investor identity exactly as written in PDF (except whitespace/case normalization for id stability).
export function canonicalizeInvestorName(value: string): string {
  const normalized = normalizeIdText(value);
  return normalized || "UNKNOWN";
}

export function getInvestorCanonicalIdFromName(value: string): string {
  return `investor:${canonicalizeInvestorName(value)}`;
}

