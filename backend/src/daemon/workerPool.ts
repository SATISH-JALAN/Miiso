import { Worker } from "node:worker_threads";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Worker script path pointing to the decompiler worker file
const WORKER_PATH = path.resolve(__dirname, "../../workers/heimdallWorker.js");

interface Task {
  bytecode: string;
  contractAddress: string;
  resolve: (value: string) => void;
  reject: (err: any) => void;
  addedAt: number;
  timeoutId?: NodeJS.Timeout;
}

class WorkerPool {
  private maxWorkers: number;
  private activeWorkers = new Set<Worker>();
  private queue: Task[] = [];
  private maxQueueDepth = 100;
  private taskTimeoutMs = 30000; // Hard 30-second limit per analysis task

  constructor() {
    // Leave 1 core free for Fastify event loop, WebSocket handling, and DB operations
    const cpuCount = os.cpus().length;
    this.maxWorkers = Math.max(1, cpuCount - 1);
    logger.info(`⚙️ WorkerPool: Initialized with max ${this.maxWorkers} worker threads.`);
  }

  /**
   * Enqueues a decompilation task.
   * Returns a promise that resolves to the decompiled Solidity code string.
   */
  public decompile(contractAddress: string, bytecode: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Create task object
      const task: Task = {
        contractAddress,
        bytecode,
        resolve,
        reject,
        addedAt: Date.now()
      };

      // Enforce maximum queue depth (Drop Oldest Eviction Policy)
      if (this.queue.length >= this.maxQueueDepth) {
        const evicted = this.queue.shift(); // Evict oldest task
        if (evicted) {
          logger.warn(`⚠️ WorkerPool Queue Overflow: Evicted oldest analysis task for ${evicted.contractAddress}`);
          clearTimeout(evicted.timeoutId);
          evicted.reject(new Error("QueueOverflowEviction: Task discarded to maintain memory bounds"));
        }
      }

      this.queue.push(task);
      this.processQueue();
    });
  }

  /**
   * Spawns a worker or assigns tasks from queue if slots are available.
   */
  private processQueue() {
    if (this.activeWorkers.size >= this.maxWorkers) {
      return; // All worker slots busy
    }

    const task = this.queue.shift();
    if (!task) return; // Queue empty

    this.runTask(task);
  }

  /**
   * Runs a decompilation task inside a child worker thread.
   */
  private runTask(task: Task) {
    const worker = new Worker(WORKER_PATH);
    this.activeWorkers.add(worker);

    // Set a hard timeout timer for the task (SIGKILL equivalent)
    const timeoutId = setTimeout(() => {
      logger.error(`❌ WorkerPool Timeout: Decompilation for ${task.contractAddress} exceeded 30s. Terminating worker...`);
      worker.terminate();
      this.activeWorkers.delete(worker);
      task.reject(new Error(`TimeoutError: Decompilation exceeded ${this.taskTimeoutMs}ms`));
      this.processQueue();
    }, this.taskTimeoutMs);

    task.timeoutId = timeoutId;

    worker.postMessage({
      bytecode: task.bytecode,
      contractAddress: task.contractAddress
    });

    worker.on("message", (msg: { success: boolean; decompiledCode?: string; error?: string }) => {
      clearTimeout(timeoutId);
      this.activeWorkers.delete(worker);
      worker.terminate();

      if (msg.success && msg.decompiledCode !== undefined) {
        task.resolve(msg.decompiledCode);
      } else {
        task.reject(new Error(msg.error || "Unknown worker error"));
      }

      this.processQueue();
    });

    worker.on("error", (err) => {
      clearTimeout(timeoutId);
      this.activeWorkers.delete(worker);
      worker.terminate();
      task.reject(err);
      this.processQueue();
    });

    worker.on("exit", (code) => {
      clearTimeout(timeoutId);
      this.activeWorkers.delete(worker);
      if (code !== 0) {
        task.reject(new Error(`Worker exited with non-zero exit code: ${code}`));
      }
      this.processQueue();
    });
  }

  public getStats() {
    return {
      activeWorkers: this.activeWorkers.size,
      maxWorkers: this.maxWorkers,
      queueDepth: this.queue.length
    };
  }
}

export const workerPool = new WorkerPool();
