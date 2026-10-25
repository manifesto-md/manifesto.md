# manifesto.md

The documents projects stand on: manifestos, principles and specifications, one page each, linking to the canonical text and the version it was read against. Maintainers claim their listing; the badge says so.

Site: https://manifesto.md. Catalog as JSON: https://manifesto.md/index.json.

## Add a document

One YAML file in `manifestos/`, by pull request. Public documents only; the directory links, it never copies. The file shape and the rules are on https://manifesto.md/add/ and in [CONTRIBUTING.md](./CONTRIBUTING.md).

## The badge

```markdown
[![manifesto.md](https://img.shields.io/endpoint?url=https://manifesto.md/badge/<slug>.json)](https://manifesto.md/<slug>/)
```

`listed`: the document is public and in the directory. `claimed`: a maintainer confirmed the listing. Nothing else is asserted; see https://manifesto.md/badge/.

## Build

Astro, static output, served as a Cloudflare Worker with assets.

```sh
npm ci
npm run build        # dist/
npx wrangler dev     # local preview of the built site
```

Node 22.12 or later. Data is validated against `src/lib/schema.ts` at build time; a malformed entry fails the build.

## Licences

Site code: MIT ([LICENSE](./LICENSE)). Catalog text we wrote (the one-line descriptions and page copy): CC BY 4.0 ([LICENSE-CONTENT](./LICENSE-CONTENT)). Listed documents keep their own licences and belong to their authors; tenets are quoted or closely paraphrased from the author's text as the shortest fair description.
