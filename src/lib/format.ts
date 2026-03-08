/**
 * Format angka menjadi representasi IDR yang ringkas.
 * Selalu render output dengan: className="font-bold text-[#D97706] tabular-nums"
 */
export function formatIDR(value: number): string {
  if (!isFinite(value) || isNaN(value)) return "—";
  if (value >= 1e15) return `Rp ${(value / 1e15).toFixed(2)} Kuadriliun`;
  if (value >= 1e12) return `Rp ${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9)  return `Rp ${(value / 1e9).toFixed(1)}M`;
  if (value >= 1e6)  return `Rp ${(value / 1e6).toFixed(0)}Jt`;
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}