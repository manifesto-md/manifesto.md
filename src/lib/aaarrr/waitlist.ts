/**
 * Waitlist signups from a brand page: the request to the stack's
 * `POST /v1/waitlist/signups` (docs/technical/WAITLIST.md) and the reading
 * of its answer. Browser-free so it can be tested; the form component wires
 * it to the DOM.
 */

const CROCKFORD = '0123456789abcdefghjkmnpqrstvwxyz';

/**
 * `<prefix>_` + the UUID's 128 bits as 26 Crockford base32 characters (the
 * TypeID encoding the api validates); null for anything but a UUID.
 */
export function typeIdOf(prefix: string, uuid: string): string | null {
    const hex = uuid.replace(/-/g, '').toLowerCase();
    if (!/^[0-9a-f]{32}$/.test(hex)) return null;
    let value = BigInt(`0x${hex}`);
    let out = '';
    for (let i = 0; i < 26; i++) {
        out = CROCKFORD[Number(value & 31n)] + out;
        value >>= 5n;
    }
    return `${prefix}_${out}`;
}

/**
 * A version 7 UUID: 48 bits of Unix time in milliseconds, then version and
 * variant bits over 74 random bits (10 bytes supplied or drawn).
 */
export function uuidV7(at: number = Date.now(), random?: Uint8Array): string {
    const bytes = new Uint8Array(16);
    let t = BigInt(at);
    for (let i = 5; i >= 0; i--) {
        bytes[i] = Number(t & 255n);
        t >>= 8n;
    }
    const rand = random ?? crypto.getRandomValues(new Uint8Array(10));
    bytes.set(rand.subarray(0, 10), 6);
    bytes[6] = (bytes[6] & 0x0f) | 0x70;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** A fresh `signup_` Idempotency-Key, the same one for every retry of one submission. */
export function signupKey(): string {
    return typeIdOf('signup', uuidV7()) as string;
}

/** The utm fields of the page's query string, trimmed; undefined without any. */
export function utmFrom(search: string): Record<string, string> | undefined {
    const params = new URLSearchParams(search);
    const utm: Record<string, string> = {};
    for (const field of ['source', 'medium', 'campaign', 'term', 'content']) {
        const value = params.get(`utm_${field}`)?.trim();
        if (value) utm[field] = value;
    }
    return Object.keys(utm).length > 0 ? utm : undefined;
}

/** What the form knows when the visitor submits. */
export interface SignupInput {
    /** Challenge response (Turnstile) when the deployment requires one. */
    challengeToken?: string;
    /**
     *
     */
    email: string;
    /**
     *
     */
    firstName?: string;
    /** Identifies the form on the page (consent record and analytics). */
    formId: string;
    /** Lineup slug of the brand's waiting list. */
    lineup: string;
    /**
     *
     */
    locale?: string;
    /** Version of the consent notice the visitor agrees to (the api requires it, 64 printable characters at most). */
    policyVersion: string;
    /** When the form was rendered (ms since epoch); too fast a submit is a bot. */
    renderedAt: number;
    /** Email topics the visitor opted in or out of. */
    topics: Record<string, boolean>;
    /**
     *
     */
    utm?: Record<string, string>;
    /** Honeypot field, sent as typed: anything in it refuses the signup. */
    website: string;
}

/**
 * The signup request body: only the fields the api documents (unknown ones
 * are a 400), trimmed, the address lowercased, empty optionals left out.
 */
export function signupBody(input: SignupInput): Record<string, unknown> {
    const body: Record<string, unknown> = {
        email: input.email.trim().toLowerCase(),
        lineup: input.lineup,
        consent: { topics: input.topics, policyVersion: input.policyVersion.trim(), formId: input.formId },
        formId: input.formId,
        website: input.website,
        renderedAt: input.renderedAt,
    };
    const firstName = input.firstName?.trim();
    if (firstName) body.firstName = firstName;
    if (input.locale) body.locale = input.locale;
    if (input.utm && Object.keys(input.utm).length > 0) body.utm = input.utm;
    if (input.challengeToken) body.challengeToken = input.challengeToken;
    return body;
}

/** The fetch call for one signup: JSON, the brand's key, the idempotency key. */
export function signupRequest(apiUrl: string, projectKey: string, body: Record<string, unknown>, idempotencyKey: string): { init: RequestInit; url: string } {
    return {
        url: `${apiUrl.replace(/\/+$/, '')}/v1/waitlist/signups`,
        init: {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': projectKey,
                'Idempotency-Key': idempotencyKey,
            },
            body: JSON.stringify(body),
            credentials: 'omit',
        },
    };
}

/** What the form shows after an answer. */
export type SignupOutcome =
    | { kind: 'joined'; position?: number }
    | { kind: 'existing' }
    | { kind: 'pending' }
    | { code?: string; kind: 'challenge'; }
    | { code?: string; fields: string[]; kind: 'invalid'; }
    | { kind: 'limited' }
    | { code?: string; kind: 'blocked'; }
    | { code?: string; kind: 'error'; };

interface SignupAnswer {
    error?: { code?: string; details?: unknown };
    existing?: boolean;
    position?: number;
}

/** The field names of a validation answer's `details`, ignoring anything else. */
function refusedFields(details: unknown): string[] {
    if (!Array.isArray(details)) return [];
    const fields: string[] = [];
    for (const detail of details) {
        const field = detail && typeof detail === 'object' ? (detail as { field?: unknown }).field : undefined;
        if (typeof field === 'string' && field) fields.push(field);
    }
    return fields;
}

/** True when the visitor's address is what the api refused, or it named no field. */
export function addressRefused(outcome: { fields: string[] }): boolean {
    return outcome.fields.length === 0 || outcome.fields.includes('email');
}

/** The api's own limit for `consent.policyVersion`: 64 bytes, no control characters. */
const POLICY_VERSION_MAX = 64;

function usablePolicyVersion(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const version = value.trim();
    if (!version || new TextEncoder().encode(version).length > POLICY_VERSION_MAX) return undefined;
    return /[\x00-\x1f\x7f]/.test(version) ? undefined : version;
}

/**
 * The notice version in the page's embedded consent configuration (the
 * `#aaarrr-consent` JSON the banner reads: `banner.notice.versionId`).
 */
export function embeddedPolicyVersion(json: string | null | undefined): string | undefined {
    if (!json) return undefined;
    try {
        const config = JSON.parse(json) as { banner?: { notice?: { versionId?: unknown } } } | null;
        return usablePolicyVersion(config?.banner?.notice?.versionId);
    } catch {
        return undefined;
    }
}

/**
 * The version the signup consents to: the one the block gives, else the
 * notice version the page embeds for the banner, else none (the form then
 * does not post a request the api would refuse). A given version the api
 * would refuse does not fall back to another one.
 */
export function policyVersionOf(given: string | undefined, embeddedJson: string | null | undefined): string | undefined {
    if (given?.trim()) return usablePolicyVersion(given);
    return embeddedPolicyVersion(embeddedJson);
}

/**
 * Reads the api's answer: 201 joined (200 with `existing` when the person
 * was already on the list, else a replay of a join), 202/502/503 saved but
 * pending (the retry with the same key finishes it), 422 a visitor-side
 * problem (missing challenge or an invalid address), 400 the same, with the
 * names of the refused fields (`error.details[].field`) so the form blames the
 * address only when it is the one refused, 429 too many, 401/403 a deployment
 * problem (key, origin, brand), anything else an error.
 */
export function signupOutcome(status: number, body: unknown): SignupOutcome {
    const answer = (body && typeof body === 'object' ? body : {}) as SignupAnswer;
    const code = answer.error?.code;
    if (status === 201) return { kind: 'joined', position: answer.position };
    if (status === 200) return answer.existing ? { kind: 'existing' } : { kind: 'joined', position: answer.position };
    if (status === 202 || status === 502 || status === 503) return { kind: 'pending' };
    if (status === 422 && code?.startsWith('CHALLENGE')) return { kind: 'challenge', code };
    if (status === 422 || status === 400) return { kind: 'invalid', code, fields: refusedFields(answer.error?.details) };
    if (status === 429) return { kind: 'limited' };
    if (status === 401 || status === 403) return { kind: 'blocked', code };
    return { kind: 'error', code };
}

/** The api url, publishable key and brand the layout gave the SDK script tag. */
export interface SiteConfig {
    /**
     *
     */
    apiUrl: string;
    /**
     *
     */
    projectKey: string;
    /**
     *
     */
    tenant?: string;
}

/** Reads SiteConfig from the `aaarrr.js` script element; null without a url and a key. */
export function siteConfigOf(script: { getAttribute(name: string): string | null } | null): SiteConfig | null {
    if (!script) return null;
    const apiUrl = script.getAttribute('data-api-url');
    const projectKey = script.getAttribute('data-api-key');
    if (!apiUrl || !projectKey) return null;
    return { apiUrl, projectKey, tenant: script.getAttribute('data-tenant') ?? undefined };
}
