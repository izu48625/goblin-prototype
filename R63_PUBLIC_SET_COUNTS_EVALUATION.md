# R63｜Public作品ランキングの一括集計（実験候補・本番未承認）

作成：2026-10-16。GitHub mainはR60（最新安定版）。R62の隔離SQL診断では、10万作品で厳密公開件数COUNTが約15ms、カウンター全件取得が約811ms。Public作品の人気順は約1,128ms（SQL関数本体をパラメータ固定にして直接EXPLAINした値）。ここを優先する。

## 変更候補
- `R63_PUBLIC_SET_COUNTS_HELPER.sql`：既存の `public.topics` と `private.discover_counters` をセット単位で結合。**可視性=PublicのIDのみ**、かつ`show_community=false`なら参加者数0。Private/UnlistedのID・カウンターを返さない。
- `R63_PUBLIC_SET_COUNTS_RPC_CANDIDATE.sql`：人気/Community/Remixのときに一括カウンターを使い、公開作品とJOIN。その他の検索意味、アンカー、正確なtotal、ランキング同順位のタイブレーク、JSON出力は変更しない。
- テーブル/インデックス/カウンターの書き込み動作は変更しない。Globalな長期キャッシュは追加しない。

## 重要なセキュリティ上の懸念
新ヘルパーは`SECURITY DEFINER`で既存Privateカウンターを読み、Public IDと公開件数を**まとめて返す新しいRPC**になる。Private以外は既存の単一ID RPCで公開されている数値だが、これまでよりも一度に多量の情報を読み取れるため、無料枠を消費するアクセスや公開作品の大量列挙リスクが増える。
従って**速度テストが成功しただけでは本番投入しない**。匿名RESTからヘルパーへアクセスできること自体の運用・レート制限対策や、Private移行直後の漏洩防止を確認してから採否判断する。

## 独立QA
Public/Unlisted/Private混合の1,000/10,000/50,000/100,000作品、各サイズ1/5/20/50並列×前後比較。検索結果32条件で完全JSON一致を必須とし、全作品の旧単体2つの関数との値一致、非公開が一括ヘルパーへ混ざらないこと、Public→Privateの変更直後の結果非表示を検証する。

標準GitHub Actionsで完全隔離PostgreSQL17のみ。本番Supabase/Cloudflareへは負荷を掛けない。有料プラン移行・追加費用なし。

## 採用条件
1. 完全JSON一致・全作品一致・Private隔離・公開取り消し後の安全性。
2. 人気/Community検索の高負荷性能改善と他画面の悪化がないこと。
3. 無制限公開RPCの濫用面の制限方針が明確になっていること。

試験結果後に採用/保留/不採用を明記する。
