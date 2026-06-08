// Supabase Edge Function: match-recap
// Expects POST { match_id }
// Reads match and messages, builds a recap, and emails both players via Sendinblue

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SENDINBLUE_API_KEY = Deno.env.get('SENDINBLUE_API_KEY');

export default async (req, ctx) => {
  try {
    const body = await req.json();
    const matchId = body.match_id;
    if (!matchId) return new Response('match_id required', { status: 400 });

    // fetch match
    const res = await fetch(`${SUPABASE_URL}/rest/v1/matches?id=eq.${matchId}`, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, Accept: 'application/json' }
    });
    const rows = await res.json();
    const m = rows && rows[0];
    if (!m) return new Response('match not found', { status: 404 });

    // fetch users' emails from users table (assuming emails stored)
    const userIds = [m.home_user, m.away_user].filter(Boolean);
    const ures = await fetch(`${SUPABASE_URL}/rest/v1/users?id=in.(${userIds.join(',')})`, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, Accept: 'application/json' }
    });
    const users = await ures.json();

    const recapHtml = `<h3>Match Recap: ${m.id}</h3><p>Result: ${m.status}</p><pre>${JSON.stringify(m.action_log || [], null, 2)}</pre>`;

    // send to both emails if present (look for email field)
    const recipients = users.map(u => ({ email: u.email })).filter(r => r.email);
    if (recipients.length === 0) return new Response('no recipient emails found', { status: 500 });

    const emailRes = await fetch('https://api.sendinblue.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': SENDINBLUE_API_KEY },
      body: JSON.stringify({ sender: { name: 'SubKit', email: 'no-reply@subkit.app' }, to: recipients, subject: `Match recap: ${m.id}`, htmlContent: recapHtml })
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error('Sendinblue error', errText);
      return new Response('email send failed', { status: 500 });
    }

    return new Response('recap sent', { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response('internal error', { status: 500 });
  }
}
