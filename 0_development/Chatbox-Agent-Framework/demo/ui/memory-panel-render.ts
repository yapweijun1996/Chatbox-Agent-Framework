import type { MemoryEntry, MemoryScope } from './memory-panel-types';
import {
    escapeHtml,
    formatImportance,
    formatRelativeTime,
    formatRawContent,
    toPlainText,
    truncate,
} from './memory-panel-helpers';

function renderTags(tags: string[]): string {
    if (!tags.length) return '';
    return `<div class="memory-tags">${tags.map(tag => `<span class="memory-tag">${escapeHtml(tag)}</span>`).join('')}</div>`;
}

export function renderMemoryItem(item: MemoryEntry, scope: MemoryScope): string {
    const tags = item.metadata.tags || [];
    const summary = item.summary || toPlainText(item.content);
    const preview = truncate(summary, 180);
    const importance = formatImportance(item.metadata.importance);
    const accessed = formatRelativeTime(item.metadata.lastAccessedAt);
    const level = item.metadata.importanceLevel ? ` (${item.metadata.importanceLevel})` : '';
    const source = item.metadata.source ? ` • ${escapeHtml(item.metadata.source)}` : '';
    const details = escapeHtml(formatRawContent(item.content));
    const actionButtons = scope === 'short'
        ? `
            <button class="icon-btn xs" data-action="promote" data-id="${escapeHtml(item.id)}" title="Promote to long-term" aria-label="Promote to long-term">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 19V5"></path>
                    <polyline points="5 12 12 5 19 12"></polyline>
                </svg>
            </button>
            <button class="icon-btn xs" data-action="delete" data-id="${escapeHtml(item.id)}" title="Delete memory" aria-label="Delete memory">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        `
        : `
            <button class="icon-btn xs" data-action="delete" data-id="${escapeHtml(item.id)}" title="Delete memory" aria-label="Delete memory">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        `;

    return `
        <article class="memory-item">
            <div class="memory-item-header">
                <span class="memory-pill ${scope}">${scope === 'short' ? 'Short-term' : 'Long-term'}</span>
                <span class="memory-id">${escapeHtml(item.id)}</span>
                <span class="memory-score">${importance}${level}</span>
                <div class="memory-actions">
                    ${actionButtons}
                </div>
            </div>
            <div class="memory-item-body">
                <p class="memory-preview">${escapeHtml(preview)}</p>
                ${renderTags(tags)}
                <div class="memory-meta">Accessed ${accessed} • ${item.metadata.accessCount} reads${source}</div>
                <details class="memory-details">
                    <summary>Details</summary>
                    <div class="memory-detail-grid">
                        <div>Created: ${formatRelativeTime(item.metadata.createdAt)}</div>
                        <div>Last accessed: ${formatRelativeTime(item.metadata.lastAccessedAt)}</div>
                    </div>
                    <pre>${details}</pre>
                </details>
            </div>
        </article>
    `;
}
