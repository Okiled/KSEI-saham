import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.08em]",
  {
    variants: {
      variant: {
        neutral: "border-border bg-panel/70 text-muted",
        coverage: "border-success/35 bg-success/12 text-success",
        warning: "border-warning/35 bg-warning/12 text-warning",
        danger: "border-danger/40 bg-danger/14 text-danger",
        status: "border-border-strong/70 bg-panel-2/70 text-foreground",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
