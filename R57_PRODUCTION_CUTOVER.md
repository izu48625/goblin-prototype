# STATS MAKER｜R57 本番検索高速化・インデックス入替え実績

実施：2026-10-16（JST）／公開URL：https://statsmaker.app/  
R57 CI基準：main `d974eaf6b6addb9df051aa833faf68e323755472`（PR #187）

## 結論
**隔離50,000作品で検索時間を約81〜96%削減する案を、本番にも適用済み。**
模擬作品は隔離Postgresのみ。実本番作品11件はID/タイトル/採点/公開状態の編集なし。
本番Supabase料金プランFreeは維持。AdSense審査待ち、GA4 OFF、課金追加なし。

## 実施した3つのDB変更
1. `r57_precomputed_search_columns_and_indexes`：`public.topics` に日本語／英語の検索文字列を保持する **STORED GENERATED** 列 `discover_search_text_ja/en` と、Public専用の2つのGIN trigram索引を作成。生成列はタイトル・説明・snapshotが更新される際にPostgresが自動で再計算する。
2. `r57_precomputed_search_rpc_cutover`：読み取りRPC `public.discover_public_works_v1` の検索条件を、従来の毎回のJSONB変換から生成列参照へ切り替え。関数の引数・レスポンス・権限・Public限定・総数計算・ソート・ページングは維持。
3. `r57_remove_redundant_expression_search_indexes`：本番で28条件の返却JSON完全一致と匿名権限・生成列整合性を確認した後、既存の重複する `topics_discover_search_ja_trgm_idx`／`topics_discover_search_en_trgm_idx` を削除。新しい2索引は維持し、検索系索引の二重更新を避ける。

## 数値・安全性

| 隔離PostgreSQL 17・50,000作品 | R56 | R57 | 短縮 |
|---|---:|---:|---:|
| 日本語1語「サッカー」 | 1,941.205 ms | 108.766 ms | 約94% |
| 日本語2語 | 2,782.812 ms | 115.712 ms | 約96% |
| 英語1語・人気順 | 2,389.434 ms | 460.455 ms | 約81% |

- **28/28** の検索結果JSON完全一致。日本語／英語、1文字、記号`%`/`_`/`!`、多語、人気/Community/Remix、カテゴリ、空検索、深いoffset。
- 作品タイトル・説明・snapshotの編集後、生成列と検索結果が同期することをテスト。Private作品が検索に混入しない。
- **実本番の切り替え前後でも28/28のJSON MD5完全一致**。
- 匿名実行で「サッカー」の結果7件、全件Public、匿名ユーザーが参照できるPrivate作品0件。
- 旧インデックス整理後、作品数11件（すべてPublic）、生成列の差異JA/ENとも0、残存する検索インデックスは新しい2個だけ。
- 本番DB全体は前後とも **約12MB**、作品テーブル／その索引は旧インデックス整理後 **288KB**。Supabase Free上限とは大きく離れている。
- 本番11件での「サッカー」単発DB内部EXPLAIN実行時間は約8.268ms（デプロイ/同時ユーザーのp95ではなく、測定環境の異なるR56以前の値との厳密比較は不可）。
- 隔離50kでのtopics総サイズ55MBは**旧索引と新索引の二重維持中**の計測。索引整理後の隔離50kでの正確な使用量、実サービス全体の転送量、同時端末負荷は未計測。

## リスク・復旧
- 検索速度改善の代償として、生成列2つがタイトル・説明・snapshotの更新時に再計算される。作品更新が集中する状況での書込遅延は別途検証。
- `public.html` の`select('*')`などは生成列も読み出すため、転送量は従来より若干増える可能性がある。今後明示的な列選択に修正する候補。
- 生成列を加えるDBマイグレーションにはテーブル書き換え／ロックが発生しうるため、大量作品が存在する他環境にSQLをそのまま実行しない。
- 旧RPCへの即時復旧は [R57_PRODUCTION_SEARCH_ROLLBACK.sql](R57_PRODUCTION_SEARCH_ROLLBACK.sql)。旧式GIN索引を再作成する必要があれば [R57_RESTORE_LEGACY_SEARCH_INDEXES.sql](R57_RESTORE_LEGACY_SEARCH_INDEXES.sql)。新生成列の除去は別手順 [R57_OPTIONAL_SCHEMA_CLEANUP_ROLLBACK.sql](R57_OPTIONAL_SCHEMA_CLEANUP_ROLLBACK.sql)（最後の方法は本番では未実行）。
- 本番ユーザーの作品・スコアを変更しない。料金プランの自動変更・実広告導入・GA4送信は行わない。

## リリースゲート
- PR #187で全8チェック成功、隔離50kの28件厳密比較・更新・Private安全性を確認。
- R57本番移行記録PRで本番 `/api/discover` のGET-only確認および既存の静的UI/保存/セキュリティの回帰テストを実行する。
- 目標「数万人同時アクセスでも快適」は**まだ証明していない**。後続では1/5/20/50同時端末/API、Supabase転送量、広域検索・ランキング・Community更新負荷を監視する。
