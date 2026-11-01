import { Suspense } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GoogleSignInButton } from "@/components/google-sign-in-button"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"

export const metadata = { title: "Sign in" }

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-5 py-10">
      <Link href="/">
        <Logo className="text-lg" />
      </Link>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome</CardTitle>
          <CardDescription>Sign in to start splitting trip expenses.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Suspense fallback={<Button size="lg" variant="outline" className="h-12 w-full" disabled>Continue with Google</Button>}>
            <GoogleSignInButton />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  )
}
