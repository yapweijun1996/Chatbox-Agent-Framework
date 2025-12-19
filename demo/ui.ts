/**
 * Demo UI Controller
 * 将庞大的 UI 逻辑拆解为多个子模块，便于维护
 */

import type { LLMSettings } from './settings';
import { getProviderDisplayName } from './settings';
import { store } from './state';
import { MessageView } from './ui/message-view';
import { SidebarManager } from './ui/sidebar-manager';
import { DebugConsole } from './ui/debug-console';
import { SettingsPanel } from './ui/settings-panel';
import { HistoryView, type Conversation } from './ui/history-view';
import { ChatViewport } from './ui/chat-viewport';

type CallbackMap = {
    onSendMessage?: (text: string) => Promise<void>;
    onNewChat?: () => void;
    onSettingsSave?: (settings: LLMSettings) => void;
    onStreamToggle?: () => void;
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
    private settingsModal: HTMLElement;
    private sidebarOverlay: HTMLElement | null;

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
        this.settingsModal = document.getElementById('settings-modal')!;
        this.sidebarOverlay = document.getElementById('sidebar-overlay');

        document.documentElement.classList.remove('sidebar-will-collapse', 'sidebar-will-hide');

        this.messageView = new MessageView(this.messagesList);
        this.sidebarManager = new SidebarManager(this.sidebar, this.sidebarOverlay);
        this.chatViewport = new ChatViewport(this.chatContainer, this.scrollBottomBtn);
        this.debugConsole = new DebugConsole({
            stepsList: this.stepsList,
            eventsContainer: this.eventsContainer,
            filterButtons: document.querySelectorAll('.filter-tab'),
            searchInput: document.getElementById('debug-search-input') as HTMLInputElement,
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

        document.getElementById('toggle-sidebar-btn')?.addEventListener('click', () => this.sidebarManager.toggle());
        document.getElementById('mobile-menu-btn')?.addEventListener('click', () => this.sidebarManager.toggle());

        const toggleDebug = () => this.debugDrawer.classList.toggle('translate-x-full');
        document.getElementById('toggle-debug-btn')?.addEventListener('click', toggleDebug);
        document.getElementById('close-debug-btn')?.addEventListener('click', toggleDebug);

        document.getElementById('new-chat-btn')?.addEventListener('click', () => {
            this.onNewChat?.();
            if (window.innerWidth < 768) {
                this.sidebarManager.close();
            }
        });

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
                this.handleSend();
            });
        });

        document.getElementById('clear-debug-btn')?.addEventListener('click', () => {
            if (confirm('Clear all debug logs?')) {
                this.debugConsole.clear();
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
    }

    clearMessages() {
        this.messageView.clear();
        this.debugConsole.clear();
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

    renderHistoryList(conversations: Conversation[], activeId: string | null) {
        this.historyView.render(conversations, activeId);
    }
}
