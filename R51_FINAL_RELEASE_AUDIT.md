# STATS MAKER｜R51 正式告知前・最終総合監査

監査日：2026-10-16（日本時間）  
正式URL：[https://statsmaker.app/](https://statsmaker.app/)  
GitHub：`izu48625/goblin-prototype` / `main`  
R51監査開始時のmain HEAD：`8303022ce110c1c4cc65cd0b14513596d48ce477`（R50所有権確認タグ）。**合格根拠はこのSHAおよびR51マージ後の正確なHEADに紐付ける。**  

## 判定

**自動QA：合格／正式告知：条件付き待機。**

現行mainの16件のチェックは全てsuccess。Cloudflare build、GitHub Pagesデプロイ、Production Smoke、R38 P17のsource／mobile／liveの3ジョブ、R50所有権確認のsource／liveの2ジョブが成功（2026-10-16）。R51のPRに対して全統合QAを再実行し、マージ後のmainで本番確認する。

**未完了で「済み」と言ってはいけない項目**は次の3つ：
1. iPhone実機のSafariキーボード、共有シート、写真／ファイルへのPNG保存、戻った後の保持、下部バー、公開作品の横スクロール等の**本人確認**。
2. Google AdSenseの**審査通過と実広告導入後**の安全な表示確認。ユーザー画面で2026-10-16 13:34に「審査待ち」を確認。審査が進んだこと・承認を受けたことをコード／CIから推論しない。
3. 個人運営の本番運用：公開投稿の権利・出典・不適切内容の目視、通報／問い合わせの受信確認手順、適切な運営者情報と広告同意管理（導入時）。

## 検証マトリクス

| 分野 | 自動QA／読み取り結果 | 判定・境界 |
| --- | --- | --- |
| HOME採点 | 10点/100点、点数入力のコミット、色ON/OFF、平均値、行列の編集、320/390/430px表示 | 隔離ブラウザ合格。物理iPhone未検証 |
| 大容量・復旧 | 40対象×10項目、連続編集・複数シート、LocalStorage、JSON、破損／容量不足、Undo、複数タブ | R37/R38統合自動QA合格。端末データ消去の防止保証は不可 |
| 拡張グラフ | 10種類のレンダリング・PNG、長い日本語ラベル、WebKit export/shareモック | 自動QA合格。実OS共有シート・写真保存は別 |
| Discover／Community | 一覧とページング、公開スコア、Remix、ランキング、集計の表示 | 自動QA合格。将来大量ユーザー時の負荷は継続観測 |
| 公開範囲・OG | Public／Unlisted／Privateの隔離テスト、公開範囲変更時の失効制御、SEO Public限定 | ローカルmock＋本番読取合格。実データにはPublicのみ11件で、非Public実レコードを使った実機検査はしていない |
| 日英SEO・ヘルプ | JA/EN、canonical/hreflang、robots、動的sitemap、4つの使い方ガイド、ヘルプ導線 | 自動QA・GET合格。検索順位・インデックス登録はGoogleが管理 |
| 本番公開 | Cloudflare Workers / GitHub Pages、HTML/CSS/JS読取、公開ビュー、存在しないUUID 404 | 同一main SHAのGitHub Actions成功 |
| AdSense | `index.html`の最外側`<head>`に `google-adsense-account` メタタグ、Googleで所有権確認成功（本人画面） | R50 live GET合格。実広告・`ads.txt`未導入、アカウント審査中。GA4オフ |
| 旧Vercel OG | 2026-10-16最新の本番GETで存在しないUUIDの `/p/` と `/api/og` は双方404/`private, no-store` | 旧キャッシュに既存で残る共有先メタデータの全消去、過去に公開→非公開になった実URL全件は未検証 |

## Supabaseの監査（本番データ・権限の変更なし）

2026-10-16、Supabaseへの読み取り専用 `SELECT` とSecurity/Performance Advisorで確認。

- Public作品 **11件**。説明空欄 **0件**、説明25字未満 **0件**、初期仮タイトル **0件**。25字はGoogleの規定ではなく独自監査目安。
- Public作品に紐づく `topic_items` は**60対象**、対象画像URL **0件**。外部引用・著作権の安全性を保証するものではない。
- `work_reports` / `contact_inquiries` はいずれも **0件**。自動メール通知はなく、運営者による定期確認が必要。
- `topics`, `topic_items`, `scores`, `rating_sets`, `work_reports`, `contact_inquiries` の6表で **RLS有効**を確認。
- Security Advisorには匿名利用を前提とするRLSポリシー、`SECURITY DEFINER` の公開呼び出し権、漏えいパスワード保護に関する **WARN** がある。WARNそのものは侵害の証明ではない。匿名投稿・集計を止める危険なGRANT/REVOKEはR51で行わない。
- 匿名EXECUTEとして警告された `discover_public_participant_count_v1`, `discover_public_remix_count_v1`, `get_community_criterion_summary`, `get_community_item_summary`, `get_topic_participant_count`, `topic_is_viewable` の6関数定義を読み取り、Public/Unlisted・Community有効化・ownerチェック等の条件分岐を確認した。**すべての経路の非漏えいを証明したものではない**ため、公開後も権限監査を継続する。
- Performance AdvisorにはFK未索引5、RLS initplan 27、複数許可ポリシー9、重複索引1等の助言。11公開作品の段階で即座に本番スキーマを書き換えない。利用者が増えたら切り分けて対応する。
- [Supabaseの公開SECURITY DEFINER診断](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) ／ [RLSパフォーマンス](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)

## R51で走らせる回帰テスト

PR時：R37 P4統合3ジョブ（API・プライバシー契約、40×10＋10 PNG＋WebKit、公開／Community／SEO＋JA/EN）およびR38 P17隔離ブラウザ・GET根拠、他の関連workflowが全て成功すること。**本番DBに偽投稿・採点・問い合わせを追加しない。**

マージ後：本番 `statsmaker.app` とGitHub Pagesの配信、Production Smoke、Cloudflare Preflight、R50のメタタグ維持・実広告非表示を確認し、最新main SHAとPRを記録する。

## 本人のiPhoneで最終確認（10〜15分目安）

1. iPhone Safariの通常タブで [HOME](https://statsmaker.app/) を開き、10点／100点切替、点数入力、キーボード開閉、上下スクロール、Safari下部バーに操作が隠れないことを確認。
2. 拡張機能でランキングとレーダー／散布図等の**代表3種類**を開き、テキスト・重なり・PNGプレビューを確認。
3. 「共有／保存」から**iOS共有シートを実際に開く**→画像を写真またはファイルに保存→保存先で日本語表示を確認→Safariへ戻ってデータ・ボタンが保たれるか確認。
4. [Discover](https://statsmaker.app/discover.html) →既存の公開作品→横スクロール・Community集計を読み取りで確認。テスト用の本番作品・採点を投稿しない。
5. 可能ならSafariをいったん閉じて開き直し、作業中のデータが残ることを確認。重要データはJSONバックアップも取る。

## AdSenseと正式告知の順序

- Googleの審査待ちには影響する可能性があるため、メタタグを維持。**実広告は未導入。**
- 審査通過時：正式`ads.txt`・Google認定CMPが必要な配信地域・プライバシーポリシー・少数広告配置・広告によるiPhone UI妨害を別PRで確認し、本人承認のもと有効化。
- **最終判定：自動QA合格 + 実機QA合格 + AdSense審査/広告最小導入確認 + 運営上の権利/問い合わせ手順** を満たしたときに「広告付き正式告知OK」とする。Webサービス自体は既に公開中。

## 原則

- ユーザーの既存データ・Public作品・RLS・Authentication・GA4・広告配信設定を勝手に変更しない。
- テストのために収益を生む本番広告を表示しない。
- 端末実機・Googleアカウント上の操作は実施したかのように報告しない。
