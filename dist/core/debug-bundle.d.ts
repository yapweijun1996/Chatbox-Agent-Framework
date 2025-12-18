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
export declare function createDebugBundle(state: State, eventStream: EventStream, options?: {
    checkpoints?: Checkpoint[];
    metadata?: Record<string, unknown>;
}): DebugBundle;
/**
 * 导出为 JSON 字符串
 */
export declare function exportDebugBundle(bundle: DebugBundle): string;
/**
 * 导出为文件（浏览器环境）
 */
export declare function downloadDebugBundle(bundle: DebugBundle, filename?: string): void;
/**
 * 从 JSON 恢复 Debug Bundle
 */
export declare function importDebugBundle(json: string): DebugBundle;
//# sourceMappingURL=debug-bundle.d.ts.map