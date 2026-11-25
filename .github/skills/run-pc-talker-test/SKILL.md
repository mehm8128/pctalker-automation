---
name: run-pc-talker-test
description: PC-Talker の AS テストを実行し、結果を as_info の YAML にするまでを案内する。「テストを実行したい」「シナリオを流したい」「judgment を書きたい」「ELIFECYCLE で失敗する」などのときに使う。
---

# PC-Talker のテストを実行する

詳細の手順は README.md の「実行」と docs/as-info.md にある。ここでは流れと、ユーザーに頼むことだけを書く。回答は常に日本語。

実行できるコマンドは、エージェントが実行する。ユーザーに頼むのは、値の決定、ブラウザーへのフォーカス移動、`judgment` の記入だけ。

## 手順

1. `pnpm install` を実行する(README の「前提」)。
2. `config.json` がなければ、`config.example.json` をコピーして作る。`as_info_path`、`scenarios_path`、`user_agent`、`assistive_tech`、`assistive_tech_config`、`tester` のうち、分からない値はユーザーに聞く。JSON の `\` はエスケープが要るので、パスは `/` 区切りにする。
3. as_info の git の状態を確認する(`git status`)。実行すると `src/content/results/` に YAML が追加される(`id` は自動採番)。未コミットの変更があれば、ユーザーに伝える。
4. ユーザーに、PC-Talker が起動していることと、実行中はキーボードやマウスを触らないことを伝え、準備ができたか確認する。準備ができたら `pnpm run-scenario` を実行する(引数にシナリオの JSON かディレクトリを指定すると、設定の `scenarios_path` を上書きできる)。最初の 5 秒(`--delay`)でブラウザーのページをクリックしてフォーカスを移すよう、実行前に伝える。
5. 終了コード 1(`ELIFECYCLE`)なら、`logs/run-*/<testId>.jsonl` で `reached: false` のステップを探し、読み上げと期待を比べて原因を調べる。原因の典型は docs/scenario-guide.md の「避けること」と docs/troubleshooting.md にある。シナリオを直したら、ユーザーに再実行の準備を確認する。
6. 実行後は、YAML の `actual` を確認し、`judgment` を人間が書くよう促す。`judgment` の書き方は、as_info の過去の YAML(同じテストの `contents`)を参照する。判定はエージェントが代わりに書かない。
7. ログだけが残っていて YAML を作り直す場合は、`pnpm as-info <ログのディレクトリ>` を実行する。同じログで 2 回実行すると、別の `id` で重複するので、先に不要な YAML を消す。
