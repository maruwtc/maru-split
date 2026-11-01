"use client"

import { CalendarDays } from "lucide-react"
import { formatDate } from "@/lib/date"
import { cn } from "@/lib/utils"

/**
 * Shows the date as DD/MM/YYYY regardless of device language, while still
 * using the native date picker (a transparent <input type="date"> on top).
 */
export function DateInput({
  id,
  value,
  onChange,
  min,
  required,
  placeholder = "DD/MM/YYYY",
  className,
}: {
  id?: string
  value: string
  onChange: (iso: string) => void
  min?: string
  required?: boolean
  placeholder?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative flex h-11 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 md:text-sm dark:bg-input/30",
        className
      )}
    >
      <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
      <span className={cn("tabular-nums", !value && "text-muted-foreground")}>{value ? formatDate(value) : placeholder}</span>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker?.()
          } catch {
            /* some browsers only allow it on direct user gesture */
          }
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
      />
    </div>
  )
}
