export type FloatStatus = "COMPLIANT" | "AT_RISK" | "NON_COMPLIANT";

type FloatPressureInput = {
  freeFloatPct: number;
  sharesOutstanding?: number | null;
  price?: number | null;
  avgVolume30d?: number | null;
};

type MandatorySellDownInput = {
  holderPct: number;
  sharesOutstanding?: number | null;
  price?: number | null;
  avgVolume30d?: number | null;
};

type FloatPressureResult = {
  status: FloatStatus;
  sharesRequired: number | null;
  idrRequired: number | null;
  daysToComply: number | null;
};

type MandatorySellDownResult = {
  sharesToSell: number | null;
  idrToSell: number | null;
  daysToAbsorb: number | null;
};

function toPositiveNumber(value: number | null | undefined): number | null {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) return null;
  return value ?? null;
}

export function getFloatStatus(freeFloatPct: number): FloatStatus {
  const pct = Number.isFinite(freeFloatPct) ? Math.max(0, freeFloatPct) : 0;
  if (pct >= 15) return "COMPLIANT";
  if (pct >= 10) return "AT_RISK";
  return "NON_COMPLIANT";
}

export function calcFloatPressure({
  freeFloatPct,
  sharesOutstanding,
  price,
  avgVolume30d,
}: FloatPressureInput): FloatPressureResult {
  const status = getFloatStatus(freeFloatPct);
  const gapPct = Math.max(0, 15 - (Number.isFinite(freeFloatPct) ? freeFloatPct : 0));
  const normalizedSharesOutstanding = toPositiveNumber(sharesOutstanding);

  if (normalizedSharesOutstanding === null) {
    return {
      status,
      sharesRequired: null,
      idrRequired: null,
      daysToComply: null,
    };
  }

  const sharesRequired = (gapPct / 100) * normalizedSharesOutstanding;
  const normalizedPrice = toPositiveNumber(price);
  const normalizedVolume = toPositiveNumber(avgVolume30d);

  return {
    status,
    sharesRequired,
    idrRequired: normalizedPrice === null ? null : sharesRequired * normalizedPrice,
    daysToComply:
      normalizedVolume === null ? (sharesRequired > 0 ? Infinity : 0) : sharesRequired / normalizedVolume,
  };
}

export function calcMandatorySellDown({
  holderPct,
  sharesOutstanding,
  price,
  avgVolume30d,
}: MandatorySellDownInput): MandatorySellDownResult {
  const excessPct = Math.max(0, (Number.isFinite(holderPct) ? holderPct : 0) - 80);
  if (excessPct === 0) {
    return {
      sharesToSell: 0,
      idrToSell: 0,
      daysToAbsorb: 0,
    };
  }

  const normalizedSharesOutstanding = toPositiveNumber(sharesOutstanding);
  if (normalizedSharesOutstanding === null) {
    return {
      sharesToSell: null,
      idrToSell: null,
      daysToAbsorb: null,
    };
  }

  const sharesToSell = (excessPct / 100) * normalizedSharesOutstanding;
  const normalizedPrice = toPositiveNumber(price);
  const normalizedVolume = toPositiveNumber(avgVolume30d);

  return {
    sharesToSell,
    idrToSell: normalizedPrice === null ? null : sharesToSell * normalizedPrice,
    daysToAbsorb:
      normalizedVolume === null ? (sharesToSell > 0 ? Infinity : 0) : sharesToSell / normalizedVolume,
  };
}

export function formatLiquidityDays(days: number | null | undefined): string {
  if (days === null || days === undefined || Number.isNaN(days)) return "-";
  if (!Number.isFinite(days)) return "N/A";
  if (days >= 10) return `${Math.round(days).toLocaleString("id-ID")} hari`;
  return `${days.toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} hari`;
}
