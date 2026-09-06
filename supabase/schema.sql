create extension if not exists "pgcrypto";

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  logo_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  position text not null check (position in ('Goalkeeper', 'Defender', 'Midfielder', 'Forward')),
  jersey_number integer not null check (jersey_number between 1 and 99),
  created_at timestamptz not null default now(),
  unique (team_id, jersey_number)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  stage text not null check (stage in ('group', 'quarter_final', 'semi_final', 'final', 'third_place')),
  home_team_id uuid not null references public.teams(id) on delete restrict,
  away_team_id uuid not null references public.teams(id) on delete restrict,
  kickoff timestamptz not null,
  venue text not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'completed', 'postponed', 'cancelled')),
  home_score integer check (home_score is null or home_score >= 0),
  away_score integer check (away_score is null or away_score >= 0),
  home_penalty_score integer check (home_penalty_score is null or home_penalty_score >= 0),
  away_penalty_score integer check (away_penalty_score is null or away_penalty_score >= 0),
  winner_team_id uuid references public.teams(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);

create table if not exists public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  assist_player_id uuid references public.players(id) on delete set null,
  event_type text not null check (event_type in ('goal', 'own_goal', 'yellow_card', 'red_card')),
  half integer not null check (half in (1, 2)),
  minute integer not null check (minute between 1 and 60),
  added_time integer not null default 0 check (added_time between 0 and 20),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.penalty_shootout_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  kick_number integer not null check (kick_number >= 1),
  outcome text not null check (outcome in ('scored', 'missed', 'saved')),
  created_at timestamptz not null default now(),
  unique (match_id, team_id, kick_number)
);

create index if not exists players_team_id_idx on public.players(team_id);
create index if not exists matches_kickoff_idx on public.matches(kickoff);
create index if not exists matches_stage_idx on public.matches(stage);
create index if not exists match_events_match_id_idx on public.match_events(match_id);
create index if not exists match_events_player_id_idx on public.match_events(player_id);
create index if not exists penalty_events_match_id_idx on public.penalty_shootout_events(match_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where admin_users.user_id = auth.uid()
  );
$$;

grant execute on function public.is_admin() to authenticated;

alter table public.admin_users enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.match_events enable row level security;
alter table public.penalty_shootout_events enable row level security;

drop policy if exists "Admins read admin users" on public.admin_users;
create policy "Admins read admin users"
on public.admin_users for select
to authenticated
using (public.is_admin());

drop policy if exists "Public read teams" on public.teams;
create policy "Public read teams"
on public.teams for select
using (true);

drop policy if exists "Admins manage teams" on public.teams;
create policy "Admins manage teams"
on public.teams for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public read players" on public.players;
create policy "Public read players"
on public.players for select
using (true);

drop policy if exists "Admins manage players" on public.players;
create policy "Admins manage players"
on public.players for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public read matches" on public.matches;
create policy "Public read matches"
on public.matches for select
using (true);

drop policy if exists "Admins manage matches" on public.matches;
create policy "Admins manage matches"
on public.matches for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public read match events" on public.match_events;
create policy "Public read match events"
on public.match_events for select
using (true);

drop policy if exists "Admins manage match events" on public.match_events;
create policy "Admins manage match events"
on public.match_events for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public read penalty events" on public.penalty_shootout_events;
create policy "Public read penalty events"
on public.penalty_shootout_events for select
using (true);

drop policy if exists "Admins manage penalty events" on public.penalty_shootout_events;
create policy "Admins manage penalty events"
on public.penalty_shootout_events for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'team-logos',
  'team-logos',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read team logos" on storage.objects;
create policy "Public read team logos"
on storage.objects for select
using (bucket_id = 'team-logos');

drop policy if exists "Admins upload team logos" on storage.objects;
create policy "Admins upload team logos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'team-logos' and public.is_admin());

drop policy if exists "Admins update team logos" on storage.objects;
create policy "Admins update team logos"
on storage.objects for update
to authenticated
using (bucket_id = 'team-logos' and public.is_admin())
with check (bucket_id = 'team-logos' and public.is_admin());

drop policy if exists "Admins delete team logos" on storage.objects;
create policy "Admins delete team logos"
on storage.objects for delete
to authenticated
using (bucket_id = 'team-logos' and public.is_admin());

-- After creating your Supabase Auth user, run this with your real email:
-- insert into public.admin_users (user_id, email)
-- select id, email from auth.users where email = 'you@example.com'
-- on conflict (user_id) do nothing;
