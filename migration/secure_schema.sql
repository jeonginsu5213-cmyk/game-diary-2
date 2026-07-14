-- secure_schema.sql
-- Run this in the Supabase SQL Editor to secure the database.

-- 1. Enable pgcrypto extension for signature verification
create extension if not exists pgcrypto;

-- 2. Create a private table to store secrets securely (only accessible by postgres/service_role/security definer functions)
create table if not exists public.private_secrets (
  key text primary key,
  value text not null
);

-- Enable RLS but define NO policies on private_secrets (restricting all public access)
alter table public.private_secrets enable row level security;

-- 3. Create or replace signature verification helper function
create or replace function public.get_auth_user_id()
returns text
language plpgsql
security definer -- Important: security definer runs with creator (superuser) privileges to read private_secrets
as $$
declare
  headers json;
  user_id text;
  signature text;
  expected_signature text;
  secret text;
begin
  -- Get shared secret from private_secrets
  select value into secret from public.private_secrets where key = 'nextauth_secret';
  if secret is null then
    secret := 'default_local_secret_key_for_dev';
  end if;

  -- Get request headers from PostgREST context
  headers := current_setting('request.headers', true)::json;
  if headers is null then
    return null;
  end if;
  
  user_id := headers->>'x-user-id';
  signature := headers->>'x-signature';
  
  if user_id is null or signature is null then
    return null;
  end if;
  
  -- Calculate expected signature using HMAC-SHA256
  expected_signature := encode(hmac(user_id::bytea, secret::bytea, 'sha256'), 'hex');
  
  if signature = expected_signature then
    return user_id;
  else
    return null;
  end if;
exception
  when others then
    return null;
end;
$$;

-- 4. Clean up existing public write policies
drop policy if exists "Allow public insert profiles" on public.profiles;
drop policy if exists "Allow public update profiles" on public.profiles;
drop policy if exists "Allow public insert server_profiles" on public.server_profiles;
drop policy if exists "Allow public update server_profiles" on public.server_profiles;
drop policy if exists "Allow public insert sessions" on public.sessions;
drop policy if exists "Allow public update sessions" on public.sessions;
drop policy if exists "Allow public insert session_participants" on public.session_participants;
drop policy if exists "Allow public update session_participants" on public.session_participants;
drop policy if exists "Allow public insert session_games" on public.session_games;
drop policy if exists "Allow public update session_games" on public.session_games;
drop policy if exists "Allow public insert session_game_players" on public.session_game_players;
drop policy if exists "Allow public update session_game_players" on public.session_game_players;
drop policy if exists "Allow public insert comments" on public.comments;
drop policy if exists "Allow public update comments" on public.comments;
drop policy if exists "Allow public delete comments" on public.comments;
drop policy if exists "Allow public insert screenshots" on public.screenshots;
drop policy if exists "Allow public update screenshots" on public.screenshots;
drop policy if exists "Allow public delete screenshots" on public.screenshots;
drop policy if exists "Allow public insert notifications" on public.notifications;
drop policy if exists "Allow public update notifications" on public.notifications;
drop policy if exists "Allow public delete notifications" on public.notifications;
drop policy if exists "Allow public insert session_favorites" on public.session_favorites;
drop policy if exists "Allow public delete session_favorites" on public.session_favorites;

-- Also clean up the public read policies that were overly permissive
drop policy if exists "Allow public read-only access" on public.notifications;
drop policy if exists "Allow public read-only access" on public.session_favorites;
drop policy if exists "Allow public read-only access" on public.profiles;
drop policy if exists "Allow public read-only access" on public.server_profiles;
drop policy if exists "Allow public read-only access" on public.sessions;
drop policy if exists "Allow public read-only access" on public.session_participants;
drop policy if exists "Allow public read-only access" on public.session_games;
drop policy if exists "Allow public read-only access" on public.session_game_players;
drop policy if exists "Allow public read-only access" on public.comments;
drop policy if exists "Allow public read-only access" on public.screenshots;
drop policy if exists "Allow public read-only access" on public.app_settings;

-- 5. Define Secure RLS Policies

-- profiles
create policy "Allow public read profiles" on public.profiles for select using (true);
create policy "Allow authenticated users to insert own profile" on public.profiles for insert with check (public.get_auth_user_id() = id);
create policy "Allow authenticated users to update own profile" on public.profiles for update using (public.get_auth_user_id() = id);

-- server_profiles
create policy "Allow public read server_profiles" on public.server_profiles for select using (true);
create policy "Allow authenticated users to insert own server profile" on public.server_profiles for insert with check (public.get_auth_user_id() = user_id);
create policy "Allow authenticated users to update own server profile" on public.server_profiles for update using (public.get_auth_user_id() = user_id);

-- sessions
create policy "Allow public read sessions" on public.sessions for select using (true);
create policy "Allow authenticated users to insert sessions" on public.sessions for insert with check (public.get_auth_user_id() is not null);
create policy "Allow session participants to update sessions" on public.sessions for update using (
  exists (
    select 1 from public.session_participants 
    where session_id = sessions.id and user_id = public.get_auth_user_id()
  )
);

-- session_participants
create policy "Allow public read session_participants" on public.session_participants for select using (true);
create policy "Allow authenticated users to insert session_participants" on public.session_participants for insert with check (public.get_auth_user_id() is not null);
create policy "Allow authenticated users to update own participant record" on public.session_participants for update using (public.get_auth_user_id() = user_id);

-- session_games
create policy "Allow public read session_games" on public.session_games for select using (true);
create policy "Allow session participants to insert games" on public.session_games for insert with check (
  exists (
    select 1 from public.session_participants 
    where session_id = session_games.session_id and user_id = public.get_auth_user_id()
  )
);
create policy "Allow session participants to update games" on public.session_games for update using (
  exists (
    select 1 from public.session_participants 
    where session_id = session_games.session_id and user_id = public.get_auth_user_id()
  )
);

-- session_game_players
create policy "Allow public read session_game_players" on public.session_game_players for select using (true);
create policy "Allow authenticated users to insert session_game_players" on public.session_game_players for insert with check (public.get_auth_user_id() is not null);
create policy "Allow authenticated users to update session_game_players" on public.session_game_players for update using (public.get_auth_user_id() is not null);

-- comments
create policy "Allow public read comments" on public.comments for select using (true);
create policy "Allow authenticated users to insert own comments" on public.comments for insert with check (public.get_auth_user_id() = user_id);
create policy "Allow authenticated users to update own comments" on public.comments for update using (public.get_auth_user_id() = user_id);
create policy "Allow authenticated users to delete own comments" on public.comments for delete using (public.get_auth_user_id() = user_id);

-- screenshots
create policy "Allow public read screenshots" on public.screenshots for select using (true);
create policy "Allow authenticated users to insert own screenshots" on public.screenshots for insert with check (public.get_auth_user_id() = uploader_id);
create policy "Allow authenticated users to update own screenshots" on public.screenshots for update using (public.get_auth_user_id() = uploader_id);
create policy "Allow authenticated users to delete own screenshots" on public.screenshots for delete using (public.get_auth_user_id() = uploader_id);

-- notifications (Secure: users can only see and modify their own notifications)
create policy "Allow users to read own notifications" on public.notifications for select using (public.get_auth_user_id() = recipient_id);
create policy "Allow authenticated users to insert notifications" on public.notifications for insert with check (public.get_auth_user_id() is not null);
create policy "Allow users to update own notifications" on public.notifications for update using (public.get_auth_user_id() = recipient_id);
create policy "Allow users to delete own notifications" on public.notifications for delete using (public.get_auth_user_id() = recipient_id);

-- session_favorites (Secure: users can only see and modify their own favorites)
create policy "Allow users to read own favorites" on public.session_favorites for select using (public.get_auth_user_id() = user_id);
create policy "Allow users to insert own favorites" on public.session_favorites for insert with check (public.get_auth_user_id() = user_id);
create policy "Allow users to delete own favorites" on public.session_favorites for delete using (public.get_auth_user_id() = user_id);

-- app_settings
create policy "Allow public read app_settings" on public.app_settings for select using (true);
