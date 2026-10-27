export const ANONYMOUS_ID_COOKIE = 'ajs_anonymous_id';

export const getAnonymousId = (): string => {
    if (typeof document === 'undefined') return '';
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${ANONYMOUS_ID_COOKIE}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || '';
    return '';
};

/**
 * Page context the AAARRR SDK read from its script tag (`tenant`, `funnel`,
 * `funnel_step`), so lead submissions name the brand and funnel they came
 * from. Empty when the page sets none (single-site deployments).
 */
export const pageContext = (): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    const context = (window as unknown as { aaarrr?: { context?: Record<string, string> } }).aaarrr?.context;
    return context ? { ...context } : {};
};

/**
 * The id a lead capture answered with (`leadId`, `id`, else `subjectId`):
 * what a form identifies the person by. Never an address (ADR 0024); none
 * when the answer carries no id, and the form then identifies nobody.
 */
export const capturedId = (body: unknown): string | undefined => {
    if (typeof body !== 'object' || body === null) return undefined;
    const b = body as Record<string, unknown>;
    for (const value of [b.leadId, b.id, b.subjectId]) {
        const id = typeof value === 'number' ? String(value) : value;
        if (typeof id === 'string' && id !== '' && !id.includes('@')) return id;
    }
    return undefined;
};

/** The JSON answer of a capture request, or nothing when it has none. */
export const answerOf = async (res: Response): Promise<unknown> => {
    try {
        return await res.json();
    } catch {
        return undefined;
    }
};
