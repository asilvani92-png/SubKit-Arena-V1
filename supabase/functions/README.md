Deploying Edge Functions (Supabase)

This folder contains two example Edge Functions:
- `verify-team` — notifies the admin when a user submits a team for verification.
- `match-recap` — builds and emails a match recap to players after completion.

Environment variables (set in Supabase project -> Settings -> Environment Variables):
- SUPABASE_URL: your supabase project URL
- SUPABASE_SERVICE_ROLE_KEY: service role key (server-side)
- SENDINBLUE_API_KEY: Sendinblue API key for sending emails
- APP_BASE_URL: public URL of your frontend (used in verify-team email links)
- ADMIN_EMAIL: optional fallback admin email

Deploy steps (Supabase CLI):
1. Install Supabase CLI: `npm install -g supabase`
2. Login: `supabase login`
3. From this folder run: `supabase functions deploy verify-team --project-ref your-project-ref`
4. Set the environment variables in the Supabase dashboard or via CLI.

Notes:
- Edge Functions use Deno. The example code uses `fetch` and Deno.env.
- You can trigger `verify-team` from your frontend after creating a `team_verifications` row, or create a DB trigger to call the function.
- Adjust sender email and templates to match your branding.

Security:
- Keep `SUPABASE_SERVICE_ROLE_KEY` secret — do not expose it to client-side code.
- Use signed URLs for private storage buckets if desired.
