(() => {
  'use strict';

  const STORAGE_KEY='statsMaker.locale';

  const messages={
    ja:{
      'viewOnly.mode':'閲覧モード',
      'viewOnly.subtitle':'編集操作を隠して結果だけを見ています',
      'viewOnly.back':'編集に戻る',
      'field.title':'表題',
      'field.titlePlaceholder':'例：歴代ジャンプ主人公評価',
      'field.description':'説明',
      'field.descriptionPlaceholder':'この表の説明（任意）',
      'field.savedSheets':'保存シート',
      'action.new':'＋ 新規',
      'action.duplicate':'複製',
      'action.delete':'削除',
      'action.addRow':'＋ 行追加',
      'action.addRowLong':'＋ 行を追加',
      'action.addMetric':'＋ 項目',
      'action.manageMetrics':'項目管理',
      'action.scoringSettings':'採点設定',
      'action.more':'その他',
      'action.settings':'⚙ 設定',
      'common.save':'保存',
      'common.cancel':'キャンセル',
      'common.apply':'適用',
      'common.close':'閉じる',
      'view.table':'表',
      'view.overview':'全体表示',
      'view.fit':'全体縮小',
      'scoring.title':'採点設定',
      'scoring.scoreMode':'点数モード',
      'scoring.score':'点数',
      'scoring.100':'100点',
      'scoring.10':'10点',
      'weight.title':'重み設定',
      'weight.short':'重み',
      'filter.search':'対象名・メモを検索',
      'filter.all':'すべて',
      'filter.cOrBelow':'C以下',
      'filter.unrated':'未採点',
      'tools.view':'閲覧',
      'tools.viewing':'閲覧中',
      'tools.backup':'バックアップ',
      'tools.restore':'復元',
      'tools.resultImage':'結果画像',
      'overview.hint':'横スクロールなしで全項目を確認',
      'fit.auto':'自動',
      'fit.width':'幅に合わせる',
      'fit.all':'全体を収める',
      'ranking.title':'ランキング',
      'ranking.metric':'ランキング項目',
      'ranking.top':'上位',
      'ranking.bottom':'下位',
      'compare.title':'比較',
      'compare.all':'すべて',
      'compare.clear':'全解除',
      'compare.radar':'レーダー',
      'compare.bars':'横棒',
      'compare.hintDefault':'好きな数だけ選択して比較できます。',
      'summary.title':'シート概要',
      'summary.autoSave':'自動保存',
      'summary.targets':'対象',
      'summary.metrics':'評価項目',
      'summary.topAverage':'最高平均',
      'summary.completion':'入力率',
      'summary.imageNote':'画像は端末から選択後、約160pxに自動縮小してこのブラウザ内に保存します。大量の高解像度画像を保存する用途ではありません。',
      'status.initial':'編集内容はブラウザへ自動保存されます。',
      'note.edit':'メモ編集',
      'note.title':'メモ',
      'note.help':'この対象について自由に感想・理由・補足を残せます。',
      'note.placeholder':'例：序盤はゆっくりだが終盤の盛り上がりが最高。',
      'weight.help':'重要な項目ほど右へ。右端の％が総合点に占める実際の比率です。',
      'weight.equal':'均等配分',
      'weight.info':'各スライダーは「比率」として扱います。合計値を100に合わせる必要はありません。例：3・2・1なら、自動的に50%・33.3%・16.7%として総合点へ反映します。',
      'weight.total':'実際の配分 合計100%',
      'import.title':'バックアップを復元',
      'import.help':'Stats Makerから書き出したJSONファイルを選択してください。現在の保存データと置き換わります。',
      'import.choose':'JSONファイルを選択',
      'import.tap':'タップしてファイルを開く',
      'share.alt':'Stats Maker 結果画像',
      'share.saveShare':'保存 / 共有',
      'share.help':'iPhoneでは「保存 / 共有」を押すと共有シートを開きます。対応していない環境ではPNGを保存します。',

      'fallback.target':'対象{n}',
      'fallback.metric':'評価{n}',
      'fallback.untitledSheet':'無題のシート',
      'fallback.newTopic':'新しいお題',
      'fallback.copySuffix':' のコピー',
      'metric.overallAverage':'総合平均',
      'table.imageTarget':'画像 / 対象',
      'table.target':'対象',
      'table.average':'平均',
      'table.rank':'ランク',
      'table.note':'メモ',
      'table.targetName':'対象名',
      'aria.editMetric':'{name}の名前を編集',
      'aria.sortAsc':'{name}を昇順',
      'aria.sortDesc':'{name}を降順',
      'aria.chooseImage':'画像を選択',
      'aria.removeImage':'画像を削除',
      'aria.progress':'入力進捗',
      'aria.note':'メモ',
      'aria.up':'上へ',
      'aria.down':'下へ',
      'aria.left':'左へ',
      'aria.right':'右へ',
      'aria.delete':'削除',
      'aria.deleteMetric':'{name}を削除',

      'save.auto':'自動保存しました。',
      'save.saving':'保存中…',
      'save.saved':'保存済み',
      'save.failed':'保存失敗',
      'save.quota':'保存容量が不足しました。画像を減らすか、不要なシートを削除してください。',
      'backup.shareTitle':'Stats Maker バックアップ',
      'backup.shared':'バックアップJSONを共有/保存しました。',
      'backup.exported':'バックアップJSONを書き出しました。',
      'backup.restored':'バックアップを復元しました。',
      'backup.invalid':'このJSONはStats Makerのバックアップとして読み込めませんでした。',
      'csv.exported':'CSVを書き出しました。',
      'image.failed':'画像を生成できませんでした。',
      'image.processing':'画像を処理しています…',
      'image.added':'画像を追加しました。',
      'image.readFailed':'画像を読み込めませんでした。別の画像を試してください。',
      'image.removed':'画像を削除しました。',
      'metric.editPrompt':'評価項目名を編集',
      'metric.saved':'評価項目名を保存しました。',
      'metric.moved':'評価項目を移動しました。',
      'metric.lastCannotDelete':'最後の1項目は削除できません。',
      'metric.deleteConfirm':'評価項目「{name}」を削除しますか？\n全対象のこの項目の点数も削除されます。',
      'metric.deleted':'{name} を削除しました。',
      'metric.max':'評価項目は最大{max}個までです。',
      'metric.added':'評価項目を追加しました。',
      'row.lastCannotDelete':'最後の1行は削除できません。',
      'row.deleteConfirm':'「{name}」を削除しますか？\nこの行の点数・メモも削除されます。',
      'row.deleted':'行を削除しました。',
      'row.moved':'評価対象を移動しました。',
      'row.max':'行は最大{max}件までです。',
      'row.added':'新しい行を追加しました。絞り込みは「すべて」に戻しました。',
      'sort.done':'{metric}を{direction}に並べ替えました。以後、採点しても順番は自動では変わりません。',
      'sort.asc':'昇順',
      'sort.desc':'降順',
      'compare.choose':'比較する対象を選択',
      'compare.noCommon':'共通して採点済みの項目がありません',
      'compare.needThree':'レーダー表示には全員が採点済みの共通項目が3つ以上必要です',
      'compare.chooseLong':'比較する対象を選択してください。',
      'compare.noScored':'選択した対象に採点済みの項目がありません。',
      'compare.none':'好きな数だけ選択できます。',
      'compare.many':'{count}件を比較中。件数が多い場合は「横棒」が見やすいです。',
      'compare.count':'{count}件を比較中。',
      'compare.addAll':'すべての対象を比較に追加しました。',
      'compare.clearAll':'比較対象をすべて解除しました。',
      'weight.weightedSummary':'加重平均：{parts}',
      'weight.enabled':'重み付けをONにしました。',
      'weight.disabled':'重み付けをOFFにしました。',
      'weight.distribution':'配分',
      'weight.updated':'重み設定を更新しました。',
      'scale.changed':'{scale}点モードへ変更しました。既存点数も自動変換しています。',
      'note.forTarget':'メモ：{name}',
      'note.saved':'メモを保存しました。',
      'sheet.created':'新しいシートを作成しました。',
      'sheet.duplicated':'シートを複製しました。',
      'sheet.lastCannotDelete':'最後の1シートは削除できません。',
      'sheet.deleteConfirm':'シート「{name}」を削除しますか？\nこの操作は元に戻せません。',
      'sheet.deleted':'シートを削除しました。',
      'sheet.switched':'シートを切り替えました。',
      'count.filtered':'{visible}/{total}件',
      'share.summary':'{rows}対象 / {cols}項目 / {scale}点満点'
    },

    en:{
      'viewOnly.mode':'View Mode',
      'viewOnly.subtitle':'Editing controls are hidden so you can focus on results.',
      'viewOnly.back':'Back to Editing',
      'field.title':'Title',
      'field.titlePlaceholder':'e.g. All-Time Jump Protagonists',
      'field.description':'Description',
      'field.descriptionPlaceholder':'Optional description for this sheet',
      'field.savedSheets':'Saved Sheets',
      'action.new':'＋ New',
      'action.duplicate':'Duplicate',
      'action.delete':'Delete',
      'action.addRow':'＋ Add Row',
      'action.addRowLong':'＋ Add Row',
      'action.addMetric':'＋ Metric',
      'action.manageMetrics':'Manage Metrics',
      'action.scoringSettings':'Scoring',
      'action.more':'More',
      'action.settings':'⚙ Settings',
      'common.save':'Save',
      'common.cancel':'Cancel',
      'common.apply':'Apply',
      'common.close':'Close',
      'view.table':'Table',
      'view.overview':'Overview',
      'view.fit':'Fit View',
      'scoring.title':'Scoring Settings',
      'scoring.scoreMode':'Scoring Scale',
      'scoring.score':'Score',
      'scoring.100':'100 pts',
      'scoring.10':'10 pts',
      'weight.title':'Weight Settings',
      'weight.short':'Weight',
      'filter.search':'Search targets or notes',
      'filter.all':'All',
      'filter.cOrBelow':'C or lower',
      'filter.unrated':'Unrated',
      'tools.view':'View',
      'tools.viewing':'Viewing',
      'tools.backup':'Backup',
      'tools.restore':'Restore',
      'tools.resultImage':'Result Image',
      'overview.hint':'See all metrics without horizontal scrolling',
      'fit.auto':'Auto',
      'fit.width':'Fit Width',
      'fit.all':'Fit All',
      'ranking.title':'Ranking',
      'ranking.metric':'Ranking Metric',
      'ranking.top':'Top',
      'ranking.bottom':'Bottom',
      'compare.title':'Compare',
      'compare.all':'All',
      'compare.clear':'Clear',
      'compare.radar':'Radar',
      'compare.bars':'Bars',
      'compare.hintDefault':'Select as many targets as you want to compare.',
      'summary.title':'Sheet Summary',
      'summary.autoSave':'Auto Save',
      'summary.targets':'Targets',
      'summary.metrics':'Metrics',
      'summary.topAverage':'Top Avg',
      'summary.completion':'Complete',
      'summary.imageNote':'Images are resized to about 160px and stored in this browser. This is not intended for storing large numbers of high-resolution images.',
      'status.initial':'Edits are saved automatically in this browser.',
      'note.edit':'Edit Note',
      'note.title':'Note',
      'note.help':'Add any thoughts, reasons, or extra details about this target.',
      'note.placeholder':'e.g. Slow start, but the ending is excellent.',
      'weight.help':'Move more important metrics to the right. The percentage shows the actual share of the overall score.',
      'weight.equal':'Equal Weights',
      'weight.info':'Each slider is treated as a relative ratio, so the values do not need to total 100. For example, 3·2·1 becomes 50%·33.3%·16.7%.',
      'weight.total':'Actual distribution: 100% total',
      'import.title':'Restore Backup',
      'import.help':'Choose a JSON file exported from Stats Maker. It will replace the currently saved data.',
      'import.choose':'Choose JSON File',
      'import.tap':'Click or tap to open a file',
      'share.alt':'Stats Maker result image',
      'share.saveShare':'Save / Share',
      'share.help':'On supported devices, Save / Share opens the system share sheet. Otherwise the PNG is downloaded.',

      'fallback.target':'Target {n}',
      'fallback.metric':'Metric {n}',
      'fallback.untitledSheet':'Untitled Sheet',
      'fallback.newTopic':'New Topic',
      'fallback.copySuffix':' Copy',
      'metric.overallAverage':'Overall Average',
      'table.imageTarget':'Image / Target',
      'table.target':'Target',
      'table.average':'Average',
      'table.rank':'Grade',
      'table.note':'Note',
      'table.targetName':'Target name',
      'aria.editMetric':'Edit {name}',
      'aria.sortAsc':'Sort {name} ascending',
      'aria.sortDesc':'Sort {name} descending',
      'aria.chooseImage':'Choose image',
      'aria.removeImage':'Remove image',
      'aria.progress':'Input progress',
      'aria.note':'Note',
      'aria.up':'Move up',
      'aria.down':'Move down',
      'aria.left':'Move left',
      'aria.right':'Move right',
      'aria.delete':'Delete',
      'aria.deleteMetric':'Delete {name}',

      'save.auto':'Saved automatically.',
      'save.saving':'Saving…',
      'save.saved':'Saved',
      'save.failed':'Save failed',
      'save.quota':'Browser storage is full. Remove some images or unused sheets.',
      'backup.shareTitle':'Stats Maker Backup',
      'backup.shared':'Backup JSON was shared/saved.',
      'backup.exported':'Backup JSON was exported.',
      'backup.restored':'Backup restored.',
      'backup.invalid':'This JSON could not be read as a Stats Maker backup.',
      'csv.exported':'CSV exported.',
      'image.failed':'Could not generate the image.',
      'image.processing':'Processing image…',
      'image.added':'Image added.',
      'image.readFailed':'Could not read that image. Please try another file.',
      'image.removed':'Image removed.',
      'metric.editPrompt':'Edit metric name',
      'metric.saved':'Metric name saved.',
      'metric.moved':'Metric moved.',
      'metric.lastCannotDelete':'You cannot delete the last metric.',
      'metric.deleteConfirm':'Delete metric “{name}”?\nScores for this metric will be deleted for every target.',
      'metric.deleted':'Deleted {name}.',
      'metric.max':'You can have up to {max} metrics.',
      'metric.added':'Metric added.',
      'row.lastCannotDelete':'You cannot delete the last row.',
      'row.deleteConfirm':'Delete “{name}”?\nThis row’s scores and note will also be deleted.',
      'row.deleted':'Row deleted.',
      'row.moved':'Target moved.',
      'row.max':'You can have up to {max} rows.',
      'row.added':'A new row was added. Filters were reset to All.',
      'sort.done':'Sorted {metric} {direction}. Editing scores will not automatically reorder rows.',
      'sort.asc':'ascending',
      'sort.desc':'descending',
      'compare.choose':'Select targets to compare',
      'compare.noCommon':'No commonly scored metrics are available',
      'compare.needThree':'Radar view needs at least 3 metrics scored by everyone selected',
      'compare.chooseLong':'Select targets to compare.',
      'compare.noScored':'The selected targets have no scored metrics.',
      'compare.none':'Select as many targets as you want.',
      'compare.many':'Comparing {count} targets. Bars are easier to read with larger selections.',
      'compare.count':'Comparing {count} targets.',
      'compare.addAll':'Added all targets to comparison.',
      'compare.clearAll':'Cleared all comparison targets.',
      'weight.weightedSummary':'Weighted average: {parts}',
      'weight.enabled':'Weighting turned on.',
      'weight.disabled':'Weighting turned off.',
      'weight.distribution':'share',
      'weight.updated':'Weight settings updated.',
      'scale.changed':'Changed to the {scale}-point scale. Existing scores were converted automatically.',
      'note.forTarget':'Note: {name}',
      'note.saved':'Note saved.',
      'sheet.created':'New sheet created.',
      'sheet.duplicated':'Sheet duplicated.',
      'sheet.lastCannotDelete':'You cannot delete the last sheet.',
      'sheet.deleteConfirm':'Delete sheet “{name}”?\nThis cannot be undone.',
      'sheet.deleted':'Sheet deleted.',
      'sheet.switched':'Sheet switched.',
      'count.filtered':'{visible}/{total}',
      'share.summary':'{rows} targets / {cols} metrics / {scale}-point scale'
    }
  };

  function normalizeLocale(value){
    const v=String(value||'').toLowerCase();
    return v.startsWith('ja')?'ja':'en';
  }

  function detectInitialLanguage(){
    const urlLang=new URLSearchParams(location.search).get('lang');
    if(urlLang)return normalizeLocale(urlLang);
    const stored=localStorage.getItem(STORAGE_KEY);
    if(stored)return normalizeLocale(stored);
    return normalizeLocale(navigator.language||'en');
  }

  let locale=detectInitialLanguage();

  function t(key,vars={}){
    let value=messages[locale]?.[key] ?? messages.en[key] ?? messages.ja[key] ?? key;
    return String(value).replace(/\{(\w+)\}/g,(_,name)=>
      Object.prototype.hasOwnProperty.call(vars,name)?String(vars[name]):`{${name}}`
    );
  }

  function applyTranslations(){
    document.documentElement.lang=locale;

    document.querySelectorAll('[data-i18n]').forEach(el=>{
      el.textContent=t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{
      el.setAttribute('placeholder',t(el.dataset.i18nPlaceholder));
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el=>{
      el.setAttribute('aria-label',t(el.dataset.i18nAria));
    });
    document.querySelectorAll('[data-i18n-alt]').forEach(el=>{
      el.setAttribute('alt',t(el.dataset.i18nAlt));
    });
    document.querySelectorAll('[data-lang]').forEach(el=>{
      el.classList.toggle('active',el.dataset.lang===locale);
      el.setAttribute('aria-pressed',el.dataset.lang===locale?'true':'false');
    });
  }

  function setLanguage(next){
    const normalized=normalizeLocale(next);
    if(normalized===locale){
      applyTranslations();
      return;
    }
    locale=normalized;
    localStorage.setItem(STORAGE_KEY,locale);
    applyTranslations();
    window.dispatchEvent(new CustomEvent('statsmaker:languagechange',{detail:{locale}}));
  }

  function getLanguage(){return locale}

  window.SM_I18N={t,setLanguage,getLanguage,applyTranslations,detectInitialLanguage};

  document.querySelectorAll('[data-lang]').forEach(btn=>{
    btn.addEventListener('click',()=>setLanguage(btn.dataset.lang));
  });

  applyTranslations();
})();