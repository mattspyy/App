-- V3 migration: Supabase auth + parties.
-- Paste into Supabase Dashboard → SQL Editor → New query → Run.
-- Re-runs are safe (uses IF NOT EXISTS).

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  pin_hash text not null,
  invite_code text unique not null,
  base_currency text not null default 'HKD',
  ai_calls_per_minute integer not null default 2,
  created_at timestamptz not null default now()
);

-- Idempotent column add for existing deployments where the table predates this column.
alter table public.users
  add column if not exists ai_calls_per_minute integer not null default 2;

create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  party_name text not null,
  type text not null check (type in ('private', 'public')),
  party_code text unique,
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists parties_user_personal_unique
  on public.parties (created_by)
  where party_name = 'Personal' and type = 'private';

create table if not exists public.party_members (
  party_id uuid not null references public.parties(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (party_id, user_id)
);

create index if not exists party_members_user_idx on public.party_members (user_id);

-- All access is via the server using the service-role key, so RLS is not enforced here.
-- If you ever want to expose tables directly to the anon key, enable RLS first.

create table if not exists public.custom_payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists custom_payment_methods_user_idx on public.custom_payment_methods (user_id);

create table if not exists public.category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  group_id uuid references public.parties(id) on delete cascade,
  merchant_keyword text not null,
  category text not null,
  created_at timestamptz not null default now(),
  unique (user_id, group_id, merchant_keyword)
);

create index if not exists category_rules_user_idx on public.category_rules (user_id);
create index if not exists category_rules_keyword_idx on public.category_rules (merchant_keyword);

create table if not exists public.settlement_payments (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.users(id) on delete cascade,
  to_user_id uuid not null references public.users(id) on delete cascade,
  amount numeric(14, 2) not null,
  currency text not null,
  group_id uuid not null references public.parties(id) on delete cascade,
  trip_id text,
  date date not null default current_date,
  status text not null default 'paid' check (status in ('pending', 'paid')),
  created_at timestamptz not null default now()
);

create index if not exists settlement_payments_group_idx on public.settlement_payments (group_id);
create index if not exists settlement_payments_trip_idx on public.settlement_payments (trip_id);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.parties(id) on delete cascade,
  trip_id text,
  amount numeric(14, 2) not null,
  currency text not null,
  period_type text not null check (period_type in ('monthly', 'trip_total')),
  start_date date,
  end_date date,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, trip_id, period_type)
);

create index if not exists budgets_group_idx on public.budgets (group_id);
create index if not exists budgets_trip_idx on public.budgets (trip_id);
