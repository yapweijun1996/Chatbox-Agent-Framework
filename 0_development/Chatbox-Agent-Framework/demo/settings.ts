/**
 * 设置管理模块
 * 管理 LLM 提供商配置
 */

export type LLMProvider = 'lm-studio' | 'gemini' | 'openai';

export interface LLMSettings {
    provider: LLMProvider;
    lmStudio: {
        baseURL: string;
        model: string;
    };
    gemini: {
        apiKey: string;
        model: string;
    };
    openai: {
        apiKey: string;
        baseURL: string;
        model: string;
    };
}

const STORAGE_KEY = 'chatbox-agent-settings';

const defaultSettings: LLMSettings = {
    provider: 'lm-studio',
    lmStudio: {
        baseURL: 'http://127.0.0.1:6354',
        model: 'mistralai/ministral-3-14b-reasoning',
    },
    gemini: {
        apiKey: '',
        model: 'gemini-2.0-flash-exp',
    },
    openai: {
        apiKey: '',
        baseURL: 'https://api.openai.com',
        model: 'gpt-4o-mini',
    },
};

export function loadSettings(): LLMSettings {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return { ...defaultSettings, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.warn('Failed to load settings:', e);
    }
    return defaultSettings;
}

export function saveSettings(settings: LLMSettings): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
        console.warn('Failed to save settings:', e);
    }
}

export function getProviderDisplayName(provider: LLMProvider): string {
    switch (provider) {
        case 'lm-studio': return 'LM Studio (Local)';
        case 'gemini': return 'Google Gemini';
        case 'openai': return 'OpenAI';
    }
}
