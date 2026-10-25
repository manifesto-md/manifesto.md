import type { APIRoute } from 'astro';
import { catalog, badge } from '../../lib/catalog';

export async function getStaticPaths() {
  const entries = await catalog();
  return entries.map((e) => ({ params: { slug: e.id }, props: { e } }));
}

export const GET: APIRoute = ({ props }) => {
  const body = JSON.stringify(badge((props as any).e));
  return new Response(body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
};
