export type MemoryScope = 'short' | 'long';

export interface MemoryMetadata {
    createdAt: number;
    lastAccessedAt: number;
    accessCount: number;
    importance: number;
    importanceLevel?: string;
    source?: string;
    tags?: string[];
}

export interface MemoryEntry {
    id: string;
    content: unknown;
    summary?: string;
    metadata: MemoryMetadata;
}

export interface MemorySnapshot {
    shortTerm: MemoryEntry[];
    longTerm: MemoryEntry[];
}

export interface MemoryCreatePayload {
    scope: MemoryScope;
    content: string;
    tags: string[];
    importance: number;
}

export interface MemoryPanelCallbacks {
    onRefresh?: (query?: string) => Promise<MemorySnapshot>;
    onAdd?: (payload: MemoryCreatePayload) => Promise<void>;
    onDelete?: (scope: MemoryScope, id: string) => Promise<void>;
    onPromote?: (id: string) => Promise<void>;
    onClear?: (scope: MemoryScope) => Promise<void>;
    onConsolidate?: () => Promise<void>;
}
