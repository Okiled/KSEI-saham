export type GhostAccumulationRequest = {
  issuerId: string;
  shareCode: string;
  timelineSeries: Array<{
    investorId: string;
    points: Array<{ snapshotDate: string; percentage: number }>;
  }>;
  snapshotDates: string[];
};

export type GhostSignal = {
  investorId: string;
  previousPct: number;
  currentPct: number;
  droppedPct: number;
  suspectedSplit: boolean;
};

export type GhostAccumulationResponse = {
  issuerId: string;
  totalDroppedPct: number;
  signals: GhostSignal[];
  isHighRisk: boolean;
};

self.onmessage = (event: MessageEvent<GhostAccumulationRequest>) => {
  const { issuerId, timelineSeries, snapshotDates } = event.data;

  if (snapshotDates.length < 2) {
    self.postMessage({ issuerId, totalDroppedPct: 0, signals: [], isHighRisk: false } as GhostAccumulationResponse);
    return;
  }

  const recentDate = snapshotDates[snapshotDates.length - 1];
  const prevDate = snapshotDates[snapshotDates.length - 2];

  let totalDroppedPct = 0;
  const signals: GhostSignal[] = [];

  for (const series of timelineSeries) {
    const prevPt = series.points.find((p) => p.snapshotDate === prevDate);
    const recentPt = series.points.find((p) => p.snapshotDate === recentDate);

    const prevPct = prevPt ? prevPt.percentage : 0;
    const recentPct = recentPt ? recentPt.percentage : 0;

    // If an investor drops from >= 1% down to 0% (or < 1% which means they disappear)
    // AND they had a substantial position previously (e.g. > 1%), this is suspicious.
    // If they drop but remain > 1%, it's just selling.
    // Ghost Accumulation / Evasion often looks like exactly splitting into < 1% chunks.
    if (prevPct >= 1.0 && recentPct === 0) {
      signals.push({
        investorId: series.investorId,
        previousPct: prevPct,
        currentPct: recentPct,
        droppedPct: prevPct,
        suspectedSplit: true, // Disappeared entirely (evasion)
      });
      totalDroppedPct += prevPct;
    } else if (prevPct > recentPct && recentPct > 0) {
      // Just a partial sell
      // Could also check if they dropped to EXACTLY ~1.01% to stay just on the radar?
      // For now, only track outright disappearances as suspected splits.
    }
  }

  // Calculate if any new investor appeared out of nowhere to absorb this.
  // If totalDroppedPct goes into a new investor, it's a transfer.
  // If it goes nowhere (no new investor > 1%), it's Ghost Accumulation.
  
  let newlyAppearedPct = 0;
  for (const series of timelineSeries) {
    const prevPt = series.points.find((p) => p.snapshotDate === prevDate);
    const recentPt = series.points.find((p) => p.snapshotDate === recentDate);
    const prevPct = prevPt ? prevPt.percentage : 0;
    const recentPct = recentPt ? recentPt.percentage : 0;

    if (recentPct >= 1.0 && prevPct === 0) {
      newlyAppearedPct += recentPct;
    }
  }

  // Net "Ghost" Dropped is what didn't re-appear as a new >=1% holder.
  const netGhostPct = Math.max(0, totalDroppedPct - newlyAppearedPct);

  // Consider it high risk if more than 3% of the company vanished into <1% accounts in a single period
  const isHighRisk = netGhostPct >= 3.0;

  const response: GhostAccumulationResponse = {
    issuerId,
    totalDroppedPct: netGhostPct,
    signals: signals.filter(s => s.suspectedSplit),
    isHighRisk,
  };

  self.postMessage(response);
};
