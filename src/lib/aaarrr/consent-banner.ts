/**
 * Consent banner in the browser (vanilla-cookieconsent). Reads the
 * configuration the page embeds, sets Google Consent Mode v2 defaults to
 * denied before anything else, asks the visitor, posts each decision to the
 * stack API (proof log) and runs Umami only while analytics is accepted.
 * Footer controls: `[data-consent-preferences]` reopens the choices,
 * `[data-consent-do-not-sell]` turns off every category that sells or
 * shares personal information.
 */
import 'vanilla-cookieconsent/dist/cookieconsent.css';
import * as CookieConsent from 'vanilla-cookieconsent';

import {
    ANALYTICS,
    anonymousIdOf,
    CONSENT_CONFIG_ID,
    consentModeSignals,
    cookieConsentConfig,
    decisionBody,
    decisionRequest,
    methodOf,
    offeredCategories,
    preferencesFrom,
    reloadAfterWithdrawal,
    type DecisionMethod,
    type EmbeddedConsent,
} from './consent-core';

type Gtag = (...args: unknown[]) => void;
declare global {
    interface Window {
        aaarrrConsent?: {
            /** Analytics accepted (undefined until the visitor decided). Read by the SDK. */
            analytics?: boolean;
            decisions: number;
            lastError?: string;
        };
        dataLayer?: unknown[];
        gtag?: Gtag;
        umami?: unknown;
    }
    interface Navigator {
        globalPrivacyControl?: boolean;
    }
}

const UMAMI_SCRIPT_ID = 'aaarrr-umami';

function gtag(...args: unknown[]): void {
    window.dataLayer = window.dataLayer || [];
    // Consent Mode reads the arguments object itself, as gtag.js pushes it.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
    void args;
}

let codeHash: Promise<string | undefined> | undefined;

/** SHA-256 of this module as served (its file name pins the chunks it imports). */
function bannerCodeSha256(): Promise<string | undefined> {
    codeHash ??= (async () => {
        try {
            const body = await (await fetch(import.meta.url, { credentials: 'omit' })).arrayBuffer();
            const digest = await crypto.subtle.digest('SHA-256', body);
            return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
        } catch {
            return undefined;
        }
    })();
    return codeHash;
}

function readConfig(): EmbeddedConsent | null {
    const el = document.getElementById(CONSENT_CONFIG_ID);
    if (!el?.textContent) return null;
    try {
        return JSON.parse(el.textContent) as EmbeddedConsent;
    } catch {
        return null;
    }
}

function startUmami(config: EmbeddedConsent): void {
    const umami = config.umami;
    if (!umami || document.getElementById(UMAMI_SCRIPT_ID)) return;
    const script = document.createElement('script');
    script.id = UMAMI_SCRIPT_ID;
    script.defer = true;
    script.src = umami.scriptUrl;
    script.dataset.websiteId = umami.websiteId;
    if (umami.domains?.length) script.dataset.domains = umami.domains.join(',');
    document.head.appendChild(script);
}

/** Removes Umami; true when it had been loaded on this page (a reload then stops its history hooks). */
function stopUmami(): boolean {
    const script = document.getElementById(UMAMI_SCRIPT_ID);
    if (!script) return false;
    script.remove();
    delete window.umami;
    return true;
}

function main(): void {
    const config = readConfig();
    if (!config) return;
    const banner = config.banner;
    const gpc = navigator.globalPrivacyControl === true;
    const state = (window.aaarrrConsent = { decisions: 0 } as NonNullable<Window['aaarrrConsent']>);

    window.gtag = window.gtag || gtag;
    window.gtag('consent', 'default', { ...consentModeSignals(banner, null, gpc), wait_for_update: 500 });

    // Tells the SDK (and forms) where the visitor stands: the SDK runs only while analytics is accepted.
    const publish = (analytics: boolean): void => {
        state.analytics = analytics;
        window.dispatchEvent(new CustomEvent('aaarrr:consent', { detail: { analytics } }));
    };

    const apply = (): boolean => {
        const accepted = CookieConsent.getUserPreferences().acceptedCategories;
        const preferences = preferencesFrom(banner, accepted, gpc);
        window.gtag?.('consent', 'update', consentModeSignals(banner, preferences, gpc));
        publish(preferences[ANALYTICS] === true);
        if (preferences[ANALYTICS]) {
            startUmami(config);
            return false;
        }
        return stopUmami();
    };

    const record = async (method: DecisionMethod): Promise<void> => {
        const accepted = CookieConsent.getUserPreferences().acceptedCategories;
        const userId = anonymousIdOf(String(CookieConsent.getCookie('consentId') ?? ''));
        if (!userId) return;
        const body = decisionBody({
            banner,
            bannerCodeSha256: await bannerCodeSha256(),
            gpc,
            method,
            now: new Date(),
            pageUrl: `${location.origin}${location.pathname}`,
            preferences: preferencesFrom(banner, accepted, gpc),
            userId,
        });
        try {
            const { init, url } = decisionRequest(config.apiUrl, config.projectKey, body, crypto.randomUUID());
            const res = await fetch(url, init);
            if (res.ok) state.decisions += 1;
            else state.lastError = `HTTP ${res.status}`;
        } catch (error) {
            state.lastError = error instanceof Error ? error.message : String(error);
        }
    };

    // Set by the "Do not sell or share" control for the change it causes.
    let pendingMethod: DecisionMethod | undefined;
    // Categories allowed before the latest change (scripts they gate may have run).
    let allowed: string[] = [];
    const gatedOnPage = () =>
        [...document.querySelectorAll<HTMLScriptElement>('script[data-category]')].map((s) => s.dataset.category ?? '').filter(Boolean);

    void CookieConsent.run({
        ...cookieConsentConfig(banner, gpc),
        onChange: async () => {
            const method = pendingMethod ?? methodOf(CookieConsent.getUserPreferences().acceptType);
            pendingMethod = undefined;
            const wasRunning = apply();
            await record(method);
            const now = CookieConsent.getUserPreferences().acceptedCategories;
            const reload = wasRunning || reloadAfterWithdrawal(allowed, now, gatedOnPage());
            allowed = [...now];
            // A withdrawal of analytics on a page where Umami already ran, or of a
            // category whose tagged scripts ran.
            if (reload) location.reload();
        },
        onConsent: () => {
            allowed = [...CookieConsent.getUserPreferences().acceptedCategories];
            apply();
        },
        onFirstConsent: async () => {
            await record(pendingMethod ?? methodOf(CookieConsent.getUserPreferences().acceptType));
            pendingMethod = undefined;
        },
    } as never);

    for (const el of document.querySelectorAll<HTMLElement>('[data-consent-preferences]')) {
        el.addEventListener('click', (event) => {
            event.preventDefault();
            CookieConsent.showPreferences();
        });
    }
    for (const el of document.querySelectorAll<HTMLElement>('[data-consent-do-not-sell]')) {
        el.addEventListener('click', (event) => {
            event.preventDefault();
            const keep = offeredCategories(banner, gpc)
                .filter((c) => !c.saleOrShare && (c.required || CookieConsent.acceptedCategory(c.key)))
                .map((c) => c.key);
            const unchanged = CookieConsent.validConsent()
                && [...keep].sort().join() === [...CookieConsent.getUserPreferences().acceptedCategories].sort().join();
            CookieConsent.hide();
            if (unchanged) {
                // Nothing to turn off: the request itself is still recorded.
                void record('do_not_sell_link');
            } else {
                pendingMethod = 'do_not_sell_link';
                CookieConsent.acceptCategory(keep);
            }
            const done = document.querySelector<HTMLElement>('[data-consent-do-not-sell-done]');
            if (done) done.hidden = false;
        });
    }
}

main();
