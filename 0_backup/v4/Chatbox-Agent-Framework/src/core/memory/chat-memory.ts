/**
 * Chat-mode memory helpers for recall and save policies.
 */

import type { MemoryItem, MemoryManager } from './types';
import {
    DEFAULT_INTENT_PATTERNS,
    DEFAULT_PREFERENCE_PATTERNS,
    extractIntentMemory,
    isPreferenceStatement,
    normalizeMemoryContent,
} from './memory-heuristics';

export type ChatMemoryMessageRole = 'system' | 'user' | 'assistant';

export interface ChatMemoryRecallPolicy {
    limit?: number;
    minImportance?: number;
    tags?: string[];
    messageRole?: ChatMemoryMessageRole;
}

export interface ChatMemorySavePolicy {
    saveUserPreferences?: boolean;
    saveConversationTurns?: boolean;
    saveIntentMessages?: boolean;
    minMessageLength?: number;
    preferencePatterns?: RegExp[];
    intentPatterns?: RegExp[];
    importance?: number;
    intentImportance?: number;
    longTerm?: boolean;
    tags?: string[];
}

export const DEFAULT_CHAT_MEMORY_RECALL_POLICY: Required<Pick<ChatMemoryRecallPolicy, 'limit' | 'messageRole'>> = {
    limit: 5,
    messageRole: 'system',
};

export const DEFAULT_CHAT_MEMORY_SAVE_POLICY: Required<Pick<ChatMemorySavePolicy, 'saveUserPreferences' | 'saveConversationTurns' | 'saveIntentMessages' | 'minMessageLength' | 'importance' | 'longTerm'>> = {
    saveUserPreferences: true,
    saveConversationTurns: false,
    saveIntentMessages: false,
    minMessageLength: 20,
    importance: 0.85,
    longTerm: true,
};

export function applyChatMemoryRecallPolicy(
    memories: MemoryItem<unknown>[],
    policy: ChatMemoryRecallPolicy
): MemoryItem<unknown>[] {
    let filtered = memories;

    if (policy.minImportance !== undefined) {
        filtered = filtered.filter(memory => memory.metadata.importance >= policy.minImportance!);
    }

    if (policy.tags && policy.tags.length > 0) {
        filtered = filtered.filter(memory => {
            if (!memory.metadata.tags) return false;
            return memory.metadata.tags.some(tag => policy.tags!.includes(tag));
        });
    }

    const limit = policy.limit ?? DEFAULT_CHAT_MEMORY_RECALL_POLICY.limit;
    return filtered.slice(0, limit);
}

export function formatChatMemories(memories: MemoryItem<unknown>[]): string {
    const lines = memories.map(memory => normalizeMemoryContent(memory.content)).filter(Boolean);

    if (lines.length === 0) return '';
    if (lines.length === 1) return `Relevant memory: ${lines[0]}`;

    return `Relevant memories:\n${lines.map(line => `- ${line}`).join('\n')}`;
}

export async function saveChatMemoryTurn(
    memory: MemoryManager,
    userMessage: string,
    assistantMessage: string,
    policy: ChatMemorySavePolicy = {}
): Promise<void> {
    const resolvedPolicy = {
        ...DEFAULT_CHAT_MEMORY_SAVE_POLICY,
        ...policy,
    };

    const baseTags = policy.tags ?? [];

    if (resolvedPolicy.saveIntentMessages) {
        const patterns = policy.intentPatterns ?? DEFAULT_INTENT_PATTERNS;
        const intentMemory = extractIntentMemory(userMessage, patterns);
        if (intentMemory) {
            await memory.remember(intentMemory, {
                tags: uniqueTags(['explicit-memory', 'conversation', ...baseTags]),
                importance: resolvedPolicy.intentImportance ?? Math.max(0.9, resolvedPolicy.importance),
                longTerm: resolvedPolicy.longTerm,
            });
        }
    }

    if (resolvedPolicy.saveUserPreferences) {
        const patterns = policy.preferencePatterns ?? DEFAULT_PREFERENCE_PATTERNS;
        if (isPreferenceStatement(userMessage, patterns)) {
            await memory.remember(userMessage, {
                tags: uniqueTags(['user-preference', 'conversation', ...baseTags]),
                importance: resolvedPolicy.importance,
                longTerm: resolvedPolicy.longTerm,
            });
        }
    }

    if (resolvedPolicy.saveConversationTurns) {
        const trimmed = userMessage.trim();
        if (trimmed.length >= resolvedPolicy.minMessageLength) {
            await memory.remember(
                {
                    user: trimmed,
                    assistant: assistantMessage,
                },
                {
                    tags: uniqueTags(['conversation-turn', ...baseTags]),
                    importance: Math.min(resolvedPolicy.importance, 0.7),
                    longTerm: resolvedPolicy.longTerm,
                }
            );
        }
    }
}

function uniqueTags(tags: string[]): string[] {
    return Array.from(new Set(tags)).filter(Boolean);
}
