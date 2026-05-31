export async function onRequest(context) {
  var url = new URL(context.request.url).searchParams.get('url');
  if (!url) {
    return new Response(JSON.stringify({ error: 'url required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    var parsed = new URL(url);
    var base = parsed.protocol + '//' + parsed.host;
    var resp = await fetch(base);
    if (!resp.ok) throw new Error('Fetch failed: ' + resp.status);
    var html = await resp.text();

    var title = '';
    var m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (m) title = m[1].trim();
    if (!title) title = parsed.hostname.replace(/^www\./, '');

    var href = '';
    var patterns = [
      /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i,
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i,
      /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i,
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon["']/i,
    ];
    for (var p of patterns) {
      m = html.match(p);
      if (m) { href = m[1]; break; }
    }
    if (href) {
      href = new URL(href, base).href;
    } else {
      href = base + '/favicon.ico';
    }

    return Response.json({ favicon: href, title: title }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
