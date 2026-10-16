# STATS MAKER｜R59 Discover Top-K 本番反映・検証記録

更新：2026-10-16 JST。

## ソース

- PR #192: https://github.com/izu48625/goblin-prototype/pull/192（squash merge済み）
- 最初の比較テスト run 38878259623: https://github.com/izu48625/goblin-prototype/actions/runs/38878259623
- 再実行では11/11チェック成功、100,000作品までの隔離DB試験と32ケースJSON完全一致を確認
- GitHub main merge SHA: `d093251895874648594f2d3ddf6f82ae596cf72a`
- SQLソース: `R59_DISCOVER_TOPK_RPC_CANDIDATE.sql`
- 復旧用: `R59_DISCOVER_TOPK_ROLLBACK.sql`
- 性能詳細: `R59_TOPK_EVALUATION.md`

## 本番の非破壊適用

Supabase Freeプロジェクト `ibpdxbeltdwkquowjeay` に `r59_discover_topk_page_before_row_number` migrationを実施（成功）。
新しいテーブル・インデックス追加なし。既存 `discover_public_works_v1` のSQL本体のみ `CREATE OR REPLACE FUNCTION` で更新。
事前関数定義MD5 `5c39d1ac810accf2fc228c31617c7057` に合致しなければ中止するガード付き。
関数は `SECURITY INVOKER` のまま（`prosecdef = false`）、`STABLE` のまま（`provolatile = s`）、実行後 `numbered_page as materialized` を確認済み。

## 本番データとの互換性（実施済）

同一アンカー `2026-10-16 00:00:00+00` を使用し、更新直前と直後にPublic Discoverの実応答 JSON MD5を比較。**全3条件が完全一致**。

|ケース|更新前MD5|更新後MD5|一致|
|--|--|--|--|
| newest / 空検索 | `9c639275e4d21b5112db05a45b26297c` | 同一 | PASS |
| popular / 空検索 | `e87e66d9e184383df3bf0af3d0099a12` | 同一 | PASS |
| newest / 日本語1文字 | `8663af779d912ee78d5360ceefeb7f11` | 同一 | PASS |

注意：本番には当時11作品しかなく、このデータで数万件の同時利用性能を検証したわけではない。性能差はGitHub Actions上の隔離PostgreSQL17で測定したものである。

## 効果と残る問題

- 100k作品50並列のローカルp95は 16.65s→14.81s（11.1%短縮）。
- 50k作品50並列は9.46s→8.49s（10.2%短縮）。
- 1k/10k作品では横ばいか悪化する条件も存在。効果を保証するものではない。
- 本命はPopular/Communityの行単位カウンタ処理と検索一致件数算出の最適化。
- 本番サイトへ大量アクセスを送信していない。有料設定、実広告、GA4、認証設定、DB構造、実データの削除・変更なし。

## 障害時のロールバック

本番RPCの不具合が確認された場合、`R59_DISCOVER_TOPK_ROLLBACK.sql` にあるR57の `CREATE OR REPLACE FUNCTION` へ戻す。
適用前に現行の `pg_get_functiondef` と移行履歴を確認し、想定外の第三者変更があれば自動的に上書きしない。
