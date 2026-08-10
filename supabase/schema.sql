-- StudyFlow persistent backend foundation.
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  grade text,
  subjects text[] default '{}',
  learning_preferences jsonb default '{}'::jsonb,
  notification_preferences jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  subject text,
  grade text,
  duration_minutes integer not null,
  goal text,
  session jsonb not null,
  status text not null default 'in_progress',
  progress integer not null default 0,
  current_step integer not null default 0,
  seconds_spent integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  session_id uuid references public.study_sessions(id) on delete set null,
  action text not null,
  model text,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  estimated_cost numeric,
  cache_hit boolean default false,
  fallback_used boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  properties jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  session_id uuid references public.study_sessions(id) on delete set null,
  rating integer,
  category text,
  message text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.study_sessions enable row level security;
alter table public.ai_interactions enable row level security;
alter table public.analytics_events enable row level security;
alter table public.feedback enable row level security;

create policy "profiles own row" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "sessions own rows" on public.study_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ai interactions own rows" on public.ai_interactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "analytics own rows" on public.analytics_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "feedback own rows" on public.feedback for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name',''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
