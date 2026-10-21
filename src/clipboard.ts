import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

const END = '<<END>>';

// PowerShell を常駐させ、起動コスト(毎回 0.5〜1 秒)を避ける。
export class WindowsClipboard {
  #proc: ChildProcessWithoutNullStreams | null = null;
  #buf = '';
  #queue: Promise<unknown> = Promise.resolve();
  #waiter: ((out: string) => void) | null = null;
  #ready: Promise<string> = Promise.resolve('');

  #start(): void {
    if (this.#proc) return;
    const proc = spawn('powershell.exe', ['-NoProfile', '-NoLogo', '-Command', '-'], { stdio: ['pipe', 'pipe', 'ignore'] }) as unknown as ChildProcessWithoutNullStreams;
    this.#proc = proc;
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (d: string) => {
      this.#buf += d;
      const i = this.#buf.indexOf(`\n${END}\n`);
      if (i >= 0 && this.#waiter) {
        const out = this.#buf.slice(0, i);
        this.#buf = this.#buf.slice(i + END.length + 2);
        const w = this.#waiter;
        this.#waiter = null;
        w(out);
      }
    });
    // 起動時の警告(スクリーンリーダー検出など)は最初の合図までを捨てて無視する
    this.#ready = new Promise<string>((resolve) => {
      this.#waiter = resolve;
    });
    proc.stdin.write(`[Console]::OutputEncoding=[Text.Encoding]::UTF8\n[Console]::Out.Write("\`n${END}\`n")\n`);
  }

  #run(script: string): Promise<string> {
    this.#start();
    const task = this.#queue
      .then(() => this.#ready)
      .then(
        () =>
          new Promise<string>((resolve) => {
            this.#waiter = resolve;
            this.#proc?.stdin.write(`${script}\n[Console]::Out.Write("\`n${END}\`n")\n`);
          }),
      );
    this.#queue = task.catch(() => {});
    return task;
  }

  async read(): Promise<string> {
    const out = await this.#run('$t = Get-Clipboard -Raw; if ($t) { [Console]::Out.Write($t) }');
    return out.replace(/^\r?\n/, '').replace(/\r?\n$/, '');
  }

  async clear(): Promise<void> {
    await this.#run('Set-Clipboard -Value $null');
  }

  close(): void {
    this.#proc?.stdin.end();
    this.#proc = null;
  }
}

export const windowsClipboard = new WindowsClipboard();
