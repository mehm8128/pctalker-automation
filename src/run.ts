// 使い方: node src/run.ts <シナリオ名(例: w3c = scenarios/w3c.json)> [--url ws://127.0.0.1:4382/session] [--out logs/run.jsonl] [--delay 5] [--copy log|last]
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { DEFAULT_URL, DriverClient } from './driver-client.ts';
import { StepLog } from './step-log.ts';
import { windowsClipboard, type WindowsClipboard } from './clipboard.ts';

export interface Step {
  name?: string;
  keys: string[];
  expect?: string | string[];
  until?: string;
  maxRepeat?: number;
  waitMs?: number;
  copy?: boolean;
  copyLog?: boolean;
}

export interface Scenario {
  waitMs?: number;
  steps: Step[];
}

export interface StepResult {
  index: number;
  name: string;
  keys: string[];
  presses: number;
  speech: string[];
  reached?: boolean;
  stalled?: boolean;
  pass?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const COPY_LAST_SPEECH = ['control', 'alt', 's']; // PC-Talker: 直前の読み上げをクリップボードへ
const COPY_SPEECH_LOG = ['control', 'alt', 'command', 's']; // PC-Talker: 音声ログ全件(最大20件)
const CLIPBOARD_TIMEOUT_MS = 500;
const STALL_COUNT = 3; // 同じ読み上げがこの回数続いたら、キーが効いていないとみなす

// キーを送り、PC-Talker のコピーコマンド経由でクリップボードから読み上げを取得する。
// copy: 'last' は直前の読み上げ(Ctrl+Alt+S)、'log' は音声ログ(Ctrl+Alt+Win+S)の最終行を取得する。
// Chrome/Firefox では Ctrl+Alt+S が「ページ全体のコピー」になるため 'log' を使う(CLI の既定)。
export async function runScenario(
  client: DriverClient,
  scenario: Scenario,
  logPath: string,
  { clipboard = windowsClipboard, copy = 'last' }: { clipboard?: Pick<WindowsClipboard, 'clear' | 'read'>; copy?: string } = {},
): Promise<StepResult[]> {
  const log = new StepLog(logPath);
  const results: StepResult[] = [];
  let lastText = '';
  const copyOnce = async (step: Step) => {
    await clipboard.clear();
    await client.chord(step.copyLog || copy === 'log' ? COPY_SPEECH_LOG : COPY_LAST_SPEECH);
    let text = '';
    for (let waited = 0; !text && waited < CLIPBOARD_TIMEOUT_MS; waited += 50) {
      await sleep(50);
      text = await clipboard.read();
    }
    if (copy === 'log' && !step.copyLog) text = text.split(/\r?\n/).filter((l) => l.trim()).pop() ?? '';
    return text;
  };
  const attempt = async (step: Step): Promise<string[]> => {
    // copy: false は読み上げをコピーしない(連続読み上げ中にコピー用の Win キーを送るとスタートメニューが開くため)
    if (step.copy === false) {
      await client.chord(step.keys);
      await sleep(step.waitMs ?? 1000);
      return [];
    }
    // 読み上げが前回から変わるまで待つ(固定待ちだと 1 つ前の読み上げを拾ってしまう)。
    // waitMs は変化を待つ上限。変化しなければ上限で同じ読み上げとして扱う。
    const maxWait = step.waitMs ?? scenario.waitMs ?? 1500;
    await client.chord(step.keys);
    const start = Date.now();
    let text = '';
    // コピー操作自体がキー入力(Win キーを含む)なので、回数を最小限にする
    do {
      await sleep(400);
      text = await copyOnce(step);
    } while ((!text || text === lastText) && Date.now() - start < maxWait);
    lastText = text;
    return text ? [text] : [];
  };
  for (const [index, step] of scenario.steps.entries()) {
    // until: 読み上げにその文字列が出るまでキーを繰り返す(最大 maxRepeat 回)
    const speech: string[] = [];
    const spoken = () => speech.join(' ');
    const maxRepeat = step.until === undefined ? 1 : (step.maxRepeat ?? 10);
    let presses = 0;
    let stalled = false;
    while (presses < maxRepeat) {
      speech.push(...(await attempt(step)));
      presses++;
      if (step.until === undefined || spoken().includes(step.until)) break;
      if (presses >= STALL_COUNT && new Set(speech.slice(-STALL_COUNT)).size === 1) {
        stalled = true;
        break;
      }
    }
    const result: StepResult = { index, name: step.name ?? step.keys.join('+'), keys: step.keys, presses, speech };
    if (step.until !== undefined) result.reached = spoken().includes(step.until);
    if (stalled) result.stalled = true;
    if (step.expect !== undefined) result.pass = ([] as string[]).concat(step.expect).every((s) => spoken().includes(s));
    if (result.reached === false) result.pass = false;
    results.push(result);
    await log.logStep(result);
    if (result.reached === false) break; // 目的の要素に着いていないまま Enter 等を送らない
  }
  await log.flush();
  return results;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      url: { type: 'string', default: DEFAULT_URL },
      out: { type: 'string', default: `logs/run-${Date.now()}.jsonl` },
      delay: { type: 'string', default: '5' },
      copy: { type: 'string', default: 'log' },
    },
  });
  if (!positionals[0]) {
    console.error('シナリオ名を指定してください(例: w3c)');
    process.exit(2);
  }
  // 名前だけ(例: w3c)なら scenarios/<名前>.json として扱う
  const arg = positionals[0];
  const scenarioPath = /[\\/]|\.json$/.test(arg) ? arg : `scenarios/${arg}.json`;
  const scenario = JSON.parse(await readFile(scenarioPath, 'utf8'));
  const client = await DriverClient.connect(values.url);
  // キーはフォーカス中のウィンドウに送られるため、ブラウザへ切り替える猶予を設ける
  for (let s = Number(values.delay); s > 0; s--) {
    console.error(`${s} 秒後に開始します。ブラウザのページをクリックして、フォーカスを移してください`);
    await sleep(1000);
  }
  const results = await runScenario(client, scenario, values.out, { copy: values.copy });
  client.close();
  windowsClipboard.close();
  console.log(JSON.stringify(results, null, 2));
  console.error(`ログ: ${values.out}`);
  process.exit(results.some((r) => r.pass === false) ? 1 : 0);
}
