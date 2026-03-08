import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.1em] transition-[background-color,border-color,color,transform] duration-200 ease-out",
  {
    variants: {
      variant: {
        neutral: "border-[#D8CDBF] bg-[#F7F0E6] text-[#665A4F]",
        coverage: "border-[#C0D6CF] bg-[#EDF4F1] text-[#1D4C45]",
        warning: "border-[#E7D2B3] bg-[#F8EEDC] text-[#996737]",
        danger: "border-[#E7BFB5] bg-[#F8E9E4] text-[#7B312C]",
        status: "border-[#D8CDBF] bg-[#FFFBF5] text-[#1C1713]",
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
