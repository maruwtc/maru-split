"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CURRENCIES } from "@/lib/money"
import { cn } from "@/lib/utils"

export function CurrencySelect({
  value,
  onChange,
  options,
  className,
  id,
}: {
  value: string
  onChange: (v: string) => void
  options?: readonly string[]
  className?: string
  id?: string
}) {
  const list = Array.from(new Set([...(options ?? []), ...CURRENCIES]))
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className={cn("w-24", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {list.map((c) => (
          <SelectItem key={c} value={c}>{c}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
