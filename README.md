# Stats Maker — 現行正式版

**正式サービス:** https://statsmaker.app/

**開発方針（2026-10-11）:** [ROADMAP_R31_PLUS.md](ROADMAP_R31_PLUS.md) を優先して参照してください。
Google / Apple認証の追加・複雑なゲストID管理は開発ロードマップから外し、Home、グラフ、Discover、Community、iPhone Safariの品質を優先します。

**正式なユーザー向け拡張機能:** Ranking Card / Stat Card / Bar Chart / Radar Chart / Quadrant / Dot Chart / Range / Dumbbell / Scatter / Tier List / Ring Gauge / Image Line の11種類。
Heatmap、Waffle、Stat Boardはユーザー向け拡張機能から廃止されています（内部レガシーコードが残る可能性あり）。

---

## 過去バージョンの開発記録（R8/R9・現行仕様ではありません）

# Stats Maker V2 LOCAL COMPLETE R8

ローカル機能を先に完成させるための統合基準版。

## Visualization
1. Ranking Card
2. Stat Card
3. Quadrant
4. Bar
5. Radar
6. Dot
7. Ring Gauge
8. Tier List
9. Heatmap
10. Scatter
11. Range / Dumbbell
12. Waffle
13. Stat Board

## 共通ローカル機能
- Local-first Project
- My Projects
- Duplicate / Rename / Delete
- Auto Save
- Undo / Redo
- Theme
- Typography
- Color
- Canvas presets / Custom
- Transparent Background
- PNG Export
- JPG Export
- Project JSON Backup
- Project JSON Restore
- Image Manager
  - Upload
  - Drag & Drop
  - Paste
  - IndexedDB
- Excel / Google Sheets Paste
- CSV / TSV Import
- Spreadsheet Editor
- ja / en
- iPhone / Android / iPad / PC

## Visualization仕上げ

### Tier
- Auto
- Manual
- Manual tier selector
- Tier label / threshold編集
- 最大10段階

### Heatmap
- Blue
- Green
- Red
- Heat
- Cool
- Rainbow
- Matrix Editor

### Scatter
- Average
- Median
- Trend line
- Category color
- Labels

### Range
- Value差
- %差
- 増減色

### Waffle
- 10×10
- 5×20
- 5×10

### Stat Board
Grid Block型。
- Hero
- Number
- Ring
- Progress
- Text
- 1 / 2 / 3 Columns
- Block順序変更
- Span変更
- Gap変更

## 次
このR8を実機で検閲する。
ローカルでの使い勝手・デザイン修正が終わったら、
Publish / Community / Remixへ進む。


## R9 Local Final Polish
- Share wording replaces PNG-save wording.
- Ranking / Bar preserve the current TOP N when the source metric changes.
- Stat Card shows only the selected target's actually scored criteria.
- Ring Gauge shows only the selected target's scored criteria.
- Quadrant / Scatter and Range automatically avoid identical paired axes.
- Radar removes axes with no data across all currently selected subjects.
- Tier rows are sorted high-to-low within each tier.
- Scatter labels move away from chart edges.
- Long Japanese names and labels wrap more safely.
- Ring layout adapts to the number of displayed criteria.


## R9 Formal Split Shell
- `/v2/` now opens the legacy/base Stats Maker sheet first.
- The 10 V2 visual tools open from the floating `拡張機能` launcher.
- Base sheet names, criteria, scores, notes and row images are bridged into V2 source-linked projects.
- Editor back button returns to the extension picker over the base screen.
- The old standalone "何を作りますか？" V2 home is no longer the formal entry screen.


## R70 Image Line（画像付き折れ線グラフ）
- 拡張機能 → 画像グラフ → **Image Line** から作成できます。
- 基本表に評価と画像があれば、評価行の並びを維持したまま、画像を項目別の縦帯背景として使います。基本表に画像がない場合は色帯を表示します。
- 編集画面の **DATA** では項目ごとの画像アップロード（基本表の画像をローカル上書き可能）、表示件数1〜40、最小値・最大値、画像の濃さ、点数・目盛・ラベル表示を変更できます。自由編集の作品なら名前・点数・並びも編集できます。
- **STYLE** で線の色（accent）や背景色、テーマを変更し、**CANVAS** で横長の画像サイズを変更できます。
- プレビューとPNG/JPG書き出しは同じCanvas描画処理を使い、iPhone SafariでもSVG/HTMLキャプチャに依存しません。
- アップロード画像は従来の画像マネージャーと同様、各ブラウザ内のIndexedDBに保存されます。JSON書き出しは画像の参照を保存しますが、画像ファイル本体を別端末へ移すものではありません。
- 他者の著作物の使用と再公開は利用権・引用等の条件をご確認ください。
