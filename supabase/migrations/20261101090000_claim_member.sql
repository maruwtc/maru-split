-- Link the caller's account to a placeholder (no-account) member of a trip
-- they already belong to. Everything recorded under the caller's current
-- member row is merged into the placeholder, then that row is removed.
create or replace function public.claim_member(p_member_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_trip uuid;
  v_self uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select trip_id into v_trip
  from public.trip_members
  where id = p_member_id and user_id is null
  for update;
  if v_trip is null then
    raise exception 'This person is already linked to an account';
  end if;

  select id into v_self
  from public.trip_members
  where trip_id = v_trip and user_id = v_uid
  for update;
  if v_self is null then
    raise exception 'Join the trip first';
  end if;

  -- Settlements between the two rows become meaningless; drop them, re-point the rest.
  delete from public.settlements
  where trip_id = v_trip
    and ((from_member = v_self and to_member = p_member_id) or (from_member = p_member_id and to_member = v_self));
  update public.settlements set from_member = p_member_id where trip_id = v_trip and from_member = v_self;
  update public.settlements set to_member = p_member_id where trip_id = v_trip and to_member = v_self;

  -- Expenses split with both: fold the caller's share into the placeholder's.
  update public.expense_splits ps
  set share = ps.share + ss.share,
      weight = case when ps.weight is null and ss.weight is null then null
                    else coalesce(ps.weight, 0) + coalesce(ss.weight, 0) end
  from public.expense_splits ss
  where ps.trip_id = v_trip and ss.trip_id = v_trip
    and ps.expense_id = ss.expense_id
    and ps.member_id = p_member_id and ss.member_id = v_self;
  delete from public.expense_splits ss
  where ss.trip_id = v_trip and ss.member_id = v_self
    and exists (select 1 from public.expense_splits ps
                where ps.expense_id = ss.expense_id and ps.member_id = p_member_id);
  update public.expense_splits set member_id = p_member_id where trip_id = v_trip and member_id = v_self;

  update public.expenses set paid_by = p_member_id where trip_id = v_trip and paid_by = v_self;

  delete from public.trip_members where id = v_self;
  update public.trip_members set user_id = v_uid where id = p_member_id;

  return v_trip;
end;
$$;

revoke execute on function public.claim_member(uuid) from public, anon;
grant execute on function public.claim_member(uuid) to authenticated;
