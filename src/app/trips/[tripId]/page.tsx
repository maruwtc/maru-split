import { notFound } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { TripView } from "@/components/trips/trip-view"
import { requireUser } from "@/lib/supabase/server"
import type { Expense, Member, Settlement, Trip } from "@/lib/types"

export async function generateMetadata({ params }: PageProps<"/trips/[tripId]">) {
  const { tripId } = await params
  const { supabase } = await requireUser()
  const { data } = await supabase.from("trips").select("name").eq("id", tripId).maybeSingle()
  return { title: data?.name ?? "Trip" }
}

export default async function TripPage({ params }: PageProps<"/trips/[tripId]">) {
  const { tripId } = await params
  const { supabase, user } = await requireUser(`/trips/${tripId}`)

  const [tripRes, membersRes, expensesRes, settlementsRes] = await Promise.all([
    supabase.from("trips").select("*").eq("id", tripId).maybeSingle(),
    supabase
      .from("trip_members")
      .select("*, profile:profiles(avatar_url, full_name)")
      .eq("trip_id", tripId)
      .order("created_at"),
    supabase
      .from("expenses")
      .select("*, expense_splits(member_id, share, weight, settled_at)")
      .eq("trip_id", tripId)
      .order("spent_at", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("settlements").select("*").eq("trip_id", tripId).order("created_at", { ascending: false }),
  ])

  if (!tripRes.data) notFound()

  return (
    <>
      <AppHeader user={user} />
      <TripView
        trip={tripRes.data as Trip}
        members={(membersRes.data ?? []) as Member[]}
        expenses={(expensesRes.data ?? []) as Expense[]}
        settlements={(settlementsRes.data ?? []) as Settlement[]}
        currentUserId={user.id}
      />
    </>
  )
}
