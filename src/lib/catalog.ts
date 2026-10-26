import { getCollection, type CollectionEntry } from 'astro:content';

export type Entry = CollectionEntry<'manifestos'>;
export type Bundle = CollectionEntry<'bundles'>;

export async function catalog(): Promise<Entry[]> {
  const all = await getCollection('manifestos');
  return all.sort((a, b) => {
    const oa = a.data.order ?? 1000, ob = b.data.order ?? 1000;
    if (oa !== ob) return oa - ob;
    return a.data.name.localeCompare(b.data.name);
  });
}

export async function bundles(): Promise<Bundle[]> {
  const all = await getCollection('bundles');
  const entries = await catalog();
  const slugs = new Set(entries.map((e) => e.id));
  for (const b of all) for (const m of b.data.members) {
    if (!slugs.has(m)) throw new Error(`bundle ${b.id}: member ${m} is not a listed document`);
  }
  return all.sort((a, b) => (a.data.order ?? 1000) - (b.data.order ?? 1000) || a.data.name.localeCompare(b.data.name));
}

export function bundlesOf(slug: string, all: Bundle[]): Bundle[] {
  return all.filter((b) => b.data.members.includes(slug));
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

/** Compact search index embedded in the index page. */
export function searchIndex(entries: Entry[], all: Bundle[]) {
  return entries.map((e) => ({
    s: e.id,
    n: e.data.name,
    a: e.data.short ?? '',
    l: e.data.line,
    k: e.data.kind,
    p: e.data.publisher,
    m: e.data.maintainer,
    t: e.data.tenets.join(' '),
    b: bundlesOf(e.id, all).map((b) => b.id).join(' '),
  }));
}

export const KIND_LABEL: Record<string, string> = { manifesto: 'Manifesto', specification: 'Specification', principles: 'Principles', convention: 'Convention' };
