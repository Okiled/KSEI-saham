import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        primary:
          "border border-focus/40 bg-focus/90 text-slate-950 hover:bg-focus hover:border-focus",
        default:
          "border border-focus/40 bg-focus/90 text-slate-950 hover:bg-focus hover:border-focus",
        secondary:
          "border border-border-strong/70 bg-panel-2 text-foreground hover:border-border-strong hover:bg-panel-3",
        ghost: "border border-transparent bg-transparent text-muted hover:bg-panel-2/70 hover:text-foreground",
        outline:
          "border border-border bg-panel/70 text-foreground hover:border-border-strong hover:bg-panel-2/70",
        danger: "border border-danger/45 bg-danger/15 text-danger hover:bg-danger/22",
      },
      size: {
        default: "h-10 px-4 py-2.5",
        sm: "h-9 px-3 text-sm",
        lg: "h-11 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
