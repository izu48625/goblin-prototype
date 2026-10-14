# STATS MAKER｜R47 People-first SEO 実装結果

更新: 2026-10-14
リポジトリ: `izu48625/goblin-prototype`
R46 Search Console の本人操作とは独立した R47 ブランチ作業。

## 目的
検索キーワードをただ増やすのではなく、訪問者が「グラフを選ぶ」「作る」「PNGを保存する」を自分で実行できる説明を日英で追加する。

## 追加したページ
- `/ja/chart-guide.html`：Radar / Ranking Card / Tier List / Bar / Dot / Scatter / Quadrant の選び分け、架空の3チームの10点満点スコア、同点・評価基準の読み方、編集手順。
- `/en/chart-guide.html`：英語独自の説明。日本語作品やユーザーデータを機械翻訳したと偽らない。
- `/ja/png-guide.html`：グラフ作成→PNG出力→iPhone Safari等の保存先の注意、PNGと編集データ・作品URLの違い。
- `/en/png-guide.html`：英語版のPNG／共有／バックアップ説明。

両言語の紹介ページ `/ja/`, `/en/` から各ガイドへの文脈に沿った内部リンクを設置。ガイド相互・Home・Discover・規約・問い合わせへのリンクも維持。

## SEOの設定
- ガイドごとに異なる `title`, `meta description`, ひとつの `h1`、自然な `h2` と本文、canonical と相互 hreflang（ja/en/x-default）。
- 静的サイトマップ `/sitemap-static.xml` に4ページを追加。`/sitemap.xml` は従来通りインデックスのまま。
- Private／Unlistedの作品の掲載ルールは変更しない。検索用ページに実ユーザーの評価・本人画像をコピーしない。
- 架空スコアであることを明記し、実在チームの統計であるとの誤認を避ける。
- GA4はR45方針の通り停止。AdSenseコード、認証、料金の追加なし。

## 自動テスト
`npm run build:cloudflare && node scripts/r47-seo-guides-qa.mjs`：
各ガイドの実体と配信バンドル、lang、canonical、日英hreflang、主要リンク、プライバシー・問い合わせ、重複タイトル、サイトマップ、解析・広告スクリプトを検査。

## 完了ではないこと
- Google Search Consoleの登録・サイトマップ送信・インデックス登録確認・実際の検索クエリ分析はR46（別チャットの本人操作）に残る。
- 検索流入や順位の増加は未測定。順位やAdSense合格は保証しない。
- 画像を端末の写真アプリへ直接保存できるかなど、物理iPhoneのOS依存動作は未検証。
- 実際の検索クエリが集まったら、キーワードを羅列せず成果と検索意図に基づき改善する。
