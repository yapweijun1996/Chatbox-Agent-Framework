/**
 * Debug Bundle 导出
 * 收集并导出完整的调试信息
 */

import type { State, Checkpoint } from './types';
import type { EventStream } from './event-stream';

export interface DebugBundle {
    version: string;
    timestamp: number;
    state: State;
    events: ReturnType<EventStream['export']>;
    checkpoints?: Checkpoint[];
    metadata: {
        userAgent?: string;
        platform?: string;
        [key: string]: unknown;
    };
}

/**
 * 创建 Debug Bundle
 */
export function createDebugBundle(
    state: State,
    eventStream: EventStream,
    options?: {
        checkpoints?: Checkpoint[];
        metadata?: Record<string, unknown>;
    }
): DebugBundle {
    return {
        version: '0.1.0',
        timestamp: Date.now(),
        state,
        events: eventStream.export(),
        checkpoints: options?.checkpoints,
        metadata: {
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
            platform: typeof navigator !== 'undefined' ? navigator.platform : undefined,
            ...options?.metadata,
        },
    };
}

/**
 * 导出为 JSON 字符串
 */
export function exportDebugBundle(bundle: DebugBundle): string {
    return JSON.stringify(bundle, null, 2);
}

/**
 * 导出为文件（浏览器环境）
 */
export function downloadDebugBundle(bundle: DebugBundle, filename?: string): void {
    const json = exportDebugBundle(bundle);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `debug-bundle-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
}

/**
 * 从 JSON 恢复 Debug Bundle
 */
export function importDebugBundle(json: string): DebugBundle {
    return JSON.parse(json);
}
