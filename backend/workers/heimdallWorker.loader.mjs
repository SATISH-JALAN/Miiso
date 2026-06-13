/**
 * Loader shim for heimdallWorker.ts
 * 
 * This .mjs file is the worker entry point. Node.js can natively load .mjs files,
 * and tsx (loaded via --import in execArgv) handles the .ts import below.
 */
await import("./heimdallWorker.ts");
