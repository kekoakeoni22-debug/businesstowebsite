create table if not exists public.subscription_cancellations (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  reason text not null default '',
  created_at timestamptz not null default now()
);

alter table public.subscription_cancellations enable row level security;

drop policy if exists "Users can read own cancellation rows" on public.subscription_cancellations;
create policy "Users can read own cancellation rows"
  on public.subscription_cancellations
  for select
  to authenticated
  using (auth.uid() = user_id);
