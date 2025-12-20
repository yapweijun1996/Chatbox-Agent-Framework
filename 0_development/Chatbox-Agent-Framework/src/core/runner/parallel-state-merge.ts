import type { ParallelMergeStrategy, State, Telemetry } from '../types';

const DEFAULT_MERGE_STRATEGY: Required<ParallelMergeStrategy> = {
    order: 'defined',
    conflict: 'last-write-wins',
};

function mergeTelemetry(base: Telemetry, deltas: Telemetry[]): Telemetry {
    const merged: Telemetry = {
        ...base,
        nodeTimings: { ...base.nodeTimings },
    };

    for (const delta of deltas) {
        merged.totalDuration += delta.totalDuration;
        merged.tokenCount += delta.tokenCount;
        merged.toolCallCount += delta.toolCallCount;
        merged.errorCount += delta.errorCount;
        merged.retryCount += delta.retryCount;

        for (const [nodeId, duration] of Object.entries(delta.nodeTimings)) {
            merged.nodeTimings[nodeId] = (merged.nodeTimings[nodeId] || 0) + duration;
        }
    }

    return merged;
}

function calculateTelemetryDelta(base: Telemetry, next: Telemetry): Telemetry {
    const deltaTimings: Record<string, number> = {};
    const baseTimings = base.nodeTimings || {};
    const nextTimings = next.nodeTimings || {};

    for (const [nodeId, duration] of Object.entries(nextTimings)) {
        const baseDuration = baseTimings[nodeId] || 0;
        if (duration !== baseDuration) {
            deltaTimings[nodeId] = duration - baseDuration;
        }
    }

    return {
        totalDuration: next.totalDuration - base.totalDuration,
        tokenCount: next.tokenCount - base.tokenCount,
        toolCallCount: next.toolCallCount - base.toolCallCount,
        errorCount: next.errorCount - base.errorCount,
        retryCount: next.retryCount - base.retryCount,
        nodeTimings: deltaTimings,
    };
}

export function mergeParallelStates(
    baseState: State,
    parallelStates: State[],
    strategy?: ParallelMergeStrategy
): State {
    const mergedStrategy = { ...DEFAULT_MERGE_STRATEGY, ...strategy };
    const orderedStates = parallelStates;

    const telemetryDeltas = orderedStates.map(state => calculateTelemetryDelta(baseState.telemetry, state.telemetry));
    const baseMessageLength = baseState.conversation.messages.length;
    const baseToolSummaryLength = baseState.conversation.toolResultsSummary.length;
    const baseLongTermLength = baseState.memory.longTermKeys.length;

    const mergedMessages = baseState.conversation.messages.slice();
    const mergedToolSummaries = baseState.conversation.toolResultsSummary.slice();
    const mergedLongTermKeys = baseState.memory.longTermKeys.slice();
    let mergedShortTerm = { ...baseState.memory.shortTerm };
    let mergedArtifacts = { ...baseState.artifacts };
    let mergedTask = baseState.task;
    let updatedAt = baseState.updatedAt;

    for (const state of orderedStates) {
        if (state.conversation.messages.length > baseMessageLength) {
            mergedMessages.push(...state.conversation.messages.slice(baseMessageLength));
        }

        if (state.conversation.toolResultsSummary.length > baseToolSummaryLength) {
            mergedToolSummaries.push(...state.conversation.toolResultsSummary.slice(baseToolSummaryLength));
        }

        if (state.memory.longTermKeys.length > baseLongTermLength) {
            mergedLongTermKeys.push(...state.memory.longTermKeys.slice(baseLongTermLength));
        }

        mergedShortTerm = { ...mergedShortTerm, ...state.memory.shortTerm };
        mergedArtifacts = { ...mergedArtifacts, ...state.artifacts };

        if (mergedStrategy.conflict === 'last-write-wins') {
            mergedTask = state.task;
        }

        updatedAt = Math.max(updatedAt, state.updatedAt);
    }

    const merged: State = {
        ...baseState,
        conversation: {
            messages: mergedMessages,
            toolResultsSummary: mergedToolSummaries,
        },
        task: mergedTask,
        memory: {
            shortTerm: mergedShortTerm,
            longTermKeys: mergedLongTermKeys,
        },
        artifacts: mergedArtifacts,
        telemetry: mergeTelemetry(baseState.telemetry, telemetryDeltas),
        policy: baseState.policy,
        createdAt: baseState.createdAt,
        updatedAt,
    };

    return merged;
}
