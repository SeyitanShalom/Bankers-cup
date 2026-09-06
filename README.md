# Bankers Cup

A Next.js competition management website for a 14-team bankers' football tournament.

## Stack

- Next.js for the public site and admin dashboard.
- Supabase Postgres for teams, players, matches, events, and stats.
- Supabase Auth for the single admin account.
- Supabase Storage for team logos.
- Vercel for hosting.

## Local Development

```bash
npm run dev
```

Open `http://localhost:3000`.

Without Supabase environment variables, the site uses demo data and the admin dashboard stores demo edits in browser local storage.

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
