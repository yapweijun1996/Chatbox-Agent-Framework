export interface Conversation {
    id: string;
    title: string;
    messages: unknown[];
    timestamp: number;
}

interface HistoryCallbacks {
    onSelect?: (id: string) => void;
    onDelete?: (id: string) => void;
    onRename?: (id: string, title: string) => void;
}

export class HistoryView {
    constructor(
        private readonly container: HTMLElement | null,
        private readonly callbacks: HistoryCallbacks
    ) { }

    render(conversations: Conversation[], activeId: string | null): void {
        if (!this.container) return;

        if (conversations.length === 0) {
            this.container.innerHTML = `
                <div class="history-empty">
                    No conversations yet
                </div>
            `;
            return;
        }

        this.container.innerHTML = conversations.map(conv => `
            <div class="history-item ${conv.id === activeId ? 'active' : ''}" data-id="${conv.id}">
                <span class="history-dot"></span>
                <span class="history-item-title">${this.escapeHtml(conv.title)}</span>
                <div class="history-item-actions">
                    <button class="icon-btn xs rename-conv-btn" title="Rename" data-id="${conv.id}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 20h9"></path>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                    </button>
                    <button class="icon-btn xs delete-conv-btn" title="Delete" data-id="${conv.id}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');

        this.bindEvents(conversations);
    }

    private bindEvents(conversations: Conversation[]): void {
        if (!this.container) return;

        this.container.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                if (target.closest('.history-item-actions')) return;

                const id = (item as HTMLElement).dataset.id;
                if (id) this.callbacks.onSelect?.(id);
            });
        });

        this.container.querySelectorAll('.delete-conv-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = (btn as HTMLElement).dataset.id;
                if (id) this.callbacks.onDelete?.(id);
            });
        });

        this.container.querySelectorAll('.rename-conv-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = (btn as HTMLElement).dataset.id;
                if (!id) return;
                const conv = conversations.find(c => c.id === id);
                const newTitle = prompt('Rename conversation:', conv?.title);
                if (newTitle && newTitle.trim()) {
                    this.callbacks.onRename?.(id, newTitle.trim());
                }
            });
        });
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
