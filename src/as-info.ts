import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { release } from 'node:os';
import { join } from 'node:path';
import { Scalar, stringify } from 'yaml';
import type { StepResult } from './types.ts';

// 設定ファイルに書く、実行環境の情報。os は実行時に取得し、environment_type は PC-Talker 前提で固定する。
export interface AsInfoConfig {
  // 実行するシナリオの JSON またはディレクトリ。コマンドライン引数で上書きできる
  scenarios_path?: string;
  // as_info リポジトリのルート。結果は <as_info_path>/src/content/results/ に書き込む
  as_info_path: string;
  user_agent: string;
  assistive_tech: string;
  assistive_tech_config?: string;
  tester: string;
}

// 設定ファイルを読む。ファイルがなければ、案内を出して終了する
export async function loadConfig(path: string): Promise<AsInfoConfig> {
  if (!existsSync(path)) {
    console.error(`設定ファイル ${path} がありません。config.example.json をコピーして作成してください`);
    process.exit(2);
  }
  return JSON.parse(await readFile(path, 'utf8'));
}

// results/ 配下の既存ファイル名(<id>.yaml)の最大値 + 1
async function nextId(resultsDir: string): Promise<number> {
  const groups = await readdir(resultsDir, { withFileTypes: true });
  let max = 0;
  for (const g of groups.filter((e) => e.isDirectory())) {
    for (const f of await readdir(join(resultsDir, g.name))) {
      const m = /^(\d+)\.yaml$/.exec(f);
      if (m) max = Math.max(max, Number(m[1]));
    }
  }
  return max + 1;
}

// 結果を as_info に書き込み、書いたパスを返す。id は 100 件ごとのグループ(0001, 0101, ...)に振り分ける
export async function writeAsInfo(testId: string, results: StepResult[], config: AsInfoConfig, date: string): Promise<string> {
  const resultsDir = join(config.as_info_path, 'src', 'content', 'results');
  const id = await nextId(resultsDir);
  const group = String(Math.floor((id - 1) / 100) * 100 + 1).padStart(4, '0');
  const dir = join(resultsDir, group);
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${String(id).padStart(4, '0')}.yaml`);
  await writeFile(path, toAsInfoYaml(testId, results, config, date, id));
  return path;
}

// Windows 11 のビルド番号は 22000 以上
function detectOs(): string {
  const build = Number(release().split('.')[2]);
  return build >= 22000 ? 'Windows 11' : 'Windows 10';
}

const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();

// as_info の contents(procedure / actual)にする。
// シナリオのステップは操作の単位で、AS テストの手順の単位とは限らない。
// step.procedure が同じステップを 1 つにまとめ、読み上げを改行でつなぐ。procedure のないステップ(ページ内の移動だけのもの)は含めない。
function toContents(results: StepResult[]): { procedure: string; actual: string; judgment: null }[] {
  const groups = new Map<string, string[]>();
  for (const r of results) {
    if (!r.procedure) continue;
    groups.set(r.procedure, [...(groups.get(r.procedure) ?? []), normalize(r.speech.join(' '))]);
  }
  return [...groups].map(([procedure, actuals]) => ({ procedure, actual: actuals.filter(Boolean).join('\n'), judgment: null }));
}

// 実行結果を as_info の結果 YAML(src/content/results/*/*.yaml)にする。judgment は人間が書くため空にしておく。
export function toAsInfoYaml(testId: string, results: StepResult[], config: AsInfoConfig, date: string, id: number): string {
  const quoted = new Scalar(date);
  quoted.type = Scalar.QUOTE_SINGLE;
  const doc = {
    id,
    test: testId.replace(/^WAIC-TEST-/, ''),
    os: detectOs(),
    user_agent: config.user_agent,
    assistive_tech: config.assistive_tech,
    assistive_tech_config: config.assistive_tech_config || null,
    contents: toContents(results),
    environment_type: '音声閲覧環境',
    comment: null,
    tester: config.tester,
    date: quoted,
  };
  return stringify(doc, { nullStr: '', lineWidth: 0 });
}
