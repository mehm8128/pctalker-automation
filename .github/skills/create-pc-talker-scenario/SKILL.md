---
name: create-pc-talker-scenario
description: AS テスト(WAIC-TEST-xxxx-xx)の PC-Talker 用シナリオ(pc-talker.json)を新規作成・修正・見直しする。「シナリオを作りたい」「シナリオが怪しい」「procedure を書きたい」ときに使う。
---

# PC-Talker のシナリオを作る

書式は docs/scenario-guide.md の「書式」、書き方の注意はその他の節にある。必ず先に docs/scenario-guide.md を読む。回答は常に日本語。

## 手順

1. as_test の `WAIC-TEST/HTML/<ID>.md` を読み、「テスト手順(音声閲覧環境)」と「期待される結果」を確認する。
2. `WAIC-CODE/WAIC-CODE-<番号>.html` を読み、要素の数・順序・`url` の番号を確認する。
3. as_info の `src/content/results/` から、同じテストの過去の YAML(音声閲覧環境)を探し、`procedure` の書き方の例にする。
4. `scenarios/<ID>/pc-talker.json` を書く。書式、`procedure` の書き方・書く前の確認・避けることは docs/scenario-guide.md に従う。
5. 実機で動くかは、エージェントが `pnpm run-scenario` で確かめる。実行前に、ユーザーへ準備(PC-Talker の起動、フォーカス移動)の確認を取る(run-pc-talker-test)。
6. 実行ログを見て、`reached: false` や読み上げの取りこぼしがあれば、シナリオを直し、得られた知見は docs/scenario-guide.md に追記する(スキルには書き足さない)。
