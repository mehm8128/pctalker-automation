# pctalker-automation

robotjs によるキー送信と、PC-Talker の音声ログのコピー(Ctrl+Alt+Win+S)を使い、PC-Talker を自動操作して読み上げログ(JSONL)を残すクライアント。

## 前提(Windows)

1. Node 24 と pnpm 12 を使う(`mise install` で `mise.toml` の版が入る)。ソースは TypeScript で、Node 24ならそのまま実行できる。
2. `pnpm install` を実行する(`robotjs` はビルド済みバイナリが使われるため、ビルドツールは不要)。
3. ブラウザで対象ページを開いておく。

## 実行

```
pnpm install
pnpm run-scenario
```

実行するシナリオは、設定ファイルの `scenarios_path` に書く。引数でシナリオの JSON ファイルかディレクトリを指定すると、設定を上書きできる(例: `pnpm run-scenario ..\as_test\scenarios\WAIC-TEST-0001-01\pc-talker.json` で 1 件だけ実行)。ディレクトリを指定すると、直下の `<ID>/pc-talker.json` を ID 順に全て実行する。ログは実行ごとのディレクトリ(`--out` で指定。省略すると `logs/run-<タイムスタンプ>`)に、シナリオごとのファイル(`<testId>.jsonl`。`testId` がなければファイル名やディレクトリ名)として出力する。

シナリオの `url`(必須)を既定のブラウザーで開き、`testId` / `title` があればログに記録する。`until` に着かなかったシナリオは、そこで打ち切って次のシナリオへ進む。各シナリオが終わると `Ctrl+W` でそのタブを閉じる(フォーカスが別ウィンドウにあると、そちらのタブが閉じる)。
実行すると、最初の 1 回だけ `--delay`(既定 5 秒)のあいだ待つので、その間にブラウザのページをクリックしてフォーカスを移す。キーはフォーカス中のウィンドウに送られる。各シナリオでは、`url` を開いた後に `--load-wait`(既定 4 秒)だけ、ページの読み込みを待つ。

実行が終わったら、as_info の `src/content/results/` に書き込まれた YAML を開き、`actual` を確認して `judgment`(`満たしている` / `満たしていない` など。過去の YAML を参照)を人間が書く。

## ドキュメント

- [docs/scenario-guide.md](docs/scenario-guide.md): シナリオの書式と書き方。シナリオの例は as_test の `scenarios/<ID>/pc-talker.json`
- [docs/as-info.md](docs/as-info.md): 設定ファイル(`config.json`)、as_info への YAML 出力、`pnpm as-info`
- [docs/log-format.md](docs/log-format.md): ログ(JSONL)の形式
- [docs/troubleshooting.md](docs/troubleshooting.md): 失敗の扱いと待ち時間