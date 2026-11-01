"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MemberAvatar } from "@/components/member-avatar"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

export function JoinTrip({
  code,
  invite,
}: {
  code: string
  invite: { id: string; name: string; emoji: string; unclaimed: { id: string; display_name: string }[] }
}) {
  const router = useRouter()
  const [choice, setChoice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function join() {
    setLoading(true)
    const { data, error } = await createClient().rpc("join_trip", { p_code: code, p_member_id: choice })
    if (error) {
      setLoading(false)
      return toast.error(error.message)
    }
    router.replace(`/trips/${data}`)
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 grid size-16 place-items-center rounded-2xl bg-accent text-3xl">{invite.emoji}</div>
        <CardTitle className="text-xl">Join “{invite.name}”</CardTitle>
        <CardDescription>
          {invite.unclaimed.length ? "Already on the list? Pick your name so past expenses link to you." : "You've been invited to split expenses on this trip."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {invite.unclaimed.length ? (
          <div className="space-y-2">
            {[...invite.unclaimed, { id: "", display_name: "I'm not listed — join as new" }].map((m) => {
              const value = m.id || null
              const active = choice === value
              return (
                <button
                  key={m.id || "new"}
                  type="button"
                  onClick={() => setChoice(value)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition",
                    active ? "border-primary bg-accent ring-2 ring-primary/15" : "hover:bg-muted"
                  )}
                >
                  {m.id ? <MemberAvatar member={{ id: m.id, display_name: m.display_name }} /> : null}
                  <span className={cn("font-medium", !m.id && "text-muted-foreground")}>{m.display_name}</span>
                </button>
              )
            })}
          </div>
        ) : null}
        <Button size="lg" className="h-12 w-full text-base" onClick={join} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : null}
          Join trip
        </Button>
      </CardContent>
    </Card>
  )
}
