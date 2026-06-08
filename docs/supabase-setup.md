Supabase setup for SubKit

Recommended free backend: Supabase (Postgres, Auth, Storage, Edge Functions).

Why Supabase?
- Full Postgres database with generous free tier
- Built-in Auth (email/password)
- Storage for player photos
- Edge Functions for custom server logic (verification emails, match hooks)

Quick start
1. Create a free account at https://supabase.com and create a new project.
2. In the project settings copy `URL` and `ANON KEY` and set in your frontend `.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

3. Open the SQL editor in Supabase and run `supabase/schema.sql` to create tables.

4. Configure Storage bucket `player-photos` (public or private + signed URLs).

5. Configure SMTP (Settings → Auth → Email) or connect an external provider to send verification and recap emails.

6. Deploy Edge Functions for server logic (optional): verification webhook, match recap generator, email sender.

Sendinblue (recommended) setup
- Create a free Sendinblue account at https://www.sendinblue.com/
- Go to SMTP & API → API keys → create a new API key (v3).
- In Supabase project settings, add the `SENDINBLUE_API_KEY` environment variable with that key.

Edge Functions deployment
- The repo contains example functions in `supabase/functions/` (`verify-team`, `match-recap`).
- Install Supabase CLI and deploy:

```bash
npm install -g supabase
supabase login
supabase init
supabase functions deploy verify-team --project-ref your-project-ref
supabase functions deploy match-recap --project-ref your-project-ref
```

Environment variables to set for functions:
- `SUPABASE_URL` — your project URL
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (server-only)
- `SENDINBLUE_API_KEY` — your Sendinblue API key
- `APP_BASE_URL` — public URL for your frontend (used in admin links)

Triggering verify-team
- The frontend creates a row in `team_verifications`. After that, the frontend attempts to call `supabase.functions.invoke('verify-team')` to notify the admin. Alternatively, create a Postgres trigger that calls the function when a new row is inserted.


Frontend wiring
- Use `src/lib/supabaseClient.js` to interact with Supabase from the frontend.

Notes on email
- Supabase requires an SMTP server for email delivery; use Sendinblue or Mailgun free tiers.
