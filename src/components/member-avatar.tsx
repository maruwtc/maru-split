import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { Member } from "@/lib/types"

const COLORS = [
  "bg-rose-500", "bg-orange-500", "bg-amber-500", "bg-lime-600", "bg-emerald-500",
  "bg-teal-500", "bg-sky-500", "bg-indigo-500", "bg-violet-500", "bg-fuchsia-500",
]

function colorFor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?"
}

export function MemberAvatar({
  member,
  className,
}: {
  member: Pick<Member, "id" | "display_name" | "profile">
  className?: string
}) {
  return (
    <Avatar className={cn("size-8", className)}>
      {member.profile?.avatar_url ? (
        <AvatarImage src={member.profile.avatar_url} alt={member.display_name} referrerPolicy="no-referrer" />
      ) : null}
      <AvatarFallback className={cn("text-xs font-semibold text-white", colorFor(member.id))}>
        {initials(member.display_name)}
      </AvatarFallback>
    </Avatar>
  )
}
