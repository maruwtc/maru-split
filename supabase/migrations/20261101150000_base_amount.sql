-- Final amount actually charged in the trip's currency (bank/card statement).
-- When set it overrides amount × fx_rate for totals and balances.
alter table public.expenses add column base_amount numeric(14, 2) check (base_amount is null or base_amount > 0);

-- Replace save_expense with a version that accepts p_base_amount (drop the old
-- signature so calls aren't ambiguous; old clients still work via the default).
drop function if exists public.save_expense(uuid, uuid, text, text, numeric, text, numeric, uuid, text, date, text, jsonb);

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
  p_splits jsonb, -- [{ "member_id": uuid, "share": number, "weight": number|null, "settled": bool }]
  p_base_amount numeric default null -- final amount in trip currency (e.g. from bank statement)
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := p_expense_id;
  v_total numeric;
  v_old jsonb := '{}'::jsonb;
  v_is_note boolean := coalesce(p_amount, 0) = 0;
begin
  if v_is_note then
    p_splits := '[]'::jsonb;
  else
    select coalesce(sum((s ->> 'share')::numeric), 0) into v_total
    from jsonb_array_elements(p_splits) s;
    if jsonb_array_length(p_splits) = 0 then
      raise exception 'Select at least one person to split with';
    end if;
    if abs(v_total - p_amount) > 0.009 then
      raise exception 'Split total (%) does not match amount (%)', v_total, p_amount;
    end if;
  end if;

  if v_id is null then
    insert into public.expenses (trip_id, description, category, amount, currency, fx_rate, paid_by, split_mode, spent_at, notes, base_amount)
    values (p_trip_id, p_description, p_category, coalesce(p_amount, 0), upper(p_currency), p_fx_rate, p_paid_by, p_split_mode, p_spent_at, p_notes,
            case when v_is_note then null else nullif(p_base_amount, 0) end)
    returning id into v_id;
  else
    update public.expenses set
      description = p_description,
      category = p_category,
      amount = coalesce(p_amount, 0),
      currency = upper(p_currency),
      fx_rate = p_fx_rate,
      paid_by = p_paid_by,
      split_mode = p_split_mode,
      spent_at = p_spent_at,
      notes = p_notes,
      base_amount = case when v_is_note then null else nullif(p_base_amount, 0) end,
      updated_at = now()
    where id = v_id and trip_id = p_trip_id;
    if not found then
      raise exception 'Expense not found';
    end if;
    select coalesce(jsonb_object_agg(member_id::text, settled_at), '{}'::jsonb) into v_old
    from public.expense_splits where expense_id = v_id and settled_at is not null;
    delete from public.expense_splits where expense_id = v_id;
  end if;

  insert into public.expense_splits (expense_id, trip_id, member_id, share, weight, settled_at)
  select v_id, p_trip_id, (s ->> 'member_id')::uuid, (s ->> 'share')::numeric, nullif(s ->> 'weight', '')::numeric,
         case when coalesce((s ->> 'settled')::boolean, false)
              then coalesce((v_old ->> (s ->> 'member_id'))::timestamptz, now())
         end
  from jsonb_array_elements(p_splits) s;

  return v_id;
end;
$$;

revoke execute on function public.save_expense(uuid, uuid, text, text, numeric, text, numeric, uuid, text, date, text, jsonb, numeric) from public, anon;
grant execute on function public.save_expense(uuid, uuid, text, text, numeric, text, numeric, uuid, text, date, text, jsonb, numeric) to authenticated;
