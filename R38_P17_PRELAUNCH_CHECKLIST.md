# STATS MAKER｜R38 P17 公開前・最終QAチェック

更新：2026-10-14  
正式環境：[`izu48625/goblin-prototype`](https://github.com/izu48625/goblin-prototype) `main` ／ [statsmaker.app](https://statsmaker.app/)  
直前のR38 P16確定main：`53ecf773e6907a430cb72b0e30572fd00425bce7`  
本書は運用手順・判定基準であり、Google・Vercel側での実際の管理操作を完了したという意味ではありません。

> **R51最新監査（2026-10-16）：** この下には開発当時の履歴も残っているため、最新状況は [R51最終総合監査](R51_FINAL_RELEASE_AUDIT.md) を優先する。2026-10-16 main `8303022ce110` の全16チェック成功。Google Search Consoleは10/14に本人が認証・サイトマップ送信済み、AdSenseは10/16に所有権確認成功・**サイト審査待ち**（本人画面）。支払いの初期設定も本人画面で完了。実広告・`ads.txt`は未導入、GA4はOFF。物理iPhoneテストは未完了。古い「AdSense未申請」「Search Console未確認」記載は**過去の状態**であり、再申請・再設定を促さない。


## 1. R38 P17 で追加した自動ゲート（本番データへの書込禁止）

GitHub Actions [`R38 P17 Read-Only Prelaunch Acceptance`](.github/workflows/r38-p17-prelaunch-qa.yml) はPR時にローカル＋隔離ブラウザテストを実行し、main反映後にCloudflare/GitHub PagesをGETのみで点検する。

- 基本表：採点モード（10点／100点）、色 ON/OFF、保存、言語・モバイルUI。
- 公開作品：モバイルの**横スクロール表**（縦カードに戻さない）、固定対象名、4×4・40×10、日本語／英語、平均値と全項目。
- グラフ：10種類の画像生成とWebKitの共有API呼出し（iOS実OSの共有シートではない）。
- 耐久性：40×10・JSONバックアップ／復元・複数タブ・保存競合。
- 安全性：公開／URL限定／非公開、Community、問い合わせ・通報の隔離契約。
- 日英SEO・利用規約・プライバシー・Public限定サイトマップ・`noindex`。
- GA4・AdSenseを無断で有効化していないこと。
- 本番配信：HTML/CSS/JSのキャッシュ識別子、横スクロール版の配信、`/work/存在しないUUID` の404。
- 旧Vercel直接アクセスは **参考観測のみ**：ログに `LEGACY_DIRECT_HOST_PASS` / `NEEDS_REVIEW` / `UNVERIFIED` と出す。旧ホストの配信を自動で変更しない。

**テストの実態：** Chromium／WebKitはSafari相当の描画・ブラウザイベントを検査できるが、物理iPhoneの写真保存、キーボード、OSの共有シートを代行できない。CIが全件成功しても「実機QA完了」と報告しない。

## 2. 現在の公開前チェック

| 分野 | 状態 | 根拠・残る制限 |
| --- | --- | --- |
| 採点・平均・10/100モード | 自動テスト済み | R38 P16までのPR/main CI。R38 P17で再テスト |
| 40×10／保存／復元／複数タブ | 自動テスト済み | 既存R37の隔離ブラウザQAを統合 |
| PNG 10種類・iPhone相当WebKit | 自動テスト済み | 端末の写真アプリへの保存は対象外 |
| 公開範囲・SEO・通報 | 自動契約テスト済み | 実運用での権利・UGC対応は継続 |
| 公開スコア横スクロール | R38 P16反映済み | モバイルで文字・列幅を縮小。実機の最終外観は本人確認 |
| 日英SEO・robots・Public限定sitemap | ソースと配信を監査 | 実際のGoogle検索登録は未確認 |
| GA4 | R45で再び無効化 | `enabled:false`, `measurementId:''`。同意画面・Googleタグ・送信なし。再開には本人の新たな依頼が必要 |
| AdSense | **審査待ち（2026-10-16本人画面）・未配信** | Google所有権メタタグとpub-IDを正式ルートで確認。実広告コード・正式ads.txtなし（プレビューのみ） |
| 旧Vercel OGP | 要実配信確認 | GitHubに失効/no-store対策はあるが、独立Vercelホストと外部SNSキャッシュは別管理 |
| 物理iPhone Safari | **未完了** | OS共有シート、写真保存、キーボード・下部バーを最終確認 |
| Google Search Console | **本人確認済み（2026-10-14）** | ドメイン認証・sitemap送信成功、/ja/・/en/登録済み。検索クエリの実データは今後確認 |

## 3. 本人に残る最短作業

- **iPhone実機（10〜15分程度）**：`statsmaker.app`を開き、10点／100点採点・色ON/OFF・公開作品の横スクロール・Community・10種のグラフのうち代表3種を確認。PNGをiOS共有シート経由で実際に「写真へ保存」し、Safariへ戻ってデータ残存を確認。新規の本番公開作品やCommunity投稿をQA目的で作成しない。詳しくは [R36_IPHONE_FINAL_CHECK.md](R36_IPHONE_FINAL_CHECK.md)。
- **Google Search Console（完了済み、追加操作不要）**：本人が2026-10-14に `statsmaker.app` の所有権確認・ `https://statsmaker.app/sitemap.xml` の送信成功を確認した。以後は検索クエリ等の実績を監視する。
- **旧Vercel（必要ならPC）**：旧 `stats-maker-ogp.vercel.app` のデプロイ履歴・直接URLの失効時応答・キャッシュを点検。GitHubで修正済みのコードが旧ホストに展開されたかは別途判定する。既存共有URLを突然無効化しない。
- **運用確認**：運営者情報、利用規約・プライバシー表記、通報の受信・対応手順、公開コンテンツの著作権リスクを最終チェック。
- **AdSense審査待ち**：本人は2026-10-16にサイト所有権確認・審査リクエスト・支払い情報の初期登録を完了。審査通過後のみ、本人承認を受けて実広告・必要なCMP・正式ads.txtを導入する。GA4はR45方針でOFFのまま。

## 4. リリース判断

GitHub mainのP17 PR・CIがすべて成功し、両配信先の本番GETチェックに合格したら、**「自動QAと配信監査は完了」**と表現してよい。物理iPhone実機・Search Console・旧Vercelの運用リスクは独立したチェック項目として保持する。配信中止・有料化・課金申請・公開データ変更は一切自動実行しない。
