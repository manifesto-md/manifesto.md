import { z } from 'astro/zod';

export const kinds = ['manifesto', 'specification', 'principles'] as const;
export const listings = ['listed', 'claimed'] as const;
export const textStatus = ['draft', 'stable', 'historical', 'unpublished'] as const;

// YAML parses bare dates as Date objects; accept both and keep the date part.
const dateish = z.union([z.string(), z.date()]).transform((d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d));

export const manifestoSchema = z.object({
  name: z.string().min(2),
  short: z.string().optional(),
  kind: z.enum(kinds),
  line: z.string().min(20).max(240),
  canonical: z.string().url(),
  repo: z.string().url().optional(),
  version: z.string().optional(),
  status_of_text: z.enum(textStatus).default('stable'),
  license: z.string().optional(),
  maintainer: z.string(),
  first_published: dateish.pipe(z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/)).optional(),
  listing: z.enum(listings).default('listed'),
  claimed_at: dateish.optional(),
  claimed_by: z.string().optional(),
  tenets: z.array(z.string()).min(1).max(20),
  tenets_label: z.string().default('Tenets'),
  related: z.array(z.string()).default([]),
  family: z.string().optional(),
  order: z.number().int().optional(),
  note: z.string().optional(),
});
export type Manifesto = z.infer<typeof manifestoSchema>;
