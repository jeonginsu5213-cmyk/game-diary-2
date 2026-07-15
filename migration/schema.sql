-- Supabase / Postgres Schema for Game Diary (Actual)
-- Follows the structure used in migrate.js and the application code

-- 1. Enable necessary extensions
create extension if not exists "uuid-ossp";

-- 2. Profiles (Users)
create table if not exists public.profiles (
  id text primary key, -- Discord User ID
  display_name text,
  avatar_url text,
  has_logged_in boolean default false,
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

-- 10. Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id text not null references public.profiles(id) on delete cascade,
  sender_id text references public.profiles(id) on delete cascade,
  type text not null,
  source_id text,
  content text not null,
  read boolean default false,
  created_at timestamptz default now()
);

-- 11. Enable RLS
alter table public.profiles enable row level security;
alter table public.server_profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.session_participants enable row level security;
alter table public.session_games enable row level security;
alter table public.session_game_players enable row level security;
alter table public.comments enable row level security;
alter table public.screenshots enable row level security;
alter table public.notifications enable row level security;
alter table public.session_favorites enable row level security;
alter table public.app_settings enable row level security;

-- 12. Define Policies (Read Policies)
create policy "Allow public read-only access" on public.profiles for select using (true);
create policy "Allow public read-only access" on public.server_profiles for select using (true);
create policy "Allow public read-only access" on public.sessions for select using (true);
create policy "Allow public read-only access" on public.session_participants for select using (true);
create policy "Allow public read-only access" on public.session_games for select using (true);
create policy "Allow public read-only access" on public.session_game_players for select using (true);
create policy "Allow public read-only access" on public.comments for select using (true);
create policy "Allow public read-only access" on public.screenshots for select using (true);
create policy "Allow public read-only access" on public.notifications for select using (true);
create policy "Allow public read-only access" on public.session_favorites for select using (true);
create policy "Allow public read-only access" on public.app_settings for select using (true);

-- 13. Define Policies (Write/Mutation Policies for public/anon web operations)
create policy "Allow public insert profiles" on public.profiles for insert with check (true);
create policy "Allow public update profiles" on public.profiles for update using (true);

create policy "Allow public insert server_profiles" on public.server_profiles for insert with check (true);
create policy "Allow public update server_profiles" on public.server_profiles for update using (true);

create policy "Allow public insert sessions" on public.sessions for insert with check (true);
create policy "Allow public update sessions" on public.sessions for update using (true);

create policy "Allow public insert session_participants" on public.session_participants for insert with check (true);
create policy "Allow public update session_participants" on public.session_participants for update using (true);

create policy "Allow public insert session_games" on public.session_games for insert with check (true);
create policy "Allow public update session_games" on public.session_games for update using (true);

create policy "Allow public insert session_game_players" on public.session_game_players for insert with check (true);
create policy "Allow public update session_game_players" on public.session_game_players for update using (true);

create policy "Allow public insert comments" on public.comments for insert with check (true);
create policy "Allow public update comments" on public.comments for update using (true);
create policy "Allow public delete comments" on public.comments for delete using (true);

create policy "Allow public insert screenshots" on public.screenshots for insert with check (true);
create policy "Allow public update screenshots" on public.screenshots for update using (true);
create policy "Allow public delete screenshots" on public.screenshots for delete using (true);

create policy "Allow public insert notifications" on public.notifications for insert with check (true);
create policy "Allow public update notifications" on public.notifications for update using (true);
create policy "Allow public delete notifications" on public.notifications for delete using (true);

create policy "Allow public insert session_favorites" on public.session_favorites for insert with check (true);
create policy "Allow public delete session_favorites" on public.session_favorites for delete using (true);

-- 14. Goals (Today's Goals)
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  session_id text references public.sessions(id) on delete cascade,
  guild_id text not null,
  game_name text not null,
  creator_id text references public.profiles(id) on delete cascade,
  title text not null,
  is_achieved boolean default false,
  created_at timestamptz default now()
);

alter table public.goals enable row level security;

create policy "Allow public read-only access" on public.goals for select using (true);
create policy "Allow public insert goals" on public.goals for insert with check (true);
create policy "Allow public update goals" on public.goals for update using (true);
create policy "Allow public delete goals" on public.goals for delete using (true);

