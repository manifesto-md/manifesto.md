import type { APIRoute } from 'astro';
import { catalog } from '../lib/catalog';

export const GET: APIRoute = async () => {
  const entries = await catalog();
  const items = entries.map((e) => ({ slug: e.id, url: `https://manifesto.md/${e.id}/`, badge: `https://manifesto.md/badge/${e.id}.json`, ...e.data }));
  return new Response(JSON.stringify({ generated: new Date().toISOString().slice(0, 10), count: items.length, items }, null, 2), { headers: { 'content-type': 'application/json; charset=utf-8' } });
};
