import { chord } from './keyboard.ts';
import { sleep } from './sleep.ts';
import { windowsClipboard, type WindowsClipboard } from './clipboard.ts';
import type { Step } from './types.ts';

const COPY_SPEECH_LOG = ['control', 'alt', 'command', 's']; // PC-Talker: 音声ログ全件(最大20件)
const CLIPBOARD_TIMEOUT_MS = 500;

// キーを送り、PC-Talker の音声ログ(Ctrl+Alt+Win+S)のコピー経由で、クリップボードから読み上げを取得する。
// ブラウザーでは Ctrl+Alt+S が「ページ全体のコピー」になるため、音声ログを使う。
export function createSpeechReader(clipboard: Pick<WindowsClipboard, 'clear' | 'read'> = windowsClipboard) {
  let prevLog: string[] = [];

  // 音声ログ全件のうち、前回の取得から増えた行だけを返す
  const readNewLines = async (): Promise<string[]> => {
    await clipboard.clear();
    chord(COPY_SPEECH_LOG);
    let text = '';
    for (let waited = 0; !text && waited < CLIPBOARD_TIMEOUT_MS; waited += 50) {
      await sleep(50);
      text = await clipboard.read();
    }
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    // 前回のログの末尾と、今回のログの先頭が重なる最長の部分を除く
    let overlap = Math.min(prevLog.length, lines.length);
    while (overlap > 0 && prevLog.slice(-overlap).join('\n') !== lines.slice(0, overlap).join('\n')) overlap--;
    if (lines.length) prevLog = lines;
    return lines.slice(overlap);
  };

  // ステップのキーを 1 回送り、新しい読み上げを返す。
  // copy: false は読み上げを取得しない(連続読み上げ中にコピー用の Win キーを送るとスタートメニューが開くため)
  const press = async (step: Step): Promise<string[]> => {
    if (step.copy === false) {
      chord(step.keys);
      await sleep(step.waitMs ?? 1000);
      return [];
    }
    // 新しい読み上げが出るまで待つ(固定待ちだと 1 つ前の読み上げを拾ってしまう)。waitMs は待つ上限
    const maxWait = step.waitMs ?? 1500;
    chord(step.keys);
    const start = Date.now();
    let lines: string[] = [];
    // コピー操作自体がキー入力(Win キーを含む)なので、回数を最小限にする
    do {
      await sleep(400);
      lines = await readNewLines();
    } while (!lines.length && Date.now() - start < maxWait);
    return lines;
  };

  return { press, readNewLines };
}
