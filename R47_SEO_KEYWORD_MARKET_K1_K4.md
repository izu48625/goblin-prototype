# STATS MAKER｜SEO-K1〜K4：検索意図・市場調査反映

更新：2026-10-14 JST
対象：`https://statsmaker.app/`、GitHub `izu48625/goblin-prototype`
起点main：`72a3d174ec8d984da629b2c66174d2493894172a`

## 調査の扱い
- **推定検索数は参考資料**。米国の seodata.dev 由来とされる graph maker / chart maker 系の数値、Trenzhub の tier list maker 等の数値は市場・期間が統一されない。**合計・比率比較・確定した需要・Bing実測には使わない**。
- Trenzhub は `https://trenzhub.com/t/tier_list_makers` に関連候補と推定値を掲載している（2026-10-14公開検索で存在を確認）。そこに示される「Competition Low」はGoogle自然検索で簡単に上位表示できるという意味ではない。需要とSEO難度を混同しない。
- seodata.dev の元データ更新時期と指定数値の同一条件での独立再検証は未了。特に日本語キーワードの月間検索数、今回の英語ロングテール各語の検索数は未確認。
- 競合検索結果の参考例：`https://anysweb.co.jp/radarchart20/`、`https://graph-maker.org/parameter-maker/`、`https://chartload.com/templates/player-stats/`、`https://www.tierflock.com/tier-list-maker`。レーダー専用やTier専用などのニーズが確認できるが、現時点の検索順位は保証できない。文章・外観を流用しない。

## 採用した検索意図
1. **能力値・ステータス比較**：ゲームキャラや架空の選手の複数能力を、同じ10点スケールで比較。日本語「能力値 グラフ」「スポーツ選手 能力 比較」、英語 `character stats chart` / `player comparison radar chart` と関連する意図。
2. **グラフ形式の選択**：Radarで能力のバランス、Ranking Cardで数値と順位、Tier Listで段階的なグループ分け、Scatterで2項目の関係を説明。実際の10種類のツールだけを扱う。
3. **評価・共有**：入力→点数→グラフ表示→PNG保存、必要な場合のみPublic/Community。自動的なランキング確定や未実装のテンプレート配布を宣伝しない。
4. **広い語を維持**：無料グラフ作成 / free chart maker をトップレベルのタイトルから排除しない。ロングテールは本文と専用ガイドの既存URLで自然にカバーする。

## 今回の差分
- `/ja/` と `/en/`：能力比較を具体的に伝える短い本文と `/ja|en/chart-guide.html#character-stats` / `#player-stats` への内部リンクを追加。既存4カード・H1・主要導線・canonical・hreflangは不変更。
- 日本語 `title` に能力比較、日英 `meta description` にキャラクター／選手比較を自然に反映。OGと WebSite JSON-LDのdescriptionも同期。検索結果のタイトルや表示文言はGoogle/Bing側で変わることがある。
- 既存 `/ja/chart-guide.html` と `/en/chart-guide.html` へ、**完全に架空の能力比較**のケーススタディをそれぞれ追加。キャラA/B（攻撃9/6・防御4/8・速度8/7）で合計が同じなのに形が異なること、架空選手C/Dの速度・技術・持久力を使い、レーダー／散布図／ランキングの選び方を具体化。
- ガイドのキャラクター／選手それぞれから、言語指定の本物の作成画面へHTMLのaリンク。未実装の自動プリセット/特定グラフ直接起動を装わない。
- **新規SEOページ・広告・データベース変更はなし**。既存日本語/英語ページのコンパクトUIを維持。
- R47のCIでリンク先のアンカー、SEOメタ整合、架空例、GA4停止とSEOの非公開保護を検査。

## Google・Bingの運用情報（本人報告・2026-10-14）
- Google Search Console: stats­maker.appのドメイン所有権確認とサイトマップ送信済み、/ja/・/en/は登録済み。再設定しない。
- Bing Webmaster Tools: GSCからのインポートとサイトマップ登録済み。最終報告は **Processing / 0件検出 / エラー0件**。成功処理とは断定せず、後で確認する。
- Google/Bingともに検索クエリ、表示回数、クリック数、CTR、平均順位、ページ別・国別・デバイス別データが蓄積してから優先順位を再評価する。Googleの登録だけでは上位表示は保証できない。

## 次の検証（Search Consoleに実績が出た後）
- JAとENそれぞれで「query × page × country」の実測を集計。十分な表示回数に対してCTRが低いページはタイトルと検索結果の実表示を、11〜30位程度で表示される語はページ内容の不足と導線を検証。
- 使用者が作る作品のPublic・Unlisted・Private設定と権利を守り、UGCを勝手に編集しない。
- 各SEO変更の前後は同程度の期間（例：28日間）で比較。検索エンジンのインデックス更新には遅延があるため確実な効果として主張しない。

## 安全・費用
- GA4設定 `enabled:false`・`measurementId:''` を維持。AdSense配信しない。Cloudflare Workers Free / Supabase Free のまま。DNS TXT・Google/Bingアカウント・既存ユーザー作品は変更しない。
