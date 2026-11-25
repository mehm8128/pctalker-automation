# as_info への出力

シナリオが終わるたびに、結果を `<as_info_path>/src/content/results/` 配下へ as_info の形式の YAML として書き込む。as_info を直接書き換えるので、実行前に as_info の git の状態を確認する。

## 設定ファイル

実行前に、`config.example.json` をコピーして `config.json`(git 管理外。`--config` で別のパスも指定できる)を作り、環境に合わせて書く。

| キー | 内容 |
| --- | --- |
| `as_info_path` | as_info リポジトリのルート(例: `../as_info`。実行時のカレントディレクトリからの相対パスも可) |
| `scenarios_path` | 実行するシナリオの JSON またはディレクトリ(例: `../as_test/scenarios`。引数で上書き可) |
| `user_agent` | ブラウザーの種類とバージョン(例: `Chrome 142`) |
| `assistive_tech` | PC-Talker の名称とバージョン |
| `assistive_tech_config` | 支援技術の設定(空文字なら YAML でも空欄) |
| `tester` | 検証者名 |

`os` は実行時に取得し(Windows 11 / 10)、`environment_type` は `音声閲覧環境` 固定なので、設定は不要。

## YAML の出力規則

- `id` は既存ファイルの最大値 + 1 を自動採番し、100 件ごとのグループに振り分ける(例: id 712 → `0701/0712.yaml`)。
- `test` は `testId` から `WAIC-TEST-` を除いたもの。
- `contents` の `procedure` / `actual` は、ステップの `procedure` が同じものを 1 つにまとめ、読み上げを改行でつないだもの。`procedure` を省略したステップは、直前のステップと同じ扱い。書き方は [scenario-guide.md](scenario-guide.md) の「as_info の procedure との対応」を参照。
- `procedure` のないステップは YAML に含めない。
- `judgment` は空欄で出力するので、人間が `○` などを書き込む。

## ログから YAML だけを生成する

実行済みのログのディレクトリを指定して、YAML だけを生成できる(ブラウザー操作はしない)。ログ内の `<testId>.jsonl` ごとに 1 件作り、`date` はログの時刻から取る。

```
pnpm as-info logs/run-<タイムスタンプ>
```

同じログで 2 回実行すると、別の `id` で重複して作られる。
