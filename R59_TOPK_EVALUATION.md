# STATS MAKER｜R59 Discover Top-K候補・隔離ベンチ

更新：2026-10-16。基準 main R58-P4（commit 7a07cb39812366480bb9de05e728c52a0d7cb8cc）。

## 実施内容

R57で使っている `discover_public_works_v1` は Public作品をフィルター後、全候補に対して `row_number() over (...)` を計算し、最終ページ12件のみを取っていた。R59では公開・検索・集計・人気順条件を**そのまま**残し、先に `ORDER BY ... LIMIT/OFFSET` でページを絞り、最大24件のページ内で `row_number()` を計算する。

- 全件数 `total`・`has_more`・`anchor` は変更しない。
- newest/popular/community/remix の完全同一順序、idでのタイブレークを維持。
- パブリック専用/RLSの範囲と `SECURITY INVOKER`、既存の参加者/Remix集計関数を維持。
- 新しい有料機能やインデックス、テーブル、外部ライブラリは追加しない。SQLは **candidate** のみで、本番SQLは自動で書き換えない。
- 50件並列に対し、1k/10k/50k/100k作品の再現可能な隔離ベンチを前後で順番に実行する。

## 検証

`scripts/r59-topk-parity-qa.sql` が R57の28条件＋4条件の計**32ケースの完全JSON一致**と、AnonでPrivate/Unlisted非表示を強制検証する。ベンチでは完全同一の人工作品とローカルPostgreSQL17を使用し、1/5/20/50並列のp95と各query種別をJSON artifactに保存する。

GitHub Actionsでは `R59 Discover TopK Isolated Before After` を開いて各ジョブのSummaryを見る。

## 制約

Top-K化しても、Popular/Communityのランキング用参加者集計、検索一致件数の全件集計、1文字検索の全候補評価は残る。改善しない場合はCI結果に従い候補の適用を見送り、別方式を検討する。

測定値はローカルpsqlクライアント経由。比較は同じrunner内の**前→後の固定順**なので、OSキャッシュ・負荷によるバイアスを含む。本番Cloudflareのレイテンシ、数万人同時アクセス、Supabase Free機の限界は判定できない。

## 記録

初回PRベンチ結果を確認してから効果・正式採否を追記する。
