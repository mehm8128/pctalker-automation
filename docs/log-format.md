# ログの形式

ログは実行ごとのディレクトリに、シナリオごとの JSONL(`<testId>.jsonl`)として出力する。各行が JSON: `time`, `type`, `index`, `name`, `keys`, `presses`, `speech`(取得した読み上げ), `reached`/`stalled`。

w3c.org を操作したときの出力例(抜粋、`time` と `type` は省略):

```jsonl
{"index":0,"name":"[H] 次の見出しへ","keys":["h"],"presses":1,"speech":["見出し レベル1 ..."]}
{"index":1,"name":"[H] 次の見出しへ(Working with stakeholders of the web)","keys":["h"],"presses":2,"speech":[" 見出し "," メインランドマーク Working with stakeholders of the web 見出しレベル2 "],"reached":true}
{"index":2,"name":"[H] 次の見出しへ(TPAC 2026)","keys":["h"],"presses":1,"speech":["TPAC 2026 見出しレベル2 "],"reached":true}
{"index":4,"name":"[Shift+H] 前の見出しへ(TPAC 2026)","keys":["shift","h"],"presses":1,"speech":["TPAC 2026 見出しレベル2 "]}
{"index":6,"name":"[U] 次のリンクへ(E-commerce)","keys":["u"],"presses":9,"speech":["日本語ホームページ ","简体中文首页 ","Search ","Sign in ","standards and guidelines ","privacy ","security ","Read more about W3C ","E-commerce "],"reached":true}
```

`until` を指定したステップは、目的の読み上げが出るまでキーを繰り返す(`presses` が押下回数、`speech` が各回の読み上げ)。
