# R70 follow-up | Cloudflare Free OG 600×315 のQA整合（2026-10-24）

R70本番反映後、`Production Smoke Test`と`OGP Smoke Test`が失敗した理由は、サイト機能ではなく**旧テストの画像寸法期待値が実装と異なったため**。

- 現在の`worker/og-image.js`：Cloudflare Workers Free向けの4bit indexed PNGを **600×315** で生成（ソース先頭 `WIDTH=600, HEIGHT=315`）。
- `worker/index.js` のOGメタ情報：`og:image:width=600`、`og:image:height=315`、`private,no-store`。
- 本番GET（CIログ）：PNGヘッダーとContent-Typeの検証には成功、寸法は **600×315**。
- 旧`scripts/production-smoke.mjs`と`.github/workflows/ogp-smoke.yml`だけが **1200×630** を強制し、誤った不合格を出していた。

修正：2つのスモークテストを実装・公開メタ情報と一致させる。**Workerの実画像処理、可視性、配信先、メタ情報、サイズ、課金/Free枠、PNGキャッシュ方針には変更なし。**

なお、600×315はOGカードの約1.90:1比率を満たす。大きなPNGへの変更はCPU・通信量を増やすため本修正では行わない。

検証方法：mainへ反映後に`OGP Smoke Test`（PNG寸法の実測）および`Production Smoke Test`（RLS、画像、編集、保存、共有）を改めて実行して両方成功したことを確認する。
