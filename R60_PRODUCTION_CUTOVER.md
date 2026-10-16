# STATS MAKER｜R60 Public Discover カウンター融合・本番反映

更新日: 2026-10-16 JST。

## ソース / テスト
- PR [#193](https://github.com/izu48625/goblin-prototype/pull/193) main squash merge: `7c7516182ff4f77bce26d3a6189171fdf4acf100`
- 1回目隔離負荷試験 [Actions #38880269092](https://github.com/izu48625/goblin-prototype/actions/runs/38880269092): 4規模すべて成功
- 2回目隔離負荷試験 [Actions #38880738685](https://github.com/izu48625/goblin-prototype/actions/runs/38880738685): 4規模すべて成功
- R60コード: `R60_DISCOVER_FUSED_COUNTS_HELPER.sql` + `R60_DISCOVER_FUSED_COUNTS_RPC_CANDIDATE.sql`
- 復元可能なR59 RPC: `R60_DISCOVER_FUSED_COUNTS_ROLLBACK.sql`

## 本番データベースの安全な移行

2026-10-16：Supabase `ibpdxbeltdwkquowjeay` の migration `r60_discover_public_fused_counter_reads` **成功**。現行R59のDB関数 `pg_get_functiondef` のハッシュが `383a5d7e2ca394d01baa6335fea371d5` であること、新ヘルパー不存在を確認するガードを設けてから、単一トランザクションで適用。

- public `discover_public_works_v1` のシグネチャ変更なし。SECURITY INVOKER・STABLE、既存RLSは不変。
- public `discover_public_rank_pair_v1(uuid)` 1関数を追加。SECURITY DEFINERのまま`public.topics`で **Public確認した作品のカウンターのみ**を返す。それ以外は `[0,0]`。Postgres完全修飾名・`search_path=''`。
- PUBLICへの暗黙EXECUTE許可は明示的にREVOKE。anon/authenticatedだけ実行可。privateスキーマのUSAGEをanon/authenticatedに新たに許可しない。
- 新しいテーブル、索引、課金、広告/GA4、Cloudflare設定変更なし。実データの追加・削除なし。

## 本番確認

本番SQLで現行関数が `with_pairs as materialized` を利用することを検証済み。
`public.topics` 全11件に対して2つの旧カウンター関数と新しいペア関数を照合：**不一致0件**。
`anon_private_usage=false`、`rpc_security_definer=false` を確認。

更新前後、同じアンカーで返却JSONのMD5が全6条件一致：

| 条件 | MD5（前後同一） |
| --- | --- |
| 新着 / JA | `9c639275e4d21b5112db05a45b26297c` |
| 人気順 / JA | `e87e66d9e184383df3bf0af3d0099a12` |
| Community順 / JA | `8d1d1c0e7d882355cb88ee1cf2d34eb6` |
| Remix順 / JA | `a02e49f0fd40f545ec1d1b7a2f9f4749` |
| 日本語1文字 | `8663af779d912ee78d5360ceefeb7f11` |
| 人気順 / EN | `b2a979634f9f4c6fd8fa6e7700deeaf0` |

## 無料の隔離ベンチの結果（実環境ではない）

1k/10k/50k/100k作品でそれぞれ1/5/20/50並列、計2実行。各実行は前後合計1,680件の検索リクエスト、32件の完全JSON比較×4規模、各規模で全作品のカウンター一致・Private/Unlisted分離をPASS、SQLエラー0件。

10万作品50並列のp95：
- 初回 R59 10.764秒 → R60 10.255秒（約4.7%短縮）
- 再試験 R59 16.276秒 → R60 15.271秒（約6.2%短縮）

10万作品5並列のp95：
- 初回 R59 1.454秒 → R60 1.133秒（約22.1%短縮）
- 再試験 R59 2.235秒 → R60 1.870秒（約16.3%短縮）

結論：単発比較のゆらぎがあるが、100k作品の集中条件で再現して改善。一方50並列ではp95が依然10秒以上で、数万人同時操作への耐性を保証しない。今後はページングの一致件数算出や新着順のインデックス利用と、実HTTPを模した別の隔離検証が必要。

## ロールバック

不具合が出た場合、先に本番の現行DB関数定義・権限を確認し、`R60_DISCOVER_FUSED_COUNTS_ROLLBACK.sql` を使用してR59版へ戻す。このファイルは既存テーブル/データを消さず、新ヘルパーのanon/authenticated EXECUTEだけを取り消す。絶対に本番レコード削除や一斉テストを行わない。
