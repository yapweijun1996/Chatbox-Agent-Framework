import { parentPort } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';

function sendMessage(message) {
    if (typeof postMessage === 'function') {
        postMessage(message);
        return;
    }
    if (parentPort) {
        parentPort.postMessage(message);
    }
}

function onMessage(handler) {
    if (typeof onmessage !== 'undefined') {
        onmessage = (event) => handler(event.data);
        return;
    }
    if (parentPort) {
        parentPort.on('message', handler);
    }
}

async function handlePayload(payload) {
    const moduleUrl = payload.modulePath.startsWith('file:')
        ? payload.modulePath
        : pathToFileURL(payload.modulePath).toString();
    const exportName = payload.exportName || 'execute';
    const mod = await import(moduleUrl);
    const handler = mod[exportName] || mod.default;

    if (typeof handler !== 'function') {
        throw new Error(`Export "${exportName}" is not a function`);
    }

    return handler(payload.input);
}

onMessage(async (payload) => {
    try {
        const output = await handlePayload(payload);
        sendMessage({ success: true, output });
    } catch (error) {
        sendMessage({ success: false, error: String(error) });
    }
});
