import { cn } from "@/lib/utils"

/**
 * Buttons pinned to the bottom of a ResponsiveDialog (use it with `flush`).
 * Floating "liquid glass" pill — same look as the trip's bottom navigation bar.
 * Content scrolls underneath and fades out behind it.
 */
export function FormActionBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none sticky bottom-0 z-10 -mx-4 bg-gradient-to-t from-background via-background/70 to-transparent px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] md:-mx-6 md:px-6 md:pb-6",
        className
      )}
    >
      <div
        className={cn(
          "pointer-events-auto relative flex items-center gap-1.5 rounded-full p-1.5",
          "border-2 border-white/70 bg-white/45 backdrop-blur-xl backdrop-saturate-[1.8]",
          "shadow-[0_10px_40px_-8px_rgb(0_0_0/0.25),inset_0_1px_0_rgb(255_255_255/0.9)]",
          "dark:border-white/15 dark:bg-zinc-900/45 dark:shadow-[0_10px_40px_-8px_rgb(0_0_0/0.7),inset_0_1px_0_rgb(255_255_255/0.12)]",
          // pill-shaped buttons inside
          "[&_button]:h-12 [&_button]:rounded-full [&_button]:shadow-none",
          // secondary (outline) buttons become soft glass circles
          "[&_button[data-variant=outline]]:size-12 [&_button[data-variant=outline]]:shrink-0 [&_button[data-variant=outline]]:border-0 [&_button[data-variant=outline]]:bg-zinc-900/10 [&_button[data-variant=outline]]:p-0 dark:[&_button[data-variant=outline]]:bg-white/15"
        )}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80 dark:opacity-30"
        />
        {children}
      </div>
    </div>
  )
}
