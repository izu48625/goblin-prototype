# Stats Maker R67 / R68 | iPhone 仕上げ・運用監査（2026-10-16）

正式URL https://statsmaker.app/ 。GitHub `izu48625/goblin-prototype` / `main`。

## R67 自動化対象

`scripts/r67-mobile-shell-webkit-qa.mjs`（新規）でGitHub Actionsの実際のWebKitを使い、iPhone相当の4画面（320×568、375×560、390×844、430×932）を検証する。

1. グローバルナビ（HOME / Discover / 紹介 / ヘルプ / EN）が画面外に出ない。埋込ホームにナビが重複しない。
2. ヘルプの5リンクが小画面でも画面内に表示され、押せる。
3. 下部の拡張機能ボタンが44px以上のタップ領域を持ち、Homeのスクロール領域を覆わない。
4. タイトル・説明・保存シート・検索・採点表の入力がiOSの自動拡大対策（16px以上）、ホーム全体の横スクロールを強制しない。
5. ローカルのタイトル・スコアを編集→拡張グラフ選択パネルを開閉→値を保持。
6. 拡張パネルのスクロール可能性、画面内レイアウト、10種類以上の機能カード。
7. Supabase実環境へテストデータを送らず、WebKitのスクリプトエラーなし。
8. 既存R36/R38の入力モーダル、PNGプレビューと共有APIモック、40×10の公開スコア横スクロールのテストも回帰実行。

**WebKitのテスト合格は実際のiPhone Safari / iOS共有シート / 写真保存の動作保証ではない。** 物理iPhoneでのPNG写真/ファイル保存、キーボードを出した状態の視認性、サイトを開き直した後のLocalStorage保持は本人による確認が必要。QAのために公開投稿はしない。

## R68 本番運用の読み取り専用監査

2026-10-16 12:44 UTC、Supabase本番に対し個別ユーザー情報を取得しない集計SQLのみを実行。

|観測|件数 / 状態|
|---|---:|
|Public|11|
|Unlisted / Private|0 / 0|
|Public説明文空欄|0|
|「新しいお題」「Untitled」を含む仮タイトル|0|
|通報 `work_reports`|0|
|問い合わせ `contact_inquiries`|0|
|R64専用内部スキーマ|未配備|
|主要テーブルのRLS|topics/topic_items/criteria/rating_sets/scores/work_reports/contact_inquiries **7件すべて有効**|

**注意: 通報/問い合わせ0件は「受信できる」の検証ではない。** 本番テスト投稿は行っていない。運用開始後は管理画面で受信状況を定期的に確認すること。

Supabase Security Advisorには `anon_security_definer_function_executable` 警告が **7件**（R51当時の6件から、新しい`discover_public_rank_pair_v1`を含む）。条件付き匿名集計に必要な関数が含まれるため一律にEXECUTEを取り消してCommunity/Discoverを壊さない。各関数の公開・非公開チェックが漏れないかを別の隔離セキュリティQAで継続監査する。 **警告=実漏えい、という断定はしない。**

## AdSense / SEO / 正式告知

- AdSenseは2026-10-16時点の記録ではサイト所有権確認・審査申請済みだが**審査待ち**。Googleの承認通知を確認できておらず、広告本番配信、広告スクリプト、GA4は無断でONにしない。
- Search Consoleのドメイン認証、サイトマップ送信は2026-10-14本人確認済み。未反映の内容を再申請したと偽らない。検索クエリやCTRの実績は収集待ち。
- 公開作品内容の権利/出典/適切性は、構造検査では判断不可。本人の目視確認と、報告後の削除/修正手順が必要。
- 正式告知用の文章、広告配置、キャンペーン配信はユーザー承認なしに勝手に公開しない。配信者へのDMも送らない。

## 本人ができる最短の実機確認

正式サイトのHOMEで軽い非公開テスト表を作る → PNGプレビューからiOS共有シートを開く → 写真/ファイルに保存 → 実画像で文字重なりを確認 → Safariに戻り入力値を保持 → Discoverで既存公開作品を横スクロール閲覧。**新規のPublic投稿/採点/配信は不要**。

## R69 次工程の優先度

端末QAとAdSense審査の未解決条件は残したまま、集客側では既存の`/ja/chart-guide.html`, `/en/chart-guide.html`, `/ja/png-guide.html`, `/en/png-guide.html`を軸に、**実際のSearch Console検索クエリ/CTRを見て**見出し・リンク・誘導を改善。需要不明なSEOキーワードの大量生成をしない。

今回のR67では**新規有料サービス、Supabase本番DDL/UPDATE、広告稼働、外部への大量アクセスを行わない**。

## QA結果

GitHub Actions `R67 iPhone WebKit Release Contract` で確認。テストの合否はこのPRに紐付ける。
