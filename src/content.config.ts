import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { manifestoSchema } from './lib/schema';

export const collections = {
  manifestos: defineCollection({
    loader: glob({ pattern: '*.yaml', base: './manifestos' }),
    schema: manifestoSchema,
  }),
};
