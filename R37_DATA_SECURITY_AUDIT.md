# R37｜データ安全性・公開権限の読み取り監査

確認：2026-10-12、GitHub `main` + Supabase `ibpdxbeltdwkquowjeay`（SQL SELECTによるメタデータ照会のみ）

## ユーザーデータ保護
- `app/src/core/store.js` は拡張グラフのJSONが破損している場合、保存・削除を拒否し、残存バイトを保持する。容量不足の例外も呼出元に伝わる。既存R30テストで検証。
- `base/js/app.js` はHomeのJSONが読み込めなければ自動保存を停止し、意図しない上書きを避ける。復元前にチェックポイントを保存する。既存R29/R30テストで検証。
- R37 P1では公式最大40対象×10項目、100/10点、複数シート、20回編集・12回切替・再読み込み・バックアップ復元・Undo復元をブラウザ隔離環境で回帰検証する。
- **R37 P1の検証で検出した既存不具合**：HOMEで数値欄の変更時に`renderAll()`が表全体を差し替え、次の数値欄への連続入力が一部反映されない現象を再現。`base/js/app.js`を変更し、採点変更後は行の平均・ランク・進捗と依存パネルのみ更新して入力欄を維持する。R37耐久テストとR28/R36の入力QAで再発を検知する。

- 運用上、SafariのLocal Storageは端末変更・ブラウザデータ削除・プライベートモード等で消える場合がある。引き続き利用者向けのバックアップ案内を維持する。

## Supabase本番RLS・権限監査（変更はしない）

2026-10-12に`pg_class`/`pg_policies`/`has_table_privilege`と対象補助関数を**読み取り専用**で確認：

| テーブル | RLS | SELECTの実際の方針 |
|---|---|---|
| `topics` | ON | 所有者、または`visibility IN ('public','unlisted')`。Privateは他者から除外 |
| `topic_items`, `criteria` | ON | `topic_is_viewable(topic_id)`（トピックの上記公開範囲に連動）と所有者用ポリシー |
| `rating_sets` | ON | 匿名DBロール`anon`にSELECT権限なし。`authenticated`は`user_id=auth.uid()`の本人分のみ |
| `work_reports`, `contact_inquiries` | ON | `anon`/`authenticated`ともSELECT権限なし。本人認証済みのINSERTのみ |

- `topic_is_viewable`、`topic_is_owned_by_me`、`topic_accepts_my_ratings` はSECURITY DEFINER補助関数だが、関数本体のトピック閲覧可否・所有者判定に`auth.uid()`を使用していることを確認。
- **UnlistedはPrivateではない**。URLを知る人が閲覧できるため、秘密情報を投稿しない。検索・Discoverへの掲載の扱いも今後回帰確認が必要。
- 本監査はRLSポリシーのメタデータと実装ロジックの読み取りであり、実際に他者アカウントへログインしたアクセス試験ではない。匿名認証を発行したり、実作品を公開・変更したりしていない。

## 次のR37
- P1：ブラウザ負荷・耐久性の再現テストをCI化、異常時はPRをマージしない。
- P2：Private/Unlisted/Publicの検索・公開ページ・Discover/APIのクロスチェック。実データを変更しないモックテストと読み取り専用セキュリティ監査を優先。
- P3：大きな画像を含むバックアップ、QuotaExceeded、長時間利用、Safariでの保存・復旧ガイダンス改善。必要性をテストしてから小さく修正。
- P4：R37総合QAとR38公開・AdSense準備への引き継ぎ。GA4・実広告は引き続き未有効化。課金・有料アプリ等は追加しない。

## 禁止事項
本番テスト名義で公開作品・Community採点・問い合わせ・通報を作成しない。本番SQLで権限変更やレコード削除をしない。サービスロールキーやユーザーの非公開情報をGitHubに載せない。
