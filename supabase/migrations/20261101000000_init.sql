-- Maru Split: travel bill splitting schema
-- Run with `supabase db push` or paste into the Supabase SQL editor.


-- ---------------------------------------------------------------------------
-- Profiles (mirrors auth.users; filled from Google metadata)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        avatar_url = excluded.avatar_url;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert or update of raw_user_meta_data on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Trips
-- ---------------------------------------------------------------------------
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  emoji text not null default '✈️',
  base_currency text not null default 'HKD' check (char_length(base_currency) = 3),
  -- { "CNY": 1.08 } => 1 CNY = 1.08 base currency
  fx_rates jsonb not null default '{}'::jsonb,
  start_date date,
  end_date date,
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Trip members (user_id may be null for people without an account yet)
-- ---------------------------------------------------------------------------
create table public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 50),
  created_at timestamptz not null default now(),
  unique (trip_id, user_id),
  unique (trip_id, id)
);
create index trip_members_user_idx on public.trip_members (user_id);

-- ---------------------------------------------------------------------------
-- Expenses + splits
-- ---------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  description text not null check (char_length(description) between 1 and 200),
  category text not null default 'other',
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null check (char_length(currency) = 3),
  fx_rate numeric(18, 8) not null default 1 check (fx_rate > 0),
  paid_by uuid not null,
  split_mode text not null default 'equal' check (split_mode in ('equal', 'exact', 'shares')),
  spent_at date not null default current_date,
  notes text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, id),
  foreign key (trip_id, paid_by) references public.trip_members (trip_id, id) on delete no action deferrable initially deferred
);
create index expenses_trip_idx on public.expenses (trip_id, spent_at desc);

create table public.expense_splits (
  expense_id uuid not null,
  trip_id uuid not null,
  member_id uuid not null,
  share numeric(14, 2) not null check (share >= 0), -- in expense currency
  weight numeric(10, 2), -- only used for split_mode = 'shares'
  primary key (expense_id, member_id),
  foreign key (trip_id, expense_id) references public.expenses (trip_id, id) on delete cascade,
  foreign key (trip_id, member_id) references public.trip_members (trip_id, id) on delete no action deferrable initially deferred
);
create index expense_splits_trip_idx on public.expense_splits (trip_id);

-- ---------------------------------------------------------------------------
-- Settlements (recorded repayments, in trip base currency)
-- ---------------------------------------------------------------------------
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  from_member uuid not null,
  to_member uuid not null,
  amount numeric(14, 2) not null check (amount > 0),
  settled_at date not null default current_date,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (from_member <> to_member),
  foreign key (trip_id, from_member) references public.trip_members (trip_id, id) on delete no action deferrable initially deferred,
  foreign key (trip_id, to_member) references public.trip_members (trip_id, id) on delete no action deferrable initially deferred
);
create index settlements_trip_idx on public.settlements (trip_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_trip_member(p_trip uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = p_trip and m.user_id = (select auth.uid())
  );
$$;

-- Creator automatically becomes the first member.
create or replace function public.add_trip_creator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.trip_members (trip_id, user_id, display_name)
  select new.id, new.created_by,
         coalesce(nullif(split_part(p.full_name, ' ', 1), ''), split_part(p.email, '@', 1), 'Me')
  from public.profiles p where p.id = new.created_by;
  return new;
end;
$$;

create trigger on_trip_created
  after insert on public.trips
  for each row execute function public.add_trip_creator();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements enable row level security;

-- profiles: see yourself and people who share a trip with you
create policy "profiles_select" on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1 from public.trip_members m
    where m.user_id = profiles.id and public.is_trip_member(m.trip_id)
  )
);
create policy "profiles_update_self" on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- trips
create policy "trips_select" on public.trips for select to authenticated
using (public.is_trip_member(id) or created_by = (select auth.uid()));
create policy "trips_insert" on public.trips for insert to authenticated
with check (created_by = (select auth.uid()));
create policy "trips_update" on public.trips for update to authenticated
using (public.is_trip_member(id)) with check (public.is_trip_member(id));
create policy "trips_delete" on public.trips for delete to authenticated
using (created_by = (select auth.uid()));

-- trip_members
create policy "members_select" on public.trip_members for select to authenticated
using (public.is_trip_member(trip_id));
create policy "members_insert" on public.trip_members for insert to authenticated
with check (public.is_trip_member(trip_id) and user_id is null);
create policy "members_update" on public.trip_members for update to authenticated
using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy "members_delete" on public.trip_members for delete to authenticated
using (public.is_trip_member(trip_id) and user_id is null);

-- expenses
create policy "expenses_all" on public.expenses for all to authenticated
using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

-- expense_splits
create policy "splits_all" on public.expense_splits for all to authenticated
using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

-- settlements
create policy "settlements_all" on public.settlements for all to authenticated
using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Save (insert or update) an expense with its splits atomically. Runs as the
-- caller so RLS still applies.
create or replace function public.save_expense(
  p_trip_id uuid,
  p_expense_id uuid,
  p_description text,
  p_category text,
  p_amount numeric,
  p_currency text,
  p_fx_rate numeric,
  p_paid_by uuid,
  p_split_mode text,
  p_spent_at date,
  p_notes text,
  p_splits jsonb -- [{ "member_id": uuid, "share": number, "weight": number|null }]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := p_expense_id;
  v_total numeric;
begin
  select coalesce(sum((s ->> 'share')::numeric), 0) into v_total
  from jsonb_array_elements(p_splits) s;

  if jsonb_array_length(p_splits) = 0 then
    raise exception 'Select at least one person to split with';
  end if;
  if abs(v_total - p_amount) > 0.009 then
    raise exception 'Split total (%) does not match amount (%)', v_total, p_amount;
  end if;

  if v_id is null then
    insert into public.expenses (trip_id, description, category, amount, currency, fx_rate, paid_by, split_mode, spent_at, notes)
    values (p_trip_id, p_description, p_category, p_amount, upper(p_currency), p_fx_rate, p_paid_by, p_split_mode, p_spent_at, p_notes)
    returning id into v_id;
  else
    update public.expenses set
      description = p_description,
      category = p_category,
      amount = p_amount,
      currency = upper(p_currency),
      fx_rate = p_fx_rate,
      paid_by = p_paid_by,
      split_mode = p_split_mode,
      spent_at = p_spent_at,
      notes = p_notes,
      updated_at = now()
    where id = v_id and trip_id = p_trip_id;
    if not found then
      raise exception 'Expense not found';
    end if;
    delete from public.expense_splits where expense_id = v_id;
  end if;

  insert into public.expense_splits (expense_id, trip_id, member_id, share, weight)
  select v_id, p_trip_id, (s ->> 'member_id')::uuid, (s ->> 'share')::numeric, nullif(s ->> 'weight', '')::numeric
  from jsonb_array_elements(p_splits) s;

  return v_id;
end;
$$;

-- Preview a trip from its invite code (caller is not a member yet).
create or replace function public.get_invite(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'emoji', t.emoji,
    'already_member', exists (
      select 1 from public.trip_members m where m.trip_id = t.id and m.user_id = (select auth.uid())
    ),
    'unclaimed', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'display_name', m.display_name) order by m.created_at)
      from public.trip_members m where m.trip_id = t.id and m.user_id is null
    ), '[]'::jsonb)
  )
  from public.trips t
  where t.invite_code = p_code;
$$;

-- Join a trip via invite code, optionally claiming an existing placeholder member.
create or replace function public.join_trip(p_code text, p_member_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip uuid;
  v_uid uuid := auth.uid();
  v_name text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select id into v_trip from public.trips where invite_code = p_code;
  if v_trip is null then
    raise exception 'Invalid invite link';
  end if;

  if exists (select 1 from public.trip_members where trip_id = v_trip and user_id = v_uid) then
    return v_trip;
  end if;

  if p_member_id is not null then
    update public.trip_members set user_id = v_uid
    where id = p_member_id and trip_id = v_trip and user_id is null;
    if found then
      return v_trip;
    end if;
  end if;

  select coalesce(nullif(split_part(full_name, ' ', 1), ''), split_part(email, '@', 1), 'Friend')
    into v_name from public.profiles where id = v_uid;

  insert into public.trip_members (trip_id, user_id, display_name)
  values (v_trip, v_uid, coalesce(v_name, 'Friend'));

  return v_trip;
end;
$$;

revoke execute on function public.get_invite(text) from anon;
revoke execute on function public.join_trip(text, uuid) from anon;
revoke execute on function public.save_expense(uuid, uuid, text, text, numeric, text, numeric, uuid, text, date, text, jsonb) from anon;

-- Members may only rename each other; linking accounts happens via join_trip().
revoke update on public.trip_members from authenticated;
grant update (display_name) on public.trip_members to authenticated;
