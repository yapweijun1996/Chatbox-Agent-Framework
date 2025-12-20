/**
 * Demo - 使用 Agent 类的简化版本
 */

import { createAgent, Agent, type AgentResult } from '../src/index';
import { getExampleTools } from '../src/tools/example-tools';
import { loadSettings, saveSettings, getProviderDisplayName, type LLMSettings, type LLMProvider } from './settings';

// ============================================================================
// DOM Elements
// ============================================================================

const sidebar = document.getElementById('sidebar') as HTMLElement;
const debugDrawer = document.getElementById('debug-drawer') as HTMLElement;
const chatContainer = document.getElementById('chat-container') as HTMLElement;
const messagesList = document.getElementById('messages-list') as HTMLElement;
const userInput = document.getElementById('user-input') as HTMLTextAreaElement;
const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
const welcomeScreen = document.getElementById('welcome-screen') as HTMLElement;
const stepsList = document.getElementById('steps-list') as HTMLElement;
const eventsContainer = document.getElementById('events-container') as HTMLElement;
const scrollBottomBtn = document.getElementById('scroll-bottom-btn') as HTMLButtonElement;
const currentProviderEl = document.getElementById('current-provider') as HTMLElement;

// Modal Elements
const settingsModal = document.getElementById('settings-modal') as HTMLElement;
const settingsOverlay = document.getElementById('settings-overlay') as HTMLElement;
const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
const modelSelector = document.getElementById('model-selector') as HTMLButtonElement;
const closeSettingsBtn = document.getElementById('close-settings-btn') as HTMLButtonElement;
const cancelSettingsBtn = document.getElementById('cancel-settings-btn') as HTMLButtonElement;
const saveSettingsBtn = document.getElementById('save-settings-btn') as HTMLButtonElement;

// Provider Buttons
const providerBtns = document.querySelectorAll('.provider-btn');
const providerSettings = {
    'lm-studio': document.getElementById('lm-studio-settings'),
    'gemini': document.getElementById('gemini-settings'),
    'openai': document.getElementById('openai-settings'),
};

// Input Fields
const lmStudioUrlInput = document.getElementById('lm-studio-url') as HTMLInputElement;
const lmStudioModelInput = document.getElementById('lm-studio-model') as HTMLInputElement;
const geminiApiKeyInput = document.getElementById('gemini-api-key') as HTMLInputElement;
const geminiModelSelect = document.getElementById('gemini-model') as HTMLSelectElement;
const openaiApiKeyInput = document.getElementById('openai-api-key') as HTMLInputElement;
const openaiBaseUrlInput = document.getElementById('openai-base-url') as HTMLInputElement;
const openaiModelSelect = document.getElementById('openai-model') as HTMLSelectElement;

// Buttons
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
const toggleDebugBtn = document.getElementById('toggle-debug-btn');
const closeDebugBtn = document.getElementById('close-debug-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');

// ============================================================================
// State
// ============================================================================

let agent: Agent;
let isGenerating = false;
let settings: LLMSettings;
let tempSettings: LLMSettings;
let selectedProvider: LLMProvider = 'lm-studio';
let isStreamEnabled = true;

const MODEL_HISTORY_KEY = 'chatbox-model-history';

// ============================================================================
// Initialization
// ============================================================================

async function init() {
    settings = loadSettings();
    setupEventListeners();
    initializeAgent();
    updateProviderDisplay();
    updateStreamToggle();
    userInput.focus();
}

/**
 * 根据设置创建 Provider 配置
 */
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

/**
 * 初始化 Agent
 */
function initializeAgent() {
    const providerConfig = createProviderConfig(settings);
    const tools = getExampleTools();

    agent = createAgent({
        provider: providerConfig,
        tools: tools,
        mode: 'auto', // 自动判断 chat 还是 agent 模式
        systemPrompt: 'You are a helpful AI assistant. Respond in the same language as the user.',
        streaming: isStreamEnabled,
        confirmTool: async (request) => {
            const message = [
                request.confirmationMessage || 'Tool execution requires confirmation.',
                `Tool: ${request.toolName}`,
                `Step: ${request.stepDescription}`,
            ].join('\n');
            return { approved: window.confirm(message) };
        },
        hooks: {
            onNodeStart: (nodeId) => addDebugStep(nodeId, 'running'),
            onNodeEnd: (nodeId, result) => updateDebugStep(nodeId, result),
        },
    });

    // 订阅事件流
    agent.getEventStream().on('*', (event: any) => {
        addDebugEvent(event);
    });

    console.log('[Demo] Agent initialized with provider:', providerConfig.type);
    console.log('[Demo] Registered tools:', agent.getToolRegistry().list());
}

function updateProviderDisplay() {
    if (currentProviderEl) {
        currentProviderEl.textContent = getProviderDisplayName(settings.provider);
    }
}

// ============================================================================
// Settings Modal
// ============================================================================

function openSettings() {
    tempSettings = JSON.parse(JSON.stringify(settings));
    selectedProvider = settings.provider;
    populateSettingsForm();
    updateProviderSelection();
    updateModelDatalist();
    settingsModal.classList.remove('hidden');
}

function getModelHistory(): string[] {
    try {
        return JSON.parse(localStorage.getItem(MODEL_HISTORY_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveModelHistory(model: string) {
    if (!model) return;
    let history = getModelHistory();
    // Remove if exists to move to top
    history = history.filter(m => m !== model);
    // Add to top
    history.unshift(model);
    // Limit to 10
    history = history.slice(0, 10);
    localStorage.setItem(MODEL_HISTORY_KEY, JSON.stringify(history));
}

function updateModelDatalist() {
    const datalist = document.getElementById('lm-studio-model-history');
    if (!datalist) return;

    const history = getModelHistory();
    datalist.innerHTML = history.map(model => `<option value="${model}">`).join('');
}

function closeSettings() {
    settingsModal.classList.add('hidden');
}

function populateSettingsForm() {
    lmStudioUrlInput.value = tempSettings.lmStudio.baseURL;
    lmStudioModelInput.value = tempSettings.lmStudio.model;
    geminiApiKeyInput.value = tempSettings.gemini.apiKey;
    geminiModelSelect.value = tempSettings.gemini.model;
    openaiApiKeyInput.value = tempSettings.openai.apiKey;
    openaiBaseUrlInput.value = tempSettings.openai.baseURL;
    openaiModelSelect.value = tempSettings.openai.model;
}

function updateProviderSelection() {
    providerBtns.forEach(btn => {
        const provider = btn.getAttribute('data-provider');
        if (provider === selectedProvider) {
            btn.classList.add('border-accent', 'bg-accent/10');
            btn.classList.remove('border-white/10');
        } else {
            btn.classList.remove('border-accent', 'bg-accent/10');
            btn.classList.add('border-white/10');
        }
    });

    Object.entries(providerSettings).forEach(([key, el]) => {
        if (el) {
            if (key === selectedProvider) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        }
    });
}

function saveCurrentSettings() {
    tempSettings.provider = selectedProvider;
    tempSettings.lmStudio.baseURL = lmStudioUrlInput.value || 'http://127.0.0.1:6354';
    tempSettings.lmStudio.model = lmStudioModelInput.value || 'mistralai/ministral-3-14b-reasoning';

    if (tempSettings.lmStudio.model) {
        saveModelHistory(tempSettings.lmStudio.model);
    }

    tempSettings.gemini.apiKey = geminiApiKeyInput.value;
    tempSettings.gemini.model = geminiModelSelect.value;
    tempSettings.openai.apiKey = openaiApiKeyInput.value;
    tempSettings.openai.baseURL = openaiBaseUrlInput.value || 'https://api.openai.com';
    tempSettings.openai.model = openaiModelSelect.value;

    if (selectedProvider === 'gemini' && !tempSettings.gemini.apiKey) {
        alert('Please enter your Gemini API key');
        return;
    }
    if (selectedProvider === 'openai' && !tempSettings.openai.apiKey) {
        alert('Please enter your OpenAI API key');
        return;
    }

    settings = tempSettings;
    saveSettings(settings);
    initializeAgent();
    updateProviderDisplay();
    closeSettings();
}

// ============================================================================
// Event Listeners
// ============================================================================

function setupEventListeners() {
    // Input Auto-resize
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = Math.min(userInput.scrollHeight, 200) + 'px';
        sendBtn.disabled = userInput.value.trim().length === 0 || isGenerating;
    });

    // Send on Enter
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    sendBtn.addEventListener('click', handleSend);

    // Sidebar Toggles
    const toggleSidebar = () => sidebar.classList.toggle('-translate-x-full');
    if (toggleSidebarBtn) toggleSidebarBtn.addEventListener('click', toggleSidebar);
    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleSidebar);

    // Debug Drawer Toggles
    const toggleDebug = () => debugDrawer.classList.toggle('translate-x-full');
    if (toggleDebugBtn) toggleDebugBtn.addEventListener('click', toggleDebug);
    if (closeDebugBtn) closeDebugBtn.addEventListener('click', toggleDebug);

    // New Chat
    if (newChatBtn) newChatBtn.addEventListener('click', resetChat);

    // Scroll Button
    chatContainer.addEventListener('scroll', checkScroll);
    if (scrollBottomBtn) scrollBottomBtn.addEventListener('click', scrollToBottom);

    // Settings Modal
    if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
    if (modelSelector) modelSelector.addEventListener('click', openSettings);
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettings);
    if (cancelSettingsBtn) cancelSettingsBtn.addEventListener('click', closeSettings);
    if (settingsOverlay) settingsOverlay.addEventListener('click', closeSettings);
    if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveCurrentSettings);

    // Provider Selection
    providerBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedProvider = btn.getAttribute('data-provider') as LLMProvider;
            updateProviderSelection();
        });
    });

    // Stream Toggle
    const streamToggleBtn = document.getElementById('stream-toggle-btn');
    if (streamToggleBtn) {
        streamToggleBtn.addEventListener('click', toggleStream);
    }

    // ESC to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !settingsModal.classList.contains('hidden')) {
            closeSettings();
        }
    });

    // Quick prompts on welcome screen
    document.querySelectorAll('.prompt-card').forEach(card => {
        card.addEventListener('click', () => {
            if (isGenerating) return;
            const prompt = (card as HTMLElement).dataset.prompt;
            if (!prompt) return;
            userInput.value = prompt;
            userInput.dispatchEvent(new Event('input'));
            handleSend();
        });
    });
}

function toggleStream() {
    isStreamEnabled = !isStreamEnabled;
    updateStreamToggle();
    // 重新初始化 Agent 以应用新的流式设置
    initializeAgent();
}

function updateStreamToggle() {
    const streamToggleBtn = document.getElementById('stream-toggle-btn');
    const dot = document.getElementById('stream-status-dot');

    if (streamToggleBtn && dot) {
        if (isStreamEnabled) {
            streamToggleBtn.classList.add('active');
            dot.classList.add('on');
        } else {
            streamToggleBtn.classList.remove('active');
            dot.classList.remove('on');
        }
    }
}

// ============================================================================
// Core Logic - 使用 Agent 类
// ============================================================================

async function handleSend() {
    const text = userInput.value.trim();
    if (!text || isGenerating) return;

    // Reset UI
    userInput.value = '';
    userInput.style.height = 'auto';
    sendBtn.disabled = true;
    welcomeScreen.classList.add('hidden');
    isGenerating = true;

    // Add User Message
    appendMessage('user', text);

    // Add Thinking / Reasoning Message (collapsible)
    const thinkingId = appendThinkingMessage();
    scrollToBottom();

    // Add Placeholder AI Message
    const aiMsgId = appendMessage('ai', '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>');

    try {
        const result: AgentResult = await agent.chat(text, {
            stream: isStreamEnabled,
            onStream: (chunk) => {
                // 实时更新 UI
                const msgRow = document.getElementById(aiMsgId);
                if (msgRow) {
                    const body = msgRow.querySelector('.message-body');
                    if (body) {
                        // 移除 typing dots
                        const typingDots = body.querySelector('.typing-dot');
                        if (typingDots) {
                            body.innerHTML = '';
                        }
                        // 追加内容
                        body.innerHTML = formatContent(body.textContent + chunk);
                    }
                }
                scrollToBottom();
            },
        });

        // 计算统计信息
        const totalTokens = result.usage?.totalTokens || 0;
        const duration = result.duration / 1000;
        const tps = duration > 0 ? (totalTokens / duration).toFixed(1) : '0.0';
        const modeStr = result.mode === 'agent' ? '🤖 Agent' : '💬 Chat';
        const statsStr = `${modeStr} • ${totalTokens} tokens • ${duration.toFixed(2)}s • ${tps} t/s`;

        // 更新消息
        updateMessage(aiMsgId, result.content, false, statsStr);
        updateThinkingMessage(thinkingId, result);

        // 如果是 Agent 模式，显示步骤
        if (result.steps && result.steps.length > 0) {
            result.steps.forEach(step => {
                addDebugStep(step.description, step.status);
            });
        }
    } catch (error) {
        console.error('[Demo] Error:', error);
        updateMessage(aiMsgId, `**Error:** ${error instanceof Error ? error.message : String(error)}`, true);
        updateThinkingMessage(thinkingId, undefined, error);
    } finally {
        isGenerating = false;
        sendBtn.disabled = false;
        userInput.focus();
    }
}

function resetChat() {
    messagesList.innerHTML = '';
    stepsList.innerHTML = '';
    eventsContainer.innerHTML = '';
    welcomeScreen.classList.remove('hidden');
    userInput.value = '';
    agent.clearHistory();
    userInput.focus();
}

// ============================================================================
// UI Helpers
// ============================================================================

function appendMessage(role: 'user' | 'ai', content: string): string {
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
            <div class="message-body prose">${formatContent(content)}</div>
        </div>
    `;
    messagesList.appendChild(div);
    return id;
}

function appendThinkingMessage(): string {
    const id = `thinking-${Date.now()}`;
    const div = document.createElement('div');
    div.className = 'message-row thinking';
    div.id = id;
    div.innerHTML = `
        <div class="message-inner">
            <div class="message-avatar ai">
                <div class="avatar-mark"></div>
            </div>
            <div class="message-body">
                <div class="thinking-card">
                    <details class="thinking-details" open>
                        <summary>
                            <span class="thinking-chip">Thinking</span>
                            <span class="thinking-mode">Working...</span>
                            <span class="thinking-meta">Preparing reasoning</span>
                        </summary>
                        <div class="thinking-body-content">
                            <div class="thinking-line">
                                <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
                                Planning steps...
                            </div>
                        </div>
                    </details>
                </div>
            </div>
        </div>
    `;
    messagesList.appendChild(div);
    return id;
}

function updateMessage(id: string, content: string, isError = false, stats?: string) {
    const msgRow = document.getElementById(id);
    if (msgRow) {
        const body = msgRow.querySelector('.message-body');
        if (body) {
            body.innerHTML = formatContent(content);
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

function formatContent(text: string): string {
    if (!text) return '';
    let formatted = text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\n/g, '<br>');
    return formatted;
}

function renderThinkingSteps(steps?: AgentResult['steps']): string {
    if (!steps || steps.length === 0) {
        return '<div class="thinking-line">No tool steps captured (chat mode).</div>';
    }

    return `
        <div class="thinking-steps">
            ${steps.map((step, idx) => `
                <div class="thinking-step">
                    <div class="step-index">${idx + 1}</div>
                    <div class="step-content">
                        <div class="step-desc">${step.description}</div>
                        <div class="step-status status-${(step.status || 'pending').toLowerCase()}">
                            ${step.status || 'pending'}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function updateThinkingMessage(id: string, result?: AgentResult, error?: unknown) {
    const row = document.getElementById(id);
    if (!row) return;

    const modeEl = row.querySelector('.thinking-mode');
    const metaEl = row.querySelector('.thinking-meta');
    const bodyEl = row.querySelector('.thinking-body-content');

    if (error) {
        if (modeEl) modeEl.textContent = 'Error';
        if (metaEl) metaEl.textContent = 'Request failed';
        if (bodyEl) bodyEl.innerHTML = `<div class="thinking-line error">Error: ${error instanceof Error ? error.message : String(error)}</div>`;
        return;
    }

    if (!result) return;

    const totalTokens = result.usage?.totalTokens || 0;
    const durationSec = (result.duration / 1000).toFixed(2);
    const modeLabel = result.mode === 'agent' ? 'Agent mode' : 'Chat mode';
    const metaLabel = `${totalTokens} tokens • ${durationSec}s`;

    if (modeEl) modeEl.textContent = modeLabel;
    if (metaEl) metaEl.textContent = metaLabel;
    if (bodyEl) {
        bodyEl.innerHTML = `
            <div class="thinking-line">
                <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
                ${modeLabel} reasoning
            </div>
            ${renderThinkingSteps(result.steps)}
        `;
    }
}

function scrollToBottom() {
    chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
}

function checkScroll() {
    const isNearBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 100;
    if (scrollBottomBtn) scrollBottomBtn.classList.toggle('hidden', isNearBottom);
}

// ============================================================================
// Debug Helpers
// ============================================================================

function addDebugStep(nodeId: string, status: string) {
    const div = document.createElement('div');
    div.className = 'bg-white/5 p-2 rounded border-l-2 border-text-tertiary';
    div.innerHTML = `<strong>${nodeId}</strong>: ${status}`;
    stepsList.appendChild(div);
    stepsList.scrollTop = stepsList.scrollHeight;
}

function updateDebugStep(nodeId: string, result: any) {
    const div = document.createElement('div');
    div.className = `bg-white/5 p-2 rounded border-l-2 ${result.success !== false ? 'border-accent' : 'border-red-500'}`;
    div.innerHTML = `<div><strong>${nodeId}</strong>: ${result.success !== false ? 'Completed' : 'Failed'}</div>`;
    stepsList.appendChild(div);
    stepsList.scrollTop = stepsList.scrollHeight;
}

function addDebugEvent(event: any) {
    const div = document.createElement('div');
    div.className = 'bg-white/5 p-2 rounded border-l-2 border-text-tertiary';
    div.innerHTML = `
        <span class="text-accent">[${new Date(event.timestamp).toLocaleTimeString()}]</span>
        <strong>${event.type}</strong>
        <div>${event.summary || ''}</div>
    `;
    eventsContainer.appendChild(div);
    eventsContainer.scrollTop = eventsContainer.scrollHeight;
}

// Start
init();
