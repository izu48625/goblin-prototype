# STATS MAKER R64｜一括カウンター関数をREST非公開スキーマに隔離する

更新：2026-10-16。R63の10万作品×50並列のp95は16.09秒→10.38秒（35.5%短縮）。ただしR63では `public.discover_public_rank_rows_v1()` をanonが直接呼べるため、本番未採用だった。

## R64構成

- 新規 `discover_internal` **独立・REST非公開スキーマ**。既存の `private` スキーマへのanon権限は一切追加しない。
- 一括集計を `discover_internal.discover_public_rank_rows_v1()` に移す。SQL上はPublic限定、`show_community=false`の参加者数0、Private/UnlistedのIDも数値も返さない。`SECURITY DEFINER SET search_path=''`、SQLは完全修飾。
- スキーマは既存`public` Data APIの **Exposed schemasに追加しない**。anon/authenticatedは専用空スキーマのUSAGEとヘルパーのEXECUTEだけ、CREATE不可。新スキーマにテーブル・他のヘルパーは置かない。
- `public.discover_public_works_v1` は従来どおり `SECURITY INVOKER` / RLSを維持し、SQL内から完全修飾の内部ヘルパーを呼ぶ。外部から見えるRPCの名前、入力、返却JSON、ソート、厳密total/has_moreを変更しない。
- R63の`public.discover_public_rank_rows_v1`は**作らない**。ただしanonが任意SQLを直接実行できる仕組みを別途提供している場合は内部ヘルパーに届き得る（REST非公開=DB実行権の剥奪ではない）。また将来Exposed schemasにdiscover_internalを追加すれば直アクセスできるため、必ず非公開を維持する。

## 必須隔離QA

1. PostgreSQL17使い捨てDB、Public/Unlisted/Private混合1k/10k/50k/100k作品を使用し、32条件の完全JSON一致、全Publicカウント一致、公開取り消し直後の非表示を検査。
2. `anon` の `private` USAGEはfalse、`discover_internal`はUSAGE true, CREATE false、public内にバルクRPCが存在しないこと。
3. **実際のPostgREST**（DB_SCHEMAS=public）でPublic Discover RPCがHTTP200、同一名称の直呼び`/rpc/discover_public_rank_rows_v1`がHTTP404、`Accept-Profile: discover_internal`がHTTP406を検査。
4. 同じ無料Actionsの前後負荷試験：1/5/20/50並列×1k/10k/50k/100k。4ジョブ完了まで本番適用しない。
5. 本番反映はSupabase Data APIの**実際のExposed schemas**を確認でき、保護設定とロール権限/戻し方を検証してから。Supabase/Cloudflare Free継続、本番へ負荷アクセスや大量作品投入をしない。

## 対応可能なリスクと限界

Publicデータのみでも匿名ユーザーが公開Discover検索を連打すればDB負荷は発生する。Worker `/api/discover` の既存レート制限を維持するが、DB REST RPC直アクセスも既存の公開契約なので、HTTPのレート制限をこれだけで完全保証しない。PostgRESTテストは`public`のみを露出したローカル構成であり、Supabase本番Exposed schemas設定の代替検証とはならない。

## 実測

GitHub Actions `R64 Unexposed Ranking Helper HTTP and Load`。実測後に結果を追記。

## 隔離試験完了（2026-10-16）

[GitHub Actions #38886435786](https://github.com/izu48625/goblin-prototype/actions/runs/38886435786) **4/4ジョブ成功**。1k/10k/50k/100kそれぞれ1/5/20/50並列。各規模210×2件、合計**1,680件の負荷クエリ全成功（エラー0）**。32条件の完全JSON一致×4規模、全公開作品の参加者/Remix数、Private/Unlistedの非表示、Public→Privateへの変更直後の集計除外が成功。

最も重要なAPI実機確認：使い捨てPostgREST v14.18（公開スキーマ=public）を接続し、Discover RPC **HTTP200**、一括集計関数の公開RPC直接アクセス **HTTP404**、`Accept-Profile: discover_internal` は **HTTP406** を確認。

|作品数|50並列 R60 p95|50並列 R64 p95|短縮|
|--:|--:|--:|--:|
|1,000|768.29ms|851.69ms|**-10.9%（悪化）**|
|10,000|1,866.92ms|1,733.30ms|+7.2%|
|50,000|8,445.07ms|5,783.15ms|**+31.5%**|
|100,000|15,842.87ms|10,167.47ms|**+35.8%**|

100kでは1並列802.31→415.10ms（48.3%短縮）、5並列1,829.03→965.20ms（47.2%短縮）、20並列5,840.45→3,592.52ms（38.5%短縮）。小規模50並列が悪化する条件を隠さず、費用無料・検証ハードウェアの変動に留意する。

### セキュリティと採用制約

**PostgRESTでdiscover_internalスキーマが公開されていないことが安全条件。** SQL権限だけではバルク関数へのDB直接実行を完全に防げない。Project本番の「Exposed schemas」を検証できない場合はカットオーバーを保留。公開スキーマに関数を置かない設計でも、将来の管理者が内部スキーマを公開した場合にはAPIアクセス可能になるため運用文書に禁止を明記。

Supabaseの公式ドキュメント：`https://supabase.com/docs/guides/api/using-custom-schemas` と `https://supabase.com/docs/guides/database/postgres/row-level-security`。本番に負荷試験はしない。GitHub Actionsの性能がそのまま本番Freeプランの性能ではない。

ロールバック：`R64_INTERNAL_RANK_ROLLBACK.sql`（R60関数復帰＋anon/authenticatedの内部ヘルパー使用権剥奪、データテーブル変更なし）。
