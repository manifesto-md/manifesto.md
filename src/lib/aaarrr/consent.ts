import type { BannerConfig, EmbeddedConsent, UmamiSettings } from './consent-core';

/**
 * Server side of the consent banner: the brand's banner configuration from
 * the CMS (`GET /api/v1/consent/config`, which archives the notice it serves),
 * cached briefly. Without a configuration, a project key or the API URL
 * there is no banner, and no analytics either: Umami only ever runs after
 * consent.
 */

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: BannerConfig | null }>();

/** The brand's banner configuration, or null when the CMS cannot give one. */
export async function loadBannerConfig(
    cmsUrl: string,
    tenant: string,
    locale: string,
    options: { fetch?: typeof fetch; now?: () => number; timeoutMs?: number } = {},
): Promise<BannerConfig | null> {
    const now = options.now ?? Date.now;
    const key = `${cmsUrl}|${tenant}|${locale}`;
    const hit = cache.get(key);
    if (hit && now() - hit.at < TTL_MS) return hit.value;
    const url = `${cmsUrl.replace(/\/$/, '')}/api/v1/consent/config?tenant=${encodeURIComponent(tenant)}&locale=${encodeURIComponent(locale)}`;
    let value: BannerConfig | null = null;
    try {
        const res = await (options.fetch ?? fetch)(url, { signal: AbortSignal.timeout(options.timeoutMs ?? 3000) });
        if (res.ok) {
            const body = (await res.json()) as BannerConfig;
            if (Array.isArray(body?.categories) && body?.notice?.textSha256 && body?.notice?.versionId) value = body;
        }
    } catch (error) {
        console.warn(`[consent] banner configuration for ${tenant} unavailable:`, error);
    }
    cache.set(key, { at: now(), value });
    return value;
}

/** What the page embeds, or null (no banner, no analytics). */
export async function consentForPage(input: {
    apiUrl?: string | null;
    cmsUrl?: string | null;
    fetch?: typeof fetch;
    locale: string;
    projectKey?: string | null;
    tenant?: string | null;
    umami?: UmamiSettings | null;
}): Promise<EmbeddedConsent | null> {
    if (!input.apiUrl || !input.cmsUrl || !input.projectKey || !input.tenant) return null;
    const banner = await loadBannerConfig(input.cmsUrl, input.tenant, input.locale, { fetch: input.fetch });
    return banner ? { apiUrl: input.apiUrl, banner, projectKey: input.projectKey, umami: input.umami ?? null } : null;
}

/** JSON for a `<script type="application/json">` element (no `</script>` break-out). */
export function embedJson(value: unknown): string {
    return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

/** Test hook: forget cached configurations. */
export function clearBannerCache(): void {
    cache.clear();
}
