import type { Checkpoint, PersistenceAdapter, RunnerHooks, State } from '../types';
import { EventStream } from '../event-stream';

export class CheckpointManager {
    constructor(
        private readonly persistence: PersistenceAdapter | undefined,
        private readonly eventStream: EventStream,
        private readonly hooks?: RunnerHooks,
    ) { }

    async save(state: State): Promise<void> {
        if (!this.persistence) return;

        const checkpoint: Checkpoint = {
            id: `checkpoint-${Date.now()}`,
            stateId: state.id,
            state,
            eventIndex: this.eventStream.getEvents().length,
            timestamp: Date.now(),
        };

        await this.persistence.saveCheckpoint(checkpoint);

        this.eventStream.emit('checkpoint', 'success', `已保存 checkpoint ${checkpoint.id}`, {
            metadata: { checkpointId: checkpoint.id },
        });

        await this.hooks?.onCheckpoint?.(checkpoint);
    }

    async load(checkpointId: string): Promise<Checkpoint> {
        if (!this.persistence) {
            throw new Error('未配置持久化适配器，无法恢复');
        }

        const checkpoint = await this.persistence.loadCheckpoint(checkpointId);
        if (!checkpoint) {
            throw new Error(`Checkpoint "${checkpointId}" 不存在`);
        }

        return checkpoint;
    }
}
