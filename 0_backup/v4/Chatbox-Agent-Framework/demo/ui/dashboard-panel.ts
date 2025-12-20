/**
 * Dashboard panel for runtime metrics.
 */

import type { Event } from '../../src/core/types';

type MetricKey =
    | 'duration'
    | 'tokens'
    | 'toolCalls'
    | 'errors'
    | 'audits'
    | 'memorySaves'
    | 'memoryRecalls';

export class DashboardPanel {
    private metrics: Record<MetricKey, number> = {
        duration: 0,
        tokens: 0,
        toolCalls: 0,
        errors: 0,
        audits: 0,
        memorySaves: 0,
        memoryRecalls: 0,
    };

    private elements: Record<MetricKey, HTMLElement>;

    constructor(private readonly container: HTMLElement) {
        this.elements = {
            duration: this.getEl('dashboard-duration'),
            tokens: this.getEl('dashboard-tokens'),
            toolCalls: this.getEl('dashboard-toolcalls'),
            errors: this.getEl('dashboard-errors'),
            audits: this.getEl('dashboard-audit'),
            memorySaves: this.getEl('dashboard-mem-save'),
            memoryRecalls: this.getEl('dashboard-mem-recall'),
        };

        this.render();
    }

    reset() {
        this.metrics = {
            duration: 0,
            tokens: 0,
            toolCalls: 0,
            errors: 0,
            audits: 0,
            memorySaves: 0,
            memoryRecalls: 0,
        };
        this.render();
    }

    handleEvent(event: Event) {
        if (event.type === 'health_metrics' && event.metadata) {
            const metadata = event.metadata as Record<string, unknown>;
            this.metrics.duration = this.asNumber(metadata.totalDurationMs, this.metrics.duration);
            this.metrics.tokens = this.asNumber(metadata.tokenCount, this.metrics.tokens);
            this.metrics.toolCalls = this.asNumber(metadata.toolCallCount, this.metrics.toolCalls);
            this.metrics.errors = this.asNumber(metadata.errorCount, this.metrics.errors);
            this.render();
            return;
        }

        if (event.type === 'tool_call') {
            this.metrics.toolCalls += 1;
        }

        if (event.type === 'error') {
            this.metrics.errors += 1;
        }

        if (event.type === 'audit') {
            this.metrics.audits += 1;
        }

        if (event.type === 'memory_save') {
            this.metrics.memorySaves += 1;
        }

        if (event.type === 'memory_recall') {
            this.metrics.memoryRecalls += 1;
        }

        this.render();
    }

    private render() {
        this.elements.duration.textContent = this.formatMs(this.metrics.duration);
        this.elements.tokens.textContent = this.formatNumber(this.metrics.tokens);
        this.elements.toolCalls.textContent = this.formatNumber(this.metrics.toolCalls);
        this.elements.errors.textContent = this.formatNumber(this.metrics.errors);
        this.elements.audits.textContent = this.formatNumber(this.metrics.audits);
        this.elements.memorySaves.textContent = this.formatNumber(this.metrics.memorySaves);
        this.elements.memoryRecalls.textContent = this.formatNumber(this.metrics.memoryRecalls);
    }

    private formatNumber(value: number): string {
        return value.toLocaleString();
    }

    private formatMs(value: number): string {
        if (!value) return '0 ms';
        if (value < 1000) return `${value} ms`;
        return `${(value / 1000).toFixed(2)} s`;
    }

    private asNumber(value: unknown, fallback: number): number {
        if (typeof value === 'number' && !Number.isNaN(value)) return value;
        return fallback;
    }

    private getEl(id: string): HTMLElement {
        const el = this.container.querySelector<HTMLElement>(`#${id}`);
        if (!el) {
            throw new Error(`Dashboard element not found: ${id}`);
        }
        return el;
    }
}
