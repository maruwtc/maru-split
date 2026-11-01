import { redirect } from "next/navigation"
import { Logo } from "@/components/logo"
import { JoinTrip } from "@/components/trips/join-trip"
import { requireUser } from "@/lib/supabase/server"

export const metadata = { title: "Join trip" }

interface Invite {
  id: string
  name: string
  emoji: string
  already_member: boolean
  unclaimed: { id: string; display_name: string }[]
}

export default async function JoinPage({ params, searchParams }: PageProps<"/join/[code]">) {
  const { code } = await params
  const { as } = await searchParams
  const asMember = typeof as === "string" ? as : null
  const { supabase } = await requireUser(`/join/${code}${asMember ? `?as=${encodeURIComponent(asMember)}` : ""}`)
  const { data } = await supabase.rpc("get_invite", { p_code: code })
  const invite = data as Invite | null

  // Personal link for a placeholder that is still unclaimed?
  const target = asMember ? invite?.unclaimed.find((m) => m.id === asMember) ?? null : null

  if (invite?.already_member && !target) redirect(`/trips/${invite.id}`)

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-5 py-10">
      <Logo className="text-lg" />
      {invite ? (
        <JoinTrip code={code} invite={invite} target={target} />
      ) : (
        <div className="text-center">
          <h1 className="text-xl font-semibold">Invite link not valid</h1>
          <p className="text-sm text-muted-foreground">Ask the trip organiser for a new link.</p>
        </div>
      )}
    </main>
  )
}
