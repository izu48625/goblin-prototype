# STATS MAKER | R66 Free枠の使用量監査と警戒判定

更新日: 2026-10-16（JST）
対象: `statsmaker.app`、Cloudflare Workers `stats-maker-web`、Supabase `ibpdxbeltdwkquowjeay`（組織 `hwqpqzavxfrahtgbkmor`）

## R66で実装すること

無料プランを変更せず、**実測・未計測を明確に分ける**監査手順を追加する。CloudflareやSupabaseの実通信量を取得できていないのに「上限まで余裕あり」と表示することを禁止する。

- `scripts/r66-free-usage-triage.mjs`: 入力JSONの容量/リクエスト/MAU等とFreeプランの上限を比較。**完全ローカル・無通信**でJSON形式の監査結果を返す。
- `scripts/r66-free-usage-triage-qa.mjs`: 未計測が"incomplete"になること、50/80/90/100%閾値、エラー率、入力値の不正検出、CLI出力を確認。
- `monitoring/r66-verified-snapshot-20261016.json`: Supabase本番データを**SELECTのみ**で確認した日付付き実測スナップショット。現在値を自動更新するファイルではない。
- 新しい料金プラン/プロジェクト/Workers Cron/DBテーブル/シークレット/メール通知は追加しない。実際のトラフィックを増やさず、製品の機能/プライバシーは一切変更しない。

## 2026-10-16 10:58 UTC の検証済み実測

| 指標 | 確認値 | 判定 |
|---|---:|---|
| Supabase組織 | Free | 追加課金設定なし |
| Supabase DB使用量 | 12,954,771 bytes ≒ **12.95 MB** | 500 MB（保守的10進基準）比 **2.59%** |
| 作品数 | 11件（Public 11 / Unlisted 0 / Private 0） | 少規模 |
| topics + indexes | 294,912 bytes | 参考 |
| rating_sets + indexes | 114,688 bytes | 参考 |
| scores + indexes | 163,840 bytes | 参考 |
| 一瞬のDB接続数 | 8件（active 1件） | **ピークではない** |
| Workers 1日リクエスト数 | **未計測** | CloudflareアカウントのUsage/Worker Metrics確認が必要 |
| Worker 5xx・CPU超過 | **未計測** | Cloudflare側で要確認 |
| Supabase uncached egress（請求月） | **未計測** | 組織Usage |
| Supabase cached egress（請求月） | **未計測** | 組織Usage |
| Supabase Auth MAU（請求月） | **未計測** | 組織Usage |
| Supabase Storage利用量 | **未計測** | 組織Usage |

**要注意:** 500 MBの公式表記を監視コードでは保守的に500,000,000 bytesと解釈する。過去の500 MiB換算では2.47%だったが、今回のアラート判定値は**2.59%**。ダッシュボードに表示される最新の実クォータを最優先する。

Supabaseの統合ログには直近24時間にedge_logs等があるが、ログ行数はユーザー数・Workerリクエスト数・請求対象Egressと同義ではないため、その値で代用しない。

## 公式Free枠と監視単位

- Cloudflare Workers Free: **アカウント全体100,000 requests / UTC日**。Workerごとの数だけでなくアカウント合計を確認。CPU **10 ms / 呼出**はリクエスト数とは別の制限。
- Supabase Free: DB **500 MB / project**、uncached Egress **5 GB / organizationの請求月**、cached Egress **別途5 GB**、Auth **50,000 MAU / organizationの請求月**、Storage **1 GB**。
- すべて運用上の目安: 50%で調査、80%で節約優先、90%で緊急見直し、100%で上限到達。これらの警戒点はStats Maker独自基準で、課金開始・実障害の確定値ではない。Workerの5xx率は別途1%注意、5%緊急（推奨目安、公式枠ではない）。
- **請求期間が違う指標は足し合わせない**。WorkerはUTC日次、Egress/MAUはSupabase組織請求月、DB容量はその時点で評価。

出典（運用時は公式ページを再確認）:
- https://developers.cloudflare.com/workers/platform/limits/
- https://supabase.com/docs/guides/platform/billing-on-supabase
- https://supabase.com/docs/guides/storage/serving/bandwidth

## 手動で測る無料手順（新しい連携・秘密鍵不要）

1. Supabase: https://supabase.com/dashboard/org/hwqpqzavxfrahtgbkmor/usage の **Organization Usage** でuncached/cached Egress, MAU, Storageを確認する。プロジェクトだけの数字に置き換えない。
2. Cloudflare: https://dash.cloudflare.com/ → Workers & Pages → `stats-maker-web` → Metricsで今日のRequests/Errors/CPUを確認。加えて**アカウント合計**も確認。
3. 新しい日付のJSONを**ローカルのみで**作り、実際の数値を埋める（不明ならnull）。GitHub Public Repoへ実IP、個人ID、クッキー、キー、ログ内容などを貼らない。
4. `node scripts/r66-free-usage-triage.mjs monitoring/r66-verified-snapshot-20261016.json` で参考実行。**必ずファイルの日付を見て、これを今日の数値と扱わない**。
5. アラートが出たら、先にキャッシュ/通信量/エラー発生箇所を調べる。有料プラン・課金を伴う設定変更は必ず本人確認を経る。

## 今後のR64切り替え

R64の公開ランキング高速化はSQL関数の実装候補をmainへ保存済みだが、Supabase Data API `Exposed schemas` の実設定が未確認。本R66はR64を勝手に有効化しない。現在の検索R60、公開/Unlisted/Private制御、サイトデプロイは変えない。

## 追加で必要なデータ

Cloudflare Worker Requests/Errors/CPU、Supabase uncached/cached egressとMAUの実測。これらが得られたらR66判定ツールに入力し、優先度を比較する。未計測は安全の証拠ではない。
