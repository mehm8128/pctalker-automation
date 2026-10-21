# pctalker-automation

ARIA-AT の [aria-at-automation-driver](https://github.com/bocoup/aria-at-automation-driver) の WebSocket(キー送信)と、PC-Talker の「直前の読み上げをコピー」(Ctrl+Alt+S)を使い、PC-Talker を自動操作して読み上げログ(JSONL)を残すクライアント。

## 前提(Windows)

1. Node 22 と pnpm 12 を使う(`mise install` で `mise.toml` の版が入る)。ソースは TypeScript で、Node 22.18 以降ならそのまま実行できる。Node 23 以降では `@bocoup/windows-sapi-tts-engine-for-automation` の postinstall が失敗する。
2. `robotjs` は Windows ではソースからビルドされるため、Visual Studio Build Tools(C++)、Python、`node-gyp`(`npm i -g node-gyp`)が必要。
3. `pnpm install` を実行する(`@bocoup/windows-sapi-tts-engine-for-automation` が devDependencies に入っており、`pnpm-workspace.yaml` の `allowBuilds` で `robotjs` などのビルドを許可済み)。
4. 別のターミナルで `pnpm at-driver` を実行して at-driver を起動する(キー送信にだけ使う。Bocoup 音声の設定は不要)。
5. ブラウザで対象ページを開いておく。

## 実行

```
pnpm install
pnpm at-driver   # 別ターミナルで起動したままにする
pnpm run-scenario w3c
```

シナリオ名の指定は必須(例: `pnpm run-scenario w3c` で `scenarios/w3c.json`)。パス付きでも指定できる。`--out` を省略すると `logs/run-<タイムスタンプ>.jsonl` に出力する。
実行すると `--delay`(既定 5 秒)のあいだ待つので、その間にブラウザのページをクリックしてフォーカスを移す。キーはフォーカス中のウィンドウに送られる。

## シナリオ

各ステップは次を持つ。キー名は robotjs の表記。PC-Talker のショートカットキーは[マニュアル](https://pctalker.net/download/manuals/pctalker.neo/pctalker_manual.pdf)で確認する。

- `keys`: 修飾キー→通常キーの順に押下する。
- `expect`: 読み上げに含まれるべき文字列(任意)。含まれなければ `pass: false`。
- `until`: 読み上げにその文字列が出るまでキーを繰り返す(任意、最大 `maxRepeat` 回、既定 10)。出なければ失敗扱い。同じ読み上げが 3 回続くと、キーが効いていないとみなして打ち切る(`stalled: true`)。
- `waitMs`: 読み上げが前回から変わるまで待つ上限(既定 1500ms)。ページ遷移など遅いステップだけ増やす。トップレベルにも指定できる。
- `copy`: `false` で、キーを送って `waitMs` 待つだけにし、コピーしない。連続読み上げ(`Ctrl+Alt+K` など)の後は、コピー用の Win キーでスタートメニューが開くため指定する。
- `copyLog`: `true` で、音声ログ全件(Ctrl+Alt+Win+S、最大 20 件)を取得する。

キー送信後、読み上げが前回のステップと変わるまでコピーを繰り返し、変わったら、その読み上げを採用する。読み上げが前回と同じになるステップは、上限まで待ってから同じ内容として扱う。クリップボードの読み取りは、常駐させた Windows の PowerShell で行う。

例: `scenarios/w3c.json`

書くときの注意点は [docs/scenario-guide.md](docs/scenario-guide.md) を参照。

## ページ全文がコピーされる場合

ブラウザーでは Ctrl+Alt+S が「ページ全体のコピー」になり、読み上げではなくページ全文が記録される。
そのため CLI の既定は `--copy log` で、音声ログ(Ctrl+Alt+Win+S)の最終行を読み上げとして記録する。
Ctrl+Alt+S が使える環境では `--copy last` を指定する。

```
pnpm run-scenario w3c --copy last
```

## ログ

各行が JSON: `time`, `type`, `index`, `name`, `keys`, `presses`, `speech`(取得した読み上げ), `reached`/`stalled`/`pass`。

`pnpm run-scenario w3c` で https://www.w3.org/ を操作したときの出力例(抜粋、`time` と `type` は省略):

```jsonl
{"index":0,"name":"[Home] 仮想カーソルをページの先頭へ","keys":["home"],"presses":1,"speech":["Skip to content "]}
{"index":1,"name":"[H] 次の見出しへ(Working with stakeholders of the web)","keys":["h"],"presses":2,"speech":[" 見出し "," メインランドマーク Working with stakeholders of the web 見出しレベル2 "],"reached":true,"pass":true}
{"index":2,"name":"[H] 次の見出しへ(TPAC 2026)","keys":["h"],"presses":1,"speech":["TPAC 2026 見出しレベル2 "],"reached":true,"pass":true}
{"index":4,"name":"[Shift+H] 前の見出しへ(TPAC 2026)","keys":["shift","h"],"presses":1,"speech":["TPAC 2026 見出しレベル2 "],"pass":true}
{"index":6,"name":"[U] 次のリンクへ(E-commerce)","keys":["u"],"presses":9,"speech":["日本語ホームページ ","简体中文首页 ","Search ","Sign in ","standards and guidelines ","privacy ","security ","Read more about W3C ","E-commerce "],"reached":true,"pass":true}
```

`until` を指定したステップは、目的の読み上げが出るまでキーを繰り返す(`presses` が押下回数、`speech` が各回の読み上げ)。
