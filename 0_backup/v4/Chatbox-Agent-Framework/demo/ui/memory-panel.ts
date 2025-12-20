import type { MemoryPanelCallbacks, MemoryScope, MemorySnapshot } from './memory-panel-types';
import { formatImportance } from './memory-panel-helpers';
import { renderMemoryItem } from './memory-panel-render';

export class MemoryPanel {
    private callbacks: MemoryPanelCallbacks = {};
    private snapshot: MemorySnapshot = { shortTerm: [], longTerm: [] };
    private activeScope: 'all' | MemoryScope = 'all';
    private searchQuery = '';
    private refreshToken = 0;
    private searchTimer?: number;

    private readonly searchInput: HTMLInputElement | null;
    private readonly filterButtons: NodeListOf<HTMLElement>;
    private readonly shortSection: HTMLElement | null;
    private readonly longSection: HTMLElement | null;
    private readonly shortList: HTMLElement | null;
    private readonly longList: HTMLElement | null;
    private readonly shortEmpty: HTMLElement | null;
    private readonly longEmpty: HTMLElement | null;
    private readonly shortCount: HTMLElement | null;
    private readonly longCount: HTMLElement | null;

    private readonly refreshBtn: HTMLButtonElement | null;
    private readonly addToggleBtn: HTMLButtonElement | null;
    private readonly addForm: HTMLElement | null;
    private readonly addBtn: HTMLButtonElement | null;
    private readonly addCancelBtn: HTMLButtonElement | null;
    private readonly scopeSelect: HTMLSelectElement | null;
    private readonly contentInput: HTMLTextAreaElement | null;
    private readonly tagsInput: HTMLInputElement | null;
    private readonly importanceInput: HTMLInputElement | null;
    private readonly importanceValue: HTMLElement | null;
    private readonly clearShortBtn: HTMLButtonElement | null;
    private readonly clearLongBtn: HTMLButtonElement | null;
    private readonly consolidateBtn: HTMLButtonElement | null;

    constructor(private readonly drawer: HTMLElement) {
        this.searchInput = drawer.querySelector<HTMLInputElement>('#memory-search-input');
        this.filterButtons = drawer.querySelectorAll<HTMLElement>('.memory-filter');
        this.shortSection = drawer.querySelector<HTMLElement>('[data-scope-section="short"]');
        this.longSection = drawer.querySelector<HTMLElement>('[data-scope-section="long"]');
        this.shortList = drawer.querySelector<HTMLElement>('#memory-short-list');
        this.longList = drawer.querySelector<HTMLElement>('#memory-long-list');
        this.shortEmpty = drawer.querySelector<HTMLElement>('#memory-short-empty');
        this.longEmpty = drawer.querySelector<HTMLElement>('#memory-long-empty');
        this.shortCount = drawer.querySelector<HTMLElement>('#memory-short-count');
        this.longCount = drawer.querySelector<HTMLElement>('#memory-long-count');
        this.refreshBtn = drawer.querySelector<HTMLButtonElement>('#memory-refresh-btn');
        this.addToggleBtn = drawer.querySelector<HTMLButtonElement>('#memory-add-toggle');
        this.addForm = drawer.querySelector<HTMLElement>('#memory-add-form');
        this.addBtn = drawer.querySelector<HTMLButtonElement>('#memory-add-btn');
        this.addCancelBtn = drawer.querySelector<HTMLButtonElement>('#memory-add-cancel');
        this.scopeSelect = drawer.querySelector<HTMLSelectElement>('#memory-scope-select');
        this.contentInput = drawer.querySelector<HTMLTextAreaElement>('#memory-content-input');
        this.tagsInput = drawer.querySelector<HTMLInputElement>('#memory-tags-input');
        this.importanceInput = drawer.querySelector<HTMLInputElement>('#memory-importance-input');
        this.importanceValue = drawer.querySelector<HTMLElement>('#memory-importance-value');
        this.clearShortBtn = drawer.querySelector<HTMLButtonElement>('#memory-clear-short-btn');
        this.clearLongBtn = drawer.querySelector<HTMLButtonElement>('#memory-clear-long-btn');
        this.consolidateBtn = drawer.querySelector<HTMLButtonElement>('#memory-consolidate-btn');

        this.bindEvents();
    }

    setCallbacks(callbacks: MemoryPanelCallbacks): void {
        this.callbacks = callbacks;
    }

    async refresh(query?: string): Promise<void> {
        if (!this.callbacks.onRefresh) return;
        const token = ++this.refreshToken;
        this.setLoading(true);
        try {
            const snapshot = await this.callbacks.onRefresh(query ?? this.searchQuery);
            if (token !== this.refreshToken) return;
            this.snapshot = snapshot;
            this.render();
        } catch (error) {
            console.error('[MemoryPanel] Refresh failed:', error);
        } finally {
            if (token === this.refreshToken) {
                this.setLoading(false);
            }
        }
    }

    private bindEvents(): void {
        this.filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const scope = btn.dataset.scope as 'all' | MemoryScope | undefined;
                this.activeScope = scope || 'all';
                this.filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.applyScopeFilter();
            });
        });

        this.searchInput?.addEventListener('input', () => {
            this.searchQuery = this.searchInput?.value.trim().toLowerCase() || '';
            this.queueRefresh();
        });

        this.refreshBtn?.addEventListener('click', () => this.refresh());

        this.addToggleBtn?.addEventListener('click', () => {
            const nextState = !this.addForm?.classList.contains('hidden');
            this.addForm?.classList.toggle('hidden', nextState);
            this.addToggleBtn?.classList.toggle('active', !nextState);
        });

        this.addCancelBtn?.addEventListener('click', () => this.resetForm(true));
        this.addBtn?.addEventListener('click', () => this.handleAdd());

        this.importanceInput?.addEventListener('input', () => {
            if (!this.importanceValue || !this.importanceInput) return;
            this.importanceValue.textContent = formatImportance(parseFloat(this.importanceInput.value));
        });

        this.clearShortBtn?.addEventListener('click', () => this.handleClear('short'));
        this.clearLongBtn?.addEventListener('click', () => this.handleClear('long'));
        this.consolidateBtn?.addEventListener('click', () => this.handleConsolidate());

        this.shortList?.addEventListener('click', (event) => this.handleListAction(event, 'short'));
        this.longList?.addEventListener('click', (event) => this.handleListAction(event, 'long'));
    }

    private async handleAdd(): Promise<void> {
        if (!this.callbacks.onAdd || !this.contentInput || !this.scopeSelect) return;

        const content = this.contentInput.value.trim();
        if (!content) {
            alert('Please enter memory content.');
            return;
        }

        const scope = this.scopeSelect.value === 'long' ? 'long' : 'short';
        const tags = this.parseTags(this.tagsInput?.value || '');
        const importance = parseFloat(this.importanceInput?.value || '0.5');

        try {
            await this.callbacks.onAdd({ scope, content, tags, importance });
            this.resetForm();
            await this.refresh();
        } catch (error) {
            console.error('[MemoryPanel] Add failed:', error);
            alert('Failed to add memory. Check console for details.');
        }
    }

    private async handleClear(scope: MemoryScope): Promise<void> {
        if (!this.callbacks.onClear) return;
        const label = scope === 'short' ? 'short-term' : 'long-term';
        if (!confirm(`Clear all ${label} memory?`)) return;
        await this.callbacks.onClear(scope);
        await this.refresh();
    }

    private async handleConsolidate(): Promise<void> {
        if (!this.callbacks.onConsolidate) return;
        await this.callbacks.onConsolidate();
        await this.refresh();
    }

    private async handleListAction(event: Event, scope: MemoryScope): Promise<void> {
        const target = event.target as HTMLElement | null;
        const button = target?.closest<HTMLButtonElement>('button[data-action]');
        if (!button) return;

        const action = button.dataset.action;
        const id = button.dataset.id;
        if (!action || !id) return;

        if (action === 'delete' && this.callbacks.onDelete) {
            if (!confirm('Delete this memory item?')) return;
            await this.callbacks.onDelete(scope, id);
            await this.refresh();
        }

        if (action === 'promote' && this.callbacks.onPromote) {
            await this.callbacks.onPromote(id);
            await this.refresh();
        }
    }

    private render(): void {
        const shortItems = this.snapshot.shortTerm || [];
        const longItems = this.snapshot.longTerm || [];

        if (this.shortList) {
            this.shortList.innerHTML = shortItems.map(item => renderMemoryItem(item, 'short')).join('');
        }
        if (this.longList) {
            this.longList.innerHTML = longItems.map(item => renderMemoryItem(item, 'long')).join('');
        }

        this.shortEmpty?.classList.toggle('hidden', shortItems.length > 0);
        this.longEmpty?.classList.toggle('hidden', longItems.length > 0);

        this.updateCounts(shortItems.length, longItems.length);
        this.applyScopeFilter();
    }

    private applyScopeFilter(): void {
        const showShort = this.activeScope === 'all' || this.activeScope === 'short';
        const showLong = this.activeScope === 'all' || this.activeScope === 'long';
        this.shortSection?.classList.toggle('hidden', !showShort);
        this.longSection?.classList.toggle('hidden', !showLong);
    }

    private updateCounts(shortCount: number, longCount: number): void {
        const allCount = shortCount + longCount;
        this.filterButtons.forEach(btn => {
            const scope = btn.dataset.scope;
            const countEl = btn.querySelector('.count');
            if (!countEl) return;
            if (scope === 'short') countEl.textContent = String(shortCount);
            else if (scope === 'long') countEl.textContent = String(longCount);
            else countEl.textContent = String(allCount);
        });

        if (this.shortCount) this.shortCount.textContent = String(shortCount);
        if (this.longCount) this.longCount.textContent = String(longCount);
    }

    private setLoading(isLoading: boolean): void {
        this.drawer.setAttribute('aria-busy', String(isLoading));
        this.drawer.classList.toggle('is-loading', isLoading);
    }

    private queueRefresh(): void {
        window.clearTimeout(this.searchTimer);
        this.searchTimer = window.setTimeout(() => this.refresh(), 250);
    }

    private resetForm(close?: boolean): void {
        if (this.contentInput) this.contentInput.value = '';
        if (this.tagsInput) this.tagsInput.value = '';
        if (this.importanceInput) this.importanceInput.value = '0.5';
        if (this.importanceValue) this.importanceValue.textContent = formatImportance(0.5);

        if (close) {
            this.addForm?.classList.add('hidden');
            this.addToggleBtn?.classList.remove('active');
        }
    }

    private parseTags(value: string): string[] {
        return value
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean);
    }
}
