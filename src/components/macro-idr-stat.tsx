import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { formatIDR } from "../lib/format";
import { getPositionValueIDR } from "../lib/market-data";
import type { OwnershipRow } from "../types/ownership";

interface MacroIDRStatProps {
  rows: OwnershipRow[];
  prices: Record<string, number>;
  updatedAt?: string | null;
  loading?: boolean;
}

export function MacroIDRStat({ rows, prices, updatedAt: _updatedAt, loading = false }: MacroIDRStatProps) {
  const { totalIDR, coveredTickers, totalTickers } = useMemo(() => {
    if (!rows.length || !Object.keys(prices).length) {
      return { totalIDR: 0, coveredTickers: 0, totalTickers: 0 };
    }

    let total = 0;
    const allTickers = new Set<string>();
    const pricedTickers = new Set<string>();

    for (const row of rows) {
      allTickers.add(row.shareCode);
      const idrValue = getPositionValueIDR(row.totalHoldingShares ?? 0, prices[row.shareCode]);
      if (idrValue === null) continue;
      total += idrValue;
      pricedTickers.add(row.shareCode);
    }

    return {
      totalIDR: total,
      coveredTickers: pricedTickers.size,
      totalTickers: allTickers.size,
    };
  }, [rows, prices]);

  return (
    <section className="page-section overflow-hidden">
      <div className="px-4 py-4 md:px-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-4 w-0.5 bg-[#996737]" />
          <span className="text-xs uppercase tracking-[0.22em] text-[#7A6E63]">Macro Value Layer</span>
        </div>

        <div className="flex items-center gap-2 text-[#1C1713]">
          <BarChart3 className="h-5 w-5 text-[#1D4C45]" />
          <span className="text-sm font-semibold uppercase tracking-[0.14em] text-[#665A4F]">
            Total kepemilikan disclosed &gt;=1% seluruh IDX
          </span>
        </div>

        <p className="mt-2 max-w-3xl text-sm leading-7 text-[#665A4F]">
          Lapisan ini mengubah snapshot kepemilikan menjadi nilai pasar yang bisa dibaca cepat. Fokusnya
          bukan market cap total emiten, tetapi nilai posisi material yang benar-benar tertangkap terminal.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <span className="font-serif text-[2.45rem] font-semibold leading-none tracking-[-0.05em] text-[#996737] md:text-[2.95rem]">
            {loading ? "Memuat..." : totalIDR > 0 ? formatIDR(totalIDR) : "Belum tersedia"}
          </span>
          {!loading ? (
            <span className="rounded-full border border-[#D8CDBF] bg-[#F7F0E6] px-3 py-1 text-xs text-[#665A4F]">
              {coveredTickers}/{totalTickers} emiten berhasil di-price
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
