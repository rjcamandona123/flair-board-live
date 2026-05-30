import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import * as cheerio from 'cheerio';

export default defineConfig({
  resolve: { dedupe: ['solid-js'] },
  plugins: [
    solidPlugin(),
    {
      name: 'favicon-resolver',
      configureServer(server) {
        server.middlewares.use('/favicon-resolver', async (req, res) => {
          try {
            var url = new URL(req.url, 'http://localhost').searchParams.get('url');
            if (!url) { res.writeHead(400); res.end('{"error":"url required"}'); return; }
            var parsed = new URL(url);
            var base = parsed.protocol + '//' + parsed.host;
            var resp = await fetch(base);
            if (!resp.ok) throw new Error('Fetch failed: ' + resp.status);
            var html = await resp.text();
            var $ = cheerio.load(html);
            var href = null;
            var selectors = ['link[rel="icon"]', 'link[rel="shortcut icon"]', 'link[rel="apple-touch-icon"]', 'link[rel~="icon"]'];
            for (var sel of selectors) { href = $(sel).attr('href'); if (href) break; }
            if (href) { href = new URL(href, base).href; } else { href = base + '/favicon.ico'; }
            var title = $('title').first().text().trim() || parsed.hostname.replace(/^www\./, '');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ favicon: href, title: title }));
          } catch (e) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      }
    }
  ],
  server: {
    proxy: {
      '/.netlify/functions/send-email': {
        target: 'https://api.resend.com',
        changeOrigin: true,
        rewrite: function() { return '/emails'; },
        configure: function(proxy) {
          proxy.on('proxyReq', function(proxyReq, req) {
            proxyReq.setHeader('Authorization', 'Bearer ' + (process.env.RESEND_API_KEY || 're_W4ZNMpxg_Fh54MeR6vNdX9iQfcw6TmtSV'));
          });
        },
      },
    },
  },
});
