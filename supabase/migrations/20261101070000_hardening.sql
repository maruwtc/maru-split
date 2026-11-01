-- Keep the RLS helper out of the exposed API schema.
create schema if not exists private;
grant usage on schema private to authenticated;
alter function public.is_trip_member(uuid) set schema private;

-- Cover foreign keys.
create index if not exists expense_splits_trip_member_idx on public.expense_splits (trip_id, member_id);
create index if not exists expense_splits_trip_expense_idx on public.expense_splits (trip_id, expense_id);
create index if not exists expenses_trip_paid_by_idx on public.expenses (trip_id, paid_by);
create index if not exists expenses_created_by_idx on public.expenses (created_by);
create index if not exists settlements_trip_from_idx on public.settlements (trip_id, from_member);
create index if not exists settlements_trip_to_idx on public.settlements (trip_id, to_member);
create index if not exists settlements_created_by_idx on public.settlements (created_by);
create index if not exists trips_created_by_idx on public.trips (created_by);
