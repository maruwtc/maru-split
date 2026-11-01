import { createClient } from "@/lib/supabase/client"
import type { Member } from "@/lib/types"

/** Add people without an account (placeholders others can later link to). */
export async function addPeople(tripId: string, names: string[]) {
  const rows = names.map((n) => n.trim()).filter(Boolean).map((display_name) => ({ trip_id: tripId, display_name }))
  if (!rows.length) return { data: [] as Member[], error: null }
  const { data, error } = await createClient()
    .from("trip_members")
    .insert(rows)
    .select("*, profile:profiles(avatar_url, full_name)")
  return { data: (data ?? []) as Member[], error }
}
