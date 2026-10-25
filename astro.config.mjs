import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://manifesto.md',
  trailingSlash: 'always',
  compressHTML: true,
  build: { inlineStylesheets: 'auto' },
});
