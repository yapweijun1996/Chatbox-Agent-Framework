import { pathToFileURL } from 'node:url';

async function readInput() {
    const chunks = [];
    for await (const chunk of process.stdin) {
        chunks.push(chunk);
    }
    if (!chunks.length) {
        return null;
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function main() {
    try {
        const payload = await readInput();
        if (!payload) {
            throw new Error('No input payload');
        }

        const moduleUrl = payload.modulePath.startsWith('file:')
            ? payload.modulePath
            : pathToFileURL(payload.modulePath).toString();
        const exportName = payload.exportName || 'execute';

        const mod = await import(moduleUrl);
        const handler = mod[exportName] || mod.default;

        if (typeof handler !== 'function') {
            throw new Error(`Export "${exportName}" is not a function`);
        }

        const output = await handler(payload.input);
        process.stdout.write(JSON.stringify({ success: true, output }));
    } catch (error) {
        process.stdout.write(JSON.stringify({ success: false, error: String(error) }));
        process.exitCode = 1;
    }
}

main();
