"use client"

import { useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, Link2, Loader2, Pencil, Share2, Trash2, UserPlus, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { MemberAvatar } from "@/components/member-avatar"
import { createClient } from "@/lib/supabase/client"
import type { Member, Trip } from "@/lib/types"

export function MembersPanel({
  trip,
  members,
  myMemberId,
}: {
  trip: Trip
  members: Member[]
  myMemberId: string | null
}) {
  const router = useRouter()
  const [newName, setNewName] = useState("")
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [copied, setCopied] = useState(false)

  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ""
  )
  const inviteUrl = `${origin}/join/${trip.invite_code}`

  async function addMember(e: React.FormEvent) {
    e.preventDefault()
    const display_name = newName.trim()
    if (!display_name) return
    setAdding(true)
    const { error } = await createClient().from("trip_members").insert({ trip_id: trip.id, display_name })
    setAdding(false)
    if (error) return toast.error(error.message)
    setNewName("")
    router.refresh()
  }

  async function rename(id: string) {
    const display_name = editName.trim()
    if (!display_name) return
    const { error } = await createClient().from("trip_members").update({ display_name }).eq("id", id)
    if (error) return toast.error(error.message)
    setEditing(null)
    router.refresh()
  }

  async function remove(m: Member) {
    if (!confirm(`Remove ${m.display_name} from this trip?`)) return
    const { error } = await createClient().from("trip_members").delete().eq("id", m.id)
    if (error) {
      return toast.error(
        error.code === "23503" ? `${m.display_name} is part of some expenses. Remove them from those first.` : error.message
      )
    }
    router.refresh()
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    toast.success("Invite link copied")
    setTimeout(() => setCopied(false), 2000)
  }

  async function shareInvite() {
    if (navigator.share) {
      try {
        await navigator.share({ title: trip.name, text: `Join “${trip.name}” on Maru Split`, url: inviteUrl })
      } catch {
        /* cancelled */
      }
    } else {
      copyInvite()
    }
  }

  return (
    <div className="space-y-4">
      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="size-4" /> Invite friends
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-4">
          <p className="text-sm text-muted-foreground">
            Anyone with this link can sign in with Google and join. They can claim a name you&apos;ve already added.
          </p>
          <div className="flex gap-2">
            <Input readOnly value={inviteUrl} className="h-10 font-mono text-xs" onFocus={(e) => e.target.select()} />
            <Button variant="outline" size="icon" className="size-10 shrink-0" onClick={copyInvite} aria-label="Copy invite link">
              {copied ? <Check /> : <Copy />}
            </Button>
            <Button size="icon" className="size-10 shrink-0 md:hidden" onClick={shareInvite} aria-label="Share invite link">
              <Share2 />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">People ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 px-4">
          <ul className="divide-y">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2">
                <MemberAvatar member={m} />
                {editing === m.id ? (
                  <form
                    className="flex flex-1 gap-1"
                    onSubmit={(e) => {
                      e.preventDefault()
                      rename(m.id)
                    }}
                  >
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus maxLength={50} className="h-9" />
                    <Button type="submit" size="icon" variant="ghost" className="size-9" aria-label="Save name"><Check /></Button>
                    <Button type="button" size="icon" variant="ghost" className="size-9" onClick={() => setEditing(null)} aria-label="Cancel"><X /></Button>
                  </form>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {m.display_name}
                        {m.id === myMemberId ? <span className="text-muted-foreground"> (you)</span> : null}
                      </div>
                      {m.user_id ? null : (
                        <Badge variant="outline" className="mt-0.5 text-[10px] font-normal">no account yet</Badge>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      onClick={() => {
                        setEditing(m.id)
                        setEditName(m.display_name)
                      }}
                      aria-label={`Rename ${m.display_name}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    {!m.user_id ? (
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => remove(m)} aria-label={`Remove ${m.display_name}`}>
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </>
                )}
              </li>
            ))}
          </ul>

          <form onSubmit={addMember} className="flex gap-2 pt-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Add a person (e.g. Mom)"
              maxLength={50}
              className="h-10"
            />
            <Button type="submit" className="h-10 shrink-0" disabled={adding || !newName.trim()}>
              {adding ? <Loader2 className="animate-spin" /> : <UserPlus />}
              Add
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
