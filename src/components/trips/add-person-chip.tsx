"use client"

import { useState } from "react"
import { Check, Loader2, UserPlus, X } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { addPeople } from "@/lib/members"
import type { Member } from "@/lib/types"
import { cn } from "@/lib/utils"

/** A "+ Add person" pill that expands into an inline name field. */
export function AddPersonChip({
  tripId,
  onAdded,
  className,
}: {
  tripId: string
  onAdded: (m: Member) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    const { data, error } = await addPeople(tripId, [name])
    setSaving(false)
    if (error || !data[0]) return toast.error(error?.message ?? "Could not add person")
    onAdded(data[0])
    setName("")
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground",
          className
        )}
      >
        <UserPlus className="size-4" /> Add person
      </button>
    )
  }

  return (
    <div className={cn("flex items-center gap-1 rounded-full border bg-background py-0.5 pl-3 pr-0.5", className)}>
      <Input
        autoFocus
        value={name}
        maxLength={50}
        placeholder="Name (no account needed)"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            save()
          }
          if (e.key === "Escape") setOpen(false)
        }}
        className="h-8 w-44 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      <button type="button" onClick={save} disabled={saving || !name.trim()} className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50" aria-label="Add">
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Cancel">
        <X className="size-4" />
      </button>
    </div>
  )
}
