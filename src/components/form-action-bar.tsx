import { cn } from "@/lib/utils"

/**
 * Buttons pinned to the bottom of a ResponsiveDialog (use it with `flush`).
 * Spans the full width of the sheet/dialog and respects the phone's safe area.
 */
export function FormActionBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 -mx-4 flex gap-2 border-t bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:-mx-6 md:px-6 md:pb-6",
        className
      )}
    >
      {children}
    </div>
  )
}
