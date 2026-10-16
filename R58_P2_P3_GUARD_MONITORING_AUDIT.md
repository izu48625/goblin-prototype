# STATS MAKER｜R58-P2/P3 隔離Community負荷・無料枠監視

2026-10-16 JST。R58-P1 main反映後に作成。**本番への同時POST、ダミー評価、大量作品投入なし。**

## P2: 既存ゲートウェイに追加する隔離テスト
`scripts/r58-community-gateway-burst-qa.mjs` は本物の Worker ルーターを呼ぶが、外部 `fetch` をすべてモックする。ダミーJWT・ダミーservice_role形式の鍵のみ使用。Supabase Auth、Cloudflare Turnstile、レート制限、RPC保存の各経路を模擬し、以下を確認する。

- 1/5/20/50個の並列リクエストが順番にAuth→Turnstile→RPCを通る
- 20回同一人物の再送信：RPC呼出回数とユニーク参加者数の区別
- 共通IP 20件／許可5件のとき429が15件、Retry-Afterが付き、DBへ流れない
- rate limiter例外→503、認証無効→401、認証成功でもTurnstile無効→403、RPC異常→503
- RPC 2xxかつJSON形式不正→誤って成功扱いしない
- p50/p95/p99をモック内で表示するが**実トラフィックの応答時間を示さない**
- さらに本物のR41カウンタトリガーをPostgres 17の隔離DBで64件同時INSERT／下書き／再投稿／DELETEして集計の不整合を確認する

未保証：実Cloudflare複数isolate/複数リージョン、Auth/Turnstileのネットワーク遅延、全利用者同時接続、現実のJWT発行と期限、DB負荷のp95/timeout。これらを「数万人耐久性」と混同しない。

## P3: 無料枠監視基準と現時点の記録
本番Supabaseの読み取り専用クエリ（2026-10-16 08:26 UTC時点）：
- DB全体：**12,938,387 B（約12.94 MB）**／Free目安 500 MiB（使用率 約2.47%）
- `topics` テーブル＋索引：約294,912 B
- Public 11 / Unlisted 0 / Private 0（合計11）
- `scripts/r58-free-usage-readonly.sql` に、DB総量・公開区分別作品数・関連3テーブルサイズを収集する読み取り専用SQLを保存

2026-10-16時点の公式無料枠資料：
- Supabase [billing](https://supabase.com/docs/guides/platform/billing-on-supabase)：DB 500MB/プロジェクト、uncached egress 5 GB＋cached egress 5 GB、Auth MAU 50,000（組織単位項目は組織全体を見る）
- Cloudflare [Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)：Free 100,000 requests/day（UTC日次リセット）、CPU 10ms/呼出、外部subrequest上限50/呼出

## 運用ダッシュボード（ブラウザで既存アカウントを使う、追加課金不要）
- Supabase Project Usage: https://supabase.com/dashboard/project/ibpdxbeltdwkquowjeay/usage （実際のEgress、Auth、Storageと残量）
- Supabase Database: https://supabase.com/dashboard/project/ibpdxbeltdwkquowjeay/database/overview
- Cloudflare Workers dashboard: https://dash.cloudflare.com/ （`stats-maker-web` のRequests、Errors、CPU）
- GitHub Actions: https://github.com/izu48625/goblin-prototype/actions

警戒目安：50%＝推移を調査、80%＝節約を優先、90%＝新たな集客・高負荷を慎重に。Workerは平均1日だけでなくピーク日、Supabaseは請求期間と組織全体の上限を確認する。429/503、Discover p95、Community送信失敗はサービスの既存ログ／Cloudflare/Supabaseの集計を見る。**実測の現在のEgress／Worker残量／429件数は未取得**。数値を推測しない。

GA4を再有効化しない。監視のための有料契約・常時稼働分析基盤・追加トラッキングSDKは導入しない。

## 残り
R58-P4: 1,000/10,000/50,000/100,000作品の隔離データ、1/5/20/50同時、HTTP/DB p50/p95/p99、最短検索語とCommunity更新負荷。R59: multi-isolate／多地域・実通信・費用予測。
