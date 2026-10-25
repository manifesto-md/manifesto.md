import { getCollection, type CollectionEntry } from 'astro:content';

export type Entry = CollectionEntry<'manifestos'>;

export async function catalog(): Promise<Entry[]> {
  const all = await getCollection('manifestos');
  return all.sort((a, b) => {
    const oa = a.data.order ?? 1000, ob = b.data.order ?? 1000;
    if (oa !== ob) return oa - ob;
    return a.data.name.localeCompare(b.data.name);
  });
}

export function badge(e: Entry) {
  const claimed = e.data.listing === 'claimed';
  return {
    schemaVersion: 1,
    label: 'manifesto.md',
    message: e.data.status_of_text === 'unpublished' ? 'unpublished' : claimed ? 'claimed' : 'listed',
    color: claimed ? '1d4ed8' : '6b7280',
    labelColor: '16181d',
    namedLogo: 'markdown',
  };
}

export const KIND_LABEL: Record<string, string> = { manifesto: 'Manifesto', specification: 'Specification', principles: 'Principles' };
