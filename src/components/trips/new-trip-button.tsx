"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ResponsiveDialog } from "@/components/responsive-dialog"
import { TripForm } from "./trip-form"
import { createClient } from "@/lib/supabase/client"
import { addPeople } from "@/lib/members"

export function NewTripButton() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <>
      <Button onClick={() => setOpen(true)} className="shrink-0">
        <Plus /> New trip
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title="New trip" description="Add who’s coming — they can link their Google account later.">
        <TripForm
          submitLabel="Create trip"
          withPeople
          onSubmit={async ({ people, ...values }) => {
            const supabase = createClient()
            const { data, error } = await supabase.from("trips").insert(values).select("id").single()
            if (error) {
              toast.error(error.message)
              return
            }
            if (people?.length) {
              const res = await addPeople(data.id, people)
              if (res.error) toast.error(`Trip created, but adding people failed: ${res.error.message}`)
            }
            setOpen(false)
            router.push(`/trips/${data.id}`)
          }}
        />
      </ResponsiveDialog>
    </>
  )
}
