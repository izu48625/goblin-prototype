# STATS MAKER｜R57 大量作品・検索用テキストの事前計算評価

更新日：2026-10-16。正式main開始時：`6ca2490cbe87f3deb48d6af1f585f8d5008b3d70`。

## 仮説
R56では検索1語で二重にJSONBを変換する問題を解消したものの、5万件の高一致検索でDB内部に約2秒の計算時間が残った。
`discover_search_blob_v1(title,description,snapshot,locale)` はIMMUTABLE関数なので、候補として**Postgres 17のSTORED generated columnに日英の正規化済み検索テキストを持つ**。検索時にJSONBを繰り返し展開せずに済み、部分一致のGIN trigram indexを列に付与できる。

## 試験中の候補（本番未適用）
- `R57_DISCOVER_PRECOMPUTED_SEARCH_SCHEMA_CANDIDATE.sql` は `public.topics` に `discover_search_text_ja/en` を `GENERATED ALWAYS AS ... STORED` で2列追加し、公開作品専用GIN trigram indexを2個追加するもの。**書込時にテキスト再生成、ストレージ消費増、既存表書換え・ロックが発生するため、本番には未実施**。
- `R57_DISCOVER_PRECOMPUTED_SEARCH_RPC_CANDIDATE.sql` は現在のR56と同じ検索ロジックのまま、検索対象テキストを前計算済み列から読み取る候補。公開範囲チェック、総件数、sort、offset、JA/EN APIの形は維持する。
- 隔離PostgreSQL 17にPublic/Unlisted/Private混在50,000作品を生成し、28条件の全文JSON一致、1語/2語/英語のEXPLAIN時間、実更新時の再計算、Private非露出、追加のDB格納サイズを確認。
- Search Console・AdSense・実広告・GA4・プラン・課金・本人の既存作品には変更を加えない。
- **費用を伴う作業は行わない。** 本番での列追加・インデックス二重保持はストレージ増加に直結するため、結果を見て必要性・追加容量・適用時ロックと復旧方法を検討する。最適化が効果を出さない場合は採用しない。

## 判定
隔離データの計測が出るまでは **「未検証・本番未適用」**。28/28一致、Private隔離、更新時整合性、明らかな性能改善、コスト/容量・可用性の安全性が条件。本番での勝手な大量データ投入・高頻度アクセスは行わない。

## 残るリスク
5万作品の検索で最初の単語が数万候補に一致すると、並び替え/件数/人気カウンターも重くなる。生成列で改善しても数万人同時に高速とは言えない。Cloudflare Worker、Supabase FreeのEgress/DB、Community経路負荷、iPhone OSの保存等は別検証。
