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
