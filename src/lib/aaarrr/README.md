# AAARRR browser modules

`consent-core.ts`, `consent-banner.ts`, `consent.ts`, `identity.ts`, `waitlist.ts` and `../../../public/aaarrr.js` are copies of the AAARRR stack's web modules (its web app at commit `1fb8d2fb`), kept unchanged so a newer copy drops in. The site wires them in `src/lib/brand-stack.ts`, `src/layouts/Base.astro`, `src/components/ConsentBanner.astro` and `src/components/Newsletter.astro`.

Update: copy the files over these, run `npm run build`, check the banner and a signup on a preview.
