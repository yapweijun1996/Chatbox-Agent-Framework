/**
 * 事件流系统
 * 提供事件发射、订阅、存储功能
 */
import type { Event, EventType } from './types';
type EventListener = (event: Event) => void | Promise<void>;
export declare class EventStream {
    private events;
    private listeners;
    private payloadStore;
    /**
     * 发射事件
     */
    emit(type: EventType, status: Event['status'], summary: string, options?: {
        nodeId?: string;
        payload?: unknown;
        metadata?: Record<string, unknown>;
    }): Event;
    private cleanup;
    /**
     * 订阅事件
     */
    on(type: EventType | '*', listener: EventListener): () => void;
    /**
     * 获取所有事件
     */
    getEvents(): Event[];
    /**
     * 获取 payload
     */
    getPayload(payloadRef: string): unknown;
    /**
     * 清空事件流
     */
    clear(): void;
    /**
     * 导出事件流（用于 debug bundle）
     */
    export(): {
        events: Event[];
        payloads: Record<string, unknown>;
    };
    /**
     * 从导出数据恢复
     */
    import(data: {
        events: Event[];
        payloads: Record<string, unknown>;
    }): void;
    private notifyListeners;
    private generateEventId;
}
export {};
//# sourceMappingURL=event-stream.d.ts.map