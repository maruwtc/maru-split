"use client"

import { useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, Link2, Loader2, MoreHorizontal, Pencil, Send, Share2, Trash2, UserCheck, UserPlus, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

  const personalUrl = (m: Member) => `${inviteUrl}?as=${m.id}`

  async function sendPersonalInvite(m: Member) {
    const url = personalUrl(m)
    if (navigator.share) {
      try {
        await navigator.share({ title: trip.name, text: `${m.display_name}, join “${trip.name}” on Maru Split`, url })
        return
      } catch {
        /* cancelled — fall back to copy */
      }
    }
    await navigator.clipboard.writeText(url)
    toast.success(`Invite link for ${m.display_name} copied`, {
      description: "When they sign in with Google, they're linked to this person.",
    })
  }

  async function claim(m: Member) {
    if (
      !confirm(
        `Link your account to “${m.display_name}”?\n\nEverything recorded under your current name in this trip moves to ${m.display_name}.`
      )
    )
      return
    const { error } = await createClient().rpc("claim_member", { p_member_id: m.id })
    if (error) return toast.error(error.message)
    toast.success(`You're now ${m.display_name}`)
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
            Anyone with this link can sign in with Google and join. People without an account can tap “Invite” next to their name to get a personal link that signs them in as that person.
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
                    {!m.user_id ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 shrink-0"
                        onClick={() => sendPersonalInvite(m)}
                        aria-label={`Send invite link to ${m.display_name}`}
                      >
                        <Send className="size-3.5" /> Invite
                      </Button>
                    ) : null}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="size-8 shrink-0" aria-label={`Options for ${m.display_name}`}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem
                          onSelect={() => {
                            setEditing(m.id)
                            setEditName(m.display_name)
                          }}
                        >
                          <Pencil /> Rename
                        </DropdownMenuItem>
                        {!m.user_id ? (
                          <>
                            <DropdownMenuItem onSelect={() => sendPersonalInvite(m)}>
                              <Send /> Send personal invite link
                            </DropdownMenuItem>
                            {myMemberId ? (
                              <DropdownMenuItem onSelect={() => claim(m)}>
                                <UserCheck /> This is me — link my account
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => remove(m)}>
                              <Trash2 /> Remove
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </li>
            ))}
          </ul>

          <form onSubmit={addMember} className="flex gap-2 pt-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Add someone without an account (e.g. Mom)"
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
