# STATS MAKER｜R55 障害封じ込め・Community同時投稿の耐性強化

更新：2026-10-16（JST）／基準main `78eb9fd307cf72068337933f28802446ade4637a`。

## 今回本番へ反映する対象（コードはQA合格後）

1. **DiscoverのDB障害連鎖を遮断**。正式ドメイン `statsmaker.app` と `www.statsmaker.app` では、Worker `/api/discover` の503/502/504、400、429および通信断を受けたとき、ブラウザから`discover_public_works_v1`をSupabaseへ直接追加問い合わせしない。Worker障害がDBの過負荷に起因する場合、各ブラウザからさらに直接SQLを実行する負荷増幅を防止。エラー画面には既存の再試行ボタンを残す。**通信障害時の成功率が一時的に下がる代わりに、全体停止の連鎖を抑える選択**。Cloudflareが動作している限り成功レスポンスの挙動は不変。
2. 開発用GitHub Pages／ローカルはWorkerなしを想定して、従来のSupabase直接RPCフォールバックを維持。サーバーが明示拒否する400/429は引き続き迂回禁止。
3. **Communityのrate limiter障害を安全に処理**。Workerの `COMMUNITY_GATEWAY_RATE_LIMIT` binding が存在しないか例外を投げた場合は、未処理エラーを出さず、503/`gateway_rate_limit_unavailable`で拒否。制限自体を無視して保存することは絶対にしない。認証情報、Turnstile、匿名Auth、スコア保存経路は変更しない。

## 追加した検証

- `scripts/r55-discover-outage-containment-qa.mjs`：正式ドメインの503/429/400／fetch通信断で直接RPC **0回**、正常200で正常描画、GitHub Pagesプレビュー404／通信断は従来のフォールバック可能なことをVMで確認。
- `scripts/r26-gateway-test.mjs`：Community limiterの欠落/例外時に503を返し、DB/Auth/Turnstileへの送信ゼロを検証。
- `scripts/r55-community-concurrency-qa.sh` と専用GitHub Actions：**PostgreSQL 17の破棄可能な隔離DB**で、R41と同じ本物のtrigger関数を使い、一つの公開作品に対して64クライアントの同時INSERT→draft切替→再submit→DELETEを実行。カウンタが各段階で64→0→64→0と一致し、二重submitでも1に保たれるかを判定。1件でも失敗・カウントずれならQA不合格。
- 既存のWebKit、40×10、10種PNG、公開/非公開・RLS、SEO、UI、Cloudflareと本番GETの統合回帰を再実行。
- **本番DBへ意図的な高頻度POST・ダミーレコード・同時負荷を与えない**。DB構造、既存の作品やスコアは変更しない。

## 成長時の限界（未解消）

- 64並列SQLはPostgreSQL内部のカウンター競合試験であり、**64人分のTurnstile／Cloudflare／Supabase Auth／端末操作を一括再現したものではない**。
- DB無料枠、Worker Freeの動的リクエスト数、ストレージ／転送の上限は不変。広告・GA4・課金・Supabaseプラン変更はしない。
- 1万～10万公開作品の人気順全体集計、短い日本語検索、深いoffsetページ、同時投稿時のトリガー待機時間、共有IPの90/分およびCommunity30/分制限などが、成長時には次の課題。過負荷の監視と必要時の負荷分散・キャッシュ刷新を検討。
- Google AdSenseは依然として審査待ち（承認通知未確認）。

## 実行結果（2026-10-16 GitHub Actions）

- `outage-no-stampede` 成功：正式ドメインの503/429/400/通信失敗でSupabase直接RPCを呼ばない。正常200・GitHub Pagesプレビュー404の互換も維持。
- `postgres-64` 成功：実R41トリガーを隔離Postgresに設置し、**64同時INSERT→0下書き→64再投稿→0削除**、すべての参加者カウンター期待値に一致。再送信の二重計上なし。
- `isolated-50k` 成功：PostgreSQL 17にPublic／Unlisted／Private混合の模擬作品50,000件を生成。現行R54最適化SQLと従来SQLで**14条件の完全JSON一致**。
- 50k件単発DB `EXPLAIN ANALYZE`：新着 **215.289→91.388ms**、人気 **577.481→451.999ms**、日本語検索「サッカー」 **1824.974→1648.731ms**（従来→改善後）。**検索はまだ重い**。50kは実際の本番規模を再現したものではなく、単発結果、ネットワーク/iPhoneや同時負荷のp95を含まない。
- PR #184 `https://github.com/izu48625/goblin-prototype/pull/184`。旧r53系のWebKit、画像10テンプレ、公開範囲、Community、SEOの回帰テストと合わせて検証。
- 新着以外の50k検索でまだ秒単位のDB処理がある。**次の最優先候補は、1〜2字・高頻度一般語の検索を対象に、インデックス利用状況、正確な総件数、全候補評価の負荷を独立テストで測って対策すること**。ユーザーの検索語をキャッシュに無制限に保持する設計や、Privateになる前の内容を出す設計は採用しない。

## 判定記録

GitHub PRで新規・既存QA、マージ後mainのProduction Smokeが成功してから「実装済み」とする。失敗したテストがあれば修正して再実行する。最新main・PR・確認値は結果確定後に追記する。
