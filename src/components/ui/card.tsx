import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const cardVariants = cva(
  "rounded-[20px] border transition-[border-color,box-shadow,background-color,transform] duration-300 ease-out",
  {
    variants: {
      surface: {
        1: "border-[#D8CDBF] bg-[#FFFBF5] shadow-[0_14px_34px_rgba(95,73,47,0.07)]",
        2: "border-[#D8CDBF] bg-[#F7F0E6] shadow-[0_12px_28px_rgba(95,73,47,0.06)]",
        3: "border-[#C4B2A0] bg-[#ECE1D2] shadow-[0_10px_24px_rgba(95,73,47,0.05)]",
      },
    },
    defaultVariants: {
      surface: 1,
    },
  },
);

type CardProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>;

export function Card({ className, surface, ...props }: CardProps) {
  return <div className={cn(cardVariants({ surface }), className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-[#D8CDBF] px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("font-serif text-[19px] font-semibold tracking-[-0.03em] text-[#1C1713]", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}
