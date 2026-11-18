# pctalker-automation

robotjs によるキー送信と、PC-Talker の「直前の読み上げをコピー」(Ctrl+Alt+S)を使い、PC-Talker を自動操作して読み上げログ(JSONL)を残すクライアント。

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
実行すると、最初の 1 回だけ `--delay`(既定 5 秒)のあいだ待つので、その間にブラウザのページをクリックしてフォーカスを移す。キーはフォーカス中のウィンドウに送られる。

## 設定ファイルと as_info への出力

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

シナリオが終わるたびに、結果を `<as_info_path>/src/content/results/` 配下へ as_info の形式の YAML として書き込む。

- `id` は既存ファイルの最大値 + 1 を自動採番し、100 件ごとのグループに振り分ける(例: id 712 → `0701/0712.yaml`)。
- `test` は `testId` から `WAIC-TEST-` を除いたもの。
- `contents` の `procedure` はステップ名、`actual` は読み上げ。
- `judgment` は空欄で出力するので、人間が `○` などを書き込む。
- as_info を直接書き換えるので、実行前に as_info の git の状態を確認する。

## シナリオ

各ステップは次を持つ。キー名は robotjs の表記。PC-Talker のショートカットキーは[マニュアル](https://pctalker.net/download/manuals/pctalker.neo/pctalker_manual.pdf)で確認する。

- `keys`: 修飾キー→通常キーの順に押下する。
- `until`: 読み上げにその文字列が出るまでキーを繰り返す(任意、最大 `maxRepeat` 回、既定 10)。出なければ失敗扱い。同じ読み上げが 3 回続くと、キーが効いていないとみなして打ち切る(`stalled: true`)。
- `waitMs`: 読み上げが前回から変わるまで待つ上限(既定 1500ms)。ページ遷移など遅いステップだけ増やす。トップレベルにも指定できる。
- `copy`: `false` で、キーを送って `waitMs` 待つだけにし、コピーしない。連続読み上げ(`Ctrl+Alt+K` など)の後は、コピー用の Win キーでスタートメニューが開くため指定する。
- `copyLog`: `true` で、音声ログ全件(Ctrl+Alt+Win+S、最大 20 件)を取得する。

キー送信後、読み上げが前回のステップと変わるまでコピーを繰り返し、変わったら、その読み上げを採用する。読み上げが前回と同じになるステップは、上限まで待ってから同じ内容として扱う。クリップボードの読み取りは、常駐させた Windows の PowerShell で行う。

例: as_test の `scenarios/<ID>/pc-talker.json`

書くときの注意点は [docs/scenario-guide.md](docs/scenario-guide.md) を参照。

## ページ全文がコピーされる場合

ブラウザーでは Ctrl+Alt+S が「ページ全体のコピー」になり、読み上げではなくページ全文が記録される。
そのため CLI の既定は `--copy log` で、音声ログ(Ctrl+Alt+Win+S)の最終行を読み上げとして記録する。
Ctrl+Alt+S が使える環境では `--copy last` を指定する。

```
pnpm run-scenario --copy last
```

## ログ

各行が JSON: `time`, `type`, `index`, `name`, `keys`, `presses`, `speech`(取得した読み上げ), `reached`/`stalled`。

w3c.org を操作したときの出力例(抜粋、`time` と `type` は省略):

```jsonl
{"index":0,"name":"[Home] 仮想カーソルをページの先頭へ","keys":["home"],"presses":1,"speech":["Skip to content "]}
{"index":1,"name":"[H] 次の見出しへ(Working with stakeholders of the web)","keys":["h"],"presses":2,"speech":[" 見出し "," メインランドマーク Working with stakeholders of the web 見出しレベル2 "],"reached":true}
{"index":2,"name":"[H] 次の見出しへ(TPAC 2026)","keys":["h"],"presses":1,"speech":["TPAC 2026 見出しレベル2 "],"reached":true}
{"index":4,"name":"[Shift+H] 前の見出しへ(TPAC 2026)","keys":["shift","h"],"presses":1,"speech":["TPAC 2026 見出しレベル2 "]}
{"index":6,"name":"[U] 次のリンクへ(E-commerce)","keys":["u"],"presses":9,"speech":["日本語ホームページ ","简体中文首页 ","Search ","Sign in ","standards and guidelines ","privacy ","security ","Read more about W3C ","E-commerce "],"reached":true}
```

`until` を指定したステップは、目的の読み上げが出るまでキーを繰り返す(`presses` が押下回数、`speech` が各回の読み上げ)。
