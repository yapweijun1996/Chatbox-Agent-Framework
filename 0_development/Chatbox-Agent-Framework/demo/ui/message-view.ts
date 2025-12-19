import { marked } from 'marked';

// Configure marked for consistent rendering
marked.setOptions({
    breaks: true,
    gfm: true,
});

type MessageRole = 'user' | 'ai';

export class MessageView {
    constructor(private readonly listEl: HTMLElement) { }

    appendMessage(role: MessageRole, content: string): string {
        const id = `msg-${Date.now()}`;
        const wrapper = document.createElement('div');
        wrapper.className = `message-row ${role}`;
        wrapper.id = id;
        const avatar = role === 'ai' ? '<div class="avatar-mark"></div>' : 'U';
        const roleLabel = role === 'ai' ? 'Assistant' : 'You';
        wrapper.innerHTML = `
            <div class="message-inner">
                <div class="message-avatar ${role}">
                    ${avatar}
                </div>
                <div class="message-body">
                    <div class="message-header">
                        <span class="role-pill ${role}">${roleLabel}</span>
                        <span class="message-divider"></span>
                    </div>
                    <div class="message-content prose">${this.formatContent(content)}</div>
                </div>
            </div>
        `;
        this.listEl.appendChild(wrapper);
        return id;
    }

    streamUpdate(id: string, fullContent: string): void {
        const msgRow = document.getElementById(id);
        if (!msgRow) return;

        const contentEl = msgRow.querySelector('.message-content');
        if (!contentEl) return;

        const parsed = this.parseThinkingContent(fullContent);
        const formatted = this.formatContent(parsed.content);

        if (parsed.thinking) {
            this.renderThinkingBlock(contentEl, parsed.thinking, formatted, false);
            return;
        }

        contentEl.innerHTML = formatted;
    }

    updateMessage(id: string, content: string, isError = false, stats?: string): void {
        const msgRow = document.getElementById(id);
        if (!msgRow) return;

        const body = msgRow.querySelector('.message-body');
        const contentEl = msgRow.querySelector('.message-content');
        if (!body || !contentEl) return;

        const parsed = this.parseThinkingContent(content);
        const formatted = this.formatContent(parsed.content);

        if (parsed.thinking) {
            this.renderThinkingBlock(contentEl, parsed.thinking, formatted, true);
        } else {
            contentEl.innerHTML = formatted;
        }

        if (isError) {
            contentEl.classList.add('text-red-500');
        }

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

    clear(): void {
        this.listEl.innerHTML = '';
    }

    private formatContent(text: string): string {
        if (!text) return '';
        try {
            return marked.parse(text) as string;
        } catch {
            return text.replace(/\n/g, '<br>');
        }
    }

    private parseThinkingContent(text: string): { thinking: string; content: string } {
        const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
        const matches = text.match(thinkRegex);

        if (!matches) {
            return { thinking: '', content: text };
        }

        const thinking = matches
            .map(match => match.replace(/<\/?think>/gi, '').trim())
            .join('\n\n');

        const content = text.replace(thinkRegex, '').trim();
        return { thinking, content };
    }

    private renderThinkingBlock(
        contentEl: Element,
        thinkingText: string,
        formattedContent: string,
        preserveOpenState: boolean
    ) {
        const existing = contentEl.querySelector('.thinking-process') as HTMLDetailsElement | null;
        const wasOpen = preserveOpenState ? existing?.hasAttribute('open') ?? false : false;

        contentEl.innerHTML = `
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

        const details = contentEl.querySelector('.thinking-process') as HTMLDetailsElement | null;
        if (details && wasOpen) {
            details.setAttribute('open', '');
        }
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
