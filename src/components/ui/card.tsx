import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const cardVariants = cva(
  "rounded-2xl border shadow-panel transition-[border-color,box-shadow,background-color,transform] duration-300 ease-out",
  {
  variants: {
    surface: {
      1: "border-border/80 bg-panel/90",
      2: "border-border/85 bg-panel-2/88",
      3: "border-border-strong/60 bg-panel-3/86",
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
      className={cn("flex items-center justify-between border-b border-border/75 px-5 py-4", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-[17px] font-semibold tracking-tight text-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}
