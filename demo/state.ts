/**
 * Demo State Management
 */

import type { LLMSettings, LLMProvider } from './settings';
import { loadSettings, saveSettings } from './settings';

export interface DemoState {
    isGenerating: boolean;
    settings: LLMSettings;
    selectedProvider: LLMProvider;
    isStreamEnabled: boolean;
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
        };
    }

    getState(): DemoState {
        return { ...this.state };
    }

    setState(partial: Partial<DemoState>) {
        this.state = { ...this.state, ...partial };
        this.notifyListeners();
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
