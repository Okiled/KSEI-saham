import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "../../lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: TabsPrimitive.TabsListProps) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex h-11 items-center rounded-xl border border-border bg-panel/65 p-1 transition-[border-color,background-color,box-shadow] duration-200",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: TabsPrimitive.TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex items-center rounded-lg px-3.5 py-1.5 text-sm font-medium text-muted transition-[color,background-color,box-shadow,transform] duration-200 hover:-translate-y-[1px] hover:text-foreground data-[state=active]:bg-panel-3 data-[state=active]:text-foreground data-[state=active]:shadow-[0_10px_20px_rgba(0,0,0,0.18)]",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: TabsPrimitive.TabsContentProps) {
  return <TabsPrimitive.Content className={cn("mt-4", className)} {...props} />;
}
