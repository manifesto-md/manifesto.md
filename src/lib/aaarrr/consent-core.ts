/**
 * Consent banner logic without the DOM: what the page embeds, how the
 * vanilla-cookieconsent configuration is built from the brand's consent
 * configuration, what a decision posts to the API, and which Google
 * Consent Mode v2 signals follow from a choice. The browser part lives in
 * `consent-banner.ts`.
 */

/** Element id of the embedded configuration (`<script type="application/json">`). */
export const CONSENT_CONFIG_ID = 'aaarrr-consent';

/** Name of the consent cookie. It holds the only identifier: the anonymous id. */
export const CONSENT_COOKIE = 'aaarrr_consent';

/** Longest life of the consent cookie: 13 months. */
export const MAX_COOKIE_DAYS = 395;

export interface BannerCategory {
    description?: string;
    key: string;
    label: string;
    required: boolean;
    saleOrShare?: boolean;
    /** Scripts and vendors the category gates, shown under its description. */
    vendors?: string[];
}

export interface BannerNotice {
    language: string;
    textSha256: string;
    textUrl?: string;
    versionId: string;
}

export interface BannerPolicy {
    doNotSellLink: boolean;
    refusalRepromptDays: number;
    retentionDaysAfterEnd: number;
    validityDays: number;
}

/** The brand's banner configuration as the CMS serves it (`GET /api/v1/consent/config`). */
export interface BannerConfig {
    categories: BannerCategory[];
    languages: string[];
    notice: BannerNotice & { text?: string };
    policy: BannerPolicy;
    requester: { brand: string; controllerContact?: string; controllerName?: string };
    texts: Record<string, string>;
}

/** Umami snippet the banner injects after analytics consent. */
export interface UmamiSettings {
    domains?: string[];
    scriptUrl: string;
    websiteId: string;
}

/** What a page embeds for the banner. */
export interface EmbeddedConsent {
    /** Public URL of the stack API (decisions go to `<apiUrl>/v1/consent/decisions`). */
    apiUrl: string;
    banner: BannerConfig;
    /** Publishable project key of the brand. */
    projectKey: string;
    umami?: UmamiSettings | null;
}

/** The analytics category: Umami runs only while it is accepted. */
export const ANALYTICS = 'analytics';

/** HTML-escaped text (the library renders texts as HTML; brand texts are plain text). */
export function escapeHtml(value: string | undefined): string {
    return (value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** A stable 31-bit number for a notice version: a new version asks again. */
export function revisionOf(versionId: string): number {
    let h = 0;
    for (let i = 0; i < versionId.length; i++) h = (Math.imul(31, h) + versionId.charCodeAt(i)) | 0;
    return (h >>> 1) || 1;
}

/** Cookie life in days for an answer: the refusal pause after "reject", the validity otherwise; at most 13 months. */
export function cookieDays(policy: BannerPolicy, acceptType: 'all' | 'custom' | 'necessary'): number {
    const days = acceptType === 'necessary' ? policy.refusalRepromptDays : policy.validityDays;
    return Math.max(1, Math.min(days, MAX_COOKIE_DAYS));
}

/** Categories the visitor may turn on: under Global Privacy Control, none that sells or shares. */
export function offeredCategories(banner: BannerConfig, gpc: boolean): BannerCategory[] {
    return banner.categories.filter((c) => !(gpc && c.saleOrShare));
}

/** vanilla-cookieconsent configuration for the brand's banner (callbacks added by the caller). */
export function cookieConsentConfig(banner: BannerConfig, gpc: boolean): Record<string, unknown> {
    const t = banner.texts;
    const offered = offeredCategories(banner, gpc);
    const categories: Record<string, { enabled: boolean; readOnly: boolean }> = {};
    // Opt-in: every optional category starts off whatever its configured default.
    for (const c of offered) categories[c.key] = { enabled: c.required, readOnly: c.required };
    const sections = [
        ...(gpc ? [{ description: escapeHtml(t.gpcHonored) }] : []),
        ...offered.map((c) => ({
            description: [escapeHtml(c.description), (c.vendors ?? []).map(escapeHtml).join(', ')].filter(Boolean).join('<br>'),
            linkedCategory: c.key,
            title: escapeHtml(c.required ? `${c.label} (${t.alwaysOn})` : c.label),
        })),
    ];
    const language = banner.notice.language;
    return {
        autoShow: true,
        categories,
        cookie: {
            expiresAfterDays: (acceptType: 'all' | 'custom' | 'necessary') => cookieDays(banner.policy, acceptType),
            name: CONSENT_COOKIE,
            sameSite: 'Lax',
            secure: true,
        },
        disablePageInteraction: false,
        guiOptions: {
            consentModal: { equalWeightButtons: true, flipButtons: false, layout: 'box', position: 'bottom right' },
            preferencesModal: { equalWeightButtons: true, flipButtons: false, layout: 'box' },
        },
        // Automated browsers and accessibility tools see the banner like people do.
        hideFromBots: false,
        language: {
            default: language,
            translations: {
                [language]: {
                    consentModal: {
                        acceptAllBtn: escapeHtml(t.acceptAll),
                        acceptNecessaryBtn: escapeHtml(t.rejectAll),
                        description: escapeHtml(t.description),
                        label: escapeHtml(t.title),
                        showPreferencesBtn: escapeHtml(t.customize),
                        title: escapeHtml(t.title),
                    },
                    preferencesModal: {
                        acceptAllBtn: escapeHtml(t.acceptAll),
                        acceptNecessaryBtn: escapeHtml(t.rejectAll),
                        closeIconLabel: escapeHtml(t.close),
                        savePreferencesBtn: escapeHtml(t.save),
                        sections,
                        title: escapeHtml(t.preferencesTitle),
                    },
                },
            },
        },
        // Umami is injected by the banner itself. A brand's own scripts are tagged
        // `<script type="text/plain" data-category="<key>">` and run only once that
        // category is allowed (built-in or custom).
        manageScriptTags: true,
        mode: 'opt-in',
        revision: revisionOf(banner.notice.versionId),
    };
}

/**
 * Whether a change must reload the page: a category that was allowed is now
 * refused and scripts it gates are on the page (they ran and cannot be unloaded).
 */
export function reloadAfterWithdrawal(before: readonly string[], after: readonly string[], gatedOnPage: readonly string[]): boolean {
    return before.some((key) => !after.includes(key) && gatedOnPage.includes(key));
}

/** Every category of the brand with its state after a choice (refusals included). */
export function preferencesFrom(banner: BannerConfig, accepted: readonly string[], gpc: boolean): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const c of banner.categories) out[c.key] = c.required || (accepted.includes(c.key) && !(gpc && c.saleOrShare));
    return out;
}

export type DecisionMethod = 'banner_accept_all' | 'banner_customize' | 'banner_reject_all' | 'do_not_sell_link';

/** Method of a banner answer. */
export function methodOf(acceptType: 'all' | 'custom' | 'necessary'): DecisionMethod {
    return acceptType === 'all' ? 'banner_accept_all' : acceptType === 'necessary' ? 'banner_reject_all' : 'banner_customize';
}

/** Body of `POST /v1/consent/decisions`. */
export function decisionBody(input: {
    banner: BannerConfig;
    bannerCodeSha256?: string;
    gpc: boolean;
    method: DecisionMethod;
    now: Date;
    pageUrl: string;
    preferences: Record<string, boolean>;
    userId: string;
}): Record<string, unknown> {
    const n = input.banner.notice;
    return {
        context: {
            ...(input.bannerCodeSha256 ? { bannerCodeSha256: input.bannerCodeSha256 } : {}),
            gpc: input.gpc,
            method: input.method,
            notice: { language: n.language, textSha256: n.textSha256, versionId: n.versionId, ...(n.textUrl ? { textUrl: n.textUrl } : {}) },
            page: { url: input.pageUrl },
            timestamp: input.now.toISOString(),
        },
        kind: 'decision',
        preferences: input.preferences,
        userId: input.userId,
    };
}

/**
 * The request recording one decision: `POST <apiUrl>/v1/consent/decisions`
 * with the publishable key and the decision's own Idempotency-Key (the API
 * requires one; a retry of the same decision resends the same key).
 */
export function decisionRequest(apiUrl: string, projectKey: string, body: Record<string, unknown>, idempotencyKey: string): { init: RequestInit; url: string } {
    return {
        init: {
            body: JSON.stringify(body),
            credentials: 'omit',
            headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey, 'X-API-Key': projectKey },
            keepalive: true,
            method: 'POST',
        },
        url: `${apiUrl.replace(/\/$/, '')}/v1/consent/decisions`,
    };
}

/** Google Consent Mode v2 signals for the current preferences. Default: all denied. */
export function consentModeSignals(banner: BannerConfig, preferences: Record<string, boolean> | null, gpc: boolean): Record<string, 'denied' | 'granted'> {
    const on = (v: boolean) => (v ? 'granted' : 'denied');
    const p = preferences ?? {};
    const ads = !gpc && banner.categories.some((c) => c.saleOrShare && p[c.key] === true);
    return {
        ad_personalization: on(ads),
        ad_storage: on(ads),
        ad_user_data: on(ads),
        analytics_storage: on(p[ANALYTICS] === true),
        functionality_storage: 'granted',
        personalization_storage: on(p.personalization === true),
        security_storage: 'granted',
    };
}

const CROCKFORD = '0123456789abcdefghjkmnpqrstvwxyz';

/**
 * The first-party anonymous id of the consent cookie's UUID: `anon_` + the
 * UUID's 128 bits in 26 Crockford base32 characters (TypeID encoding).
 */
export function anonymousIdOf(uuid: string): string | null {
    const hex = uuid.replace(/-/g, '').toLowerCase();
    if (!/^[0-9a-f]{32}$/.test(hex)) return null;
    let value = BigInt(`0x${hex}`);
    let out = '';
    for (let i = 0; i < 26; i++) {
        out = CROCKFORD[Number(value & 31n)] + out;
        value >>= 5n;
    }
    return `anon_${out}`;
}
