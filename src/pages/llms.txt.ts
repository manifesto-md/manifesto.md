import type { APIRoute } from 'astro';
import { catalog, bundles, KIND_LABEL } from '../lib/catalog';

// llms.txt per https://llmstxt.org/ (v2): H1, blockquote summary, then H2 sections of links.
export const GET: APIRoute = async () => {
  const entries = await catalog();
  const all = await bundles();
  const lines: string[] = [
    '# manifesto.md',
    '',
    '> A directory of the documents projects stand on: manifestos, principles, specifications and file conventions. One page per document, linking the author\'s canonical text and the version it was read against. A listing asserts nothing beyond the link; a claimed listing was confirmed by the document\'s maintainer.',
    '',
    'Pages are static. Each document page states its tenets (quoted from the source), the canonical URL, the version read against, maintainer, licence of the text, and the bundles it belongs to. The whole catalog is also available as JSON.',
    '',
    '## Catalog',
    '',
    '- [Catalog as JSON](https://manifesto.md/index.json): every listing with its fields',
    '- [Full text for models](https://manifesto.md/llms-full.txt): all document pages in one file',
    '- [How to add or claim a listing](https://manifesto.md/add/)',
    '- [What the badge asserts](https://manifesto.md/badge/)',
    '',
  ];
  for (const kind of ['specification', 'convention', 'manifesto', 'principles']) {
    const items = entries.filter((e) => e.data.kind === kind);
    if (!items.length) continue;
    lines.push(`## ${KIND_LABEL[kind]}s`, '');
    for (const e of items) lines.push(`- [${e.data.name}](https://manifesto.md/${e.id}/): ${e.data.line} Canonical text: ${e.data.canonical}`);
    lines.push('');
  }
  lines.push('## Bundles', '');
  for (const b of all) lines.push(`- [${b.data.name}](https://manifesto.md/bundles/${b.id}/): ${b.data.line}`);
  lines.push('', '## Optional', '', '- [Source repository](https://github.com/manifesto-md/manifesto.md): data files, issue templates, contribution rules', '');
  return new Response(lines.join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
