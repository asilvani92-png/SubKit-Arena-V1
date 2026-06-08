// Supabase Edge Function: verify-team
// Expects POST { verification_id }
// Reads the verification row using SERVICE_ROLE_KEY and emails admin via Sendinblue

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SENDINBLUE_API_KEY = Deno.env.get('SENDINBLUE_API_KEY');
const APP_BASE_URL = Deno.env.get('APP_BASE_URL') || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SENDINBLUE_API_KEY) {
  console.error('Missing required env vars. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SENDINBLUE_API_KEY');
}

export default async (req, ctx) => {
  try {
    const body = await req.json();
    const id = body.verification_id;
    if (!id) return new Response('verification_id required', { status: 400 });

    // fetch verification row
    const res = await fetch(`${SUPABASE_URL}/rest/v1/team_verifications?id=eq.${id}`, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Accept: 'application/json'
      }
    });
    const rows = await res.json();
    const v = rows && rows[0];
    if (!v) return new Response('verification not found', { status: 404 });

    // read admin email from app_settings
    const sres = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?id=eq.singleton`, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, Accept: 'application/json' }
    });
    const srows = await sres.json();
    const adminEmail = (srows && srows[0] && srows[0].admin_email) || Deno.env.get('ADMIN_EMAIL');
    if (!adminEmail) return new Response('admin email not configured', { status: 500 });

    // build email body
    const approveUrl = `${APP_BASE_URL}/admin?verify_id=${id}`;
    const html = `New team verification submitted:<br/><strong>${v.team_name}</strong><br/>Submitted at: ${v.submitted_at}<br/><a href="${approveUrl}">Open in Admin</a>`;

    // send via Sendinblue
    const emailRes = await fetch('https://api.sendinblue.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': SENDINBLUE_API_KEY },
      body: JSON.stringify({
        sender: { name: 'SubKit', email: 'no-reply@subkit.app' },
        to: [{ email: adminEmail }],
        subject: `New Team Verification: ${v.team_name}`,
        htmlContent: html
      })
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error('Sendinblue error', errText);
      return new Response('email send failed', { status: 500 });
    }

    return new Response('email sent', { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response('internal error', { status: 500 });
  }
}
