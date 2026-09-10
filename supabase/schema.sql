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
  home_clean_sheet_goalkeeper_id uuid references public.players(id) on delete set null,
  away_clean_sheet_goalkeeper_id uuid references public.players(id) on delete set null,
  timer_phase text not null default 'not_started' check (timer_phase in ('not_started', 'first_half', 'half_time', 'second_half', 'full_time', 'penalties')),
  timer_started_at timestamptz,
  timer_elapsed_seconds integer not null default 0 check (timer_elapsed_seconds >= 0),
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
  is_disallowed boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  constraint match_events_no_self_assist check (
    assist_player_id is null or assist_player_id <> player_id
  )
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

create table if not exists public.news_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists players_team_id_idx on public.players(team_id);
create index if not exists matches_kickoff_idx on public.matches(kickoff);
create index if not exists matches_stage_idx on public.matches(stage);
create index if not exists matches_status_idx on public.matches(status);
create index if not exists match_events_match_id_idx on public.match_events(match_id);
create index if not exists match_events_player_id_idx on public.match_events(player_id);
create index if not exists penalty_events_match_id_idx on public.penalty_shootout_events(match_id);
create index if not exists news_posts_published_at_idx on public.news_posts(published_at desc);

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

alter table if exists public.matches
  add column if not exists timer_phase text not null default 'not_started'
    check (timer_phase in ('not_started', 'first_half', 'half_time', 'second_half', 'full_time', 'penalties')),
  add column if not exists timer_started_at timestamptz,
  add column if not exists timer_elapsed_seconds integer not null default 0
    check (timer_elapsed_seconds >= 0);

alter table if exists public.matches
  add column if not exists home_clean_sheet_goalkeeper_id uuid references public.players(id) on delete set null,
  add column if not exists away_clean_sheet_goalkeeper_id uuid references public.players(id) on delete set null;

alter table if exists public.matches replica identity full;

alter table if exists public.match_events
  add column if not exists is_disallowed boolean not null default false;

update public.match_events
set assist_player_id = null
where assist_player_id = player_id;

alter table if exists public.match_events
  drop constraint if exists match_events_no_self_assist,
  add constraint match_events_no_self_assist check (
    assist_player_id is null or assist_player_id <> player_id
  );

alter table if exists public.match_events replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.matches;
  alter publication supabase_realtime add table public.match_events;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

create or replace function public.validate_match_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  home_keeper_team_id uuid;
  away_keeper_team_id uuid;
begin
  if new.winner_team_id is not null and
    new.winner_team_id not in (new.home_team_id, new.away_team_id)
  then
    raise exception 'Winner must be one of the match teams';
  end if;

  if (new.home_penalty_score is null) <> (new.away_penalty_score is null) then
    raise exception 'Enter both penalty scores or leave both blank';
  end if;

  if new.home_penalty_score is not null and new.away_penalty_score is not null then
    if new.stage = 'group' then
      raise exception 'Penalty scores only apply to knockout matches';
    end if;

    if new.home_penalty_score = new.away_penalty_score then
      raise exception 'Penalty score needs a winner';
    end if;

    if new.home_score is not null and
      new.away_score is not null and
      new.home_score <> new.away_score
    then
      raise exception 'Penalty scores only apply when the knockout score is tied';
    end if;
  end if;

  if new.home_clean_sheet_goalkeeper_id is not null then
    if new.status <> 'completed' or new.away_score is distinct from 0 then
      raise exception 'Home clean sheet goalkeeper requires a completed home clean sheet';
    end if;

    select team_id
    into home_keeper_team_id
    from public.players
    where id = new.home_clean_sheet_goalkeeper_id;

    if home_keeper_team_id is distinct from new.home_team_id then
      raise exception 'Home clean sheet goalkeeper must belong to the home team';
    end if;
  end if;

  if new.away_clean_sheet_goalkeeper_id is not null then
    if new.status <> 'completed' or new.home_score is distinct from 0 then
      raise exception 'Away clean sheet goalkeeper requires a completed away clean sheet';
    end if;

    select team_id
    into away_keeper_team_id
    from public.players
    where id = new.away_clean_sheet_goalkeeper_id;

    if away_keeper_team_id is distinct from new.away_team_id then
      raise exception 'Away clean sheet goalkeeper must belong to the away team';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_match_integrity_trigger on public.matches;
create trigger validate_match_integrity_trigger
before insert or update on public.matches
for each row
execute function public.validate_match_integrity();

create or replace function public.validate_match_event_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  match_home_team_id uuid;
  match_away_team_id uuid;
  event_player_team_id uuid;
  assist_player_team_id uuid;
begin
  select home_team_id, away_team_id
  into match_home_team_id, match_away_team_id
  from public.matches
  where id = new.match_id;

  if match_home_team_id is null then
    raise exception 'Selected match was not found';
  end if;

  if new.team_id not in (match_home_team_id, match_away_team_id) then
    raise exception 'Choose one of the teams playing this match';
  end if;

  select team_id
  into event_player_team_id
  from public.players
  where id = new.player_id;

  if event_player_team_id is distinct from new.team_id then
    raise exception 'Choose a player from the selected team';
  end if;

  if new.event_type <> 'goal' and new.assist_player_id is not null then
    raise exception 'Assists can only be added to goal events';
  end if;

  if new.assist_player_id is not null then
    select team_id
    into assist_player_team_id
    from public.players
    where id = new.assist_player_id;

    if assist_player_team_id is distinct from new.team_id then
      raise exception 'Choose an assist from the selected team';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_match_event_integrity_trigger on public.match_events;
create trigger validate_match_event_integrity_trigger
before insert or update on public.match_events
for each row
execute function public.validate_match_event_integrity();

create or replace function public.validate_penalty_event_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  match_stage text;
  match_home_team_id uuid;
  match_away_team_id uuid;
  penalty_player_team_id uuid;
begin
  select stage, home_team_id, away_team_id
  into match_stage, match_home_team_id, match_away_team_id
  from public.matches
  where id = new.match_id;

  if match_stage is null then
    raise exception 'Selected match was not found';
  end if;

  if match_stage = 'group' then
    raise exception 'Penalty events only apply to knockout matches';
  end if;

  if new.team_id not in (match_home_team_id, match_away_team_id) then
    raise exception 'Choose one of the teams playing this match';
  end if;

  select team_id
  into penalty_player_team_id
  from public.players
  where id = new.player_id;

  if penalty_player_team_id is distinct from new.team_id then
    raise exception 'Choose a player from the selected team';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_penalty_event_integrity_trigger
on public.penalty_shootout_events;
create trigger validate_penalty_event_integrity_trigger
before insert or update on public.penalty_shootout_events
for each row
execute function public.validate_penalty_event_integrity();

alter table public.admin_users enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.match_events enable row level security;
alter table public.penalty_shootout_events enable row level security;
alter table public.news_posts enable row level security;

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

drop policy if exists "Public read news posts" on public.news_posts;
create policy "Public read news posts"
on public.news_posts for select
using (true);

drop policy if exists "Admins manage news posts" on public.news_posts;
create policy "Admins manage news posts"
on public.news_posts for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'team-logos',
  'team-logos',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
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
