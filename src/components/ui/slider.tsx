import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "../../lib/utils";

type SliderProps = SliderPrimitive.SliderProps;

export function Slider({ className, ...props }: SliderProps) {
  return (
    <SliderPrimitive.Root
      className={cn("group relative flex h-4 w-full touch-none select-none items-center", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 grow rounded-full bg-panel-3/85">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-gradient-to-r from-local/90 to-focus/90 transition-all duration-200" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-3.5 w-3.5 rounded-full border border-foreground/30 bg-foreground shadow transition-[transform,box-shadow,border-color] duration-150 hover:scale-110 group-hover:shadow-[0_0_0_6px_rgba(132,164,246,0.12)] focus-visible:scale-110 focus-visible:border-focus/80" />
    </SliderPrimitive.Root>
  );
}
