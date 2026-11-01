import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold">Trip not found</h1>
      <p className="text-sm text-muted-foreground">It may have been deleted, or you&apos;re not a member yet. Ask for an invite link.</p>
      <Button asChild><Link href="/trips">Back to trips</Link></Button>
    </main>
  )
}
