import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { manifestoSchema } from './lib/schema';

export const collections = {
  manifestos: defineCollection({
    loader: glob({ pattern: '*.yaml', base: './manifestos' }),
    schema: manifestoSchema,
  }),
  bundles: defineCollection({
    loader: glob({ pattern: '*.yaml', base: './bundles' }),
    schema: z.object({
      name: z.string().min(2),
      line: z.string().min(20).max(240),
      members: z.array(z.string()).min(2),
      order: z.number().int().optional(),
    }),
  }),
};
