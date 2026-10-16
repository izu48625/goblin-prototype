# STATS MAKER｜R52 多角的監査：スケール・速度・文言・運用

2026-10-16　｜　正式サイト https://statsmaker.app/　｜　開始main `1bdd85d1313a07072fbfce8b3da6a171cf55425e`

> **結論：現規模での自動QA・配信は合格。ただし1万〜10万規模の公開作品や多数の同時アクセスを快適に処理できる実測根拠はまだない。**
> 本監査は2026-10-16のソース、Supabase本番の**読み取り専用**集計、単発のEXPLAIN ANALYZE、R40/R41〜43/R51の隔離QA、事業者公式無料枠を根拠とする。ピークを想定した本番への負荷試験、実機OS操作、AdSenseの広告配信は実施していない。
> Google AdSenseはユーザー画面により**所有権確認済み・審査待ち**、まだ承認・実広告配信には至っていない。個人情報や未公開の作品、投稿者データへの変更は禁止。

## 1. 観測値と制限

- 本番Postgres DB全体 **12,897,427 bytes（表示12 MB）**。公開作品11件、`rating_sets` 6件、`scores` 190件、`topic_items` 60件。現在の利用規模での計測であり、**利用者数やトラフィックは不明**。
- `topics` など6表のRLS有効。問い合わせ `contact_inquiries` 0、作品通報 `work_reports` 0。公開作品の説明空欄0、25字未満0、仮タイトル0、`topic_items.image_url` 登録0/60。運営者による権利確認は独立。
- 本番SQL関数 `public.discover_public_works_v1` の `EXPLAIN(ANALYZE,BUFFERS)` 単発例：newest **22.551ms**、popular **11.180ms**、検索「サッカー」＋popular **17.705ms**（11作品）。これはDB内部時間でありネットワーク・描画・同時実行時のp95ではない。
- R40時代の合成 `generate_series` 1000 / 10000 / 100000件の走査・ソートはおおむね16ms / 140〜166ms / 1.4〜1.7秒だったが、**現行R43 RPC実データの規模性能を測定した結果ではない**。PR #167でカウンター・trigram索引・20秒IDキャッシュが既に導入されているため、古いR40の問題を「未対応」と誤記しない。
- Workers Freeの **10万「Worker実行」リクエスト／日、CPU 10ms/実行** が上限。通常のHTML/CSS/JSはWorkers Static Assetsとして**無料・無制限**であり、すべてのサイト閲覧が10万リクエストに数えられるわけではない。現在の `wrangler.jsonc` は `/api/discover`、`/api/og`、`/p/*`、`/work/*`、`/sitemap*` 等だけを `run_worker_first` に設定。Workerを実際に通る動的アクセスと、DBへの個別RPCが計数・制限上重要。
- Supabase Freeの公表枠は**DB 500MB、認証MAU 5万、非キャッシュ転送5GB/月＋キャッシュ転送5GB/月**。MAUはページ閲覧数とは異なり、認証利用者ベース。各枠のどれが先に限界になるかは運用ログなしには決められない。
- 公式：https://developers.cloudflare.com/workers/platform/limits/ ／ https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/ ／ https://supabase.com/docs/guides/platform/billing-on-supabase

## 2. リスクと原因

| 優先度 | 分野 | 実装上の観測と影響 | 改善方針 |
| --- | --- | --- | --- |
| **高：成長時** | Discover/検索 | 最大12カードずつ返すが、`discover_public_works_v1` はPublic候補を `MATERIALIZED` に集め、全候補の検索・`row_number`・正確な総数計算を行う。投稿が増えると候補側の作業量が増えうる。既存GIN trigramは3文字未満や一部の短い検索語で効きにくい。 | 1k/10k/100k独立DBテストでEXPLAIN＋p95、必要ならソート／正確な件数計算を対象絞り込みと分離、深いページにkeysetを検討 |
| **高：トラフィック増** | DBアクセス集中 | `/api/discover` の20秒キャッシュはID・順位だけ。キャッシュ命中でもPublic公開状態を確認するRPCを呼ぶ。Cloudflareの90件/分/IP制限は同じIPを共有する複数人にも作用しうる。フロントはゲートウェイの非429/400失敗時にSupabase RPC直接フォールバックする。 | Public/Private切替後の即時不可視化を維持しつつ、読み取り回数とエラー率、利用IPの公平性を実測 |
| **中〜高** | 公開UGC・AdSense | 不適切画像や中傷・第三者権利はDBの空欄検査だけでは判定できない。通報/問い合わせはDBへ記録するがメール自動通知なし。 | 審査前の人手レビューと定期的なキュー確認、広告を危険なUGCに出さない仕組みを承認後に検討 |
| **中：スケール時** | 共有OG・SEO | `/api/og` はVercelバックエンドをプロキシ、現時点では外部ホストの応答性・上限にも依存。動的 `/work/:id` はDB read＋no-storeで閲覧のたびに照会。サイトマップは200件×最大250ページ＝**最大5万Public URLまで**。 | 外部OGへの依存・レート/応答監視、5万件に近づいたらsitemap拡張。キャッシュで非公開化後の情報漏えいが起きない設計を維持 |
| **中** | DBと費用 | 500MB/5GB等の固定無料枠、Communityの多数のスコア行、トリガーによる公開ランキングのカウンタ更新。 | DBサイズ、転送量、Workerリクエスト、5xx/429、DB query時間を週次確認。予算の合意なしに有料化しない |
| **中** | 権限/DB性能 | Supabase Advisorは匿名対応RLS、`SECURITY DEFINER`の公開EXECUTE 6関数、RLS initplan 27、複数許可ポリシー9、未索引FK 5等を警告。監査対象6関数に公開/URL限定/owner判定があることは確認したが全権限の正当性を証明していない。 | 設計意図と最小権限を個別にテスト。危険な一括REVOKEやDBスキーマ変更を本番へ無断反映しない |
| **中** | モバイルPNG | 40×10の連続操作・10形式PNG・WebKit exportは自動合格。ブラウザ内画像生成は利用者端末側のメモリ・CPUに依存し、24h継続利用やiOS OS共有シートは完全再現不可。 | 実iPhoneでキーボード、写真保存、長文PNG、再起動後の保存を確認。高解像度と多数画像を使う場合はメモリ監査 |

## 3. 文言・翻訳・実機UX

- `base/js/i18n.js` で **JA259キー／EN258キー**、英語の `action.hideMetrics` が欠落していた。R52で一致させる。
- `publish.migrationRequired` が一般ユーザーに「R18 Supabase移行SQLを再実行」と案内していた。利用者が実行できず、運営者手順と誤認させるため、**問い合わせ・再試行案内**に更新。
- `publish.imageWarning` が「R15では」と旧バージョンを出す設計。公開作品への画像未送信という利用者に必要な情報だけに変更。
- 日英紹介ページ、ガイド、利用規約で現在の無料基本機能・Local-first・Public/Unlisted/Private・PNGとJSONの違いを点検。明確な機能虚偽は今回の静的調査で検出されず。ただし**全端末・全画面の実物UI表示を保証しない**。
- Discover「Popular/人気」は参加者数と公開Remix数を使う独自計算。「参加者順」「Remix順」とは異なり、総合人気の定義は未表示。改善候補はツールチップまたはヘルプ内の短い説明。可視性/並び替えロジックの変更はしない。
- 設定日時が入った規約文（2026-10-14現在）は当時の状態を示す歴史的表記で、虚偽と断定しない。**実広告開始前**には日英のプライバシー・Cookie・CMP情報と更新日を正確に更新する。
- AdSenseではサイト運営者がユーザー投稿のポリシー準拠に責任を負う。公式：https://support.google.com/adsense/answer/1355699?hl=ja ／ https://support.google.com/adsense/answer/10502938?hl=ja

## 4. 今後の数値検証計画（現時点では未実施）

**最初の閾値は運営上の監視目安であり、現在の合格判定やGoogleの基準ではない。**

- 別のテスト用PostgreSQL/Workerを用意し、公開 1千/1万/10万作品、各作品の参加者0/10/100/1000人を模したスナップショットと集計データを投入。**本番にダミー投稿は絶対入れない**。
- 1/5/20/50同時利用、JA/EN短文/長文検索・新着/人気/Community/Remix、2ページ目以降、投稿更新と公開→非公開を測る。
- 指標：API p50/p95/p99、DB実行/CPU・Rows read、5xx/429・タイムアウト率、転送量、Worker実行回数、端末FPS/メモリ、iOS PNG所要時間、コスト。
- 運用上の監視開始目安：Worker 7万実行/日、DB 350MB、非キャッシュ転送3.5GB/月、Discover p95の悪化や429増加。**閾値はアラート設計案であって、サービス上限の変更ではない**。
- 変更の必要性が実測で確認できたら別PR＋DBトランザクション・rollback・非公開化の安全性テストを通す。現時点で有料のプランには変更しない。

## 5. R52作業と最終判定

- R52でコード変更するのは**UIの文言／翻訳キーのみ**。データ形式、Discover/Community、認証/権限、Worker、AdSense、GA4、料金を変更しない。
- JA/ENのキー集合一致と「利用者にSQL再実行を指示しない」静的QAを追加し、既存統合QA・Cloudflare/本番配信を確認する。
- 判定：**現状規模での正式告知準備：概ね良好**。**急成長時の無条件スケーラビリティ：未検証／条件付き**。AdSense審査結果と実広告・権利運用・物理iPhoneの最終チェックは別途必要。
