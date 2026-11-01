import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <main className="flex flex-1 items-center justify-center px-5">
      <Skeleton className="h-80 w-full max-w-sm rounded-xl" />
    </main>
  )
}
