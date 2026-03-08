import type { IssuerHolderPosition } from "../types/ownership";
import type { MarketDataEntry } from "./market-data";
import { getPositionValueIDR } from "./market-data";

export type MutualFundPressure = {
  mutualFundPct: number;
  mutualFundCount: number;
  mutualFundValueIDR: number | null;
  redemption10pctIDR: number | null;
  topMutualFundName: string | null;
  topMutualFundPct: number;
  concentrationRisk: boolean;
  herdingRisk: boolean;
  funds: Array<{
    investorId: string;
    investorName: string;
    percentage: number;
    shares: number;
    valueIDR: number | null;
  }>;
};

export function isMutualFundHolder(investorType: string | null, investorName: string | null | undefined): boolean {
  const normalizedType = (investorType ?? "").trim().toUpperCase();
  const normalizedName = (investorName ?? "").trim().toUpperCase();
  return normalizedType === "MF" || normalizedName.includes("REKSA DANA") || normalizedName.includes("MUTUAL FUND");
}

export function calcRedemptionRisk(
  holders: IssuerHolderPosition[],
  marketEntry: MarketDataEntry | null | undefined,
): MutualFundPressure | null {
  const funds = holders
    .filter((holder) => isMutualFundHolder(holder.investorType, holder.investorName))
    .map((holder) => ({
      investorId: holder.investorId,
      investorName: holder.investorName,
      percentage: holder.percentage,
      shares: holder.shares,
      valueIDR: getPositionValueIDR(holder.shares, marketEntry?.price),
    }))
    .sort((left, right) => right.percentage - left.percentage);

  if (funds.length === 0) return null;

  const mutualFundPct = funds.reduce((sum, fund) => sum + fund.percentage, 0);
  const mutualFundShares = funds.reduce((sum, fund) => sum + fund.shares, 0);
  const mutualFundValueIDR = getPositionValueIDR(mutualFundShares, marketEntry?.price);

  return {
    mutualFundPct: +mutualFundPct.toFixed(2),
    mutualFundCount: funds.length,
    mutualFundValueIDR,
    redemption10pctIDR: mutualFundValueIDR !== null ? mutualFundValueIDR * 0.1 : null,
    topMutualFundName: funds[0]?.investorName ?? null,
    topMutualFundPct: funds[0]?.percentage ?? 0,
    concentrationRisk: (funds[0]?.percentage ?? 0) > 15,
    herdingRisk: funds.length >= 5,
    funds,
  };
}
