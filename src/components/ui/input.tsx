import * as React from "react";
import { cn } from "../../lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-border bg-panel/75 px-3.5 text-[15px] text-foreground outline-none transition-[border-color,box-shadow,background-color,transform] duration-200 ease-out placeholder:text-muted2 hover:border-border-strong/80 hover:bg-panel-2/65 focus:-translate-y-[1px] focus:border-focus/70 focus:ring-2 focus:ring-focus/30 disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      {...props}
    />
  );
}
