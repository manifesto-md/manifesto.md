# Contributing

## Add a listing

1. Copy `manifestos/keep-a-changelog.yaml` to `manifestos/<slug>.yaml`. The slug is lowercase, hyphens, becomes the URL.
2. Fill the fields. `canonical` is the author's URL; `version` is the version you read; `tenets` are the document's own principles, quoted or closely paraphrased, up to twenty; `listing: listed` unless you maintain the document.
3. `npm run build` passes locally.
4. Open the pull request. One document per pull request.

## Propose a bundle

A bundle is a set of documents teams adopt in one pass or cite together. One YAML file in `bundles/`: `name`, `line` (one sentence under 240 characters), `members` (two or more existing slugs, in reading order). The build fails on an unknown slug.

## Claim a listing

You maintain a listed document. Either open a pull request setting `listing: claimed`, `claimed_at` and `claimed_by` (a handle or name) on its file, or reply yes on the listing issue the directory opened on your repository. The badge then reads `claimed`. A reaction is not a claim.

## Remove a listing

Open an issue. Removal on request from a maintainer, no questions.

## Rules

- Public documents only, linked from the author's own site or repository.
- No logos or trademarks in the directory. Names only.
- No commentary in the data files: the one-line description says what the document is for, the tenets are the author's.
- When the directory lists a document whose author did not ask, a maintainer of the directory opens an issue on the author's repository (or sends an email where the project asks for that) saying the listing exists, linking the page, and explaining claim and removal. One message, no follow-up.

## Code

Standard library of the web: Astro, no UI framework, no analytics. A dependency added needs an issue first.
