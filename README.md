# Bankers Cup

A Next.js competition management website for a 14-team bankers' football tournament.

## Stack

- Next.js for the public site and admin dashboard.
- Supabase Postgres for teams, players, matches, events, news, and stats.
- Supabase Auth for the single admin account.
- Supabase Storage for team logos.
- Vercel for hosting.

## Local Development

```bash
npm run dev
```

Open `http://localhost:3000`.

Without Supabase environment variables, the site uses local JSON data instead of a remote database.

If you cannot create a Supabase project, you can still run the site locally without credentials. The admin dashboard switches into local mode on `localhost` and saves edits to `data/competition.json`. Public pages read the same file through `/api/competition`, so standings, fixtures, stats, news, and live match screens update from that local data.

Local mode is intended for development and content prep on your machine. For a hosted live tournament with shared admin access and real-time updates, use Supabase or another deployed database.

## Supabase Setup

1. Create a Supabase project.
2. Open the SQL editor and run `supabase/schema.sql`.
3. Create your admin user in Supabase Auth.
4. Run the final `insert into public.admin_users...` statement from `supabase/schema.sql` with your real admin email.
5. Copy `.env.example` to `.env.local` and set:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

6. Restart the dev server.

## Tournament Rules Captured

- 14 teams in one group.
- Top 8 qualify for knockouts.
- Matches are 60 minutes: 30 minutes each half.
- Added time is supported, for example `30+1` and `60+2`.
- Knockout draws go straight to penalties.
- Shootout goals are separate from normal goalscorer stats.
- The admin match timer supports first half, half-time, second half, full-time, and penalties for knockout matches.
- Live goal events update the match score, and disallowed goals can be marked so the score and stats correct automatically.
- Clean sheets are credited after full-time by selecting the player who kept goal for any team that conceded 0.
