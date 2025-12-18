/**
 * Demo UI Controller - 所有的 DOM 操作和事件处理
 */

import { marked } from 'marked';
import type { LLMSettings, LLMProvider } from './settings';
import { getProviderDisplayName } from './settings';
import { store, getModelHistory, saveModelHistory } from './state';

// Configure marked for security
marked.setOptions({
    breaks: true,
    gfm: true,
});

export class UIController {
    // DOM Elements
    private sidebar: HTMLElement;
    private debugDrawer: HTMLElement;
    private chatContainer: HTMLElement;
    private messagesList: HTMLElement;
    private userInput: HTMLTextAreaElement;
    private sendBtn: HTMLButtonElement;
    private welcomeScreen: HTMLElement;
    private stepsList: HTMLElement;
    private eventsContainer: HTMLElement;
    private scrollBottomBtn: HTMLButtonElement;
    private currentProviderEl: HTMLElement;
    private settingsModal: HTMLElement;
    private sidebarOverlay: HTMLElement | null;

    // Callbacks
    private onSendMessage?: (text: string) => Promise<void>;
    private onNewChat?: () => void;
    private onSettingsSave?: (settings: LLMSettings) => void;
    private onStreamToggle?: () => void;

    // Temp state for settings
    private tempSettings?: LLMSettings;
    private selectedProvider: LLMProvider = 'lm-studio';
    private isSidebarOpen = false;
    private activeFilter: 'all' | 'step' | 'event' | 'error' = 'all';
    private debugCounts = { all: 0, step: 0, event: 0, error: 0 };

    constructor() {
        // Initialize DOM references
        this.sidebar = document.getElementById('sidebar')!;
        this.debugDrawer = document.getElementById('debug-drawer')!;
        this.chatContainer = document.getElementById('chat-container')!;
        this.messagesList = document.getElementById('messages-list')!;
        this.userInput = document.getElementById('user-input') as HTMLTextAreaElement;
        this.sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
        this.welcomeScreen = document.getElementById('welcome-screen')!;
        this.stepsList = document.getElementById('steps-list')!;
        this.eventsContainer = document.getElementById('events-container')!;
        this.scrollBottomBtn = document.getElementById('scroll-bottom-btn') as HTMLButtonElement;
        this.currentProviderEl = document.getElementById('current-provider')!;
        this.settingsModal = document.getElementById('settings-modal')!;
        this.sidebarOverlay = document.getElementById('sidebar-overlay');
        this.isSidebarOpen = window.innerWidth >= 768;

        this.setupEventListeners();
        this.updateProviderDisplay();
        this.checkScroll();
        this.applySidebarState();
    }

    setCallbacks(callbacks: {
        onSendMessage?: (text: string) => Promise<void>;
        onNewChat?: () => void;
        onSettingsSave?: (settings: LLMSettings) => void;
        onStreamToggle?: () => void;
    }) {
        Object.assign(this, callbacks);
    }

    private setupEventListeners() {
        // Input Auto-resize
        this.userInput.addEventListener('input', () => {
            this.userInput.style.height = 'auto';
            this.userInput.style.height = Math.min(this.userInput.scrollHeight, 200) + 'px';
            const state = store.getState();
            this.sendBtn.disabled = this.userInput.value.trim().length === 0 || state.isGenerating;
        });

        // Send on Enter
        this.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        });

        this.sendBtn.addEventListener('click', () => this.handleSend());

        // Sidebar toggles
        document.getElementById('toggle-sidebar-btn')?.addEventListener('click', () => this.toggleSidebar());
        document.getElementById('mobile-menu-btn')?.addEventListener('click', () => this.toggleSidebar());
        this.sidebarOverlay?.addEventListener('click', () => this.closeSidebar());

        // Debug drawer toggles
        const toggleDebug = () => this.debugDrawer.classList.toggle('translate-x-full');
        document.getElementById('toggle-debug-btn')?.addEventListener('click', toggleDebug);
        document.getElementById('close-debug-btn')?.addEventListener('click', toggleDebug);

        // New chat
        document.getElementById('new-chat-btn')?.addEventListener('click', () => this.onNewChat?.());

        // Scroll
        this.chatContainer.addEventListener('scroll', () => this.checkScroll());
        window.addEventListener('resize', () => {
            this.checkScroll();
            this.applySidebarState();
        });
        this.scrollBottomBtn?.addEventListener('click', () => this.scrollToBottom());

        // Settings
        document.getElementById('settings-btn')?.addEventListener('click', () => this.openSettings());
        document.getElementById('model-selector')?.addEventListener('click', () => this.openSettings());
        document.getElementById('close-settings-btn')?.addEventListener('click', () => this.closeSettings());
        document.getElementById('cancel-settings-btn')?.addEventListener('click', () => this.closeSettings());
        document.getElementById('settings-overlay')?.addEventListener('click', () => this.closeSettings());
        document.getElementById('save-settings-btn')?.addEventListener('click', () => this.saveSettings());

        // Provider selection
        document.querySelectorAll('.provider-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectedProvider = btn.getAttribute('data-provider') as LLMProvider;
                this.updateProviderSelection();
            });
        });

        // Stream toggle
        document.getElementById('stream-toggle-btn')?.addEventListener('click', () => this.onStreamToggle?.());

        // ESC to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.settingsModal.classList.contains('hidden')) {
                this.closeSettings();
            }
            if (e.key === 'Escape' && this.isSidebarOpen && window.innerWidth < 768) {
                this.closeSidebar();
            }
        });

        // Quick prompts
        document.querySelectorAll('.prompt-card').forEach(card => {
            card.addEventListener('click', () => {
                const state = store.getState();
                if (state.isGenerating) return;
                const prompt = (card as HTMLElement).dataset.prompt;
                if (!prompt) return;
                this.userInput.value = prompt;
                this.userInput.dispatchEvent(new Event('input'));
                this.handleSend();
            });
        });

        // Debug console filters
        document.querySelectorAll('.filter-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                this.activeFilter = (btn as HTMLElement).dataset.filter as any;
                document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.applyFilter();
            });
        });

        // Clear debug logs
        document.getElementById('clear-debug-btn')?.addEventListener('click', () => {
            if (confirm('Clear all debug logs?')) {
                this.clearDebugLogs();
            }
        });

        // Export debug logs
        document.getElementById('export-btn')?.addEventListener('click', () => {
            this.exportDebugLogs();
        });
    }

    private async handleSend() {
        const text = this.userInput.value.trim();
        const state = store.getState();
        if (!text || state.isGenerating) return;

        this.userInput.value = '';
        this.userInput.style.height = 'auto';
        this.sendBtn.disabled = true;

        await this.onSendMessage?.(text);
    }

    private toggleSidebar() {
        this.isSidebarOpen = !this.isSidebarOpen;
        this.applySidebarState();
    }

    private openSidebar() {
        this.isSidebarOpen = true;
        this.applySidebarState();
    }

    private closeSidebar() {
        this.isSidebarOpen = false;
        this.applySidebarState();
    }

    private applySidebarState() {
        const isMobile = window.innerWidth < 768;

        if (isMobile) {
            if (this.isSidebarOpen) {
                this.sidebar.classList.remove('-translate-x-full');
                this.sidebarOverlay?.classList.add('active');
            } else {
                this.sidebar.classList.add('-translate-x-full');
                this.sidebarOverlay?.classList.remove('active');
            }
            document.body.classList.remove('sidebar-collapsed');
        } else {
            this.sidebar.classList.remove('-translate-x-full');
            this.sidebarOverlay?.classList.remove('active');
            document.body.classList.toggle('sidebar-collapsed', !this.isSidebarOpen);
        }
    }

    // Message Management
    appendMessage(role: 'user' | 'ai', content: string): string {
        const id = `msg-${Date.now()}`;
        const div = document.createElement('div');
        div.className = `message-row ${role}`;
        div.id = id;
        const avatar = role === 'ai' ? '<div class="avatar-mark"></div>' : 'U';
        div.innerHTML = `
            <div class="message-inner">
                <div class="message-avatar ${role}">
                    ${avatar}
                </div>
                <div class="message-body prose">${this.formatContent(content)}</div>
            </div>
        `;
        this.messagesList.appendChild(div);
        return id;
    }

    streamUpdate(id: string, fullContent: string) {
        const msgRow = document.getElementById(id);
        if (!msgRow) return;

        const body = msgRow.querySelector('.message-body');
        if (!body) return;

        // Parse thinking tags and content
        const parsed = this.parseThinkingContent(fullContent);

        const formattedContent = this.formatContent(parsed.content);

        if (parsed.thinking) {
            this.renderThinkingBlock(body, parsed.thinking, formattedContent, false);
            return;
        }

        body.innerHTML = formattedContent;
    }

    private parseThinkingContent(text: string): { thinking: string; content: string } {
        // Match <think>...</think> tags
        const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
        const matches = text.match(thinkRegex);

        if (!matches) {
            return { thinking: '', content: text };
        }

        // Extract all thinking content
        const thinking = matches
            .map(match => match.replace(/<\/?think>/gi, '').trim())
            .join('\n\n');

        // Remove thinking tags from content
        const content = text.replace(thinkRegex, '').trim();

        return { thinking, content };
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    private renderThinkingBlock(
        body: Element,
        thinkingText: string,
        formattedContent: string,
        preserveOpenState: boolean
    ) {
        const existing = body.querySelector('.thinking-process') as HTMLDetailsElement | null;
        const wasOpen = preserveOpenState ? existing?.hasAttribute('open') ?? false : false;

        body.innerHTML = `
            <div class="thinking-wrapper">
                <details class="thinking-process">
                    <summary>
                        <span class="thinking-label">💭 Reasoning</span>
                        <span class="thinking-hint">Click to expand</span>
                    </summary>
                    <div class="thinking-content">${this.escapeHtml(thinkingText)}</div>
                </details>
                <div class="assistant-content">${formattedContent || '<span class="muted-text">Generating response...</span>'}</div>
            </div>
        `;

        const details = body.querySelector('.thinking-process') as HTMLDetailsElement | null;
        if (details && wasOpen) {
            details.setAttribute('open', '');
        }
    }

    updateMessage(id: string, content: string, isError = false, stats?: string) {
        const msgRow = document.getElementById(id);
        if (msgRow) {
            const body = msgRow.querySelector('.message-body');
            if (body) {
                const parsed = this.parseThinkingContent(content);
                const formatted = this.formatContent(parsed.content);
                if (parsed.thinking) {
                    this.renderThinkingBlock(body, parsed.thinking, formatted, true);
                } else {
                    body.innerHTML = formatted;
                }
                if (isError) body.classList.add('text-red-500');

                if (stats && msgRow.classList.contains('ai')) {
                    const statsDiv = document.createElement('div');
                    statsDiv.className = 'message-meta';
                    statsDiv.innerHTML = `
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
                        ${stats}
                    `;
                    body.appendChild(statsDiv);
                }
            }
        }
    }

    private formatContent(text: string): string {
        if (!text) return '';
        try {
            return marked.parse(text) as string;
        } catch {
            // Fallback to simple formatting
            return text.replace(/\n/g, '<br>');
        }
    }

    hideWelcomeScreen() {
        this.welcomeScreen.classList.add('hidden');
    }

    scrollToBottom(behavior: ScrollBehavior = 'smooth') {
        this.chatContainer.scrollTo({
            top: this.chatContainer.scrollHeight,
            behavior
        });
    }

    public getIsNearBottom(): boolean {
        const threshold = 150;
        return this.chatContainer.scrollHeight - this.chatContainer.scrollTop - this.chatContainer.clientHeight < threshold;
    }

    private checkScroll() {
        this.scrollBottomBtn?.classList.toggle('hidden', this.getIsNearBottom());
    }

    // Debug Panel
    addDebugStep(nodeId: string, status: string) {
        const div = document.createElement('div');
        div.className = 'bg-white/5 p-2 rounded border-l-2 border-text-tertiary';
        div.dataset.filter = 'step';
        div.innerHTML = `<strong>${nodeId}</strong>: ${status}`;
        this.stepsList.appendChild(div);
        this.stepsList.scrollTop = this.stepsList.scrollHeight;
        this.updateDebugCounts();
        this.applyFilter();
    }

    updateDebugStep(nodeId: string, result: any) {
        const div = document.createElement('div');
        const isSuccess = result.success !== false;
        div.className = `bg-white/5 p-2 rounded border-l-2 ${isSuccess ? 'border-accent' : 'border-red-500'}`;
        div.dataset.filter = 'step';
        if (!isSuccess) div.dataset.type = 'error';
        div.innerHTML = `<div><strong>${nodeId}</strong>: ${isSuccess ? 'Completed' : 'Failed'}</div>`;
        this.stepsList.appendChild(div);
        this.stepsList.scrollTop = this.stepsList.scrollHeight;
        this.updateDebugCounts();
        this.applyFilter();
    }

    addDebugEvent(event: any) {
        const div = document.createElement('div');
        const eventType = this.getEventType(event);

        div.className = `debug-event type-${eventType}`;
        div.dataset.filter = 'event';
        div.dataset.type = eventType;

        div.innerHTML = `
            <span class="event-time">${this.formatRelativeTime(event.timestamp)}</span>
            <span class="event-badge">${eventType.toUpperCase()}</span>
            <div class="event-content">
                <strong>${event.type}</strong>
                ${event.summary ? `<div>${event.summary}</div>` : ''}
            </div>
        `;

        this.eventsContainer.appendChild(div);
        this.eventsContainer.scrollTop = this.eventsContainer.scrollHeight;
        this.updateDebugCounts();
        this.applyFilter();
    }

    private getEventType(event: any): 'error' | 'success' | 'info' | 'warning' {
        const eventType = event.type?.toLowerCase() || '';
        if (eventType.includes('error') || eventType.includes('fail')) return 'error';
        if (eventType.includes('complete') || eventType.includes('success')) return 'success';
        if (eventType.includes('warn')) return 'warning';
        return 'info';
    }

    private formatRelativeTime(timestamp: number): string {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h`;
    }

    private updateDebugCounts() {
        this.debugCounts.all = this.stepsList.children.length + this.eventsContainer.children.length;
        this.debugCounts.step = this.stepsList.children.length;
        this.debugCounts.event = this.eventsContainer.children.length;
        this.debugCounts.error = document.querySelectorAll('[data-type="error"]').length;

        // Update UI counts
        document.querySelectorAll('.filter-tab').forEach(btn => {
            const filter = (btn as HTMLElement).dataset.filter as keyof typeof this.debugCounts;
            const countEl = btn.querySelector('.count');
            if (countEl && filter) {
                countEl.textContent = String(this.debugCounts[filter]);
            }
        });
    }

    private applyFilter() {
        const allItems = document.querySelectorAll('[data-filter]');
        allItems.forEach(item => {
            const el = item as HTMLElement;
            if (this.activeFilter === 'all') {
                el.style.display = '';
            } else if (this.activeFilter === 'error') {
                el.style.display = el.dataset.type === 'error' ? '' : 'none';
            } else {
                el.style.display = el.dataset.filter === this.activeFilter ? '' : 'none';
            }
        });
    }

    clearDebugLogs() {
        this.stepsList.innerHTML = '';
        this.eventsContainer.innerHTML = '';
        this.debugCounts = { all: 0, step: 0, event: 0, error: 0 };
        this.updateDebugCounts();
    }

    exportDebugLogs() {
        const logs = {
            timestamp: new Date().toISOString(),
            steps: Array.from(this.stepsList.children).map(el => el.textContent),
            events: Array.from(this.eventsContainer.children).map(el => ({
                type: el.querySelector('strong')?.textContent,
                content: el.textContent
            }))
        };

        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debug-logs-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Settings Modal
    private openSettings() {
        const state = store.getState();
        this.tempSettings = JSON.parse(JSON.stringify(state.settings));
        this.selectedProvider = state.settings.provider;
        this.populateSettingsForm();
        this.updateProviderSelection();
        this.updateModelDatalist();
        this.settingsModal.classList.remove('hidden');
    }

    private closeSettings() {
        this.settingsModal.classList.add('hidden');
    }

    private populateSettingsForm() {
        if (!this.tempSettings) return;
        (document.getElementById('lm-studio-url') as HTMLInputElement).value = this.tempSettings.lmStudio.baseURL;
        (document.getElementById('lm-studio-model') as HTMLInputElement).value = this.tempSettings.lmStudio.model;
        (document.getElementById('gemini-api-key') as HTMLInputElement).value = this.tempSettings.gemini.apiKey;
        (document.getElementById('gemini-model') as HTMLSelectElement).value = this.tempSettings.gemini.model;
        (document.getElementById('openai-api-key') as HTMLInputElement).value = this.tempSettings.openai.apiKey;
        (document.getElementById('openai-base-url') as HTMLInputElement).value = this.tempSettings.openai.baseURL;
        (document.getElementById('openai-model') as HTMLSelectElement).value = this.tempSettings.openai.model;
    }

    private updateProviderSelection() {
        document.querySelectorAll('.provider-btn').forEach(btn => {
            const provider = btn.getAttribute('data-provider');
            if (provider === this.selectedProvider) {
                btn.classList.add('border-accent', 'bg-accent/10');
                btn.classList.remove('border-white/10');
            } else {
                btn.classList.remove('border-accent', 'bg-accent/10');
                btn.classList.add('border-white/10');
            }
        });

        const settingsMap: Record<string, HTMLElement | null> = {
            'lm-studio': document.getElementById('lm-studio-settings'),
            'gemini': document.getElementById('gemini-settings'),
            'openai': document.getElementById('openai-settings'),
        };

        Object.entries(settingsMap).forEach(([key, el]) => {
            if (el) {
                el.classList.toggle('hidden', key !== this.selectedProvider);
            }
        });
    }

    private updateModelDatalist() {
        const datalist = document.getElementById('lm-studio-model-history');
        if (!datalist) return;
        const history = getModelHistory();
        datalist.innerHTML = history.map(model => `<option value="${model}">`).join('');
    }

    private saveSettings() {
        if (!this.tempSettings) return;

        this.tempSettings.provider = this.selectedProvider;
        this.tempSettings.lmStudio.baseURL = (document.getElementById('lm-studio-url') as HTMLInputElement).value || 'http://127.0.0.1:6354';
        this.tempSettings.lmStudio.model = (document.getElementById('lm-studio-model') as HTMLInputElement).value || 'mistralai/ministral-3-14b-reasoning';

        if (this.tempSettings.lmStudio.model) {
            saveModelHistory(this.tempSettings.lmStudio.model);
        }

        this.tempSettings.gemini.apiKey = (document.getElementById('gemini-api-key') as HTMLInputElement).value;
        this.tempSettings.gemini.model = (document.getElementById('gemini-model') as HTMLSelectElement).value;
        this.tempSettings.openai.apiKey = (document.getElementById('openai-api-key') as HTMLInputElement).value;
        this.tempSettings.openai.baseURL = (document.getElementById('openai-base-url') as HTMLInputElement).value || 'https://api.openai.com';
        this.tempSettings.openai.model = (document.getElementById('openai-model') as HTMLSelectElement).value;

        if (this.selectedProvider === 'gemini' && !this.tempSettings.gemini.apiKey) {
            alert('Please enter your Gemini API key');
            return;
        }
        if (this.selectedProvider === 'openai' && !this.tempSettings.openai.apiKey) {
            alert('Please enter your OpenAI API key');
            return;
        }

        store.setState({ settings: this.tempSettings });
        this.onSettingsSave?.(this.tempSettings);
        this.updateProviderDisplay();
        this.closeSettings();
    }

    updateProviderDisplay() {
        const state = store.getState();
        if (this.currentProviderEl) {
            this.currentProviderEl.textContent = getProviderDisplayName(state.settings.provider);
        }
    }

    updateStreamToggle(isEnabled: boolean) {
        const streamToggleBtn = document.getElementById('stream-toggle-btn');
        const dot = document.getElementById('stream-status-dot');

        if (streamToggleBtn && dot) {
            streamToggleBtn.classList.toggle('active', isEnabled);
            dot.classList.toggle('on', isEnabled);
        }
    }

    clearMessages() {
        this.messagesList.innerHTML = '';
        this.stepsList.innerHTML = '';
        this.eventsContainer.innerHTML = '';
        this.welcomeScreen.classList.remove('hidden');
        this.userInput.value = '';
    }

    focusInput() {
        this.userInput.focus();
    }

    enableInput() {
        this.sendBtn.disabled = false;
        this.userInput.focus();
    }
}
