var corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: corsHeaders });
  }

  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  var apiKey = context.env.RESEND_API_KEY;

  var body;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  if (!body.to) {
    return new Response(JSON.stringify({ error: 'Recipient email (to) is required' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  var res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: body.from || 'Flair Board <onboarding@resend.dev>',
      to: body.to,
      subject: body.subject || 'Flair Board Verification',
      html: body.html,
    }),
  });

  var data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  return new Response(JSON.stringify(data), {
    status: res.ok ? 200 : res.status,
    headers: corsHeaders,
  });
}
