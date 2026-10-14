# STATS MAKER｜R45以降・検索キーワードSEOロードマップ

更新：2026-10-14 / 正式ドメイン：https://statsmaker.app/ / GitHub main

## 方針
- GA4は当面OFF。同意画面や国別判定のための新規開発は不要。AdSenseとSEOにGA4は必須ではない。
- **Google検索でユーザーが入力したキーワードはGoogle Search Console（GSC、無料）で調べる。** GA4は不要。
- 検索者が必要としている内容と実際の機能が一致する独自コンテンツを優先する。検索順位は保証できない。
- Private/Unlisted作品を検索対象にしない。一般公開の作品でも権利・重複・説明の品質を維持する。

## P1｜Google Search Console導入（未完了・所有者のPC作業）
1. https://search.google.com/search-console/ から statsmaker.app のドメインプロパティを登録（サイト名は `statsmaker.app`。DNSへのTXTレコード追加など、所有権確認が必要な場合あり）。
2. 所有権が確認できたら https://statsmaker.app/sitemap.xml を「サイトマップ」から送信。サイトマップはすでに実装済みだが、Search Console送信は未確認。
3. インデックス登録の状況、除外・クロールエラー、モバイル表示を点検。新規登録から実データが見えるまで時間がかかる。
4. 「検索パフォーマンス → 検索結果」で **クエリ、表示回数、クリック数、CTR、平均掲載順位** をチェック。ページ・国・デバイスごとに絞って比較する。
5. Search ConsoleはGoogle検索結果のクエリを示すもので、ユーザーがStats Maker内で入力した検索語を追跡するものではない。

## P2｜キーワードの候補（需要・検索数は未調査）
| 日本語の検索ニーズ | 対応する機能 |
|---|---|
| グラフ 作成 無料、棒グラフ 作成 サイト | ブラウザでのグラフ作成とPNG出力 |
| レーダーチャート 作成、比較 グラフ | レーダー、Dot、Quadrant、Scatter |
| Tier表 作成、Tierリスト メーカー | Tier List テンプレート |
| ランキング表 作成、評価表 作成 | Ranking Card / 点数比較 / 評価シート |
| みんなで評価、投票 ランキング | 共同採点 Community、公開作品 |

| 英語の検索ニーズ | 対応する機能 |
|---|---|
| free graph maker, bar chart maker online | Free web-based chart creation |
| radar chart maker, comparison chart maker | Radar and comparison visualization |
| free tier list maker, ranking maker | Tier List and Ranking Card |
| rating sheet maker, collaborative rating | Rating sheets and community scores |

## P3｜ユーザーに役立つSEO改善
1. 既存の日本語 /ja/・英語 /en/ の見出し、本文、title、meta description、FAQが実際の機能を表しているか再確認する。
2. GSCの検索クエリと検索意図を確認してから、需要のあるテーマを優先する。意味のないキーワード羅列や同じ文章の大量生成は行わない。
3. グラフの使い方、架空データと明記した作成例、PNG保存、比較表、共同評価の手順などオリジナルの役立つ説明を整える。
4. Public作品の検索ページに表示されるタイトル・説明文などの品質を点検する。他の作成者の作品を無断で書き換えない。
5. GSCで月ごとに表示回数・CTR・順位・公開ページ別成果を観測し、説明文や見出しを改善する。

## 現在の状態
- 実装済：日本語/英語紹介ページ、canonical、hreflang、Public作品のSEOページ、robots.txt、Public限定sitemap。
- **未完了：Search Console所有権確認、sitemap送信、実際の検索キーワード調査、追加コンテンツ制作。**
- GA4停止。Cloudflare Web Analyticsも利用開始の確認はなく、必要なら別途設定する。
- AdSense登録・審査・広告配信は別工程。検索流入を増やすSEOと混同しない。
