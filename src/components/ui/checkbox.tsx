import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

type CheckboxProps = CheckboxPrimitive.CheckboxProps & {
  label?: string;
};

export function Checkbox({ className, label, ...props }: CheckboxProps) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
      <CheckboxPrimitive.Root
        className={cn(
          "h-4.5 w-4.5 rounded border border-border bg-background data-[state=checked]:border-focus data-[state=checked]:bg-focus data-[state=checked]:text-slate-950",
          className,
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator className="flex items-center justify-center">
          <Check className="h-3.5 w-3.5" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label ? <span>{label}</span> : null}
    </label>
  );
}

