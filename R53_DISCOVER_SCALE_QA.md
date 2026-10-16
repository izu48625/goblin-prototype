# STATS MAKER｜R53 同時アクセス・作品増大への段階的耐性強化

開始時点 main: `555b34dba8528e363ad5fd3c223f85a1f669a5de`（2026-10-16）  
正式サイト: https://statsmaker.app/  
既存の R41〜R43 集計カウンター、GIN trigram 検索索引、先頭ページの20秒IDキャッシュは**導入済み**。機能を重複実装しない。

## R53 A｜本番へ反映する低リスク改善

- `worker/discover-public.js`：先頭ページの `newest` / `popular`、空の検索・全カテゴリ条件のみ、**同一Worker isolate内の同時キャッシュミス**について1つのフルランキングRPCへ集約する（best-effort single-flight）。
- 先頭のリクエスト（owner）は既存通り新規DBレスポンスを利用。後続（joiner）は共有された結果の**IDだけを使い**、実際に返す前に `discover_public_cards_by_ids_v1` で**現在のPublic公開状態と内容を再取得**。Private／Unlistedへの変更後に古い本文を返さない。変わっていれば通常の全検索を再実行する。
- Cache APIには引き続きID・総数・ページ情報だけを20秒保存し、非公開データ・トークン・投稿内容は保存しない。
- ネットワーク／DB失敗後は in-flight エントリを必ず消す。DB・認証・rate limit・広告設定・スキーマは変更しない。
- 既存 `scripts/r43-discover-gateway-qa.mjs` の過去の安全性テストと新規 `scripts/r53-discover-burst-qa.mjs` にて、**50件の同時キャッシュミス**、PublicからPrivateへの変更、503後の復旧をテストする。
- **効果の限界**：同一isolate内の重い全スキャンの重複を抑えるだけ。複数isolate・データセンターをまたぐ集約はできず、後続の公開権限確認はDBへ1回/要求。実際の同時訪問者数の無制限化を保証しない。

## R53 B｜本番には適用しないSQL候補

`R53_DISCOVER_LATE_HYDRATION_CANDIDATE.sql` は、検索・絞り込み・ランキング時に大きな `snapshot` JSONBをCTE全体に保持せず、IDと公開日時中心の軽い情報だけを扱い、**決定した12件だけを公開テーブルから再取得**する候補。

- 現在の本番 SQL `discover_public_works_v1` 定義をそのまま隔離環境用の `scripts/r53-baseline-live-discover.sql` に保持し、厳密な JSON 結果比較を実施。
- PostgreSQL 17 GitHub Actions隔離コンテナに **10,000件** の模擬作品（Public、Unlisted、Private混在）を新規生成。現行方式と改善候補の **14ケースの同一JSON・0件の結果の一致**および新着・人気・日本語検索の `EXPLAIN ANALYZE` を比較する。
- **本番Supabaseにテスト作品の登録を行わず、テスト環境のSQLは本番へ向けない。**
- 速さ・データ結果・安定性・公開範囲のすべてを検証した後、別フェーズで本番に短いトランザクション（ロールバック準備あり）を適用するか判断する。改善が乏しければ採用しない。
- DBのページング `offset` と正確な `total` を引き続き求めているため、SQL候補だけでは10万〜100万件で無制限に高速とは言えない。

## 今後の成長時のリスク

1. 公開件数が1万・10万件に増える際の全候補ソート・条件検索・正確な総件数、短い1〜2字の検索、深いoffsetページ。
2. 一度に多数のCommunity投稿を受け取るトリガーカウンター・レート制限・Supabase転送量。
3. R43ゲートウェイがHTTP 503の場合にブラウザが直接Supabase RPCへフォールバックできること。現時点では既存互換性を維持しているが、大規模障害時の負荷拡大は独立した改善対象。
4. 同一IPのユーザーが集中するとWorkerの90回/分レート制限で一部の正当な利用者にも429が出る可能性がある。
5. Cloudflare Workers Freeの動的リクエスト上限、Supabase FreeのDB/転送/MAU制約。静的ファイル配信とWorker実行は別物。課金・プラン変更は本人承認なしには実施しない。

## リリースゲート

- A は `R53` のAPIモック安全性・ブラウザ/40x10/PNG/公開範囲の既存CIを通してからPRをマージ。最新main SHAの Cloudflare build と Production Smoke、Discover本番 GETを確認。
- B は**あくまで候補**。隔離PostgreSQLのベンチマーク比較結果を報告してから、本番適用判断を分ける。
- AdSense所有権メタタグ・GA4 off・利用者作品・既存スコア・RLS/権限は変更しない。
