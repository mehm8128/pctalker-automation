// 使い方: node src/as-info-cli.ts <ログのディレクトリ(logs/run-xxx)> [--config config.json]
// ログのディレクトリ内の <testId>.jsonl ごとに、as_info の結果 YAML を生成する。
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';
import { loadConfig, writeAsInfo } from './as-info.ts';
import type { StepResult } from './types.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { config: { type: 'string', default: 'config.json' } },
});
const dir = positionals[0];
if (!dir || !existsSync(dir)) {
  console.error('ログのディレクトリを指定してください(例: pnpm as-info logs/run-1234567890)');
  process.exit(2);
}
const config = await loadConfig(values.config);

const logs = (await readdir(dir)).filter((f) => f.endsWith('.jsonl')).sort();
if (!logs.length) {
  console.error(`${dir} に .jsonl のログがありません`);
  process.exit(2);
}
for (const file of logs) {
  const lines = (await readFile(join(dir, file), 'utf8')).split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const steps: (StepResult & { time: string; type: string })[] = lines.filter((l) => l.type === 'step');
  if (!steps.length) continue;
  // 実行した日をログの時刻から取る
  const date = new Date(steps[0].time).toLocaleDateString('sv');
  const path = await writeAsInfo(steps[0].testId ?? basename(file, '.jsonl'), steps, config, date);
  console.error(`${file} -> ${path}`);
}
