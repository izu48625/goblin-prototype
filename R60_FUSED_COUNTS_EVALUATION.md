# STATS MAKER R60｜公開作品ランキングの参加者数/Remix数一括照会（同一作品・1回）

## 問題
R59の人気順では候補作品ごとに `discover_public_participant_count_v1(id)` と `discover_public_remix_count_v1(id)` を別々のSECURITY DEFINER関数で評価する。全件ヒットする検索では候補数に比例し、10万作品・50並列のp95は隔離DBで14.81秒。

## 候補
- `R60_DISCOVER_FUSED_COUNTS_HELPER.sql`: 単一作品UUIDから**公開のみ**のparticipants/remixesを配列で返す（2件分を同じ公開確認+privateカウンター参照で取得）。
- `R60_DISCOVER_FUSED_COUNTS_RPC_CANDIDATE.sql`: 人気順・Community順・Remix順ではこの補助関数を1回呼ぶ。新着順は最終12件のみ従来の関数を呼ぶ。JSON応答、人気順の計算、同数タイブレーク、アンカー、全件数、表示範囲を保持する。
- 辞書的なキャッシュ・カウントの非同期反映は追加せず、集計はリクエスト時点の値。
- ヘルパーは SECURITY DEFINERだが、**UUID単位のみ**・非公開IDは常に0・スキーマを完全修飾・search_path空・PUBLIC実行権削除・anon/authenticatedだけ許可。既存の公開カウントヘルパーと同じ公開情報のみ返す。privateスキーマのUSAGEをanonに付与しない。
- 無関係なSupabase設定、無料枠、広告、GA4、Workerを変更しない。

## 品質確認
- R59現行関数との32パターン**完全JSON一致**（Public、Unlisted、Private混在）。
- 全件の単独カウント2関数と新しいペア関数の結果を独立に比較。非公開作品で0・show_community=falseで参加者0を確認する。
- 作品数1,000/10,000/50,000/100,000×並列1/5/20/50を、実HTTPではなく標準GitHub Actionsの使い捨てPostgres 17に対して測定。各ジョブ、現行R59→候補R60の固定順。CPU負荷とOSキャッシュのばらつきは残る。
- 改善しない場合は本番のSQLを置き換えず、計測結果だけ保存する。
- 本番へ適用する場合も、現在の関数定義が想定したものであることを確認し、動作検証・ロールバックを用意する。

## 合格条件
32条件のJSON一致・Public専用・全件カウント一致。50k/100kで高負荷p95の改善、他の条件で著しい悪化がないこと。数万人同時利用の保証にはならない。

## 結果
GitHub Actionsの `R60 Discover Fused Counts Isolated Comparison` を参照。数値はCI完了後に記録。
