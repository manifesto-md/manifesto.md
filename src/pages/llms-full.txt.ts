import type { APIRoute } from 'astro';
import { catalog, bundles, bundlesOf, KIND_LABEL } from '../lib/catalog';

export const GET: APIRoute = async () => {
  const entries = await catalog();
  const all = await bundles();
  const out: string[] = ['# manifesto.md: full text', '', 'Every document page of the directory. Tenets are quoted or closely paraphrased from each document\'s canonical text, which is the only normative one.', ''];
  for (const e of entries) {
    const d = e.data;
    out.push(`## ${d.name}`, '', `- Kind: ${KIND_LABEL[d.kind]}`, `- Page: https://manifesto.md/${e.id}/`, `- Canonical text: ${d.canonical}${d.version ? ` (read against version ${d.version})` : ''}`, `- Maintainer: ${d.maintainer}`);
    if (d.repo) out.push(`- Repository: ${d.repo}`);
    if (d.license) out.push(`- Licence of the text: ${d.license}`);
    out.push(`- Listing: ${d.listing}${d.status_of_text === 'unpublished' ? ' (text not yet public)' : ''}`);
    const mine = bundlesOf(e.id, all); if (mine.length) out.push(`- Bundles: ${mine.map((b) => b.data.name).join('; ')}`);
    out.push('', d.line, '', `${d.tenets_label}:`, ...d.tenets.map((t, i) => `${i + 1}. ${t}`), '');
  }
  return new Response(out.join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
