export class CheckpointManager {
    persistence;
    eventStream;
    hooks;
    constructor(persistence, eventStream, hooks) {
        this.persistence = persistence;
        this.eventStream = eventStream;
        this.hooks = hooks;
    }
    async save(state) {
        if (!this.persistence)
            return;
        const checkpoint = {
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
    async load(checkpointId) {
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
//# sourceMappingURL=checkpoint-manager.js.map