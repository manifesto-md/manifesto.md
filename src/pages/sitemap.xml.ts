import type { APIRoute } from 'astro';
import { catalog, bundles } from '../lib/catalog';

// Sitemaps protocol 0.90, https://www.sitemaps.org/protocol.html
export const GET: APIRoute = async () => {
  const entries = await catalog();
  const all = await bundles();
  const urls = ['/', '/bundles/', '/badge/', '/add/', '/privacy/', ...entries.map((e) => `/${e.id}/`), ...all.map((b) => `/bundles/${b.id}/`)];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>https://manifesto.md${u}</loc></url>`).join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
