# R35 P6 — 個人サイト向け規約・プライバシー整備監査

更新日：2026-10-11
対象：`ja/legal.html` / `en/legal.html`、正式ソース：GitHub `main`
方針：公開規約の不足部分だけを補足する。追加フォーム・追加ログイン・CMP・Cookieバナー・管理者画面・課金設定は作らない。

## 現行実装との照合

| 実装 | 確認先 | 対外的な表現 |
|---|---|---|
| 無料の作成・画像出力・公開・Community | `base/js/app.js`, `cloud/publish-model.js`, `cloud/rate.js` | 現在基本機能は無料。決済機能なし |
| Local-first / JSONバックアップ | `base/js/app.js` | 端末内保存のデータ消失に注意 |
| Public / Unlisted / Private | `cloud/public.js`, Supabase RLS | Publicは一般公開、UnlistedはURL閲覧、Privateは原則作成者のみ |
| Remix / Copy | `cloud/remix.js`, `cloud/publish-model.js` | タイトル、説明、対象、項目を自分の表にコピー。元の採点やローカル画像はコピーしない。コピー元の作品IDを維持 |
| 通報 / 問い合わせ | `worker/work-report.js`, `worker/legal-contact.js`, `R35_REPORTS_MIGRATION.sql`, `R35_CONTACT_MIGRATION.sql` | 内容は一般非公開、運営者が管理するキューへ記録。メール自動通知なし |
| 利用者データ / 外部サービス | `cloud/supabase.js`, HTMLのjsDelivr script, Worker + Cloudflare | 作品の公開時・問い合わせ・認証時のSupabase送信、CDNやCloudflare通信による技術情報の送信を案内 |
| GA4 | `cloud/analytics-config.js` | `enabled:false`, 測定ID空欄。現時点でGA4計測は無効 |
| 広告 | `cloud/ad-layout.js` | `?adPreview=1` の開発プレビューのみ。実広告・AdSenseタグなし |

## 優先度と根拠

### 法令上の義務になり得る事項（適用条件に依存）

1. **個人情報保護法（APPI）**：個人情報取扱事業者に該当し保有個人データを扱う場合、運営者の氏名／名称・住所（法人なら代表者名）、利用目的、安全管理、請求手続・苦情窓口等を本人が知れる状態にする必要がある。**ホームページへの常時全文掲載しか認められないという意味ではない**。問い合わせに応じて遅滞なく案内する方法もある。実際に答えられる運用を運営者が確保する必要がある。確認：個人情報保護委員会 https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/ 、同Q&A https://www.ppc.go.jp/all_faq_index/faq1-q9-1/ 。
2. **電気通信事業法の外部送信規律**：サービス類型・電気通信事業への該当性・送信内容に応じて適用判断。Cookieを使わなければ必ず対象外、とはいえない。現行のCloudflare・Supabase・jsDelivr等の通信を整理して説明する。総務省FAQ https://www.soumu.go.jp/main_sosiki/joho_tsusin/d_syohi/gaibusoushin_kiritsu_00002.html 。
3. **利用者の所在地で適用されるプライバシー規則**：海外から閲覧可能であるだけで一律同意バナーを追加すべきとは限らず、実際の活動・対象顧客・データ処理で適用判断が必要。現時点ではGA4、実広告は無効。

### 今回採用した任意改善

- 現在無料・将来の料金条件の事前表示、Remixのコピー範囲と第三者の権利、変更・中断・終了、日本法と各地の強行法規、制定日を短い日英の文章で追加。
- ローカル保存と認証データ、Cloudflare / Supabase / jsDelivrの送信先を区別。
- セキュリティの概要（HTTPS、RLSを含むアクセス制御、送信頻度制限）を明示。完全無事故を保証しない。
- 問い合わせフォーム・規約リンク・HELPバー・日英のUI/保存/公開処理は**変更しない**。

## 未確定・運営者が別途確認する点

- 運営者の実際の氏名・住所の回答方法、本人確認方法、請求対応体制。未提供の個人情報をGitHubやWebに直書きしない。
- 各データの実際の保存・削除スケジュール、SupabaseプロジェクトやCloudflare契約の国外処理・各種設定。
- 著作権申立てへの対応方法と、現在公開中の作品投稿者へ重要な規約変更を周知する必要性。
- AdSense・GA4を**将来**有効にする際の別途監査。EEA/英国/スイスへのパーソナライズ広告にはGoogle認定TCF CMP等のGoogle要件がある。現時点では導入しない。
  https://support.google.com/adsense/answer/13554116?hl=en
- 法的適合の最終判断はサービスの実際の運営形態と適用法による。今回の文章は法務意見書ではない。

## 実装・確認

- `ja/legal.html` と `en/legal.html` の既存セクション内に限って加筆。
- `scripts/r35-legal-contact-qa.mjs` で必須表示・GA4無効・広告プレビュー・Remix出典・元スコア非複製を検証。
- iPhone Safariの共通HELPメニューおよび既存R34/R35 CIを通す。Supabaseの本番データ・RLSは変更しない。
