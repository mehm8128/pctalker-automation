import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

// ステップごとの結果を JSONL に追記する。
export class StepLog {
  #logPath: string;
  #writes: Promise<unknown> = Promise.resolve();

  constructor(logPath: string) {
    this.#logPath = logPath;
  }

  logStep(step: object): Promise<unknown> {
    const line = JSON.stringify({ time: new Date().toISOString(), type: 'step', ...step }) + '\n';
    this.#writes = this.#writes
      .then(() => mkdir(dirname(this.#logPath), { recursive: true }))
      .then(() => appendFile(this.#logPath, line));
    return this.#writes;
  }

  flush(): Promise<unknown> {
    return this.#writes;
  }
}
