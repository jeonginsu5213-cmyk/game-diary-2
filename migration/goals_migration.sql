-- DDL for Today's Goals Feature

CREATE TABLE IF NOT EXISTS public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text REFERENCES public.sessions(id) ON DELETE CASCADE,
  guild_id text NOT NULL,
  game_name text NOT NULL,
  creator_id text REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  is_achieved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- Define Policies
CREATE POLICY "Allow public read-only access" ON public.goals FOR SELECT USING (true);
CREATE POLICY "Allow public insert goals" ON public.goals FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update goals" ON public.goals FOR UPDATE USING (true);
CREATE POLICY "Allow public delete goals" ON public.goals FOR DELETE USING (true);
