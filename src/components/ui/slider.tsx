import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "../../lib/utils";

type SliderProps = SliderPrimitive.SliderProps;

export function Slider({ className, ...props }: SliderProps) {
  return (
    <SliderPrimitive.Root
      className={cn("relative flex h-4 w-full touch-none select-none items-center", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 grow rounded-full bg-panel-3/85">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-gradient-to-r from-local/90 to-focus/90" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-3.5 w-3.5 rounded-full border border-foreground/30 bg-foreground shadow" />
    </SliderPrimitive.Root>
  );
}
