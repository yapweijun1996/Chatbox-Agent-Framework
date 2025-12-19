type DebugFilter = 'all' | 'step' | 'event' | 'error';

interface DebugConsoleOptions {
    stepsList: HTMLElement;
    eventsContainer: HTMLElement;
    filterButtons: NodeListOf<Element>;
    searchInput: HTMLInputElement;
}

export class DebugConsole {
    private activeFilter: DebugFilter = 'all';
    private searchQuery = '';
    private counts = { all: 0, step: 0, event: 0, error: 0 };

    constructor(private readonly options: DebugConsoleOptions) {
        this.options.filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = (btn as HTMLElement).dataset.filter as DebugFilter;
                this.activeFilter = filter || 'all';
                this.options.filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.applyFilter();
            });
        });

        this.options.searchInput.addEventListener('input', () => {
            this.searchQuery = this.options.searchInput.value.toLowerCase();
            this.applyFilter();
        });
    }

    addStep(nodeId: string, status: string, data?: any): void {
        const div = document.createElement('div');
        div.className = 'debug-step-item';
        div.dataset.filter = 'step';

        const isRunning = status === 'running';
        const statusClass = isRunning ? 'status-running' : 'status-completed';

        div.innerHTML = `
            <div class="debug-item-header">
                <span class="step-indicator ${statusClass}"></span>
                <div class="debug-item-title">
                    <span class="node-id">${nodeId}</span>
                    <span class="node-status">${status}</span>
                </div>
                ${data ? '<button class="detail-toggle">Data</button>' : ''}
            </div>
            ${data ? `<div class="debug-item-detail hidden"><pre>${this.formatData(data)}</pre></div>` : ''}
        `;

        if (data) {
            div.querySelector('.detail-toggle')?.addEventListener('click', (e) => {
                const detail = div.querySelector('.debug-item-detail');
                detail?.classList.toggle('hidden');
                (e.target as HTMLElement).classList.toggle('active');
            });
        }

        this.options.stepsList.appendChild(div);
        this.options.stepsList.scrollTop = this.options.stepsList.scrollHeight;
        this.updateCounts();
        this.applyFilter();
    }

    updateStep(nodeId: string, result: any): void {
        // Find the last running step with this nodeId
        const steps = Array.from(this.options.stepsList.querySelectorAll('.debug-step-item')) as HTMLElement[];
        const lastStep = steps.reverse().find(s =>
            s.querySelector('.node-id')?.textContent === nodeId &&
            s.querySelector('.node-status')?.textContent === 'running'
        );

        if (lastStep) {
            const isSuccess = result.success !== false;
            const indicator = lastStep.querySelector('.step-indicator');
            const statusText = lastStep.querySelector('.node-status');

            if (indicator) {
                indicator.className = `step-indicator ${isSuccess ? 'status-completed' : 'status-failed'}`;
            }
            if (statusText) {
                statusText.textContent = isSuccess ? 'completed' : 'failed';
            }

            // Add details if not present
            if (!lastStep.querySelector('.detail-toggle')) {
                const header = lastStep.querySelector('.debug-item-header');
                const btn = document.createElement('button');
                btn.className = 'detail-toggle';
                btn.textContent = 'Result';
                btn.onclick = () => {
                    let detail = lastStep.querySelector('.debug-item-detail');
                    if (!detail) {
                        detail = document.createElement('div');
                        detail.className = 'debug-item-detail';
                        detail.innerHTML = `<pre>${this.formatData(result)}</pre>`;
                        lastStep.appendChild(detail);
                    }
                    detail.classList.toggle('hidden');
                    btn.classList.toggle('active');
                };
                header?.appendChild(btn);
            }

            if (!isSuccess) lastStep.dataset.type = 'error';
        } else {
            // Fallback: add as new if not found
            this.addStep(nodeId, result.success !== false ? 'completed' : 'failed', result);
        }

        this.updateCounts();
        this.applyFilter();
    }

    addEvent(event: any): void {
        const div = document.createElement('div');
        const eventType = this.getEventType(event);

        div.className = `debug-event type-${eventType}`;
        div.dataset.filter = 'event';
        div.dataset.type = eventType;

        div.innerHTML = `
            <div class="debug-item-header">
                <span class="event-time">${this.formatRelativeTime(event.timestamp || Date.now())}</span>
                <span class="event-badge">${eventType.toUpperCase()}</span>
                <div class="event-title"><strong>${event.type}</strong></div>
                <button class="detail-toggle">JSON</button>
            </div>
            <div class="debug-item-detail hidden">
                ${event.summary ? `<div class="event-summary">${event.summary}</div>` : ''}
                <pre>${this.formatData(event)}</pre>
            </div>
        `;

        div.querySelector('.detail-toggle')?.addEventListener('click', (e) => {
            const detail = div.querySelector('.debug-item-detail');
            detail?.classList.toggle('hidden');
            (e.target as HTMLElement).classList.toggle('active');
        });

        this.options.eventsContainer.appendChild(div);
        this.options.eventsContainer.scrollTop = this.options.eventsContainer.scrollHeight;
        this.updateCounts();
        this.applyFilter();
    }

    clear(): void {
        this.options.stepsList.innerHTML = '';
        this.options.eventsContainer.innerHTML = '';
        this.counts = { all: 0, step: 0, event: 0, error: 0 };
        this.updateCounts();
    }

    exportLogs(): void {
        const logs = {
            timestamp: new Date().toISOString(),
            steps: Array.from(this.options.stepsList.children).map(el => ({
                text: el.querySelector('.debug-item-title')?.textContent?.trim(),
                data: el.querySelector('pre')?.textContent
            })),
            events: Array.from(this.options.eventsContainer.children).map(el => ({
                type: el.querySelector('.event-title strong')?.textContent,
                time: el.querySelector('.event-time')?.textContent,
                data: el.querySelector('pre')?.textContent,
            })),
        };

        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debug-logs-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    private applyFilter(): void {
        const targets = [
            ...Array.from(this.options.stepsList.children),
            ...Array.from(this.options.eventsContainer.children),
        ] as HTMLElement[];

        targets.forEach(el => {
            const matchesFilter =
                this.activeFilter === 'all' ||
                (this.activeFilter === 'error' && el.dataset.type === 'error') ||
                el.dataset.filter === this.activeFilter;

            const matchesSearch =
                !this.searchQuery ||
                el.textContent?.toLowerCase().includes(this.searchQuery);

            el.style.display = matchesFilter && matchesSearch ? '' : 'none';
        });
    }

    private updateCounts(): void {
        this.counts.step = this.options.stepsList.children.length;
        this.counts.event = this.options.eventsContainer.children.length;
        this.counts.all = this.counts.step + this.counts.event;
        this.counts.error = document.querySelectorAll('.debug-drawer [data-type="error"]').length;

        this.options.filterButtons.forEach(btn => {
            const filter = (btn as HTMLElement).dataset.filter as keyof typeof this.counts;
            const countEl = btn.querySelector('.count');
            if (filter && countEl) {
                countEl.textContent = String(this.counts[filter]);
            }
        });
    }

    private getEventType(event: any): 'error' | 'success' | 'info' | 'warning' {
        const eventType = event.type?.toLowerCase() || '';
        if (eventType.includes('error') || eventType.includes('fail')) return 'error';
        if (eventType.includes('complete') || eventType.includes('success')) return 'success';
        if (eventType.includes('warn')) return 'warning';
        return 'info';
    }

    private formatRelativeTime(timestamp: number): string {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 5) return 'now';
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m`;
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    private formatData(data: any): string {
        try {
            return JSON.stringify(data, null, 2);
        } catch (e) {
            return String(data);
        }
    }
}
