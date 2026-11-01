# Maru Split

Split travel bills with friends. Log a spend, pick who paid and who it was for, and see who owes whom. It works on mobile and desktop.

**Stack:** Next.js 16 (App Router) · shadcn/ui + Tailwind v4 · Supabase (Postgres + RLS + Google OAuth) · Vercel

## Features

- **Google sign-in** via Supabase Auth
- **Trips** with an emoji, dates, a settle-up currency (e.g. HKD) and exchange rates (e.g. 1 CNY = 1.08 HKD)
- **Add expense:** amount + currency, description, category, **paid by** (tap a person), **split between** (tap people). Split **equally**, by **exact amounts** or by **shares**, with cent-exact rounding
- **Balances & settle up:** net balance per person and a minimal list of transfers. Tap **Paid** to record a repayment
- **People:** add travellers who don't have an account yet. Share an invite link, and friends who sign in can claim their name so past expenses link to them
- Filter expenses by person, export to CSV, dark mode
- **Responsive UI:** bottom-sheet drawer + floating “Add expense” button on phones, two-column layout with dialogs on desktop

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema: open **SQL Editor**, paste `supabase/migrations/20261101000000_init.sql` and run it.
   (Or with the CLI: `supabase link --project-ref <ref> && supabase db push`.)
3. **Google provider:** in Google Cloud Console create an OAuth client ID (type *Web application*) with the
   authorized redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`.
   Then in Supabase go to **Authentication → Sign In / Providers → Google**, enable it and paste the client ID and secret.
4. **Authentication → URL Configuration:** set **Site URL** to your production URL and add redirect URLs:
   - `http://localhost:3000/**`
   - `https://<your-app>.vercel.app/**`
   - `https://*-<your-team>.vercel.app/**` (preview deployments)

### 2. Local development

```bash
cp .env.example .env.local   # fill in URL + publishable (or anon) key from Supabase → Project Settings → API
npm install
npm run dev
```

### 3. Deploy to Vercel

Import the repo in Vercel (framework preset: Next.js) and add these environment variables:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key (`NEXT_PUBLIC_SUPABASE_ANON_KEY` also works) |

You can also use the Vercel ↔ Supabase marketplace integration, which sets these automatically.

## Project structure

```
src/
  proxy.ts                     # refreshes the Supabase session, guards routes (Next 16 "proxy" = old middleware)
  app/
    page.tsx                   # landing
    login/                     # Google sign-in
    auth/callback, auth/signout
    trips/                     # trip list
    trips/[tripId]/            # trip: expenses, balances, people
    join/[code]/               # invite links
  components/trips/            # expense form, list, balances, members, trip form
  lib/
    split.ts                   # equal / exact / shares split with cent rounding
    balances.ts                # balances + settle-up transfers
    supabase/                  # browser / server / proxy clients
supabase/migrations/           # schema, RLS policies, RPCs (save_expense, join_trip, get_invite)
```

## Data model

- `trips`: base currency, `fx_rates` JSON, invite code
- `trip_members`: a person on a trip. `user_id` is null until they join with Google
- `expenses`: amount, currency, `fx_rate` to the base currency, `paid_by`, `split_mode`
- `expense_splits`: per-person share (in the expense currency)
- `settlements`: recorded repayments (in the base currency)

Row-level security restricts every table to members of the trip. Expenses and their splits are saved together in one transaction through the `save_expense` RPC.
