/**
 * AAARRR Stack Client SDK
 * Unified interface for Analytics, Feature Flags, and Identity.
 * Complies with AAARRR Stack v1 API (Protobuf/Go).
 * 
 * Usage:
 * <script src="https://domain.com/aaarrr.js" data-api-url="https://api.domain.com" data-api-key="pub_key..."></script>
 *
 * Consent: the SDK is inert until the visitor accepts the analytics category
 * of the consent banner. Before that it sets no cookie and sends nothing (no
 * page view, no track, no identify, no feature evaluation); forms and signups
 * work without its id. The banner tells the SDK with the `aaarrr:consent`
 * window event (`detail.analytics`: true or false) and by setting
 * `window.aaarrrConsent.analytics`. On withdrawal the SDK stops sending and
 * deletes its cookie. A page without a banner never starts the SDK.
 *
 * Optional context, added to every event's properties:
 *   data-tenant       brand (tenant id); also sent as X-Tenant-ID, which the
 *                     API checks against the project key's tenant
 *   data-funnel       funnel name of the page
 *   data-funnel-step  funnel step of the page
 *   data-experiment   the page's experiment (its GrowthBook flag key)
 *   data-debug        "true" prints each identify, track, page view and
 *                     feature load to the console; off by default, since
 *                     traits and properties may carry personal values
 *
 * GrowthBook attributes sent with the flags request, under GrowthBook's
 * names: id, url, path, host, query, and utmSource, utmMedium, utmCampaign,
 * utmTerm, utmContent. UTMs follow GrowthBook's own SDK: read from the
 * page's utm_* parameters and kept in sessionStorage (`aaarrr_utm`) for the
 * tab's session, a later page's parameter replacing that one. Stored only
 * after consent and removed on withdrawal, like the cookie. deviceType and
 * browser are not sent: the API reads them from the request, one source for
 * every caller.
 *
 * Experiment exposures follow GrowthBook's own SDK: an exposure is recorded
 * when the page uses a flag whose value comes from an experiment
 * (features.getValue / isOn, or the window.growthbook shim; the ABTest
 * island reads it as it shows the variation), never when the flags load.
 * The SDK then reports the experiment and the variation the API assigned to
 * POST /v1/features/exposure, which checks the variation against its own
 * assignment before recording it. One report per experiment assignment per
 * tab session (sessionStorage `aaarrr_exposures`, the page's memory where
 * storage is blocked), only after consent; withdrawal forgets them.
 */

(function(window) {
    // Prevent double initialization
    if (window.aaarrr) return;

    const SCRIPT_TAG = document.currentScript;
    const API_URL = SCRIPT_TAG?.getAttribute('data-api-url') || '';
    const API_KEY = SCRIPT_TAG?.getAttribute('data-api-key') || '';
    const ANONYMOUS_ID_COOKIE = 'ajs_anonymous_id';
    const UTM_STORAGE_KEY = 'aaarrr_utm';
    const EXPOSURE_STORAGE_KEY = 'aaarrr_exposures';
    // utm_* query parameter -> GrowthBook attribute.
    const UTM_PARAMS = [['utm_source', 'utmSource'], ['utm_medium', 'utmMedium'], ['utm_campaign', 'utmCampaign'], ['utm_term', 'utmTerm'], ['utm_content', 'utmContent']];
    const DEBUG = SCRIPT_TAG?.getAttribute('data-debug') === 'true';
    const debug = (...args) => { if (DEBUG) console.log(...args); };
    // Off until analytics consent: nothing is set or sent while false.
    let enabled = false;
    const CONTEXT = {};
    for (const [attribute, key] of [['data-tenant', 'tenant'], ['data-funnel', 'funnel'], ['data-funnel-step', 'funnel_step'], ['data-experiment', 'experiment']]) {
        const value = SCRIPT_TAG?.getAttribute(attribute);
        if (value) CONTEXT[key] = value;
    }

    // ==========================================
    // 1. Identity Module
    // ==========================================
    const Identity = {
        getCookie(name) {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop().split(';').shift();
        },

        setCookie(name, value, days = 365) {
            const d = new Date();
            d.setTime(d.getTime() + (days*24*60*60*1000));
            document.cookie = `${name}=${value}; expires=${d.toUTCString()}; path=/; SameSite=Lax`;
        },

        deleteCookie(name) {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
        },

        /** The anonymous id; empty (and no cookie) while analytics consent is not given. */
        getAnonymousId() {
            if (!enabled) return '';
            let id = this.getCookie(ANONYMOUS_ID_COOKIE);
            if (!id) {
                id = crypto.randomUUID();
                this.setCookie(ANONYMOUS_ID_COOKIE, id);
            }
            return id;
        },

        async identify(userId, traits = {}) {
            if (!enabled) return;
            debug('[AAARRR] Identify:', userId, traits);
            
            const payload = {
                user: {
                    id: userId,
                    anonymous_id: this.getAnonymousId(),
                    traits: traits
                }
            };

            await Transport.send('/v1/identify', payload);
        }
    };

    // ==========================================
    // 2. Transport Module
    // ==========================================
    const Transport = {
        // One Idempotency-Key per call: each call is one event (the API
        // requires the header on track, identify and exposures).
        async send(endpoint, body, headers = {}) {
            if (!enabled || !API_URL) return;

            try {
                await fetch(`${API_URL}${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Idempotency-Key': crypto.randomUUID(),
                        'X-API-Key': API_KEY,
                        ...(CONTEXT.tenant ? { 'X-Tenant-ID': CONTEXT.tenant } : {}),
                        ...headers
                    },
                    body: JSON.stringify(body),
                    keepalive: true
                });
            } catch (err) {
                console.error('[AAARRR] Transport Error:', err);
            }
        }
    };

    // ==========================================
    // 3. Analytics Module
    // ==========================================
    const Analytics = {
        track(eventName, properties = {}) {
            if (!enabled) return;
            debug('[AAARRR] Track:', eventName, properties);
            
            // Construct TrackRequest (Protobuf-JSON mapping)
            const payload = {
                event: {
                    name: eventName,
                    anonymous_id: Identity.getAnonymousId(),
                    properties: { ...CONTEXT, ...properties },
                    timestamp: new Date().toISOString()
                }
            };

            Transport.send('/v1/track', payload);
        },

        page(name, properties = {}) {
            if (!enabled) return;
            debug('[AAARRR] Page View:', name, properties);
            this.track('page_view', { page: name, ...properties });
        }
    };

    // ==========================================
    // 4. GrowthBook Attributes
    // ==========================================
    const Attributes = {
        /**
         * The session's UTM attributes: those stored for the tab's session,
         * with the current page's utm_* parameters over them (stored back).
         * Storage may be unavailable (blocked, private mode): then the page's own.
         */
        utms() {
            let utms = {};
            try {
                utms = JSON.parse(window.sessionStorage.getItem(UTM_STORAGE_KEY) || '{}') || {};
            } catch (err) { utms = {}; }
            const params = new URLSearchParams(window.location.search || '');
            let changed = false;
            for (const [param, attribute] of UTM_PARAMS) {
                if (params.has(param)) {
                    utms[attribute] = params.get(param) || '';
                    changed = true;
                }
            }
            if (changed) {
                try { window.sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utms)); } catch (err) { /* storage unavailable */ }
            }
            return utms;
        },

        /** Drop the stored UTMs (consent withdrawn). */
        forget() {
            try { window.sessionStorage.removeItem(UTM_STORAGE_KEY); } catch (err) { /* storage unavailable */ }
        },

        /** GrowthBook's page attributes and the session's UTMs, for the visitor. */
        current() {
            const location = window.location;
            return {
                id: Identity.getAnonymousId(),
                url: location.href,
                path: location.pathname,
                host: location.host,
                query: location.search || '',
                ...this.utms()
            };
        }
    };

    // ==========================================
    // 5. Experiment Exposures
    // ==========================================
    const Exposures = {
        // Reported this page, for when session storage is unavailable.
        reported: new Set(),

        /** The assignments reported this tab session. */
        stored() {
            try {
                const ids = JSON.parse(window.sessionStorage.getItem(EXPOSURE_STORAGE_KEY) || '[]');
                return Array.isArray(ids) ? ids : [];
            } catch (err) { return []; }
        },

        /** Mark one assignment reported; false if it already was. */
        claim(id) {
            if (this.reported.has(id)) return false;
            const ids = this.stored();
            if (ids.includes(id)) return false;
            this.reported.add(id);
            try { window.sessionStorage.setItem(EXPOSURE_STORAGE_KEY, JSON.stringify([...ids, id])); } catch (err) { /* storage unavailable */ }
            return true;
        },

        /**
         * The page uses the flag `key`: when its value comes from an
         * experiment, report the variation shown, once per assignment
         * (visitor, experiment, variation) per tab session.
         */
        report(key, feature) {
            const experiment = feature && typeof feature === 'object' ? feature.experiment : null;
            if (!enabled || !experiment || typeof experiment.key !== 'string' || typeof experiment.variation !== 'string') return;
            const anonymousId = Identity.getAnonymousId();
            if (!this.claim(JSON.stringify([anonymousId, experiment.key, experiment.variation]))) return;
            debug('[AAARRR] Exposure:', key, experiment);
            Transport.send('/v1/features/exposure', {
                feature: key,
                experiment: experiment.key,
                variation: experiment.variation,
                attributes: Attributes.current()
            }, { 'X-Anonymous-ID': anonymousId });
        },

        /** Forget the reported assignments (consent withdrawn). */
        forget() {
            this.reported.clear();
            try { window.sessionStorage.removeItem(EXPOSURE_STORAGE_KEY); } catch (err) { /* storage unavailable */ }
        }
    };

    // ==========================================
    // 6. Features Module (Integration with Stack Features API)
    // ==========================================
    const Features = {
        ready: false,
        features: {},

        async init() {
            if (!enabled || !API_URL) return;
            
            debug('[AAARRR] Initializing Features...');
            
            try {
                // Fetch features from the stack's public API
                // We use /evaluate to ensure we get assigned variants for the current user
                const res = await fetch(`${API_URL}/v1/features/evaluate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': API_KEY,
                        'X-Anonymous-ID': Identity.getAnonymousId()
                    },
                    body: JSON.stringify({ attributes: Attributes.current() })
                });
                
                if (res.ok && enabled) {
                    const data = await res.json();
                    this.features = data.features || {};
                    this.ready = true;
                    debug('[AAARRR] Features Loaded');
                } else {
                    console.warn('[AAARRR] Features API returned error:', res.status);
                }
            } catch (err) {
                console.error('[AAARRR] Failed to load features:', err);
            }
        },

        isOn(key) {
            if (!this.ready) return false;
            // Evaluates based on the feature set returned by the API
            const feature = this.features[key];
            Exposures.report(key, feature);
            if (typeof feature === 'boolean') return feature;
            if (feature && typeof feature === 'object') return !!feature.enabled;
            return false;
        },

        getValue(key, fallback) {
            if (!this.ready) return fallback;
            const feature = this.features[key];
            Exposures.report(key, feature);
            if (feature && typeof feature === 'object' && feature.value !== undefined) {
                return feature.value;
            }
            return feature ?? fallback;
        }
    };

    // ==========================================
    // 7. Consent
    // ==========================================
    const Consent = {
        /** Analytics consent given: set the id, load features, send the page view. */
        async enable() {
            if (enabled) return;
            enabled = true;
            Identity.getAnonymousId(); // Ensure ID exists
            await Features.init();
            Analytics.page(document.title);
        },

        /** Consent withdrawn or refused: stop sending, delete the cookie, the stored UTMs and exposures. */
        disable() {
            enabled = false;
            Features.ready = false;
            Features.features = {};
            Identity.deleteCookie(ANONYMOUS_ID_COOKIE);
            Attributes.forget();
            Exposures.forget();
        },

        apply(analytics) {
            return analytics === true ? this.enable() : this.disable();
        }
    };

    // ==========================================
    // 8. Public API
    // ==========================================
    window.aaarrr = {
        identity: Identity,
        analytics: Analytics,
        features: Features,
        /** Page context (tenant, funnel, funnel_step, experiment) added to every event. */
        context: CONTEXT,

        // Convenience methods
        track: (name, props) => Analytics.track(name, props),
        identify: (id, traits) => Identity.identify(id, traits),
        /** Whether analytics consent is given (the SDK is running). */
        isEnabled: () => enabled,
        init: async () => {
            if (enabled) await Features.init();
        }
    };

    // The banner reports every decision, and its state when it starts.
    if (typeof window.addEventListener === 'function') {
        window.addEventListener('aaarrr:consent', (event) => {
            Consent.apply(event?.detail?.analytics === true);
        });
    }
    if (window.aaarrrConsent?.analytics === true) Consent.enable();

    // No banner on the page (its script defines window.aaarrrConsent as it starts):
    // nobody can consent, so a cookie left by an earlier version goes.
    const cleanStale = () => {
        if (!window.aaarrrConsent) Identity.deleteCookie(ANONYMOUS_ID_COOKIE);
    };
    if (document.readyState === 'loading' && typeof document.addEventListener === 'function') {
        document.addEventListener('DOMContentLoaded', cleanStale);
    } else {
        cleanStale();
    }

    // Shim for GrowthBook Adapter compatibility
    window.growthbook = {
        isOn: (key) => Features.isOn(key),
        getFeatureValue: (key, fallback) => Features.getValue(key, fallback),
        setAttributes: (attrs) => { /* Sync traits if needed */ }
    };

})(window);
