# Current SEO priorities — R45 (2026-10-14)

GA4 is paused and is **not required for SEO**. Next: register `statsmaker.app` on Google Search Console (free), verify ownership, submit `https://statsmaker.app/sitemap.xml`, then inspect actual search queries, impressions, clicks, CTR and ranking by language/page/country. Search Console domain verification, sitemap submission, and /ja/ plus /en/ indexing are **confirmed by the owner as of 2026-10-14**. Query performance data is still pending. See `R45_SEO_SEARCH_WORDS_ROADMAP.md` for keyword planning. Avoid invented traffic figures or keyword-stuffed pages.

---

# Stats Maker R34 — 日本語・英語SEO／公開作品サイトマップ

更新日: 2026-10-11
運用: GitHub main が唯一の正式ソース。Cloudflare Workers Free と Supabase Free の枠内で運用する。

## 実装範囲

### 日英それぞれの本物の検索用案内ページ

- 日本語 `https://statsmaker.app/ja/`：無料グラフ作成、ランキング、Tier表、比較・評価、10種類のグラフ。
- 英語 `https://statsmaker.app/en/`：free chart maker, rankings, comparisons, rating sheets, radar charts, tier lists, anime/sports/game comparisons 等の実在機能を説明。
- ページ本文も各言語で独立して作成。双方の `rel="alternate" hreflang="ja"/"en"/"x-default"` とcanonicalを整備。
- 日本語・英語の入口から `?lang=ja/en` でHome/Discoverを開き、ローカルの表示言語を明示して引き継ぐ。Google/Appleログインの追加を意味しない。
- ユーザー要望で紹介文・見出し・SEOメタ情報は**維持**し、グラフ4種類の特徴紹介カードのみ省スペース化。共通Homeナビ（HOME｜Discover｜JA/EN）を両言語の紹介ページに適用し、言語切替では `/en/` と `/ja/` を正しく相互移動できるようにする。
- 検索順位の保証や自動翻訳、架空のレビュー／作品数／集計値は掲載しない。

### 一般公開作品（Public）のみSEOインデックス対象

- `https://statsmaker.app/work/<Public UUID>` に、Cloudflare Workerが**公開作品のタイトル・説明・比較対象・評価項目をHTMLとして描画する**ページを用意。
- PublicだけをPostgRESTの `visibility=eq.public` で読み取り、レスポンスは保存せず毎回公開状態を確認する。Ownerが公開→非公開／URL限定へ変えた場合、次回リクエストから404+noindexにする。
- 公開作品の元の言語を `lang` に設定。日本語作品を英語に翻訳したふりをしない。英語投稿の作品は英語で検索されやすい。
- 検索結果の作品ページには、**従来どおりの本物の採点・評価を見る**ための明確なリンクを表示する。検索用ページでは閲覧操作が1クリック必要。既存 `/p/<id>`（SNSカード／旧共有）と `/public?id=<id>`（操作できる閲覧画面）は変更しない。
- `/public` の共通クライアント描画ページ、`/my`、`/rate`、内部編集／埋め込み画面は `noindex` として、URL限定のID等が検索に出ないようにする。
- 作品のタイトルなどのユーザー入力はHTML／JSON-LDともエスケープし、スクリプト注入を防ぐ。WebPage構造化データは実際の内容のみ。

### 自動サイトマップ

- `https://statsmaker.app/sitemap.xml` はサイトマップインデックス。
- `/sitemap-static.xml` に `/ja/`、`/en/`、`/discover`。
- `/sitemap-works-1.xml` 以降に**Public作品だけ**を各200件ずつ、最大250ページまで列挙（超えた場合は拡張仕様を検討）。
- sitemap indexのPublic件数取得は小さな `select=id&visibility=eq.public&limit=1` + `Prefer: count=exact`。複数ページはアクセス時のみ生成。匿名read-only／select列最小／有料サービスなし。
- XMLは正規ドメイン `https://statsmaker.app` 固定。最後の更新日時は実際の公開作品の更新日時を使用。
- `robots.txt` にサイトマップURLを追加。SEO取得失敗時は503、未公開・存在しない作品は404でfail-closed。

## 英語流入を増やすための残作業

1. 本番のHTML・サイトマップ・canonical・robotsを確認し、Publicのみ掲載されていることをQA。
2. **[ ] 未完了：Google Search Console（無料）に `statsmaker.app` を登録し、ドメイン所有権を確認する。** DNS操作や外部アカウント接続はユーザー本人の承認が必要。
   **[ ] 未完了：Search Consoleの「インデックス作成」→「サイトマップ」で `https://statsmaker.app/sitemap.xml` を送信する。** 送信済みではない。送信後にステータスとPublic作品の検索登録状況を確認する。
   **[ ] 未完了：英語・日本語の検索クエリ、掲載順位、表示回数、クリック数の確認を開始する。** GA4のPC保留とは独立して進められる。
3. Search Consoleの検索パフォーマンスで英語・日本語クエリ、表示回数、CTR、掲載順位、国別の流入を観測する。順位・インデックス登録はGoogleが決定し、保証されない。
4. 作品の英語検索を増やすには、**英語で作成された公開作品のタイトル・説明・評価項目**が重要。機械翻訳の大量生成や、英語のキーワードだけを不自然に詰め込まない。
5. AdSense審査前に公開作品の通報・モデレーション・適切な規約・プライバシー・著作権対応などをR35で整える。

## 品質・費用の制約

- Cloudflare Workers Free、Supabase Free。新しい有料サービスなし。
- ブラウザの公開・保存・Community評価、広告プレビュー／R33 GA4コードの実動作は変更しない。
- **GA4はPCで測定IDを取得するまで無効化を維持**（`enabled:false`, `measurementId:''`）。
- プライベート情報とURL限定作品の検索露出を防ぐ。公開データの英語版を捏造しない。
- 自動テスト：サイトマップPublicのみ／非公開noindex、XSS、403等失敗時の非公開、日英hreflang、静的バンドル、本番read-only検証。
