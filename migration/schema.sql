-- Supabase / Postgres Schema for Game Diary (Actual)
-- Follows the structure used in migrate.js and the application code

-- 1. Enable necessary extensions
create extension if not exists "uuid-ossp";

-- 2. Profiles (Users)
create table if not exists public.profiles (
  id text primary key, -- Discord User ID
  display_name text,
  avatar_url text,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

-- 3. Server Profiles (Nickname per Server)
create table if not exists public.server_profiles (
  id bigint generated always as identity primary key,
  user_id text references public.profiles(id) on delete cascade,
  guild_name text not null,
  nickname text,
  avatar_url text,
  created_at timestamptz default now(),
  unique(user_id, guild_name)
);

-- 4. Sessions (Game recording sessions)
create table if not exists public.sessions (
  id text primary key, -- Can be UUID or custom string from Discord
  start_time timestamptz not null,
  end_time timestamptz,
  channel_name text,
  title text,
  guild_name text,
  guild_icon text,
  total_duration_min integer default 0,
  created_at timestamptz default now()
);

-- 5. Session Participants
create table if not exists public.session_participants (
  id bigint generated always as identity primary key,
  session_id text references public.sessions(id) on delete cascade,
  user_id text references public.profiles(id) on delete cascade,
  duration_min integer default 0,
  created_at timestamptz default now(),
  unique(session_id, user_id)
);

-- 6. Session Games (Games played within a session)
create table if not exists public.session_games (
  id uuid primary key default gen_random_uuid(),
  session_id text references public.sessions(id) on delete cascade,
  title text not null,
  icon_url text,
  play_time_min integer default 0,
  start_time timestamptz not null,
  end_time timestamptz,
  created_at timestamptz default now(),
  unique(session_id, title, start_time)
);

-- 7. Session Game Players (Play time per game)
create table if not exists public.session_game_players (
  game_id uuid references public.session_games(id) on delete cascade,
  user_id text references public.profiles(id) on delete cascade,
  play_time_min integer default 0,
  primary key (game_id, user_id)
);

-- 8. Comments
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.session_games(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  content text not null,
  is_checklist boolean default false,
  reactions jsonb default '{}',
  replies jsonb default '[]',
  created_at timestamptz default now(),
  unique(game_id, user_id, content, created_at)
);

-- 9. Screenshots
create table if not exists public.screenshots (
  id uuid primary key default gen_random_uuid(),
  session_id text references public.sessions(id) on delete cascade,
  game_title text, -- Linked by title instead of ID for flexibility
  url text not null,
  uploader_id text references public.profiles(id) on delete cascade,
  comment text,
  created_at timestamptz default now(),
  unique(session_id, url)
);

-- 10. Enable RLS
alter table public.profiles enable row level security;
alter table public.server_profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.session_participants enable row level security;
alter table public.session_games enable row level security;
alter table public.session_game_players enable row level security;
alter table public.comments enable row level security;
alter table public.screenshots enable row level security;

-- 11. Define Policies
create policy "Allow public read-only access" on public.profiles for select using (true);
create policy "Allow public read-only access" on public.server_profiles for select using (true);
create policy "Allow public read-only access" on public.sessions for select using (true);
create policy "Allow public read-only access" on public.session_participants for select using (true);
create policy "Allow public read-only access" on public.session_games for select using (true);
create policy "Allow public read-only access" on public.session_game_players for select using (true);
create policy "Allow public read-only access" on public.comments for select using (true);
create policy "Allow public read-only access" on public.screenshots for select using (true);

-- Note: Write policies should be added based on authentication requirements.
-- Typically, the bot (service_role) handles most writes, so public write policies are not needed.
