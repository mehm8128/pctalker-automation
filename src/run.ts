// 使い方: node src/run.ts [シナリオの JSON | シナリオのディレクトリ(<ID>/pc-talker.json を全て実行)。省略すると設定ファイルの scenarios_path] [--out logs/run-xxx] [--delay 5] [--load-wait 4] [--config config.json]
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { loadConfig, writeAsInfo } from './as-info.ts';
import { chord } from './keyboard.ts';
import { sleep } from './sleep.ts';
import { createSpeechReader } from './speech.ts';
import { StepLog } from './step-log.ts';
import { windowsClipboard, type WindowsClipboard } from './clipboard.ts';
import type { Scenario, StepResult } from './types.ts';

export type { Scenario, Step, StepResult } from './types.ts';

const STALL_COUNT = 3; // 同じ読み上げがこの回数続いたら、キーが効いていないとみなす
const MAX_REPEAT = 10; // until に着かないときの、キーを押す回数の上限

export async function runScenario(
  scenario: Scenario,
  logPath: string,
  { clipboard = windowsClipboard }: { clipboard?: Pick<WindowsClipboard, 'clear' | 'read'> } = {},
): Promise<StepResult[]> {
  const log = new StepLog(logPath);
  const speechReader = createSpeechReader(clipboard);
  const results: StepResult[] = [];
  // 毎回、最初に仮想カーソルをページの先頭へ移す(ログには残さない)。この時点までの読み上げは取得済みとして捨てる
  chord(['home']);
  await sleep(3000);
  await speechReader.readNewLines();
  let procedure: string | undefined;
  for (const [index, step] of scenario.steps.entries()) {
    // procedure を省略したステップは、直前のステップと同じ procedure
    procedure = step.procedure ?? procedure;
    // until: 読み上げにその文字列が出るまでキーを繰り返す(最大 MAX_REPEAT 回)
    const speech: string[] = [];
    const spoken = () => speech.join(' ');
    const maxRepeat = step.until === undefined ? 1 : MAX_REPEAT;
    let presses = 0;
    let stalled = false;
    while (presses < maxRepeat) {
      speech.push(...(await speechReader.press(step)));
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
    if (procedure !== undefined) result.procedure = procedure;
    if (step.until !== undefined) result.reached = spoken().includes(step.until);
    if (stalled) result.stalled = true;
    results.push(result);
    await log.logStep(result);
    if (result.reached === false) break; // 目的の要素に着いていないまま Enter 等を送らない
  }
  await log.flush();
  return results;
}

// ディレクトリなら、直下の <ID>/pc-talker.json を全て返す
async function collectScenarioPaths(arg: string): Promise<string[]> {
  if (!(await stat(arg).then((s) => s.isDirectory(), () => false))) return [arg];
  return (await readdir(arg, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => join(arg, e.name, 'pc-talker.json'))
    .filter((p) => existsSync(p))
    .sort();
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string', default: `logs/run-${Date.now()}` },
      delay: { type: 'string', default: '5' },
      'load-wait': { type: 'string', default: '4' },
      config: { type: 'string', default: 'config.json' },
    },
  });
  const config = await loadConfig(values.config);
  // 引数を省略すると、設定ファイルの scenarios_path を使う
  const arg = positionals[0] ?? config.scenarios_path;
  if (!arg) {
    console.error('シナリオの JSON またはシナリオのディレクトリを、引数か設定ファイルの scenarios_path で指定してください');
    process.exit(2);
  }
  const scenarioPaths = await collectScenarioPaths(arg);
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
    // ページの読み込み前に操作すると、前のページを読み上げてしまうため待つ
    await sleep(Number(values['load-wait']) * 1000);
    // キーはフォーカス中のウィンドウに送られるため、最初の 1 回だけ、ブラウザへ切り替える猶予を設ける
    if (i === 0) {
      for (let s = Number(values.delay); s > 0; s--) {
        console.error(`${s} 秒後に開始します。ブラウザのページをクリックして、フォーカスを移してください`);
        await sleep(1000);
      }
    }
    const fileName = basename(scenarioPath) === 'pc-talker.json' ? basename(dirname(scenarioPath)) : basename(scenarioPath, '.json');
    const name = scenario.testId ?? fileName;
    const scenarioResults = await runScenario(scenario, join(values.out, `${name}.jsonl`));
    results.push(...scenarioResults);
    // as_info の結果として書き込む(judgment は人間が書く)
    const asInfoPath = await writeAsInfo(name, scenarioResults, config, new Date().toLocaleDateString('sv'));
    console.error(`as_info: ${asInfoPath}`);
    // 終わったページのタブを閉じる(開いたタブにフォーカスがある前提)
    chord(['control', 'w']);
    await sleep(500);
  }
  windowsClipboard.close();
  console.error(`ログ: ${values.out}`);
  process.exit(results.some((r) => r.reached === false) ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
