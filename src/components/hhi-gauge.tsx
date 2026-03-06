import { NumberTicker } from "./number-ticker";

export function HhiGauge({ hhi, repoRisk = false }: { hhi: number; repoRisk?: boolean }) {
  // HHI ranges from 0 to 10000.
  // <3000: Fragmented (Teal)
  // 3000-6000: Moderate (Gold)
  // >6000: High Concentration (Rose)
  
  let colorClass = "text-teal";
  let label = "Tersebar";
  let riskLevel = "Rendah";

  if (repoRisk) {
    colorClass = "text-rose";
    label = "SANGAT RENTAN (REPO)";
    riskLevel = "Kritis";
  } else if (hhi >= 6000) {
    colorClass = "text-rose";
    label = "Terkonsentrasi";
    riskLevel = "Tinggi";
  } else if (hhi >= 3000) {
    colorClass = "text-gold";
    label = "Moderat";
    riskLevel = "Sedang";
  }

  return (
    <div>
      <div className={`stat-hero ${colorClass}`}>
        <NumberTicker value={hhi} />
      </div>
      <div className="mt-1.5 flex flex-col items-start leading-tight">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted font-mono">Risk: {riskLevel}</span>
        <span className={`text-[11px] font-medium ${colorClass}`}>{label}</span>
      </div>
    </div>
  );
}
