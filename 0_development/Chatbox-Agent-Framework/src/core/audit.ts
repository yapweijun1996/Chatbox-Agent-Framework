/**
 * Audit logging helpers.
 */

import type { EventStream } from './event-stream';
import type { Event } from './types';

export type AuditStatus = Event['status'];

export interface AuditEntry {
    action: string;
    status: AuditStatus;
    actor?: string;
    roles?: string[];
    metadata?: Record<string, unknown>;
    timestamp?: number;
}

export interface AuditLogger {
    log(entry: AuditEntry): void | Promise<void>;
}

export function createEventStreamAuditLogger(eventStream: EventStream): AuditLogger {
    return {
        log(entry: AuditEntry) {
            const timestamp = entry.timestamp ?? Date.now();
            eventStream.emit('audit', entry.status, entry.action, {
                metadata: {
                    actor: entry.actor,
                    roles: entry.roles,
                    ...entry.metadata,
                },
                payload: {
                    ...entry,
                    timestamp,
                },
            });
        },
    };
}
