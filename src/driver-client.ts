// aria-at-automation-driver (v1.aria-at.bocoup.com) の WebSocket クライアント。
// このプロジェクトではキー送信(pressKey/releaseKey)にだけ使う。
import { EventEmitter } from 'node:events';

const PROTOCOL = 'v1.aria-at.bocoup.com';
export const DEFAULT_URL = 'ws://127.0.0.1:4382/session';

export class DriverClient extends EventEmitter {
  #ws!: WebSocket;
  #nextId = 1;
  #pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  static connect(url = DEFAULT_URL): Promise<DriverClient> {
    const client = new DriverClient();
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, PROTOCOL);
      client.#ws = ws;
      ws.addEventListener('open', () => resolve(client), { once: true });
      ws.addEventListener('error', (e) => reject(new Error(`接続失敗: ${url} ${(e as ErrorEvent).message ?? ''}`)), { once: true });
      ws.addEventListener('message', (e) => client.#onMessage(String(e.data)));
      ws.addEventListener('close', () => {
        for (const { reject } of client.#pending.values()) reject(new Error('接続が閉じられました'));
        client.#pending.clear();
        client.emit('close');
      });
    });
  }

  #onMessage(raw: string): void {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.type === 'response') {
      const p = this.#pending.get(msg.id);
      if (!p) return;
      this.#pending.delete(msg.id);
      if (msg.error) p.reject(new Error(`${msg.error}: ${msg.message ?? ''}`));
      else p.resolve(msg.result);
    } else if (msg.type === 'event') {
      this.emit(msg.name, msg.data);
    }
  }

  command(name: string, params: unknown[] = []): Promise<unknown> {
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#ws.send(JSON.stringify({ type: 'command', id, name, params }));
    });
  }

  pressKey(key: string): Promise<unknown> {
    return this.command('pressKey', [key]);
  }

  releaseKey(key: string): Promise<unknown> {
    return this.command('releaseKey', [key]);
  }

  // 修飾キーを押したまま最後のキーを押す。例: ['control', 'shift', 'f1']
  async chord(keys: string[]): Promise<void> {
    const pressed: string[] = [];
    try {
      for (const k of keys) {
        await this.pressKey(k);
        pressed.push(k);
      }
    } finally {
      for (const k of pressed.reverse()) await this.releaseKey(k);
    }
  }

  close(): void {
    this.#ws.close();
  }
}
