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

type Person = { id: string; display_name: string }

export function JoinTrip({
  code,
  invite,
  target,
}: {
  code: string
  invite: { id: string; name: string; emoji: string; already_member: boolean; unclaimed: Person[] }
  /** Placeholder chosen by a personal invite link (?as=…), if still unclaimed. */
  target: Person | null
}) {
  const router = useRouter()
  const [choice, setChoice] = useState<string | null>(target?.id ?? null)
  const [loading, setLoading] = useState(false)

  async function join() {
    setLoading(true)
    const supabase = createClient()
    // Already in the trip under another name → merge into the placeholder.
    const { data, error } = invite.already_member
      ? await supabase.rpc("claim_member", { p_member_id: choice })
      : await supabase.rpc("join_trip", { p_code: code, p_member_id: choice })
    if (error) {
      setLoading(false)
      return toast.error(error.message)
    }
    router.replace(`/trips/${data}`)
  }

  if (invite.already_member && target) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2"><MemberAvatar member={target} className="size-16 text-lg" /></div>
          <CardTitle className="text-xl">Are you {target.display_name}?</CardTitle>
          <CardDescription>
            You&apos;re already in “{invite.name}”. Linking moves everything under your current name to{" "}
            {target.display_name}, and {target.display_name} becomes your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button size="lg" className="h-12 w-full text-base" onClick={join} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : null}
            Yes, link my account
          </Button>
          <Button size="lg" variant="ghost" className="h-12 w-full" onClick={() => router.replace(`/trips/${invite.id}`)}>
            No, go to trip
          </Button>
        </CardContent>
      </Card>
    )
  }

  const options: { id: string | null; display_name: string }[] = target
    ? [target, { id: null, display_name: `I'm not ${target.display_name} — join as new` }]
    : [...invite.unclaimed, { id: null, display_name: "I'm not listed — join as new" }]

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 grid size-16 place-items-center rounded-2xl bg-accent text-3xl">{invite.emoji}</div>
        <CardTitle className="text-xl">Join “{invite.name}”</CardTitle>
        <CardDescription>
          {target
            ? `You were invited as ${target.display_name}. Expenses already recorded for them will be linked to you.`
            : invite.unclaimed.length
              ? "Already on the list? Pick your name so past expenses link to you."
              : "You've been invited to split expenses on this trip."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {target || invite.unclaimed.length ? (
          <div className="space-y-2">
            {options.map((m) => {
              const active = choice === m.id
              return (
                <button
                  key={m.id ?? "new"}
                  type="button"
                  onClick={() => setChoice(m.id)}
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
          {choice && target ? `Join as ${target.display_name}` : "Join trip"}
        </Button>
      </CardContent>
    </Card>
  )
}
