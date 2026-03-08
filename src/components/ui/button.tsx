import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-full text-sm font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:-translate-y-[1px] active:translate-y-px disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        primary:
          "border border-[#1D4C45] bg-[#1D4C45] text-[#FFF9F1] shadow-[0_18px_34px_rgba(29,76,69,0.16)] hover:border-[#173C37] hover:bg-[#173C37]",
        default:
          "border border-[#1D4C45] bg-[#1D4C45] text-[#FFF9F1] shadow-[0_18px_34px_rgba(29,76,69,0.16)] hover:border-[#173C37] hover:bg-[#173C37]",
        secondary:
          "border border-[#D8CDBF] bg-[#FFFBF5] text-[#1C1713] hover:border-[#C4B2A0] hover:bg-[#F7F0E6]",
        ghost:
          "border border-transparent bg-transparent text-[#665A4F] hover:bg-[#F0E7DB] hover:text-[#1C1713]",
        outline:
          "border border-[#C4B2A0] bg-[#F7F0E6] text-[#1C1713] hover:border-[#996737] hover:bg-[#F4EBDF]",
        danger:
          "border border-[#E7BFB5] bg-[#F8E9E4] text-[#7B312C] hover:border-[#D7A59A] hover:bg-[#F5E0DA]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-[13px]",
        lg: "h-10 px-5 text-[15px]",
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
