# STATS MAKER｜R61 Discover完全一致件数の重複処理最適化
2026-10-16 作成。対象 [main](https://github.com/izu48625/goblin-prototype) R60（5abcd1719b00d2b8504e5bff6a29335e6033c75f）。

## 問題と変更候補
Discover の `public_only AS MATERIALIZED` → `filtered AS MATERIALIZED` は同じ候補行を一時結果として二重に保持する可能性がある。さらに `total` と `has_more` は同じ `filtered` の正確な `count(*)` をそれぞれ計算する。

`R61_DISCOVER_SINGLE_COUNT_RPC_CANDIDATE.sql` では：
- 1回しか参照されない `public_only` を自動インライン可能なCTEにし、`filtered` は引き続き materialized。
- `filtered_total AS MATERIALIZED(SELECT count(*)::bigint FROM filtered)` を1つだけ設け、`total` と `has_more` の両方で再利用する。
- 利用者へ見せる件数は**推定値・キャッシュ値ではなく、従来と同じ厳密な件数**。
- 人気順/Community順/Remix順、Private/Unlisted除外、検索語の処理、アンカー、レスポンスJSON、グラフ編集や認証は変更しない。
- 新たなインデックス・テーブル・課金・非同期処理は追加しない。先に既存R60との32条件完全JSON互換テストを行う。

## 比較条件
無料のGitHub Actions標準ランナー、完全隔離Postgres 17上で 1k/10k/50k/100k作品 × 1/5/20/50並列、前後210件/作品規模。Private/Unlisted/Public混合、32検索/ページ条件完全JSON一致、全作品の既存カウンター関数との一致、例外/タイムアウト報告とCPUスポット値を確認する。

**重要：** SQLプランが変わって遅くなる場合もある。実験前後の固定順・キャッシュやGitHubランナーの揺れを考慮し、高負荷が再現して改善しなければ本番は変更しない。50件の並列接続＝数万人の実ユーザーではない。本番への一斉アクセスや大量テストデータ投入はしない。

## 状態
まず PR の CI で候補を測定し、数値と採否を追記する。
