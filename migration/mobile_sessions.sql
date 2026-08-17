-- Mobile OAuth handoff and server-side sessions for Capacitor iOS/Android apps.
-- Apply this in Supabase before deploying the mobile auth API routes.

create extension if not exists pgcrypto;

create table if not exists public.mobile_auth_requests (
  id uuid primary key,
  platform text not null check (platform in ('ios', 'android')),
  state_hash text not null,
  authorization_code_hash text unique,
  user_id text references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  completed_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mobile_auth_requests_expires_at_idx
  on public.mobile_auth_requests (expires_at);

alter table public.mobile_auth_requests enable row level security;

create table if not exists public.mobile_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  access_token_hash text not null unique,
  refresh_token_hash text not null unique,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mobile_sessions_active_user_idx
  on public.mobile_sessions (user_id, refresh_expires_at)
  where revoked_at is null;

alter table public.mobile_sessions enable row level security;

-- These tables are private. Mobile clients authenticate only through Next.js API
-- routes that use the Supabase service role; no direct client policies are granted.
