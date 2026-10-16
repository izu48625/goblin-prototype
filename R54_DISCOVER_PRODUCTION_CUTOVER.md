# STATS MAKER｜R54 Discover実環境カットオーバー実績

2026-10-16 日本時間／Cloudflare Workers `statsmaker.app` ／Supabase `ibpdxbeltdwkquowjeay`

## 変更内容と適用結果

- R53の隔離テストで**14ケースの全文JSON一致**が確認できた `R53_DISCOVER_LATE_HYDRATION_CANDIDATE.sql` を、Supabase `apply_migration` で **`r54_discover_late_hydration_v1` として本番適用済み**。
- 変更対象は読み取り専用 `public.discover_public_works_v1` 関数の実装のみ。**同じ関数名・引数・返却形状を維持**し、作品／採点レコード・RLS・付与済み関数権限を変更していない。
- 従来はMATERIALIZED CTEの全候補に大きな `snapshot` JSONBを載せていた。現在は候補ID／公開日時などを先に絞り、ページで選ばれた最大12作品の詳細JSONを最後に取得する。検索条件が必要なケースでは検索用JSONアクセスを引き続き行う。
- 本番DB移行直前に **14条件のJSON MD5** を採取。移行直後の **14/14完全一致**、不一致0件を確認。
- 匿名ユーザー権限（`SET LOCAL ROLE anon`）の単発確認：Public総数11、返却11、**全行`visibility='public'`、匿名で見えるPrivateレコード0件**。
- 直前に取得した本番関数定義がR53保管ソース（`scripts/r53-baseline-live-discover.sql`）と一致することを検証後に適用。
- 実際の本番関数は `R53_DISCOVER_LATE_HYDRATION_CANDIDATE.sql`。万一問題があれば `R53_DISCOVER_LATE_HYDRATION_ROLLBACK.sql`（本番旧関数の正確なスナップショット）で戻せる。ロールバック自体を本番環境で実行したわけではない。

## R53隔離SQL負荷試験

模擬10,000件（Public／Unlisted／Private混在）、PostgreSQL 17、単発 `EXPLAIN ANALYZE`。SQL関数は全14ケースで同一のJSON結果を返却。CIジョブ「isolated-10k」成功。

| ケース | 従来のDB実行時間 | R53候補 | 単発改善 |
|---|---:|---:|---:|
| 新着順 | 39.930ms | 10.535ms | 約74%短縮 |
| 人気順 | 105.352ms | 67.863ms | 約36%短縮 |
| 日本語検索 | 276.692ms | 259.485ms | 約6%短縮 |

**重要**：これらは模擬10,000件・実験1回の測定で、**本番の同時負荷性能、端末の描画、Googleの検索順位、SLAを保証しない**。試験で使用したDBへ実際のユーザー情報・採点を入れていない。

## R53 Workerで実際に本番へ導入された集中アクセス対策

- `worker/discover-public.js` の先頭ページの同一isolateでの同時キャッシュミスについてランキングRPCをbest-effortで集約。
- 50件同時リクエストの隔離モックで、従来50回の全検索を **1回の全検索＋49回のPublic限定ライブ再取得**へ減らし、非公開化・503後復旧のQAに合格。
- 結果の権限再確認を省略する方式や、Privateになる前のJSONを20秒キャッシュしてしまう方式は採用していない。
- R53 main: `8926da04ad44400b2faf0d55c29445cfc55bd341`。チェック14件success。

## 残る限界（R55以降の優先課題）

1. 同時接続はWorkerのisolateをまたぐため、同一isolateのsingle-flightだけでは1万同時アクセスの保証はできない。Worker実行回数、Supabase DB/Egress/CPU、429/5xxの運用計測が必要。
2. Popular/Community/Remixは多数の候補の順位付けと正確な総数集計を行うため、10万作品規模では依然として負荷が増える。深いoffsetのkeyset化、集計値の事前計算を実測後に検討。
3. 日本語1～2文字検索・多語検索はGIN trigramが不利なことがあり、部分一致検索の候補数次第では依然遅くなる。
4. Communityへの大量投稿は別経路の書き込み負荷。既存R41の16並列カウンターテストはあるが、50/100同時参加者の端末/DB全経路は未実施。
5. 既存の`/api/discover`の90回/分/IPは共有IPの正規利用を妨げる場合がある。ゲートウェイ障害時の直接Supabaseフォールバックも残る。障害時のDB過負荷対策として別途改修が必要。
6. 無料枠超過の予測はリアル運用のトラフィックから判定し、承認なしの課金/アップグレードは行わない。
7. AdSenseは審査待ち、GA4はOFF、実際の広告配信は未開始。画像共有のiOS実機チェックは別。

## 本番読み取り専用QA

`scripts/r54-discover-live-qa.mjs` を`statsmaker.app`への少量のGETだけで実行し、Public-only・返却12件以下・正常HTTP・公開状態やページングを検証する。これは**アクセス集中のベンチマークではない**。

**現時点の判断：** 大きいJSONの候補行転送を減らし、同じエッジへの先頭ページアクセス集中を抑える変更は導入済み。**規模無制限の保証はなく、目標規模別の負荷測定・監視は継続**。
