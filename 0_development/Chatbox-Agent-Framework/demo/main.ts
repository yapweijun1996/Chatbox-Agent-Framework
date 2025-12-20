/**
 * Demo Main Entry Point - 精简版本
 */

import {
    createAgent,
    Agent,
    type AgentResult,
    createMemoryManager,
    IndexedDBMemoryAdapter,
    SimpleTFIDFEmbedding,
    SimpleMemorySummarizer,
    DEFAULT_MEMORY_PRUNING_CONFIG,
} from '../src/index';
import { getExampleTools } from '../src/tools/example-tools';
import type { LLMSettings } from './settings';
import { store } from './state';
import { UIController } from './ui';
import type { MemoryCreatePayload, MemoryScope, MemorySnapshot } from './ui/memory-panel-types';

// ============================================================================
// Application State
// ============================================================================

let agent: Agent;
const ui = new UIController();
const memoryAdapter = new IndexedDBMemoryAdapter();
const memoryEmbedding = new SimpleTFIDFEmbedding(128);
const memory = createMemoryManager(
    {
        persistenceAdapter: memoryAdapter,
        summarizer: new SimpleMemorySummarizer(),
        pruningConfig: DEFAULT_MEMORY_PRUNING_CONFIG,
    },
    undefined,
    memoryEmbedding
);

// ============================================================================
// Initialization
// ============================================================================

async function init() {
    setupCallbacks();
    setupMemoryCallbacks();
    await store.init();
    initializeAgent();
    updateUIFromState();
    ui.focusInput();

    // Subscribe to state changes
    store.subscribe((state) => {
        ui.updateStreamToggle(state.isStreamEnabled);
        ui.updateProviderDisplay();
        ui.setGenerating(state.isGenerating);
        ui.renderHistoryList(state.conversations, state.activeConversationId);
    });

    // Initial render
    const state = store.getState();
    ui.renderHistoryList(state.conversations, state.activeConversationId);
}

function setupCallbacks() {
    ui.setCallbacks({
        onSendMessage: handleSend,
        onNewChat: resetChat,
        onSettingsSave: handleSettingsSave,
        onStreamToggle: toggleStream,
        onStopGeneration: handleStop,
        onPromptLibrary: () => ui.focusInput(),
        onConversationSelect: switchConversation,
        onConversationDelete: deleteConversation,
        onConversationRename: renameConversation,
    });
}

function setupMemoryCallbacks() {
    ui.setMemoryCallbacks({
        onRefresh: fetchMemorySnapshot,
        onAdd: addMemoryEntry,
        onDelete: deleteMemoryEntry,
        onPromote: promoteMemoryEntry,
        onClear: clearMemoryScope,
        onConsolidate: consolidateMemory,
    });
}

async function fetchMemorySnapshot(query?: string): Promise<MemorySnapshot> {
    const normalized = query?.trim().toLowerCase() || '';
    const shortItems = memory.shortTerm.query({
        sortBy: 'lastAccessedAt',
        sortOrder: 'desc',
    });

    const filteredShort = normalized
        ? shortItems.filter(item => matchesQuery(item, normalized))
        : shortItems;

    const longItems = normalized
        ? await memory.longTerm.search(normalized, { limit: 200 })
        : await memory.longTerm.query({ sortBy: 'lastAccessedAt', sortOrder: 'desc', limit: 200 });

    return {
        shortTerm: filteredShort,
        longTerm: longItems,
    };
}

function matchesQuery(item: { content: unknown; metadata: { tags?: string[] } }, query: string): boolean {
    const contentText = toPlainText(item.content).toLowerCase();
    const tagText = (item.metadata.tags || []).join(' ').toLowerCase();
    return contentText.includes(query) || tagText.includes(query);
}

function toPlainText(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

async function addMemoryEntry(payload: MemoryCreatePayload): Promise<void> {
    const tags = payload.tags.length > 0 ? payload.tags : undefined;
    const options = { importance: payload.importance, tags };

    if (payload.scope === 'long') {
        await Promise.resolve(memory.remember(payload.content, { ...options, longTerm: true }));
        return;
    }

    const key = `stm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    memory.shortTerm.set(key, payload.content, options);
}

async function deleteMemoryEntry(scope: MemoryScope, id: string): Promise<void> {
    if (scope === 'short') {
        memory.shortTerm.delete(id);
        return;
    }
    await memory.longTerm.delete(id);
}

async function promoteMemoryEntry(id: string): Promise<void> {
    await memory.promoteToLongTerm(id);
}

async function clearMemoryScope(scope: MemoryScope): Promise<void> {
    if (scope === 'short') {
        memory.shortTerm.clear();
        return;
    }
    await memory.longTerm.clear();
}

async function consolidateMemory(): Promise<void> {
    await memory.consolidate();
}

function createProviderConfig(settings: LLMSettings) {
    switch (settings.provider) {
        case 'gemini':
            return {
                type: 'gemini' as const,
                apiKey: settings.gemini.apiKey,
                model: settings.gemini.model,
            };
        case 'openai':
            return {
                type: 'openai' as const,
                apiKey: settings.openai.apiKey,
                baseURL: settings.openai.baseURL,
                model: settings.openai.model,
            };
        case 'lm-studio':
        default:
            return {
                type: 'lm-studio' as const,
                baseURL: settings.lmStudio.baseURL,
                model: settings.lmStudio.model,
            };
    }
}

function initializeAgent() {
    const state = store.getState();
    const providerConfig = createProviderConfig(state.settings);
    const tools = getExampleTools();

    agent = createAgent({
        provider: providerConfig,
        tools: tools,
        mode: 'auto',
        systemPrompt: 'You are a helpful AI assistant. Respond in the same language as the user.',
        streaming: state.isStreamEnabled,
        memory: memory,
        enableMemory: true,
        enableChatMemory: true,
        chatMemorySavePolicy: {
            saveUserPreferences: true,
            saveConversationTurns: true,
            saveIntentMessages: true,
            minMessageLength: 10,
        },
        chatMemoryRecallPolicy: {
            limit: 5,
            minImportance: 0.7,
        },
        confirmTool: async (request) => {
            const message = [
                request.confirmationMessage || 'Tool execution requires confirmation.',
                `Tool: ${request.toolName}`,
                `Step: ${request.stepDescription}`,
            ].join('\n');
            return { approved: window.confirm(message) };
        },
        hooks: {
            onNodeStart: (nodeId) => ui.addDebugStep(nodeId, 'running'),
            onNodeEnd: (nodeId, result) => ui.updateDebugStep(nodeId, result),
        },
    });

    agent.getEventStream().on('*', (event: any) => {
        ui.addDebugEvent(event);
    });
    ui.setGraphDefinition(agent.getGraphDefinition() ?? null);

    console.log('[Demo] Agent initialized with provider:', providerConfig.type);
    store.setState({ lastLatencyMs: null, lastTokenCount: null });
}

function updateUIFromState() {
    const state = store.getState();
    ui.updateProviderDisplay();
    ui.updateStreamToggle(state.isStreamEnabled);
    ui.setGenerating(state.isGenerating);
}

// ============================================================================
// Event Handlers
// ============================================================================

async function handleSend(text: string) {
    store.setState({ isGenerating: true });
    ui.hideWelcomeScreen();
    ui.appendMessage('user', text);
    ui.scrollToBottom();

    const aiMsgId = ui.appendMessage('ai', '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>');
    ui.scrollToBottom();

    try {
        const state = store.getState();
        let fullContent = '';

        const result = await agent.chat(text, {
            stream: state.isStreamEnabled,
            onStream: (chunk) => {
                const wasAtBottom = ui.getIsNearBottom();
                fullContent += chunk;
                ui.streamUpdate(aiMsgId, fullContent);
                if (wasAtBottom) {
                    ui.scrollToBottom('auto');
                }
            },
        });

        const totalTokens = result.usage?.totalTokens ?? null;
        const durationSeconds = result.duration / 1000;
        const tps = totalTokens !== null && durationSeconds > 0
            ? (totalTokens / durationSeconds).toFixed(1)
            : null;
        const modeStr = result.mode === 'agent' ? '🤖 Agent' : '💬 Chat';
        const statsParts = [
            result.aborted ? 'Stopped' : modeStr,
            typeof totalTokens === 'number' ? `${totalTokens} tokens` : null,
            `${durationSeconds.toFixed(2)}s`,
            tps ? `${tps} t/s` : null,
        ].filter(Boolean);

        const statsStr = statsParts.join(' • ');
        const finalContent = result.aborted ? (fullContent || 'Generation stopped.') : result.content;

        if (result.aborted) {
            const updatedHistory = agent.getHistory();
            const lastMsg = updatedHistory[updatedHistory.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
                lastMsg.content = finalContent;
                agent.setHistory(updatedHistory);
            }

            // Save interrupted conversation to memory for context
            if (finalContent) {
                try {
                    await memory.remember(
                        { user: text, assistant: finalContent, interrupted: true },
                        {
                            tags: ['conversation-turn', 'interrupted'],
                            importance: 0.6,
                            longTerm: false,
                        }
                    );
                } catch (error) {
                    console.warn('[Demo] Failed to save interrupted conversation to memory:', error);
                }
            }
        }

        ui.updateMessage(aiMsgId, finalContent, false, statsStr || undefined);
        store.setState({
            lastLatencyMs: result.duration,
            lastTokenCount: totalTokens,
        });

        // Save to history
        updateHistory();
    } catch (error) {
        console.error('[Demo] Error:', error);
        ui.updateMessage(aiMsgId, `**Error:** ${error instanceof Error ? error.message : String(error)}`, true);
    } finally {
        store.setState({ isGenerating: false });
        ui.enableInput();
    }
}

function handleStop() {
    const state = store.getState();
    if (!state.isGenerating) return;

    try {
        agent.getAbortController().abort('User stopped generation');
    } catch (error) {
        console.warn('[Demo] Abort failed:', error);
    } finally {
        store.setState({ isGenerating: false });
        ui.enableInput();
    }
}

function updateHistory() {
    const state = store.getState();
    const history = agent.getHistory();
    const currentId = state.activeConversationId || `conv-${Date.now()}`;

    const conversations = [...state.conversations];
    const index = conversations.findIndex(c => c.id === currentId);

    const firstUserMsg = history.find(m => m.role === 'user')?.content || 'New conversation';
    const title = firstUserMsg.slice(0, 30) + (firstUserMsg.length > 30 ? '...' : '');

    if (index >= 0) {
        conversations[index] = {
            ...conversations[index],
            messages: history,
            timestamp: Date.now()
        };
    } else {
        conversations.unshift({
            id: currentId,
            title,
            messages: history,
            timestamp: Date.now()
        });
    }

    store.setState({
        conversations,
        activeConversationId: currentId
    });
}

function resetChat() {
    ui.clearMessages();
    agent.clearHistory();
    store.setState({ activeConversationId: null, lastLatencyMs: null, lastTokenCount: null });
    ui.focusInput();
}

function switchConversation(id: string) {
    const state = store.getState();
    const conv = state.conversations.find(c => c.id === id);
    if (!conv) return;

    ui.clearMessages();
    ui.hideWelcomeScreen();

    conv.messages.forEach(msg => {
        if (msg.role === 'user') {
            ui.appendMessage('user', msg.content);
        } else if (msg.role === 'assistant') {
            ui.appendMessage('ai', msg.content);
        }
    });

    agent.setHistory(conv.messages);
    store.setState({ activeConversationId: id });
    ui.scrollToBottom();
    ui.focusInput();
}

function deleteConversation(id: string) {
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    const state = store.getState();
    const conversations = state.conversations.filter(c => c.id !== id);

    if (state.activeConversationId === id) {
        resetChat();
    }

    store.setState({ conversations });
}

function renameConversation(id: string, title: string) {
    const state = store.getState();
    const conversations = state.conversations.map(c =>
        c.id === id ? { ...c, title } : c
    );
    store.setState({ conversations });
}

function handleSettingsSave(settings: LLMSettings) {
    store.setState({ settings });
    store.saveSettings();
    initializeAgent();
}

function toggleStream() {
    const state = store.getState();
    store.setState({ isStreamEnabled: !state.isStreamEnabled });
    initializeAgent();
}

// ============================================================================
// Start Application
// ============================================================================

init();
