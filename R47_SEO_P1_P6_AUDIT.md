# STATS MAKER｜R47 SEO-P1〜P6 追加監査・改善結果

更新: 2026-10-14（GitHub main R47 #171を起点）
基準: `izu48625/goblin-prototype` / `main`

## SEO-P1：実装済みの状態
- `/ja/`、`/en/` は HTML title / description / H1 / H2 / canonical / 日英hreflang / WebSite JSON-LD / OGP / 内部リンクを実装済み。4つの独立した使い方ページと、/ja・/en 各ページからのガイド導線も実装済み。
- `robots.txt`、sitemap index、静的ページ（新規4ガイドを含む）、Public作品の動的サイトマップが実装済み。
- `/work/<uuid>` は毎回匿名・Public限定でデータ取得し、404/503を適切に返す。Private/Unlistedは対象外で、非公開化後のキャッシュ残存を防ぐためページは no-store。
- /public、/my、/rate 等の非検索用アプリ画面は noindex。作品名・説明文・対象・項目名を HTML と JSON-LD にエスケープする設計。
- 日英ガイドは記事本文と架空の例があり、単なるキーワード羅列ではない。iPhone向けのコンパクトカードCSSは変更不要。
- GA4停止、実AdSense未導入。DNS・GSC設定・本番のUGC保存データは変更しない。

## SEO-P2〜P3：検索結果向け説明
- 日本語タイトル: `無料グラフ作成・比較・ランキング・Tier表 | Stats Maker`
- 英語タイトル: `Free Chart Maker, Radar Charts & Tier Lists | Stats Maker`
- 両言語で meta description、OG title/description、WebSite JSON-LD description を一致させ、実機能（10種の視覚化、PNG保存、Communityへの任意参加）に沿う簡潔な説明へ更新。
- H1のブランドメッセージ、導入文、コンパクトな4つのカードは維持。機能紹介のH2と短いFAQを追加/最適化。
- canonical と相互 hreflang は維持。新しいURLを増産しない。

## SEO-P4：Public作品の説明が空欄のケース
- 公開作品のオーナー説明文がある場合は従来どおり使用し、オーナーの入力もDBも変更しない。
- 説明欄が空の場合のみ、現在Publicとして確認された作品の snapshot.rows / snapshot.criteria の実在名から、自然な日本語・英語の代替説明を生成。
- 存在しないスコア、平均、事実、ユーザーが書いていない評価の根拠、架空の第三者レビューは追加しない。
- 全ての公開表示データに既存のHTMLエスケープを適用し、Private/Unlistedの除外とキャッシュno-storeを保持。

## SEO-P5：テスト
- 既存R34 Edge testsに、日英ともに説明が空欄のPublic作品の紹介文、HTMLエスケープ、非公開除外を追加。
- R47専用QAに、日英 title / OG / WebSite JSON-LD の一致、H1一つ、サイト内ガイドリンク、iPhoneコンパクトカードCSS、GA4無効を追加。
- 既存CI：Cloudflare Preflight、R34 SEO、R38 Safari/WebKit相当、R39/40 Discover、法務/privacyなど。物理iPhone Safari操作は別途。
- GSCの実際の検索クエリ・CTR・順位は「未確認・実績なし」とし、勝手に生成しない。

## SEO-P6：反映・継続分析
- PR作成→全CI確認→mainへの統合→本番スモークテスト→コミットSHA確認。
- 2026年10月14日、GSCの所有権確認・サイトマップ正常処理・日英紹介ページ登録は**本人確認済み**として引継ぎ済み。サイトマップ再送信やDNS TXTの編集をしない。
- 以後はGSC検索パフォーマンス（クエリ／表示回数／クリック数／CTR／順位／国／デバイス）の蓄積を待ち、少なくとも月次でページごとの表示回数とCTRを確認。表示回数が多くCTRが低いページは検索意図とのズレ、流入後に作成ボタンへ移れるかを見直す。
- GA4再開、AdSense導入、検索順位保証、有料機能追加は行わない。

## 注意
検索順位・クリック数改善、Googleのクロール時点や新規URLのインデックス化は第三者要因であり、今回の完了条件には含まれない。
