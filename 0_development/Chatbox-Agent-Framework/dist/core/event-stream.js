/**
 * 事件流系统
 * 提供事件发射、订阅、存储功能
 */
export class EventStream {
    events = [];
    listeners = new Map();
    payloadStore = new Map();
    /**
     * 发射事件
     */
    emit(type, status, summary, options) {
        const event = {
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
    cleanup() {
        // 保留最近 1000 条
        const removalCount = this.events.length - 1000;
        if (removalCount <= 0)
            return;
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
    on(type, listener) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }
        this.listeners.get(type).add(listener);
        // 返回取消订阅函数
        return () => {
            this.listeners.get(type)?.delete(listener);
        };
    }
    /**
     * 获取所有事件
     */
    getEvents() {
        return [...this.events];
    }
    /**
     * 获取 payload
     */
    getPayload(payloadRef) {
        return this.payloadStore.get(payloadRef);
    }
    /**
     * 清空事件流
     */
    clear() {
        this.events = [];
        this.payloadStore.clear();
    }
    /**
     * 导出事件流（用于 debug bundle）
     */
    export() {
        const payloads = {};
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
    import(data) {
        this.events = data.events;
        this.payloadStore = new Map(Object.entries(data.payloads));
    }
    notifyListeners(type, event) {
        const listeners = this.listeners.get(type);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(event);
                }
                catch (error) {
                    console.error(`Error in event listener for ${type}:`, error);
                }
            });
        }
    }
    generateEventId() {
        return `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
//# sourceMappingURL=event-stream.js.map