// 使い方: node src/run.ts [シナリオの JSON | シナリオのディレクトリ(<ID>/pc-talker.json を全て実行)。省略すると設定ファイルの scenarios_path] [--out logs/run-xxx] [--delay 5] [--copy log|last] [--config config.json]
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { writeAsInfo, type AsInfoConfig } from './as-info.ts';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { chord } from './keyboard.ts';
import { StepLog } from './step-log.ts';
import { windowsClipboard, type WindowsClipboard } from './clipboard.ts';

export interface Step {
  name?: string;
  keys: string[];
  until?: string;
  maxRepeat?: number;
  waitMs?: number;
  copy?: boolean;
  copyLog?: boolean;
}

export interface Scenario {
  testId?: string;
  title?: string;
  url: string;
  waitMs?: number;
  steps: Step[];
}

export interface StepResult {
  testId?: string;
  title?: string;
  index: number;
  name: string;
  keys: string[];
  presses: number;
  speech: string[];
  reached?: boolean;
  stalled?: boolean;
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
  scenario: Scenario,
  logPath: string,
  { clipboard = windowsClipboard, copy = 'last' }: { clipboard?: Pick<WindowsClipboard, 'clear' | 'read'>; copy?: string } = {},
): Promise<StepResult[]> {
  const log = new StepLog(logPath);
  const results: StepResult[] = [];
  let lastText = '';
  const copyOnce = async (step: Step) => {
    await clipboard.clear();
    chord(step.copyLog || copy === 'log' ? COPY_SPEECH_LOG : COPY_LAST_SPEECH);
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
      chord(step.keys);
      await sleep(step.waitMs ?? 1000);
      return [];
    }
    // 読み上げが前回から変わるまで待つ(固定待ちだと 1 つ前の読み上げを拾ってしまう)。
    // waitMs は変化を待つ上限。変化しなければ上限で同じ読み上げとして扱う。
    const maxWait = step.waitMs ?? scenario.waitMs ?? 1500;
    chord(step.keys);
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
    if (scenario.testId !== undefined) result.testId = scenario.testId;
    if (scenario.title !== undefined) result.title = scenario.title;
    if (step.until !== undefined) result.reached = spoken().includes(step.until);
    if (stalled) result.stalled = true;
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
      out: { type: 'string', default: `logs/run-${Date.now()}` },
      delay: { type: 'string', default: '5' },
      copy: { type: 'string', default: 'log' },
      config: { type: 'string', default: 'config.json' },
    },
  });
  if (!existsSync(values.config)) {
    console.error(`設定ファイル ${values.config} がありません。config.example.json をコピーして作成してください`);
    process.exit(2);
  }
  const config: AsInfoConfig = JSON.parse(await readFile(values.config, 'utf8'));
  // 引数を省略すると、設定ファイルの scenarios_path を使う
  const arg = positionals[0] ?? config.scenarios_path;
  if (!arg) {
    console.error('シナリオの JSON またはシナリオのディレクトリを、引数か設定ファイルの scenarios_path で指定してください');
    process.exit(2);
  }
  // ディレクトリなら、直下の <ID>/pc-talker.json を全て流す
  const scenarioPaths = (await stat(arg).then((s) => s.isDirectory(), () => false))
    ? (await readdir(arg, { withFileTypes: true }))
        .filter((e) => e.isDirectory())
        .map((e) => join(arg, e.name, 'pc-talker.json'))
        .filter((p) => existsSync(p))
        .sort()
    : [arg];
  if (!scenarioPaths.length) {
    console.error(`${arg} に <ID>/pc-talker.json がありません`);
    process.exit(2);
  }
  const results: StepResult[] = [];
  for (const [i, scenarioPath] of scenarioPaths.entries()) {
    const scenario: Scenario = JSON.parse(await readFile(scenarioPath, 'utf8'));
    console.error(`[${i + 1}/${scenarioPaths.length}] ${scenario.testId ?? scenarioPath} ${scenario.title ?? ''}`.trim());
    // url を既定のブラウザーで開く
    spawn('cmd.exe', ['/c', 'start', '', scenario.url], { stdio: 'ignore' }).unref();
    // キーはフォーカス中のウィンドウに送られるため、最初の 1 回だけ、ブラウザへ切り替える猶予を設ける
    if (i === 0) {
      for (let s = Number(values.delay); s > 0; s--) {
        console.error(`${s} 秒後に開始します。ブラウザのページをクリックして、フォーカスを移してください`);
        await sleep(1000);
      }
    }
    const fileName = basename(scenarioPath) === 'pc-talker.json' ? basename(dirname(scenarioPath)) : basename(scenarioPath, '.json');
    const name = scenario.testId ?? fileName;
    const scenarioResults = await runScenario(scenario, join(values.out, `${name}.jsonl`), { copy: values.copy });
    results.push(...scenarioResults);
    // as_info の結果として書き込む(judgment は人間が書く)
    const asInfoPath = await writeAsInfo(scenario, scenarioResults, config, new Date().toLocaleDateString('sv'));
    console.error(`as_info: ${asInfoPath}`);
    // 終わったページのタブを閉じる(開いたタブにフォーカスがある前提)
    chord(['control', 'w']);
    await sleep(500);
  }
  windowsClipboard.close();
  console.error(`ログ: ${values.out}`);
  process.exit(results.some((r) => r.reached === false) ? 1 : 0);
}
