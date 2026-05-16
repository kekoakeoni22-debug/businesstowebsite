create table if not exists public.user_credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  credits_remaining integer not null default 4000,
  period_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_credits enable row level security;

drop policy if exists "user_credits_select_own" on public.user_credits;
create policy "user_credits_select_own"
  on public.user_credits
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.get_user_credits(
  p_user_id uuid,
  p_monthly integer default 4000
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_row public.user_credits%rowtype;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'forbidden';
  end if;

  insert into public.user_credits(user_id, credits_remaining, period_started_at, updated_at)
  values (p_user_id, p_monthly, v_now, v_now)
  on conflict (user_id) do nothing;

  select * into v_row
  from public.user_credits
  where user_id = p_user_id
  for update;

  if v_now >= (v_row.period_started_at + interval '1 month') then
    update public.user_credits
    set credits_remaining = p_monthly,
        period_started_at = v_now,
        updated_at = v_now
    where user_id = p_user_id
    returning * into v_row;
  end if;

  return v_row.credits_remaining;
end;
$$;

create or replace function public.consume_generation_credits(
  p_user_id uuid,
  p_cost integer default 100,
  p_monthly integer default 4000
)
returns table(ok boolean, credits_remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_row public.user_credits%rowtype;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'forbidden';
  end if;

  insert into public.user_credits(user_id, credits_remaining, period_started_at, updated_at)
  values (p_user_id, p_monthly, v_now, v_now)
  on conflict (user_id) do nothing;

  select * into v_row
  from public.user_credits
  where user_id = p_user_id
  for update;

  if v_now >= (v_row.period_started_at + interval '1 month') then
    update public.user_credits
    set credits_remaining = p_monthly,
        period_started_at = v_now,
        updated_at = v_now
    where user_id = p_user_id
    returning * into v_row;
  end if;

  if v_row.credits_remaining < p_cost then
    return query select false, v_row.credits_remaining;
    return;
  end if;

  update public.user_credits
  set credits_remaining = v_row.credits_remaining - p_cost,
      updated_at = v_now
  where user_id = p_user_id
  returning * into v_row;

  return query select true, v_row.credits_remaining;
end;
$$;
