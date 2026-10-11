# R33 無料アクセス解析・利用導線計測

## 現在の状態（2026-10-11：PC操作まで保留）

- ユーザーはGoogle Analyticsの無料アカウント／プロパティを作成し、`https://statsmaker.app` のWebデータストリームも作成済み。
- iPhone SafariのGoogle Analytics初期画面が操作しにくく、ストリームの**測定ID（`G-...`）はまだ取得できていない**。
- **本人がPCで操作できるときに再開**する。Google Analytics管理画面 → 管理 → データ ストリーム → 既存のStats Maker Web → 測定IDを確認して共有。ストリームの追加作成は不要。
- それまでは `cloud/analytics-config.js` の `enabled:false`／測定ID空欄を維持。Google Analyticsへのデータ送信は始めない。Googleアカウント操作・課金・広告配信も進めない。
- 測定ID受領後はプライバシー表示／同意機構を再検証し、ユーザーの有効化承認を得てからテスト・リリースする。作業の詳細は本書「GA4導入前に必要な作業」を参照。
- **次の開発は公開作品のSEOと広告審査の土台**。本件は明示的な再開指示があるまで保留とする。

## 目的

Stats Makerの広告配信開始後に、**流入元 → 最初のページ → Discoverで作品を探す → 公開作品を閲覧 → 自分でも評価／グラフを作る → 公開 → 共有**という導線を改善する。

**追加月額0円**のサービスのみ採用。Supabaseでクリック履歴を収集しない。Cloudflare Workersのリクエスト枠も分析イベントで消費しない。

## 構成（無料）

1. **Cloudflare Web Analytics**（管理画面で後日ユーザーが有効化）：訪問数／流入ドメイン／訪問ページ／パフォーマンス。無料、Cookieを使わない。Workers構成ではCloudflare Web Analyticsで手動表示した beacon snippet/token が必要になる場合がある。ユーザーのCloudflareアカウント内で有効化の要否を確認すること。現時点では未設定。
2. **Google Analytics 4**（無料プロパティをユーザーが作成済み、測定ID未取得）：経路データ探索／ファネル探索／媒体・デバイス別、カスタムイベントによる行動分析。現時点では計測IDがなく **enabled:false**、タグ・ネットワーク通信はゼロ。
3. **AdSense** は別系統。広告表示量や収益データを扱う。実際の収益を広告枠別に確認する場合はAdSenseの実績とGA4の行動指標を組み合わせる。GA4だけで広告売上を自動的に取得できるとは限らない。

## 実装済み（R33）

- `cloud/analytics-config.js`: GA4は明示的に `enabled:false`。測定ID未設定。
- `cloud/analytics.js`: 全主要ページに配置したイベント送信の共通口。
- **Basic Consent Mode**：測定IDを入れてenabledにしても、同意前はGoogleタグをダウンロードせず、通信しない。許可・拒否をユーザー自身が選択でき、上部ナビの「解析設定」から見直せる。広告の保存・ターゲティングは拒否を既定値とする。
- GA4送信前にイベント名と全パラメータをallowlistで制限。作品タイトル、点数、検索語、ユーザー名、ログインID、匿名認証ID、メール、問い合わせ内容を収集しない。
- ページ名は `home`, `community`, `discover`, `published`, `my_works`, `editor`, `rating_legacy` の固定値。URL限定作品のID・検索クエリ・公開作品のURLパラメータ・サインイン情報は送信しない。
- **Public作品のみ**、`work_view` イベントに `work_code` として作品UUIDの先頭8桁だけを使用。URL限定・Privateでは `work_code` を送信しない。同一短縮コードの重複可能性はゼロではなく、将来作品数増加時は再検討する。
- URLパラメータで許可するのは英数字＋ハイフン・アンダースコアの48文字以下に限定した `utm_source`, `utm_medium`, `utm_campaign` の3種。公開作品IDや検索語は破棄。
- Homeの編集領域はiframe内にあるため、計測を親ウィンドウへ渡す。表示ページの二重カウントを防止。
- `?analyticsDebug=1` は開発者向けの**送信なしデバッグ**。ブラウザコンソールの `SM_ANALYTICS.state().events` に安全なイベントが最大200件だけメモリ内に残る。ページ再読み込み時は消える。

## GA4カスタムイベント

| イベント | 意味 | GA4の流れとしての使い方 |
|---|---|---|
| `page_view` | ページ閲覧（canonical page_group） | 流入先・移動先 |
| `discover_filter` | すべての作品／みんなで評価、カテゴリ・ソートの切替 | 作品探索 |
| `discover_search` | 検索した事実（検索語は送らない） | 検索利用率 |
| `discover_open_work` | カードから公開作品を開いた | Discover→閲覧 |
| `work_view` | Public作品の閲覧。短いwork_codeを含む | 人気作品の比較 |
| `home_action` | 新規シート・公開・グラフ画面・バックアップ開始 | 機能発見 |
| `template_selected` | 10種のグラフのどれを選んだか（固定のtype） | 人気グラフ |
| `editor_export_started` / `editor_export_completed` | 画像作成開始／成功／失敗 | 制作完了ファネル |
| `publish_attempt` / `publish_success` / `publish_failure` | 公開の着手／成功／失敗 | 公開離脱 |
| `rating_attempt` / `rating_success` / `rating_failure` | Community投稿の着手／成功／失敗 | 投稿完了率 |
| `share_action` | リンク・画像の共有操作 | 共有への到達 |
| `remix_started` | 作品コピーから採点開始 | 作品再利用 |
| `scroll_depth` | 25／50／75／90%の閲覧深さ（4段階） | コンテンツ配置 |
| `ad_slot_viewable` | 後日 **実際の広告要素** に `data-sm-ad-live-slot` を付けた場合のみ、50%以上表示 | 広告候補ごとの視認率 |

注: R32の点線プレビュー `data-sm-slot` は**絶対に広告インプレッションとして計測しない**。上記 `ad_slot_viewable` は独自の閲覧目安であり、Google AdSenseの課金対象インプレッションや収益を意味しない。

## GA4導入前に必要な作業（本人の承認が必要）

1. 作成済みのGA4プロパティとWebデータストリームをPCから開き、測定ID `G-...` を確認する。新たなストリームを作成しない。
2. プライバシーポリシーに、GA4／Cloudflareによる解析の目的・保存・第三者サービス・同意撤回方法を明記。必要地域の法令・同意管理を確認。
3. 本人から測定IDを受け取った後だけ、`cloud/analytics-config.js` の `measurementId` と `enabled:true` を設定。費用が生じる操作やAds連携は事前確認。
4. GA4で **カスタムディメンション** `page_group`、`template_type`、`filter_type`、`visibility`、`outcome`、`work_code`、`slot_id` を必要に応じて登録。値の種類が多い `work_code` はGA4の高カーディナリティ化に注意。
5. GA4の「探索 → 経路データ探索」で `page_view` と `page_group` の導線、「ファネルデータ探索」で作成→出力、Discover→作品閲覧、公開→共有、Community投稿開始→成功をそれぞれ可視化。
6. SNS投稿やプロモーションのリンクに `?utm_source=x&utm_medium=social&utm_campaign=launch` のような安全なUTMを付与して流入別に効果を分析。共有するURLに個人情報を含めない。
7. Cloudflare Web AnalyticsはCloudflare側で別途確認し、必要なビーコントークンを有効化する。トークン未入手のままダミーのアクセス解析スクリプトを登録しない。

**データの境界**：解析の有効化が済むまでは外部解析通信ゼロ。Supabaseの新規テーブル・追加課金ゼロ。本番の既存作品・評価・保存データは変更しない。
