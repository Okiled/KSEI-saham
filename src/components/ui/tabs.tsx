import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "../../lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: TabsPrimitive.TabsListProps) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex h-10 items-center rounded-full border border-[#D8CDBF] bg-[#FFF8F0] p-1 shadow-[0_10px_22px_rgba(95,73,47,0.05)] transition-[border-color,background-color,box-shadow] duration-200",
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
        "inline-flex items-center rounded-full px-3.5 py-1 text-[13px] font-semibold text-[#665A4F] transition-[color,background-color,box-shadow,transform] duration-200 hover:-translate-y-[1px] hover:bg-[#F0E7DB] hover:text-[#1C1713] data-[state=active]:bg-[#1D4C45] data-[state=active]:text-[#FFF9F1] data-[state=active]:shadow-[0_8px_18px_rgba(29,76,69,0.18)]",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: TabsPrimitive.TabsContentProps) {
  return <TabsPrimitive.Content className={cn("mt-4", className)} {...props} />;
}
