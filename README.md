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
