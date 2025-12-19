/**
 * Demo UI Controller
 * 将庞大的 UI 逻辑拆解为多个子模块，便于维护
 */

import type { LLMSettings } from './settings';
import { getProviderDisplayName } from './settings';
import { store } from './state';
import { MessageView } from './ui/message-view';
import { SidebarManager } from './ui/sidebar-manager';
import { DebugConsole, type DebugCounts } from './ui/debug-console';
import { SettingsPanel } from './ui/settings-panel';
import { HistoryView, type Conversation } from './ui/history-view';
import { ChatViewport } from './ui/chat-viewport';

type CallbackMap = {
    onSendMessage?: (text: string) => Promise<void>;
    onNewChat?: () => void;
    onSettingsSave?: (settings: LLMSettings) => void;
    onStreamToggle?: () => void;
    onStopGeneration?: () => void;
    onPromptLibrary?: () => void;
    onConversationSelect?: (id: string) => void;
    onConversationDelete?: (id: string) => void;
    onConversationRename?: (id: string, title: string) => void;
};

export class UIController {
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
    private currentModelEl: HTMLElement | null;
    private modelLatencyEl: HTMLElement | null;
    private streamStatusText: HTMLElement | null;
    private settingsModal: HTMLElement;
    private sidebarOverlay: HTMLElement | null;
    private promptLibraryPanel: HTMLElement | null;
    private promptLibraryBtn: HTMLButtonElement | null;
    private closePromptLibraryBtn: HTMLButtonElement | null;
    private stopBtn: HTMLButtonElement | null;
    private composerHint: HTMLElement | null;
    private debugBadge: HTMLElement | null;
    private unreadDebugEvents = 0;
    private isPromptLibraryOpen = false;

    private readonly messageView: MessageView;
    private readonly sidebarManager: SidebarManager;
    private readonly debugConsole: DebugConsole;
    private readonly settingsPanel: SettingsPanel;
    private readonly historyView: HistoryView;
    private readonly chatViewport: ChatViewport;

    private onSendMessage?: (text: string) => Promise<void>;
    private onNewChat?: () => void;
    private onSettingsSave?: (settings: LLMSettings) => void;
    private onStreamToggle?: () => void;
    private onConversationSelect?: (id: string) => void;
    private onConversationDelete?: (id: string) => void;
    private onConversationRename?: (id: string, title: string) => void;

    constructor() {
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
        this.currentModelEl = document.getElementById('current-model');
        this.modelLatencyEl = document.getElementById('model-latency');
        this.streamStatusText = document.getElementById('stream-status-text');
        this.settingsModal = document.getElementById('settings-modal')!;
        this.sidebarOverlay = document.getElementById('sidebar-overlay');
        this.promptLibraryPanel = document.getElementById('prompt-library-panel');
        this.promptLibraryBtn = document.getElementById('prompt-library-btn') as HTMLButtonElement | null;
        this.closePromptLibraryBtn = document.getElementById('close-prompt-library-btn') as HTMLButtonElement | null;
        this.stopBtn = document.getElementById('stop-btn') as HTMLButtonElement | null;
        this.composerHint = document.getElementById('composer-hint');
        this.debugBadge = document.getElementById('debug-badge');
        this.promptLibraryBtn?.setAttribute('aria-expanded', 'false');


        this.messageView = new MessageView(this.messagesList);
        this.sidebarManager = new SidebarManager(this.sidebar, this.sidebarOverlay);

        // Remove FOUC prevention classes after sidebar manager has applied the persistent state
        document.documentElement.classList.remove('sidebar-will-collapse', 'sidebar-will-hide');
        this.chatViewport = new ChatViewport(this.chatContainer, this.scrollBottomBtn);
        this.debugConsole = new DebugConsole({
            stepsList: this.stepsList,
            eventsContainer: this.eventsContainer,
            filterButtons: document.querySelectorAll('.filter-tab'),
            searchInput: document.getElementById('debug-search-input') as HTMLInputElement,
            stepsEmpty: document.getElementById('steps-empty'),
            eventsEmpty: document.getElementById('events-empty'),
            onCountsChange: (counts) => this.handleDebugCountsChange(counts),
        });
        this.settingsPanel = new SettingsPanel(
            this.settingsModal,
            document.querySelectorAll('.provider-btn'),
            (settings) => this.onSettingsSave?.(settings)
        );
        this.historyView = new HistoryView(
            document.getElementById('history-list'),
            {
                onSelect: (id) => this.onConversationSelect?.(id),
                onDelete: (id) => this.onConversationDelete?.(id),
                onRename: (id, title) => this.onConversationRename?.(id, title),
            }
        );

        this.restoreHintState();
        this.updateDebugBadge(0);
        this.bindCoreEvents();
        this.updateProviderDisplay();
    }

    setCallbacks(callbacks: CallbackMap) {
        Object.assign(this, callbacks);
    }

    // ---------------------------------------------------------------------
    // Event wiring
    // ---------------------------------------------------------------------

    private bindCoreEvents() {
        this.userInput.addEventListener('input', () => {
            this.userInput.style.height = 'auto';
            this.userInput.style.height = Math.min(this.userInput.scrollHeight, 200) + 'px';
            const state = store.getState();
            this.sendBtn.disabled = this.userInput.value.trim().length === 0 || state.isGenerating;
        });

        this.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        });

        this.sendBtn.addEventListener('click', () => this.handleSend());
        this.stopBtn?.addEventListener('click', () => this.onStopGeneration?.());

        document.getElementById('toggle-sidebar-btn')?.addEventListener('click', () => this.sidebarManager.toggle());
        document.getElementById('mobile-menu-btn')?.addEventListener('click', () => this.sidebarManager.toggle());

        const toggleDebug = () => {
            const isClosed = this.debugDrawer.classList.toggle('translate-x-full');
            if (!isClosed) {
                this.unreadDebugEvents = 0;
                this.updateDebugBadge(0);
            }
        };
        document.getElementById('toggle-debug-btn')?.addEventListener('click', toggleDebug);
        document.getElementById('close-debug-btn')?.addEventListener('click', toggleDebug);

        document.getElementById('new-chat-btn')?.addEventListener('click', () => {
            this.onNewChat?.();
            if (window.innerWidth < 768) {
                this.sidebarManager.close();
            }
        });

        this.promptLibraryBtn?.addEventListener('click', () => {
            this.togglePromptLibrary();
            this.onPromptLibrary?.();
        });
        this.closePromptLibraryBtn?.addEventListener('click', () => this.togglePromptLibrary(false));
        document.getElementById('attach-btn')?.addEventListener('click', () => this.flashHint());
        document.getElementById('dismiss-hint-btn')?.addEventListener('click', () => this.dismissHint());

        let resizeTimeout: ReturnType<typeof setTimeout>;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.chatViewport.checkScroll();
                this.sidebarManager.applyState();
            }, 150);
        });

        document.getElementById('settings-btn')?.addEventListener('click', () => this.openSettings());
        document.getElementById('model-selector')?.addEventListener('click', () => this.openSettings());
        document.getElementById('close-settings-btn')?.addEventListener('click', () => this.settingsPanel.close());
        document.getElementById('cancel-settings-btn')?.addEventListener('click', () => this.settingsPanel.close());
        document.getElementById('settings-overlay')?.addEventListener('click', () => this.settingsPanel.close());
        document.getElementById('save-settings-btn')?.addEventListener('click', () => this.settingsPanel.save());

        document.getElementById('stream-toggle-btn')?.addEventListener('click', () => this.onStreamToggle?.());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (store.getState().isGenerating) {
                    this.onStopGeneration?.();
                    return;
                }
                if (this.isPromptLibraryOpen) {
                    this.togglePromptLibrary(false);
                    return;
                }
                if (!this.settingsModal.classList.contains('hidden')) {
                    this.settingsPanel.close();
                }
                if (window.innerWidth < 768) {
                    this.sidebarManager.close();
                }
            }
        });

        document.querySelectorAll('.prompt-card').forEach(card => {
            card.addEventListener('click', () => {
                const state = store.getState();
                if (state.isGenerating) return;
                const prompt = (card as HTMLElement).dataset.prompt;
                if (!prompt) return;
                this.userInput.value = prompt;
                this.userInput.dispatchEvent(new Event('input'));
                this.togglePromptLibrary(false);
                this.handleSend();
            });
        });

        document.getElementById('clear-debug-btn')?.addEventListener('click', () => {
            if (confirm('Clear all debug logs?')) {
                this.debugConsole.clear();
                this.unreadDebugEvents = 0;
                this.updateDebugBadge(0);
            }
        });

        document.getElementById('export-btn')?.addEventListener('click', () => {
            this.debugConsole.exportLogs();
        });
    }

    private async handleSend() {
        const text = this.userInput.value.trim();
        const state = store.getState();
        if (!text || state.isGenerating) return;

        this.togglePromptLibrary(false);
        this.userInput.value = '';
        this.userInput.style.height = 'auto';
        this.sendBtn.disabled = true;

        await this.onSendMessage?.(text);
    }

    private openSettings() {
        const state = store.getState();
        this.settingsPanel.open(state.settings);
    }

    // ---------------------------------------------------------------------
    // Public API (delegating to sub-components)
    // ---------------------------------------------------------------------

    appendMessage(role: 'user' | 'ai', content: string): string {
        return this.messageView.appendMessage(role, content);
    }

    streamUpdate(id: string, fullContent: string) {
        this.messageView.streamUpdate(id, fullContent);
    }

    updateMessage(id: string, content: string, isError = false, stats?: string) {
        this.messageView.updateMessage(id, content, isError, stats);
    }

    hideWelcomeScreen() {
        this.welcomeScreen.classList.add('hidden');
    }

    scrollToBottom(behavior: ScrollBehavior = 'smooth') {
        this.chatViewport.scrollToBottom(behavior);
    }

    getIsNearBottom(): boolean {
        return this.chatViewport.isNearBottom();
    }

    addDebugStep(nodeId: string, status: string) {
        this.debugConsole.addStep(nodeId, status);
    }

    updateDebugStep(nodeId: string, result: any) {
        this.debugConsole.updateStep(nodeId, result);
    }

    addDebugEvent(event: any) {
        this.debugConsole.addEvent(event);
        if (this.debugDrawer.classList.contains('translate-x-full')) {
            this.unreadDebugEvents += 1;
            this.updateDebugBadge(this.unreadDebugEvents);
        }
    }

    clearMessages() {
        this.messageView.clear();
        this.debugConsole.clear();
        this.welcomeScreen.classList.remove('hidden');
        this.userInput.value = '';
        this.togglePromptLibrary(false);
        this.unreadDebugEvents = 0;
        this.updateDebugBadge(0);
    }

    focusInput() {
        this.userInput.focus();
    }

    enableInput() {
        this.setGenerating(false);
        this.userInput.focus();
    }

    updateProviderDisplay() {
        const state = store.getState();
        if (this.currentProviderEl) {
            this.currentProviderEl.textContent = getProviderDisplayName(state.settings.provider);
        }
        if (this.currentModelEl) {
            this.currentModelEl.textContent = this.getActiveModelLabel(state.settings);
        }
        if (this.modelLatencyEl) {
            this.modelLatencyEl.textContent = this.formatLatency(state.lastLatencyMs);
        }
    }

    updateStreamToggle(isEnabled: boolean) {
        const streamToggleBtn = document.getElementById('stream-toggle-btn');
        const dot = document.getElementById('stream-status-dot');
        if (this.streamStatusText) {
            this.streamStatusText.textContent = isEnabled ? 'ON' : 'OFF';
        }

        if (streamToggleBtn && dot) {
            streamToggleBtn.classList.toggle('active', isEnabled);
            dot.classList.toggle('on', isEnabled);
        }
    }

    renderHistoryList(conversations: Conversation[], activeId: string | null) {
        this.historyView.render(conversations, activeId);
    }

    setGenerating(isGenerating: boolean) {
        const hasText = this.userInput.value.trim().length > 0;
        this.sendBtn.disabled = isGenerating || !hasText;
        this.stopBtn?.classList.toggle('hidden', !isGenerating);
        this.userInput.classList.toggle('is-generating', isGenerating);
        this.userInput.setAttribute('aria-busy', String(isGenerating));
        if (isGenerating) {
            this.togglePromptLibrary(false);
        }
    }

    private getActiveModelLabel(settings: LLMSettings): string {
        switch (settings.provider) {
            case 'gemini':
                return settings.gemini.model || 'Gemini';
            case 'openai':
                return settings.openai.model || 'OpenAI';
            case 'lm-studio':
            default:
                return settings.lmStudio.model || 'LM Studio';
        }
    }

    private formatLatency(latencyMs: number | null): string {
        if (typeof latencyMs !== 'number' || latencyMs <= 0) {
            return '-- ms';
        }
        if (latencyMs < 1000) return `${Math.round(latencyMs)} ms`;
        return `${(latencyMs / 1000).toFixed(2)} s`;
    }

    private togglePromptLibrary(force?: boolean) {
        if (!this.promptLibraryPanel) return;
        const nextState = force !== undefined ? force : this.promptLibraryPanel.classList.contains('hidden');
        this.isPromptLibraryOpen = nextState;
        this.promptLibraryPanel.classList.toggle('hidden', !nextState);
        this.promptLibraryBtn?.setAttribute('aria-expanded', String(nextState));
        this.promptLibraryBtn?.classList.toggle('active', nextState);
    }

    private dismissHint() {
        document.body.classList.add('hint-dismissed');
        localStorage.setItem('chatbox-hint-dismissed', '1');
    }

    private restoreHintState() {
        const dismissed = localStorage.getItem('chatbox-hint-dismissed') === '1';
        if (dismissed) {
            document.body.classList.add('hint-dismissed');
        }
    }

    private flashHint() {
        if (!this.composerHint || document.body.classList.contains('hint-dismissed')) return;
        this.composerHint.classList.add('highlight');
        setTimeout(() => this.composerHint?.classList.remove('highlight'), 1200);
    }

    private updateDebugBadge(count: number) {
        if (!this.debugBadge) return;
        this.debugBadge.textContent = String(count);
        this.debugBadge.classList.toggle('hidden', count <= 0);
    }

    private handleDebugCountsChange(counts: DebugCounts) {
        if (counts.event === 0) {
            this.unreadDebugEvents = 0;
            this.updateDebugBadge(0);
        }
    }
}
