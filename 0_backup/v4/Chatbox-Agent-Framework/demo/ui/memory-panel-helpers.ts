export function toPlainText(content: unknown): string {
    if (content === null || content === undefined) return '';
    if (typeof content === 'string') return content;
    try {
        return JSON.stringify(content);
    } catch {
        return String(content);
    }
}

export function formatRawContent(content: unknown): string {
    const raw = toPlainText(content);
    if (raw.length <= 4000) return raw;
    return `${raw.slice(0, 4000)}...`;
}

export function truncate(text: string, length: number): string {
    if (text.length <= length) return text;
    return `${text.slice(0, length - 3)}...`;
}

export function formatImportance(value: number): string {
    const normalized = Number.isFinite(value) ? value : 0;
    return `${Math.round(normalized * 100)}%`;
}

export function formatRelativeTime(timestamp: number): string {
    const deltaSeconds = Math.floor((Date.now() - timestamp) / 1000);
    if (deltaSeconds < 10) return 'just now';
    if (deltaSeconds < 60) return `${deltaSeconds}s ago`;
    const minutes = Math.floor(deltaSeconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

export function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
