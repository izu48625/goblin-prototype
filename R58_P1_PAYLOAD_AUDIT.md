# STATS MAKER R58-P1｜公開作品ページの不要転送削減

基準：2026-10-16、R57後の正式 main `0879213d1de9beca12a75b7c9b9b529f3199f7d0`。
対象：`cloud/public.js`、`public.html`。DB schema／RLS／Auth／評価データは変更しない。

## 変更
公開作品ページの `sb.from('topics').select('*',...)` を必要13列＋同じ2リレーションの明示取得へ変更：

- `id, owner_id, title, description, score_scale, weighted, visibility`
- `allow_ratings, show_community, source_topic_id, published_at`
- `snapshot, snapshot_updated_at`
- `topic_items(id,name,position,image_url)`
- `criteria(id,name,weight,position)`

使用しない検索専用の `discover_search_text_ja` / `discover_search_text_en`、余分なメタデータ列を送らない。スナップショット（表示・Remixに必要）は維持。
派生元・Remix数・Community集計の既存クエリ、匿名認証、権限判定、保存データの互換性は変更しない。
古いページJSのキャッシュ継続を避けるため、`public.html` のJS/CSS参照キーを同じ新キーに更新。R38の旧キャッシュ・UI検証も併せて更新した。

## 数値（本番DB上の**読み取り専用** SQL計測）
2026-10-16時点。公開作品を含む topics 11レコードの**親レコードJSON**合計。
関係テーブル2件・HTTPヘッダー・通信圧縮・TLSなどは含まない。

| 指標 | R57従来 | R58-P1投影相当 | 差 |
|---|---:|---:|---:|
| JSONの総バイト数 | 38,525 B | 23,111 B | -15,414 B |
| 相対削減 | — | — | **約40.0%** |

比較方法：`octet_length(to_jsonb(t)::text)` に対し、実際の選択列を `jsonb_build_object` で組み立てたJSONのバイト長をSQLで計測。
プロパティ並びなどの差は無視できるが、PostgREST通信の**実測バイト**とは異なる。ブラウザ通信の実測は追跡課題。

## QAゲート
- 専用 `scripts/r58-public-projection-qa.mjs` で使用列の完全性・wildcard/生成列排除・キャッシュキー整合性。
- Chromium / WebKit（390×844）でMock SupabaseによるPublic・Unlisted・Private（匿名拒否／所有者許可）、40×10、Community、画像共有モーダル。
- 既存 `r38-p15` (公開スコア)、`r37-visibility-ui`（公開範囲）、`r38-p17`（静的/SEO/広告/GA4保護）、`r38-p4`（旧UI/色/キャッシュ）を回帰。
- GitHub CI成功を確認してからPRをmainへマージ。Production Smokeはmainデプロイ後にGET-onlyで実施。

## 未解決・次工程
R58-P2: Turnstile→Worker gateway→匿名Auth→Supabase RPCの全経路同時評価（隔離環境のみ）。
R58-P3: Supabase DB/Egress、Worker request/day、429/5xx、Discover p95、Community失敗率の無料枠予算監視。
R58-P4: 1k/10k/50k/100k作品 × 同時1/5/20/50の隔離負荷。多地域／異なるisolateの本番性能はまだ保証しない。
費用プラン・実広告配信・GA4は現状維持。