/**
 * Shared heuristics for memory detection and formatting.
 */

export const DEFAULT_PREFERENCE_PATTERNS: RegExp[] = [
    /i prefer/i,
    /i like/i,
    /i want/i,
    /i need/i,
    /i always/i,
    /please.*always/i,
    /by default/i,
    /make sure/i,
];

export const DEFAULT_INTENT_PATTERNS: RegExp[] = [
    /^remember\b/i,
    /^remember that\b/i,
    /^save\b/i,
    /^save this\b/i,
    /^store\b/i,
    /^store this\b/i,
    /^add to memory\b/i,
    /^note that\b/i,
];

export function isPreferenceStatement(content: string, patterns: RegExp[] = DEFAULT_PREFERENCE_PATTERNS): boolean {
    const normalized = content.toLowerCase();
    return patterns.some(pattern => pattern.test(normalized));
}

export function extractIntentMemory(content: string, patterns: RegExp[] = DEFAULT_INTENT_PATTERNS): string | null {
    const trimmed = content.trim();
    if (!trimmed) return null;

    for (const pattern of patterns) {
        if (pattern.test(trimmed)) {
            const stripped = trimmed.replace(pattern, '').trim();
            return stripped || trimmed;
        }
    }

    return null;
}

export function normalizeMemoryContent(content: unknown): string {
    if (typeof content === 'string') return content;
    try {
        return JSON.stringify(content);
    } catch (error) {
        return String(content);
    }
}
