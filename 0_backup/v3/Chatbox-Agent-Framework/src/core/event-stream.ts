/**
 * 事件流系统
 * 提供事件发射、订阅、存储功能
 */

import type { Event, EventType } from './types';

type EventListener = (event: Event) => void | Promise<void>;

export class EventStream {
    private events: Event[] = [];
    private listeners: Map<EventType | '*', Set<EventListener>> = new Map();
    private payloadStore: Map<string, unknown> = new Map();

    /**
     * 发射事件
     */
    emit(
        type: EventType,
        status: Event['status'],
        summary: string,
        options?: {
            nodeId?: string;
            payload?: unknown;
            metadata?: Record<string, unknown>;
        }
    ): Event {
        const event: Event = {
            id: this.generateEventId(),
            timestamp: Date.now(),
            type,
            status,
            summary,
            nodeId: options?.nodeId,
            metadata: options?.metadata,
        };

        // 如果有 payload，存储并生成引用
        if (options?.payload !== undefined) {
            const payloadRef = `payload-${event.id}`;
            this.payloadStore.set(payloadRef, options.payload);
            event.payloadRef = payloadRef;
        }

        this.events.push(event);

        // 自动清理，防止内存无限增长 (Keep last 1000 events)
        if (this.events.length > 1000) {
            this.cleanup();
        }

        // 触发监听器
        this.notifyListeners(type, event);
        this.notifyListeners('*', event); // 通配符监听器

        return event;
    }

    private cleanup() {
        // 保留最近 1000 条
        const removalCount = this.events.length - 1000;
        if (removalCount <= 0) return;

        const removedEvents = this.events.splice(0, removalCount);

        // 清理对应的 payload
        removedEvents.forEach(evt => {
            if (evt.payloadRef) {
                this.payloadStore.delete(evt.payloadRef);
            }
        });
    }

    /**
     * 订阅事件
     */
    on(type: EventType | '*', listener: EventListener): () => void {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }
        this.listeners.get(type)!.add(listener);

        // 返回取消订阅函数
        return () => {
            this.listeners.get(type)?.delete(listener);
        };
    }

    /**
     * 获取所有事件
     */
    getEvents(): Event[] {
        return [...this.events];
    }

    /**
     * 获取 payload
     */
    getPayload(payloadRef: string): unknown {
        return this.payloadStore.get(payloadRef);
    }

    /**
     * 清空事件流
     */
    clear(): void {
        this.events = [];
        this.payloadStore.clear();
    }

    /**
     * 导出事件流（用于 debug bundle）
     */
    export(): { events: Event[]; payloads: Record<string, unknown> } {
        const payloads: Record<string, unknown> = {};
        this.payloadStore.forEach((value, key) => {
            payloads[key] = value;
        });

        return {
            events: this.events,
            payloads,
        };
    }

    /**
     * 从导出数据恢复
     */
    import(data: { events: Event[]; payloads: Record<string, unknown> }): void {
        this.events = data.events;
        this.payloadStore = new Map(Object.entries(data.payloads));
    }

    private notifyListeners(type: EventType | '*', event: Event): void {
        const listeners = this.listeners.get(type);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(event);
                } catch (error) {
                    console.error(`Error in event listener for ${type}:`, error);
                }
            });
        }
    }

    private generateEventId(): string {
        return `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
