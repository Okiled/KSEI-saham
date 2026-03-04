import { cn } from "../../lib/utils";

type ProgressProps = {
  value: number;
  className?: string;
};

export function Progress({ value, className }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2.5 w-full overflow-hidden rounded-full bg-panel-3/75", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-focus/95 to-foreground/80 transition-all duration-200"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
