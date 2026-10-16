# Stats Maker｜R65 無料枠効率化と可視性維持
更新：2026-10-16 JST。対象：`izu48625/goblin-prototype` main。

## 目的と実装
R64の隔離負荷試験では10万作品50並列のp95が約35.8%改善したが、新しいバルク関数を本番に導入するにはSupabase Data APIの`Exposed schemas`実設定の外部確認が必要。**R65はこの承認待ちに依存しないエッジ通信・守りの改善**のみ行う。Supabaseスキーマ/テーブル/DB関数/既存private RLS/無料プランの変更は無し。

1. `worker/seo.js`: `/work/<uuid>`のSEOカード生成のため、`topics.snapshot`全文を取得しない。既存ページで使う最初の**18件の対象名と10件の評価項目**だけをPostgRESTのJSONパス投影で取得し、ページの検索メタ・説明文・比較対象・評価項目・翻訳・見出し・JSON-LDを維持。余計なスコアや画像データはDBからWorkerへ送信しない。公開作品以外は`visibility=eq.public`でfail-closed、`Cache-Control: no-store`を維持。
2. `worker/seo.js` `publicWorkHead`: HEADでHTML内容は不要。公開IDの存在のみをDB照会し、Private/Unlistedは404、DB障害は503。GETは従来のSEO HTML。
3. `worker/index.js` `/api/og`: GETの視認性検査を`id,visibility`に軽量化（Share /p の本文用タイトルなどは保持）。HEADでは**Vercelの画像生成を呼ばず**、現在のPublic/Unlisted可視性のみ照会して200/404を決定し、ボディは作らない。Privateへの変更後はHEADも直ちに404、OG GETは非キャッシュのまま。
4. `/p/<id>`や`/sitemap*.xml`: HEADでは本文をレンダリング・生成せず、後者はDBアクセスも無い。無効なsitemapページ番号は404。
5. `worker/discover-public.js`: 正式サイトの`DISCOVER_RATE_LIMIT`が欠落した場合、これまでのfail-open（無制限にSupabase照会）から**503 fail-closed**へ。限度超過429に`Retry-After: 60`を付与。ローカルプレビューでは従来どおりテスト可能。
6. OG/共有のリミッター障害も予測可能な503でfail-closed。新たな広告やGA4の有効化・有料監視はしない。

## 試験
- `scripts/r65-free-efficiency-qa.mjs`: 全ネットワークモック。公開/非公開/URL限定、SEO HTML、HTMLエスケープ、HEAD Vercel負荷0、サイトマップHEAD DB負荷0、Limiter欠落・障害・429時 Supabase問い合わせ0を検証。
- `scripts/r65-postgrest-projection-qa.sh`: 実際のPostgREST v14.18 と使い捨てPostgreSQL17で、18件の対象名+10件の評価項目がフルスナップショットからの値と一致し、`snapshot`全文が返却されないことを確認。
- 既存`r34-seo-edge-test.mjs`/`r26-edge-test.mjs`/`r37-visibility-edge-qa.mjs`/`r43-discover-gateway-qa.mjs` + 全体の既存回帰・Pagesデプロイ・Production Smokeをチェックする。

## 費用と影響範囲
- Cloudflare Workers Free/Supabase Free/Vercel既存OG先を継続。追加プラン、外部キャッシュ、DB migration、ログ保存基盤、追加計測SDKなし。
- GETのライブ可視性確認を省略する方式（Private化後にSNSカード/タイトルが残る）や、公開作品本文・スコアの永続キャッシュは不採用。
- Freeの制限値は変更できない。Workerリクエスト約10万/日、Supabase容量やEgressは別々に監視。HTTP HEADも**Worker 1リクエスト分**は消費するが、DBペイロードとVercel画像生成の通信は削減。
- R64の本番切替は`Exposed schemas`の明示確認まで保留。

## 試験結果
PR CI・本番の回帰テスト完了後に追記。
