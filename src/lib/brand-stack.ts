/**
 * The manifesto.md brand on the AAARRR stack. Every value is public by design: the project key is
 * publishable (it only allows signups, consent decisions and events for this brand, from this
 * brand's origins) and all of it appears in the page source.
 */
export const STACK = {
  tenant: 'manifesto-md',
  apiUrl: 'https://api.aaarrr.tools',
  cmsUrl: 'https://console.aaarrr.tools',
  projectKey: 'pk_live_1c03e208b5e607216c71132ac82ff13ec417f23769715c36',
  /** Cloudflare Turnstile site key of the stack's signup challenge (the widget lists manifesto.md). */
  challengeSiteKey: '0x4AAAAAAFiYqBRVFKMf2jRD',
  umami: { scriptUrl: 'https://stats.aaarrr.tools/script.js', websiteId: '96107426-0d28-45c0-9b1d-0f9ca7b04341' },
  lineup: 'newsletter',
  formTopic: 'newsletter',
} as const;

/** Version of the privacy policy shown at signup (its last-updated date); recorded with the consent. Change it with the policy page. */
export const PRIVACY_POLICY_VERSION = '2026-10-27';
