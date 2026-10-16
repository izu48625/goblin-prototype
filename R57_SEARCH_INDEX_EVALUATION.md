# STATS MAKER｜R57 大量作品・検索用テキストの事前計算評価

更新日：2026-10-16。正式main開始時：`6ca2490cbe87f3deb48d6af1f585f8d5008b3d70`。

> **最新結果（2026-10-16）：** 50,000作品に対して日本語1語1941→109ms、2語2783→116ms、英語人気順2389→460ms。28条件の返却JSON一致・更新後検索一致・Private隔離に合格し、**本番Supabaseに検索用生成列2個と専用GIN索引2個を適用済み**。RPC切替後の28条件一致も確認し、重複する旧索引2個を削除。DB全体は約12MB・Freeプラン維持。詳細は [R57本番適用記録](R57_PRODUCTION_CUTOVER.md)。以下の「候補」「未実施」は開発時点の検証計画を記録したもの。

## 仮説
R56では検索1語で二重にJSONBを変換する問題を解消したものの、5万件の高一致検索でDB内部に約2秒の計算時間が残った。
`discover_search_blob_v1(title,description,snapshot,locale)` はIMMUTABLE関数なので、候補として**Postgres 17のSTORED generated columnに日英の正規化済み検索テキストを持つ**。検索時にJSONBを繰り返し展開せずに済み、部分一致のGIN trigram indexを列に付与できる。

## 隔離試験当時の候補（現在は本番適用済み）
- `R57_DISCOVER_PRECOMPUTED_SEARCH_SCHEMA_CANDIDATE.sql` は `public.topics` に `discover_search_text_ja/en` を `GENERATED ALWAYS AS ... STORED` で2列追加し、公開作品専用GIN trigram indexを2個追加するもの。**書込時にテキスト再生成、ストレージ消費増、既存表書換え・ロックが発生するため、本番には未実施**。
- `R57_DISCOVER_PRECOMPUTED_SEARCH_RPC_CANDIDATE.sql` は現在のR56と同じ検索ロジックのまま、検索対象テキストを前計算済み列から読み取る候補。公開範囲チェック、総件数、sort、offset、JA/EN APIの形は維持する。
- 隔離PostgreSQL 17にPublic/Unlisted/Private混在50,000作品を生成し、28条件の全文JSON一致、1語/2語/英語のEXPLAIN時間、実更新時の再計算、Private非露出、追加のDB格納サイズを確認。
- Search Console・AdSense・実広告・GA4・プラン・課金・本人の既存作品には変更を加えない。
- **費用を伴う作業は行わない。** 試験時点ではストレージ増とテーブルロックを評価。R57本番適用後は旧索引を整理済み。追加課金は行っていない。

## 判定
R57開発開始時点の判定は **「未検証・本番未適用」** だったが、隔離試験後に本番適用済み。28/28一致、Private隔離、更新時整合性、明らかな性能改善、コスト/容量・可用性の安全性が条件。本番での勝手な大量データ投入・高頻度アクセスは行わない。

## 残るリスク
5万作品の検索で最初の単語が数万候補に一致すると、並び替え/件数/人気カウンターも重くなる。生成列で改善しても数万人同時に高速とは言えない。Cloudflare Worker、Supabase FreeのEgress/DB、Community経路負荷、iPhone OSの保存等は別検証。
