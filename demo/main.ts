/**
 * Demo Main Entry Point - 精简版本
 */

import { createAgent, Agent, type AgentResult } from '../src/index';
import { getExampleTools } from '../src/tools/example-tools';
import type { LLMSettings } from './settings';
import { store } from './state';
import { UIController } from './ui';

// ============================================================================
// Application State
// ============================================================================

let agent: Agent;
const ui = new UIController();

// ============================================================================
// Initialization
// ============================================================================

async function init() {
    setupCallbacks();
    initializeAgent();
    updateUIFromState();
    ui.focusInput();

    // Subscribe to state changes
    store.subscribe((state) => {
        ui.updateStreamToggle(state.isStreamEnabled);
        ui.updateProviderDisplay();
    });
}

function setupCallbacks() {
    ui.setCallbacks({
        onSendMessage: handleSend,
        onNewChat: resetChat,
        onSettingsSave: handleSettingsSave,
        onStreamToggle: toggleStream,
    });
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
        hooks: {
            onNodeStart: (nodeId) => ui.addDebugStep(nodeId, 'running'),
            onNodeEnd: (nodeId, result) => ui.updateDebugStep(nodeId, result),
        },
    });

    agent.getEventStream().on('*', (event: any) => {
        ui.addDebugEvent(event);
    });

    console.log('[Demo] Agent initialized with provider:', providerConfig.type);
}

function updateUIFromState() {
    const state = store.getState();
    ui.updateProviderDisplay();
    ui.updateStreamToggle(state.isStreamEnabled);
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

        const totalTokens = result.usage?.totalTokens || 0;
        const duration = result.duration / 1000;
        const tps = duration > 0 ? (totalTokens / duration).toFixed(1) : '0.0';
        const modeStr = result.mode === 'agent' ? '🤖 Agent' : '💬 Chat';
        const statsStr = `${modeStr} • ${totalTokens} tokens • ${duration.toFixed(2)}s • ${tps} t/s`;

        ui.updateMessage(aiMsgId, result.content, false, statsStr);

        if (result.steps && result.steps.length > 0) {
            result.steps.forEach(step => {
                ui.addDebugStep(step.description, step.status);
            });
        }
    } catch (error) {
        console.error('[Demo] Error:', error);
        ui.updateMessage(aiMsgId, `**Error:** ${error instanceof Error ? error.message : String(error)}`, true);
    } finally {
        store.setState({ isGenerating: false });
        ui.enableInput();
    }
}

function resetChat() {
    ui.clearMessages();
    agent.clearHistory();
    ui.focusInput();
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
