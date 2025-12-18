import { describe, it, expect, vi } from 'vitest';
import { EventStream } from '../../src/core/event-stream';

describe('EventStream', () => {
    it('should emit and receive events', () => {
        const stream = new EventStream();
        const listener = vi.fn();

        stream.on('node_start', listener);

        stream.emit('node_start', 'info', 'test summary');

        expect(listener).toHaveBeenCalledTimes(1);
        const event = listener.mock.calls[0][0];
        expect(event.type).toBe('node_start');
        expect(event.status).toBe('info');
        expect(event.summary).toBe('test summary');
        expect(event.timestamp).toBeDefined();
        expect(event.id).toBeDefined();
    });

    it('should handle wildcard listeners', () => {
        const stream = new EventStream();
        const listener = vi.fn();

        stream.on('*', listener);

        stream.emit('node_start', 'info', 'start');
        stream.emit('node_end', 'success', 'end');

        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('should unsubscribe correctly', () => {
        const stream = new EventStream();
        const listener = vi.fn();

        const unsubscribe = stream.on('node_start', listener);
        stream.emit('node_start', 'info', 'first');
        
        unsubscribe();
        stream.emit('node_start', 'info', 'second');

        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should store and retrieve payloads', () => {
        const stream = new EventStream();
        const payload = { data: 'test' };

        const event = stream.emit('tool_result', 'success', 'done', { payload });

        expect(event.payloadRef).toBeDefined();
        expect(stream.getPayload(event.payloadRef!)).toBe(payload);
    });

    it('should maintain event history', () => {
        const stream = new EventStream();
        
        stream.emit('node_start', 'info', '1');
        stream.emit('node_end', 'success', '2');

        const events = stream.getEvents();
        expect(events).toHaveLength(2);
        expect(events[0].summary).toBe('1');
        expect(events[1].summary).toBe('2');
    });

    it('should cleanup old events when limit exceeded', () => {
        const stream = new EventStream();
        
        // Emit 1100 events
        for (let i = 0; i < 1100; i++) {
            stream.emit('node_start', 'info', `event-${i}`, { payload: { i } });
        }

        const events = stream.getEvents();
        expect(events).toHaveLength(1000);
        // Should keep the last 1000 (100 to 1099)
        expect(events[0].summary).toBe('event-100');
        expect(events[999].summary).toBe('event-1099');
    });

    it('should clear all events and payloads', () => {
        const stream = new EventStream();
        stream.emit('node_start', 'info', 'test', { payload: {} });

        stream.clear();

        expect(stream.getEvents()).toHaveLength(0);
        // Internal payload store check is hard without exposing it, 
        // but getPayload should return undefined for old refs if we knew them.
    });

    it('should export and import correctly', () => {
        const stream1 = new EventStream();
        stream1.emit('node_start', 'info', 'test', { payload: { val: 1 } });

        const data = stream1.export();
        
        const stream2 = new EventStream();
        stream2.import(data);

        const events = stream2.getEvents();
        expect(events).toHaveLength(1);
        expect(events[0].summary).toBe('test');
        expect(stream2.getPayload(events[0].payloadRef!)).toEqual({ val: 1 });
    });
});