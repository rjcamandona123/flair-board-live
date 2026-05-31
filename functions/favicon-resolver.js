import * as cheerio from 'cheerio';

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
    var $ = cheerio.load(html);

    var href = null;
    var selectors = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]',
      'link[rel~="icon"]',
    ];
    for (var sel of selectors) {
      href = $(sel).attr('href');
      if (href) break;
    }
    if (href) {
      href = new URL(href, base).href;
    } else {
      href = base + '/favicon.ico';
    }

    var title = $('title').first().text().trim() || parsed.hostname.replace(/^www\./, '');

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
