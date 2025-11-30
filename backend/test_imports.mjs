import { createRequire } from 'module';
const require = createRequire(import.meta.url);

console.log("--- Testing Imports ---");

try {
    const DefaultImport = await import('node-carplay');
    console.log("import * from 'node-carplay':", Object.keys(DefaultImport));
    if (DefaultImport.default) console.log("Default export:", DefaultImport.default);
} catch (e) { console.log("Failed to import 'node-carplay':", e.message); }

try {
    const NodeImport = await import('node-carplay/node');
    console.log("import * from 'node-carplay/node':", Object.keys(NodeImport));
    if (NodeImport.default) {
        console.log("Default export type:", typeof NodeImport.default);
        try {
            const instance = new NodeImport.default({ dpi: 480 });
            console.log("Instance keys:", Object.keys(instance));
        } catch (e) { console.log("Failed to instantiate:", e.message); }
    }
} catch (e) { console.log("Failed to import 'node-carplay/node':", e.message); }

console.log("--- End Test ---");
