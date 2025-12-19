/**
 * Demo State Management
 */

import type { LLMSettings, LLMProvider } from './settings';
import { loadSettings, saveSettings } from './settings';
import type { Conversation } from './db';
import { dbStorage } from './db';

export interface DemoState {
    isGenerating: boolean;
    settings: LLMSettings;
    selectedProvider: LLMProvider;
    isStreamEnabled: boolean;
    lastLatencyMs: number | null;
    lastTokenCount: number | null;
    conversations: Conversation[];
    activeConversationId: string | null;
    isInitialized: boolean;
}

type StateListener = (state: DemoState) => void;

class StateStore {
    private state: DemoState;
    private listeners: StateListener[] = [];

    constructor() {
        this.state = {
            isGenerating: false,
            settings: loadSettings(),
            selectedProvider: 'lm-studio',
            isStreamEnabled: true,
            lastLatencyMs: null,
            lastTokenCount: null,
            conversations: [],
            activeConversationId: null,
            isInitialized: false,
        };
    }

    async init() {
        const conversations = await dbStorage.getAllConversations();
        this.setState({
            conversations,
            isInitialized: true
        });
    }

    getState(): DemoState {
        return { ...this.state };
    }

    setState(partial: Partial<DemoState>) {
        const oldConversations = this.state.conversations;
        this.state = { ...this.state, ...partial };

        // Persist conversations if they changed
        if (partial.conversations) {
            this.persistChanges(partial.conversations, oldConversations);
        }

        this.notifyListeners();
    }

    private async persistChanges(newConvs: Conversation[], oldConvs: Conversation[]) {
        // Simple logic: Save any conversation that is different or new
        // For performance, in a real app we'd track dirty states
        for (const conv of newConvs) {
            const old = oldConvs.find(c => c.id === conv.id);
            if (!old || JSON.stringify(old) !== JSON.stringify(conv)) {
                await dbStorage.saveConversation(conv);
            }
        }

        // Handle deletions
        for (const old of oldConvs) {
            if (!newConvs.find(c => c.id === old.id)) {
                await dbStorage.deleteConversation(old.id);
            }
        }
    }

    subscribe(listener: StateListener): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notifyListeners() {
        this.listeners.forEach(listener => listener(this.getState()));
    }

    saveSettings() {
        saveSettings(this.state.settings);
    }
}

export const store = new StateStore();

// Model History Helper
const MODEL_HISTORY_KEY = 'chatbox-model-history';

export function getModelHistory(): string[] {
    try {
        return JSON.parse(localStorage.getItem(MODEL_HISTORY_KEY) || '[]');
    } catch {
        return [];
    }
}

export function saveModelHistory(model: string) {
    if (!model) return;
    let history = getModelHistory();
    history = history.filter(m => m !== model);
    history.unshift(model);
    history = history.slice(0, 10);
    localStorage.setItem(MODEL_HISTORY_KEY, JSON.stringify(history));
}
