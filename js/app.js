/**
 * 🎹 智慧和弦轉調與組成音查詢工具 - 前端應用程式主控制器 (js/app.js)
 *
 * 負責：
 * 1. 全域狀態管理 (原調 sourceKey、目標調 targetKey、顯示模式 displayMode、分頁切換 activeTab)
 * 2. 新調性升降記號、自然音階與小調導音提示橫幅渲染
 * 3. 【模式一：調性對應和弦 ＆ 組成音總表】自動產生 1~7 級常用對應和弦與組成音對照表 + 特殊和弦快速換算
 * 4. 【模式二：互動鋼琴鍵盤 ＆ 整首和弦工作台】3 八度互動式 SVG 鋼琴鍵盤與整首範例譜批次轉調
 */

(function () {
  'use strict';

  // ============================================================================
  // 1. 調性對應和弦總表之標準級數家族定義 (涵蓋大調與小調簡譜最常出現的和弦)
  // ============================================================================

  const REFERENCE_CHORD_CATALOG = [
    // 1 級 (Do)
    { degreeRaw: '1',       group: '1', isCommon: true,  roleNote: '大調主和弦 / 小調三級和弦' },
    { degreeRaw: '1M7',     group: '1', isCommon: true,  roleNote: '一級大七和弦 (抒情常用)' },
    { degreeRaw: '17',      group: '1', isCommon: false, roleNote: '一級屬七 (往四級過渡)' },
    { degreeRaw: '1add9',   group: '1', isCommon: false, roleNote: '一級加九和弦' },

    // 2 級 (Re)
    { degreeRaw: '2m',      group: '2', isCommon: true,  roleNote: '二級小和弦 / 小調四級下屬和弦' },
    { degreeRaw: '2m7',     group: '2', isCommon: true,  roleNote: '二級小七和弦 (2-5-1 進行核心)' },
    { degreeRaw: '2m7b5',   group: '2', isCommon: true,  roleNote: '二級半減七 (小調 2-37-6m 常用)' },
    { degreeRaw: '27',      group: '2', isCommon: false, roleNote: '二級副屬七和弦' },

    // 3 級 (Mi)
    { degreeRaw: '3m',      group: '3', isCommon: true,  roleNote: '三級小和弦' },
    { degreeRaw: '3m7',     group: '3', isCommon: false, roleNote: '三級小七和弦' },
    { degreeRaw: '37',      group: '3', isCommon: true,  roleNote: '⭐ 小調五級屬七導音和弦 (極常用)' },
    { degreeRaw: '37-9+5',  group: '3', isCommon: true,  roleNote: '⭐ 小調屬七降九升五 (演歌/國台語常用)' },

    // 4 級 (Fa)
    { degreeRaw: '4',       group: '4', isCommon: true,  roleNote: '四級大三和弦 (下屬和弦)' },
    { degreeRaw: '4M7',     group: '4', isCommon: true,  roleNote: '四級大七和弦 (《償還》間奏常用)' },
    { degreeRaw: '4m',      group: '4', isCommon: true,  roleNote: '四級小和弦 (抒情歌借用和弦)' },
    { degreeRaw: '4m6',     group: '4', isCommon: false, roleNote: '四級小六和弦' },

    // 5 級 (Sol)
    { degreeRaw: '5',       group: '5', isCommon: true,  roleNote: '五級大三屬和弦' },
    { degreeRaw: '57',      group: '5', isCommon: true,  roleNote: '五級屬七和弦 (返回 1 級)' },
    { degreeRaw: '5sus4',   group: '5', isCommon: true,  roleNote: '五級掛四和弦 (解決至 5 或 57)' },
    { degreeRaw: '5m6/7b',  group: '5', isCommon: false, roleNote: '五級小六轉位和弦 (《償還》過門)' },

    // 6 級 (La)
    { degreeRaw: '6m',      group: '6', isCommon: true,  roleNote: '⭐ 小調主和弦 / 大調六級關係小和弦' },
    { degreeRaw: '6m7',     group: '6', isCommon: false, roleNote: '六級小七和弦' },
    { degreeRaw: '6',       group: '6', isCommon: false, roleNote: '六級大三和弦 (經過和弦)' },
    { degreeRaw: '67',      group: '6', isCommon: true,  roleNote: '六級副屬七 (導向 2m)' },
    { degreeRaw: '67+5',    group: '6', isCommon: false, roleNote: '六級屬七升五 (導向 2m)' },

    // 7 級與變化級數 (Si / b7 / b3)
    { degreeRaw: '7b',      group: '7', isCommon: true,  roleNote: '降七級大和弦 (bVII)' },
    { degreeRaw: 'b3',      group: '7', isCommon: false, roleNote: '降三級借用和弦 (如 C 調中的 bE)' },
    { degreeRaw: '77',      group: '7', isCommon: false, roleNote: '七級副屬七 (導向 37 或 3m)' },
    { degreeRaw: '7m7b5',   group: '7', isCommon: false, roleNote: '七級導音半減七和弦' }
  ];

  // ============================================================================
  // 2. 內建實譜範例資料 (模式二工作台使用)
  // ============================================================================

  const PRESET_SHEETS = {
    changHuan: {
      title: '《償還》鄧麗君 (電子琴方框級數譜 - 全曲)',
      sourceKey: 'Am',
      targetKey: 'Cm',
      quickTargets: [
        { label: '女調建議 (Cm)', key: 'Cm' },
        { label: '男調建議 (Fm)', key: 'Fm' },
        { label: '原譜預設 (Am)', key: 'Am' },
        { label: 'Dm 小調', key: 'Dm' }
      ],
      content: `[Intro I 前奏]
6m | 2m | 37 | 6m

[Main A 主歌 A]
6m | 2m | 37 | 6m | 37 | 37-9+5

[Main B 主歌 B]
6m | 6 67 67+5 | 2m | 6m | 77 | 37 | 6m

[Main C 副歌 C]
2m7 | 37 | 6m | 2m | 57 | 1 | 7b 5m6/7b

[Main D 間奏與尾段]
67 | 2m | 37 | 6m | /5 | 4M7 | 77 | 37 37-9+5 | 6m`
    },

    kawaNoNagare: {
      title: '《川の流れのように》美空雲雀 (紅色英文和弦譜 - 全曲)',
      sourceKey: 'C',
      targetKey: 'D',
      quickTargets: [
        { label: '譜面建議 C+2 (D大調)', key: 'D' },
        { label: '原譜預設 (C大調)', key: 'C' },
        { label: 'F 大調', key: 'F' },
        { label: 'G 大調', key: 'G' },
        { label: 'Eb 大調 (bE)', key: 'Eb' }
      ],
      content: `[Main A 主歌 1]
C | Am | C | Em | Dm G | C | Am | Em F G C | Am

[Main B 主歌 2]
Em | Am | Em | F Fm | Em Am | Dm | Gsus4 | G

[Main C 副歌 1]
C CM7 | C7 | Em | bE | Dm | Em | F D7 | Gsus4 G

[Main D 副歌 2 & 尾奏]
C CM7 | C7 | Em | bE | Dm | Em | Fm | Gsus4 | C`
    }
  };

  const KEY_OPTIONS_MINOR = ['Am', 'Bbm', 'Bm', 'Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m'];
  const KEY_OPTIONS_MAJOR = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

  // ============================================================================
  // 3. 應用程式狀態 (App State)
  // ============================================================================

  const state = {
    sourceKey: 'C',
    targetKey: 'C',
    displayMode: 'english', // 'english' | 'number' | 'practice'
    audioEnabled: true,
    activeTab: 'tab-reference-table',
    degreeFilter: 'common', // 'common' | 'all' | '1' ~ '7'
    activePresetKey: 'changHuan',
    selectedRawChord: 'C',
    selectedCardIndex: null,
    // T2-3 原譜覆蓋標籤互動與樣式狀態
    selectedSheetTagId: null,
    addChordOnSheetMode: false,
    tagsVisible: true,
    tagStyle: 'red-box', // 'red-box' | 'clean-cover' | 'blue-box' | 'yellow-box'
    tagFontSize: 15,
    inlinePianoVisible: true
  };

  // ============================================================================
  // 4. DOM 元素參照與初始化
  // ============================================================================

  const els = {};

  function initDOMReferences() {
    els.sourceKeySelect = document.getElementById('sourceKeySelect');
    els.targetKeySelect = document.getElementById('targetKeySelect');
    els.btnSemitoneDown = document.getElementById('btnSemitoneDown');
    els.btnSemitoneReset = document.getElementById('btnSemitoneReset');
    els.btnSemitoneUp = document.getElementById('btnSemitoneUp');
    els.modeButtons = document.querySelectorAll('.mode-btn');
    els.btnAudioToggle = document.getElementById('btnAudioToggle');

    // 分頁切換按鈕與面板
    els.viewTabBtns = document.querySelectorAll('.view-tab-btn');
    els.tabPanes = document.querySelectorAll('.tab-pane');

    // 新調性升降記號橫幅
    els.ksBanner = document.getElementById('keySignatureBanner');

    // 模式一：調性對應和弦與組成音總表
    els.refTableTitle = document.getElementById('refTableTitle');
    els.thSourceKeyName = document.getElementById('thSourceKeyName');
    els.thTargetKeyName = document.getElementById('thTargetKeyName');
    els.quickPairBtns = document.querySelectorAll('.quick-pair-btn');
    els.quickSingleChordInput = document.getElementById('quickSingleChordInput');
    els.quickSingleChordResult = document.getElementById('quickSingleChordResult');
    els.degreeFilterBtns = document.querySelectorAll('#degreeFilterBtns button');
    els.chordRefTableBody = document.getElementById('chordRefTableBody');

    // 模式二 (T2-1 & T2-2)：琴譜 PDF / JPG 載入、高清預覽與 Gemini AI 抓譜區
    els.sheetViewerStatus = document.getElementById('sheetViewerStatus');
    els.sheetDropZone = document.getElementById('sheetDropZone');
    els.sheetFileInput = document.getElementById('sheetFileInput');
    els.btnLoadSamplePdf = document.getElementById('btnLoadSamplePdf');
    els.btnLoadSampleJpg = document.getElementById('btnLoadSampleJpg');
    els.btnRunAiRecognize = document.getElementById('btnRunAiRecognize');
    els.btnForceAiRecognize = document.getElementById('btnForceAiRecognize');
    els.aiRecognizeSummary = document.getElementById('aiRecognizeSummary');
    els.apiKeyStatusBadge = document.getElementById('apiKeyStatusBadge');
    els.btnToggleApiKeyBox = document.getElementById('btnToggleApiKeyBox');
    els.apiKeyConfigBox = document.getElementById('apiKeyConfigBox');
    els.geminiApiKeyInput = document.getElementById('geminiApiKeyInput');
    els.geminiModelSelect = document.getElementById('geminiModelSelect');
    els.btnSaveApiKey = document.getElementById('btnSaveApiKey');
    els.btnClearApiKey = document.getElementById('btnClearApiKey');
    els.tokenUsageStatsBar = document.getElementById('tokenUsageStatsBar');
    els.recognizedChordsBar = document.getElementById('recognizedChordsBar');
    // T2-3 覆蓋標籤控制與點選組成音/鋼琴聯動面板
    els.btnToggleAddChordMode = document.getElementById('btnToggleAddChordMode');
    els.btnToggleTagsVisible = document.getElementById('btnToggleTagsVisible');
    els.btnResetPageChords = document.getElementById('btnResetPageChords');
    els.tagStyleSelect = document.getElementById('tagStyleSelect');
    els.tagSizeSelect = document.getElementById('tagSizeSelect');
    els.btnNudgeUp = document.getElementById('btnNudgeUp');
    els.btnNudgeDown = document.getElementById('btnNudgeDown');
    els.btnNudgeLeft = document.getElementById('btnNudgeLeft');
    els.btnNudgeRight = document.getElementById('btnNudgeRight');
    els.sheetSelectedChordInspector = document.getElementById('sheetSelectedChordInspector');
    els.inspectorRawChordInput = document.getElementById('inspectorRawChordInput');
    els.btnInspectorUpdateChord = document.getElementById('btnInspectorUpdateChord');
    els.btnInspectorDeleteChord = document.getElementById('btnInspectorDeleteChord');
    els.inspectorVoicingSummary = document.getElementById('inspectorVoicingSummary');
    els.btnInspectorPlayAudio = document.getElementById('btnInspectorPlayAudio');
    els.btnToggleInlinePiano = document.getElementById('btnToggleInlinePiano');
    els.sheetInlinePianoWrapper = document.getElementById('sheetInlinePianoWrapper');
    els.sheetInlinePianoContainer = document.getElementById('sheetInlinePianoContainer');
    els.btnSheetPrevPage = document.getElementById('btnSheetPrevPage');
    els.sheetPageIndicator = document.getElementById('sheetPageIndicator');
    els.btnSheetNextPage = document.getElementById('btnSheetNextPage');
    els.sheetPageQuickBtns = document.getElementById('sheetPageQuickBtns');
    els.btnSheetZoomOut = document.getElementById('btnSheetZoomOut');
    els.btnSheetZoomReset = document.getElementById('btnSheetZoomReset');
    els.sheetZoomLabel = document.getElementById('sheetZoomLabel');
    els.btnSheetZoomIn = document.getElementById('btnSheetZoomIn');
    // T3-1 & T3-2 匯出 JPG / PDF 與專案檔 (.json) 按鈕
    els.btnExportPageJpg = document.getElementById('btnExportPageJpg');
    els.btnExportAllPdf = document.getElementById('btnExportAllPdf');
    els.btnExportProjectJson = document.getElementById('btnExportProjectJson');
    els.projectJsonFileInput = document.getElementById('projectJsonFileInput');
    els.sheetEmptyPlaceholder = document.getElementById('sheetEmptyPlaceholder');
    els.sheetCanvasStageWrapper = document.getElementById('sheetCanvasStageWrapper');
    els.sheetViewportInner = document.getElementById('sheetViewportInner');
    els.sheetBaseCanvas = document.getElementById('sheetBaseCanvas');
    els.sheetOverlayLayer = document.getElementById('sheetOverlayLayer');

    // 模式三：單一和弦查詢與鋼琴區 + 批次和弦譜轉調區
    els.chordLookupInput = document.getElementById('chordLookupInput');
    els.btnPlayCurrentChord = document.getElementById('btnPlayCurrentChord');
    els.quickChordChips = document.getElementById('quickChordChips');
    els.voicingDetailBox = document.getElementById('voicingDetailBox');
    els.pianoContainer = document.getElementById('pianoContainer');
    els.btnPresetChangHuan = document.getElementById('btnPresetChangHuan');
    els.btnPresetKawa = document.getElementById('btnPresetKawa');
    els.sheetInputTextarea = document.getElementById('sheetInputTextarea');
    els.quickKeyPresetsBar = document.getElementById('quickKeyPresetsBar');
    els.transposedSheetOutput = document.getElementById('transposedSheetOutput');
  }

  let currentTargetKeyOrder = null; // 'major-first' | 'minor-first'

  function buildKeyOptGroup(label, keys) {
    const grp = document.createElement('optgroup');
    grp.label = label;
    keys.forEach(k => {
      const info = MusicTheory.getKeyInfo(k);
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = info.label;
      grp.appendChild(opt);
    });
    return grp;
  }

  function populateSourceKeySelect() {
    if (!els.sourceKeySelect) return;
    els.sourceKeySelect.innerHTML = '';
    els.sourceKeySelect.appendChild(buildKeyOptGroup('大調 (Major Keys)', KEY_OPTIONS_MAJOR));
    els.sourceKeySelect.appendChild(buildKeyOptGroup('小調 (Minor Keys)', KEY_OPTIONS_MINOR));
    els.sourceKeySelect.value = state.sourceKey;
  }

  /**
   * 動態依據「原譜調性」調整「目標調性」下拉選單之群組置頂順序：
   * - 原譜為小調 (如 Am)：小調群組置頂 (小調 ➔ 大調)，方便小調琴譜快速選取目標小調
   * - 原譜為大調 (如 C)：大調群組置頂 (大調 ➔ 小調)
   */
  function updateTargetKeySelectOptions() {
    if (!els.targetKeySelect) return;
    const isMinor = MusicTheory.getKeyInfo(state.sourceKey)?.isMinor || state.sourceKey.endsWith('m');
    const desiredOrder = isMinor ? 'minor-first' : 'major-first';

    if (currentTargetKeyOrder !== desiredOrder || els.targetKeySelect.children.length === 0) {
      currentTargetKeyOrder = desiredOrder;
      els.targetKeySelect.innerHTML = '';
      if (isMinor) {
        els.targetKeySelect.appendChild(buildKeyOptGroup('小調 (Minor Keys)', KEY_OPTIONS_MINOR));
        els.targetKeySelect.appendChild(buildKeyOptGroup('大調 (Major Keys)', KEY_OPTIONS_MAJOR));
      } else {
        els.targetKeySelect.appendChild(buildKeyOptGroup('大調 (Major Keys)', KEY_OPTIONS_MAJOR));
        els.targetKeySelect.appendChild(buildKeyOptGroup('小調 (Minor Keys)', KEY_OPTIONS_MINOR));
      }
    }

    els.targetKeySelect.value = state.targetKey;
  }

  function populateKeySelects() {
    populateSourceKeySelect();
    updateTargetKeySelectOptions();
  }

  // ============================================================================
  // 5. 新調性升降記號與音階橫幅渲染
  // ============================================================================

  function renderKeySignatureBanner() {
    const srcInfo = MusicTheory.getKeyInfo(state.sourceKey);
    const tgtDetails = MusicTheory.getKeySignatureDetails(state.targetKey);
    const tgtInfo = MusicTheory.getKeyInfo(state.targetKey);

    const rawDiff = ((tgtInfo.tonic - srcInfo.tonic) % 12 + 12) % 12;
    const signedDiff = rawDiff > 6 ? rawDiff - 12 : rawDiff;
    const shiftText = signedDiff === 0
      ? '原調 (0 半音)'
      : (signedDiff > 0 ? `升 +${signedDiff} 半音 (或降 ${signedDiff - 12})` : `降 ${signedDiff} 半音 (或升 +${signedDiff + 12})`);

    let accListHTML = '';
    if (tgtDetails.accidentalCount === 0) {
      accListHTML = `<span class="acc-pill">✨ 自然音階皆為白鍵，無固定升降記號</span>`;
    } else {
      accListHTML = tgtDetails.accidentalsEnglish.map((eng, idx) => {
        const num = tgtDetails.accidentalsFixedNumber[idx];
        const sol = tgtDetails.accidentalsSolfege[idx];
        return `<span class="acc-pill" title="${sol}">🎹 <strong>${eng}</strong> <span class="num-tag">(${num})</span></span>`;
      }).join('');
    }

    const scaleHTML = tgtDetails.scaleEnglish.map((eng, idx) => {
      const num = tgtDetails.scaleFixedNumber[idx];
      const isBlack = eng.includes('#') || eng.includes('b');
      return `<span class="scale-note-chip ${isBlack ? 'is-black-note' : ''}">${eng} <small>(${num})</small></span>`;
    }).join('');

    const harmonicTipHTML = tgtDetails.harmonicMinorNote
      ? `<div class="ks-harmonic-tip">💡 ${tgtDetails.harmonicMinorNote}</div>`
      : '';

    els.ksBanner.innerHTML = `
      <div>
        <div class="ks-section-title">🎯 目標調性與轉調位移 (${srcInfo.label.split(' ')[0]} ➔ ${tgtDetails.keyLabel.split(' ')[0]})</div>
        <div class="ks-main-key">
          <span class="ks-key-name">${tgtDetails.keyLabel}</span>
          <span class="ks-shift-badge">${shiftText}</span>
        </div>
      </div>

      <div>
        <div class="ks-section-title">♯♭ 新調性升降記號 (需要按的黑鍵提示)</div>
        <div><span class="ks-acc-badge">${tgtDetails.badgeText}</span></div>
        <div class="ks-acc-list">${accListHTML}</div>
      </div>

      <div>
        <div class="ks-section-title">🎼 新調自然音階 (英文音名 / 固定調簡譜數字)</div>
        <div class="ks-scale-list">${scaleHTML}</div>
        ${harmonicTipHTML}
      </div>
    `;
  }

  // ============================================================================
  // 6. 【模式一】調性對應和弦 ＆ 組成音對照總表渲染
  // ============================================================================

  function renderQuickSingleConverter() {
    const raw = (els.quickSingleChordInput.value || '').trim();
    if (!raw) {
      els.quickSingleChordResult.innerHTML = '<span style="color:#94a3b8;">請輸入任一和弦以查看轉調結果與組成音</span>';
      return;
    }

    const tr = MusicTheory.transposeChord(raw, state.sourceKey, state.targetKey);
    if (!tr) {
      els.quickSingleChordResult.innerHTML = `<span style="color:#f43f5e; font-weight:700;">⚠️ 無法識別「${raw}」</span>`;
      return;
    }

    const srcTr = MusicTheory.transposeChord(raw, state.sourceKey, state.sourceKey);
    const srcEng = srcTr ? srcTr.englishChord : raw;

    els.quickSingleChordResult.innerHTML = `
      <span>原調: <strong style="color:#cbd5e1;">${raw} (${srcEng})</strong></span>
      <span>➔ 目標調: <strong style="color:#34d399; font-size:1.2rem;">${tr.englishChord}</strong> <span style="color:#fbbf24; font-weight:700;">(數字: ${tr.fixedNumberChord})</span></span>
      <span>組成音: <strong style="color:#60a5fa;">${tr.notes.english.join(' - ')}</strong> <span style="color:#fbbf24;">(${tr.notes.fixedNumber.join(' - ')})</span></span>
      <button type="button" class="btn btn-primary" id="btnQuickSinglePlay" style="padding:4px 10px;">🔊 試聽</button>
      <button type="button" class="btn" id="btnQuickSingleJumpPiano" style="padding:4px 10px;">🎹 看鋼琴鍵盤</button>
    `;

    const btnPlay = document.getElementById('btnQuickSinglePlay');
    if (btnPlay) {
      btnPlay.addEventListener('click', () => PianoVisualizer.playChordAudio(tr));
    }

    const btnJump = document.getElementById('btnQuickSingleJumpPiano');
    if (btnJump) {
      btnJump.addEventListener('click', () => jumpToPianoWithChord(raw));
    }
  }

  function renderReferenceTable() {
    const srcInfo = MusicTheory.getKeyInfo(state.sourceKey);
    const tgtInfo = MusicTheory.getKeyInfo(state.targetKey);

    els.refTableTitle.textContent = `【${srcInfo.label.split(' ')[0]} ➔ ${tgtInfo.label.split(' ')[0]}】常用對應和弦與組成音對照總表`;
    els.thSourceKeyName.textContent = state.sourceKey;
    els.thTargetKeyName.textContent = state.targetKey;

    const filteredCatalog = REFERENCE_CHORD_CATALOG.filter(item => {
      if (state.degreeFilter === 'common') return item.isCommon;
      if (state.degreeFilter === 'all') return true;
      return item.group === state.degreeFilter;
    });

    const rowsHTML = filteredCatalog.map(item => {
      // 計算該級數在「原調」的對應和弦與「目標調」的對應和弦
      const srcChord = MusicTheory.transposeChord(item.degreeRaw, state.sourceKey, state.sourceKey);
      const tgtChord = MusicTheory.transposeChord(item.degreeRaw, state.sourceKey, state.targetKey);
      if (!srcChord || !tgtChord) return '';

      let targetDisplayHTML = `<span class="tgt-chord-cell">${tgtChord.englishChord}</span><span class="tgt-num-tag">(數字: ${tgtChord.fixedNumberChord})</span>`;
      if (state.displayMode === 'number') {
        targetDisplayHTML = `<span class="tgt-chord-cell" style="color:#fbbf24;">${tgtChord.fixedNumberChord}</span><span class="tgt-num-tag" style="color:#34d399;">(英文: ${tgtChord.englishChord})</span>`;
      } else if (state.displayMode === 'practice') {
        targetDisplayHTML = `<span class="tgt-chord-cell">${item.degreeRaw} ➔ ${tgtChord.englishChord}</span><span class="tgt-num-tag">(${tgtChord.fixedNumberChord})</span>`;
      }

      const engNotes = tgtChord.notes.english.join(' - ');
      const numNotes = tgtChord.notes.fixedNumber.join(' - ');
      const isPrimaryTonic = (srcInfo.isMinor && item.degreeRaw === '6m') || (!srcInfo.isMinor && item.degreeRaw === '1');

      return `
        <tr class="${isPrimaryTonic ? 'is-diatonic-primary' : ''}">
          <td><span class="degree-badge">${item.degreeRaw}</span></td>
          <td class="src-chord-cell">${srcChord.englishChord} <small style="color:#64748b;">(${srcChord.fixedNumberChord})</small></td>
          <td>${targetDisplayHTML}</td>
          <td><span class="notes-eng-pill">${engNotes}</span></td>
          <td><span class="notes-num-pill">${numNotes}</span></td>
          <td style="color:#94a3b8; font-size:0.84rem;">${item.roleNote}</td>
          <td style="white-space:nowrap;">
            <button type="button" class="btn btn-row-play" data-deg="${item.degreeRaw}" style="padding:4px 8px; font-size:0.78rem;">🔊 試聽</button>
            <button type="button" class="btn btn-row-piano" data-deg="${item.degreeRaw}" style="padding:4px 8px; font-size:0.78rem;">🎹 看琴鍵</button>
          </td>
        </tr>`;
    }).join('');

    els.chordRefTableBody.innerHTML = rowsHTML;

    // 綁定表格內的試聽與跳轉鋼琴按鈕
    els.chordRefTableBody.querySelectorAll('.btn-row-play').forEach(btn => {
      btn.addEventListener('click', () => {
        const deg = btn.getAttribute('data-deg');
        const tr = MusicTheory.transposeChord(deg, state.sourceKey, state.targetKey);
        if (tr) PianoVisualizer.playChordAudio(tr);
      });
    });

    els.chordRefTableBody.querySelectorAll('.btn-row-piano').forEach(btn => {
      btn.addEventListener('click', () => {
        const deg = btn.getAttribute('data-deg');
        jumpToPianoWithChord(deg);
      });
    });
  }

  function switchTab(tabId) {
    state.activeTab = tabId;
    els.viewTabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    els.tabPanes.forEach(pane => {
      pane.classList.toggle('active', pane.id === tabId);
    });
  }

  function jumpToPianoWithChord(rawChord) {
    switchTab('tab-interactive-studio');
    els.chordLookupInput.value = rawChord;
    renderSelectedChordAndPiano(true);
  }

  // ============================================================================
  // 7. 【模式二】單一和弦組成音與互動式鋼琴鍵盤 + 批次和弦譜工作台
  // ============================================================================

  function renderSelectedChordAndPiano(triggerAudio = false) {
    const rawInput = (els.chordLookupInput.value || state.selectedRawChord || 'Cm').trim();
    const transposed = MusicTheory.transposeChord(rawInput, state.sourceKey, state.targetKey);

    if (!transposed) {
      els.voicingDetailBox.innerHTML = `
        <div style="color: #f43f5e; font-weight: 700; padding: 8px 0;">
          ⚠️ 無法識別和弦「${rawInput}」，請輸入如 Cm, bE, 6m, 37-9+5, 5m6/7b 等格式。
        </div>`;
      return;
    }

    state.selectedRawChord = rawInput;

    const engNotesStr = transposed.notes.english.join(' - ');
    const numNotesStr = transposed.notes.fixedNumber.join(' - ');
    const formulaStr = transposed.notes.formula.join(' - ');
    const bassStr = `${transposed.notes.bassEnglish} (${transposed.notes.bassFixedNumber})`;

    els.voicingDetailBox.innerHTML = `
      <div class="voicing-main-header">
        <div>
          <span class="voicing-big-chord">${transposed.englishChord}</span>
          <span class="voicing-num-chord">［數字: ${transposed.fixedNumberChord}｜級數: ${transposed.relativeDegreeChord}］</span>
        </div>
        <span class="voicing-type-label">原譜輸入: <strong>${transposed.originalRaw}</strong> ｜ ${transposed.chordTypeName || ''}</span>
      </div>

      <div class="voicing-notes-table">
        <div class="v-row">
          <span class="v-label">🎵 英文組成音 (右手)：</span>
          <span class="v-value eng-notes">${engNotesStr}</span>
        </div>
        <div class="v-row">
          <span class="v-label">🔢 固定調簡譜組成音：</span>
          <span class="v-value num-notes">${numNotesStr}</span>
        </div>
        <div class="v-row">
          <span class="v-label">📐 和弦音程結構公式：</span>
          <span class="v-value formula-notes">${formulaStr}</span>
        </div>
        <div class="v-row">
          <span class="v-label">🎹 左手伴奏根音 / Bass：</span>
          <span class="v-value" style="color: #fbbf24;">${bassStr}</span>
        </div>
      </div>
    `;

    PianoVisualizer.mountPiano(els.pianoContainer, transposed);

    if (triggerAudio && state.audioEnabled) {
      PianoVisualizer.playChordAudio(transposed);
    }
  }

  function renderQuickChordChips() {
    const sampleChords = ['6m', '2m', '37', '37-9+5', '67+5', '5m6/7b', '4M7', 'CM7', 'Gsus4', 'bE', 'Dm7b5'];
    els.quickChordChips.innerHTML = sampleChords.map(ch =>
      `<button type="button" class="chip-btn" data-chord="${ch}">${ch}</button>`
    ).join('');

    els.quickChordChips.querySelectorAll('.chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const ch = btn.getAttribute('data-chord');
        els.chordLookupInput.value = ch;
        renderSelectedChordAndPiano(true);
      });
    });
  }

  function parseSheetText(text) {
    const lines = (text || '').split(/\r?\n/);
    const sections = [];
    let currentSection = { title: '樂譜段落', bars: [] };

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const secMatch = trimmed.match(/^\[(.*)\]$/);
      if (secMatch) {
        if (currentSection.bars.length > 0) {
          sections.push(currentSection);
        }
        currentSection = { title: secMatch[1], bars: [] };
        return;
      }

      const barStrings = trimmed.split('|').map(s => s.trim()).filter(Boolean);
      barStrings.forEach(barStr => {
        const tokens = barStr.split(/\s+/).filter(Boolean);
        tokens.forEach(token => {
          currentSection.bars.push({
            rawToken: token,
            barNumber: currentSection.bars.length + 1
          });
        });
      });
    });

    if (currentSection.bars.length > 0) {
      sections.push(currentSection);
    }
    return sections;
  }

  function renderQuickKeyPresets() {
    const preset = PRESET_SHEETS[state.activePresetKey];
    if (!preset || !preset.quickTargets) {
      els.quickKeyPresetsBar.innerHTML = '';
      return;
    }

    const buttonsHTML = preset.quickTargets.map(qt => {
      const isActive = state.targetKey === qt.key;
      const btnClass = isActive ? 'btn btn-primary' : 'btn';
      return `<button type="button" class="${btnClass}" data-target-key="${qt.key}">${qt.label}</button>`;
    }).join('');

    els.quickKeyPresetsBar.innerHTML = `
      <span style="font-size: 0.85rem; font-weight: 700; color: #94a3b8;">⚡ 譜面常用調性快捷切換：</span>
      ${buttonsHTML}
    `;

    els.quickKeyPresetsBar.querySelectorAll('button[data-target-key]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.targetKey = btn.getAttribute('data-target-key');
        els.targetKeySelect.value = state.targetKey;
        updateAllViews();
      });
    });
  }

  function renderTransposedSheet() {
    const rawText = els.sheetInputTextarea.value;
    const sections = parseSheetText(rawText);

    if (sections.length === 0) {
      els.transposedSheetOutput.innerHTML = `
        <div class="section-block" style="color: #94a3b8;">
          尚無和弦資料，請在左側輸入或點擊上方「載入《償還》/《川の流れ》範例」。
        </div>`;
      return;
    }

    let globalCardIdx = 0;

    const sectionsHTML = sections.map(sec => {
      const cardsHTML = sec.bars.map(item => {
        const currentIdx = globalCardIdx++;
        const tr = MusicTheory.transposeChord(item.rawToken, state.sourceKey, state.targetKey);

        if (!tr) {
          return `
            <div class="chord-bar-card">
              <div class="bar-orig-tag"><span>#${item.barNumber}</span><span>無法解析</span></div>
              <div class="bar-main-chord" style="color:#f43f5e;">${item.rawToken}</div>
            </div>`;
        }

        let mainDisplay = tr.englishChord;
        let subDisplay = `數字: ${tr.fixedNumberChord}`;

        if (state.displayMode === 'number') {
          mainDisplay = tr.fixedNumberChord;
          subDisplay = `英文: ${tr.englishChord}`;
        } else if (state.displayMode === 'practice') {
          mainDisplay = `${tr.originalRaw} ➔ ${tr.englishChord}`;
          subDisplay = `固定調數字: ${tr.fixedNumberChord} (級數 ${tr.relativeDegreeChord})`;
        }

        const notesPreview = state.displayMode === 'number'
          ? `${tr.notes.fixedNumber.join('-')} (${tr.notes.english.join('-')})`
          : `${tr.notes.english.join('-')} (${tr.notes.fixedNumber.join('-')})`;

        const isSelected = state.selectedCardIndex === currentIdx;

        return `
          <div class="chord-bar-card ${isSelected ? 'selected' : ''}" data-raw-chord="${tr.originalRaw}" data-card-idx="${currentIdx}">
            <div class="bar-orig-tag">
              <span>原譜: <strong>${tr.originalRaw}</strong></span>
              <span>🎹 點擊看鍵盤</span>
            </div>
            <div class="bar-main-chord">${mainDisplay}</div>
            <div class="bar-sub-chord">${subDisplay}</div>
            <div class="bar-notes-preview">組成音: ${notesPreview}</div>
          </div>`;
      }).join('');

      return `
        <div class="section-block">
          <div class="section-header-tag">📌 ${sec.title}</div>
          <div class="chord-bars-grid">${cardsHTML}</div>
        </div>`;
    }).join('');

    els.transposedSheetOutput.innerHTML = sectionsHTML;

    els.transposedSheetOutput.querySelectorAll('.chord-bar-card[data-raw-chord]').forEach(card => {
      card.addEventListener('click', () => {
        const rawChord = card.getAttribute('data-raw-chord');
        state.selectedCardIndex = parseInt(card.getAttribute('data-card-idx'), 10);
        els.chordLookupInput.value = rawChord;
        renderSelectedChordAndPiano(true);
        renderTransposedSheet();
      });
    });
  }

  // ============================================================================
  // 8. 半音升降與範例載入輔助函式
  // ============================================================================

  function shiftTargetKeyBySemitones(delta) {
    const tgtInfo = MusicTheory.getKeyInfo(state.targetKey);
    const newTonic = ((tgtInfo.tonic + delta) % 12 + 12) % 12;
    const pool = tgtInfo.isMinor ? KEY_OPTIONS_MINOR : KEY_OPTIONS_MAJOR;

    for (const k of pool) {
      const info = MusicTheory.getKeyInfo(k);
      if (info.tonic === newTonic) {
        state.targetKey = k;
        els.targetKeySelect.value = k;
        updateAllViews();
        break;
      }
    }
  }

  function loadPresetSheet(presetKey, updateGlobalKeys = true) {
    const preset = PRESET_SHEETS[presetKey];
    if (!preset) return;

    state.activePresetKey = presetKey;
    if (updateGlobalKeys) {
      state.sourceKey = preset.sourceKey;
      state.targetKey = preset.targetKey;
      els.sourceKeySelect.value = state.sourceKey;
      els.targetKeySelect.value = state.targetKey;
    }
    state.selectedCardIndex = 0;
    els.sheetInputTextarea.value = preset.content;

    const firstChord = updateGlobalKeys ? (presetKey === 'changHuan' ? '6m' : 'C') : state.selectedRawChord;
    els.chordLookupInput.value = firstChord;

    updateAllViews();
  }

  function updateAllViews() {
    updateTargetKeySelectOptions();
    renderKeySignatureBanner();
    renderQuickSingleConverter();
    renderReferenceTable();
    renderQuickKeyPresets();
    renderSelectedChordAndPiano(false);
    renderTransposedSheet();
    renderSheetOverlayAndChordsBar();
  }

  // ============================================================================
  // 8.5 【模式二 T2-2】Gemini Vision AI 抓譜、快取與原譜覆蓋標籤渲染
  // ============================================================================

  function updateApiKeyStatusUI() {
    if (!window.SheetParser || !els.apiKeyStatusBadge) return;
    const hasKey = SheetParser.hasApiKey();
    const model = SheetParser.getModelName();
    if (els.geminiModelSelect) {
      els.geminiModelSelect.value = model;
    }
    if (hasKey) {
      els.apiKeyStatusBadge.textContent = `🔑 API Key 已就緒 (${model})`;
      els.apiKeyStatusBadge.className = 'sheet-status-badge status-success';
    } else {
      els.apiKeyStatusBadge.textContent = '🔑 未設定 API Key (內建範例譜可 0 Token 免費辨識)';
      els.apiKeyStatusBadge.className = 'sheet-status-badge status-info';
    }
    renderTokenUsageStatsBar();
  }

  /**
   * 渲染每日預估剩餘免費額度（精簡版：依使用者建議移除複雜的 Token 數值，專注於每日剩餘可用次數）
   */
  function renderTokenUsageStatsBar(lastSessionTokens = null) {
    if (!window.SheetParser || !els.tokenUsageStatsBar) return;
    const stats = SheetParser.getTokenUsageStats();

    let sessionStatusHTML = '';
    if (lastSessionTokens !== null) {
      if (lastSessionTokens === 0) {
        sessionStatusHTML = `<span style="color:#34d399; font-weight:700;">⚡ 本次免連網 (0 消耗快取)</span> <span>｜</span>`;
      } else {
        sessionStatusHTML = `<span style="color:#fde68a; font-weight:700;">✅ 本次 AI 辨識完成</span> <span>｜</span>`;
      }
    }

    els.tokenUsageStatsBar.innerHTML = `
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px;">
        ${sessionStatusHTML}
        <span>🔋 <strong>今日免費額度預估剩餘：</strong><strong style="color:#34d399; font-size:1.02rem;">約 ${stats.remainingRequests.toLocaleString()} / ${stats.freeDailyRequestLimit.toLocaleString()} 次</strong> <span style="color:#94a3b8;">(今日已使用 ${stats.todayRequests} 次)</span></span>
      </div>
      <a href="https://aistudio.google.com/app/plan_information" target="_blank" rel="noopener" style="color: #93c5fd; text-decoration: none; font-weight: 700;">
        🔗 查看 Google 官方額度後台 ↗
      </a>
    `;
  }

  /**
   * 將當前頁面的和弦變更寫回本機快取 (保存拖曳座標或手動修改結果)
   */
  function persistCurrentPageChords() {
    if (!window.SheetViewer || !window.SheetParser) return;
    const vState = SheetViewer.getState();
    const pageObj = SheetViewer.getCurrentPage();
    if (!pageObj) return;

    SheetParser.saveCachedRecognition(vState.fileName, pageObj.pageNumber, {
      detectedSourceKey: state.sourceKey,
      detectedTargetKey: state.targetKey,
      chords: pageObj.chords || []
    });
  }

  /**
   * 渲染琴譜上方的「點選和弦：手動修改 ＋ 組成音明細 ＋ 內嵌鋼琴鍵盤」即時聯動面板 (T2-3)
   */
  function renderSheetSelectedInspector(triggerAudio = false) {
    if (!els.sheetSelectedChordInspector || !window.SheetViewer) return;
    const pageObj = SheetViewer.getCurrentPage();
    if (!pageObj || !Array.isArray(pageObj.chords) || !state.selectedSheetTagId) {
      els.sheetSelectedChordInspector.style.display = 'none';
      return;
    }

    const chordItem = pageObj.chords.find(c => c.id === state.selectedSheetTagId);
    if (!chordItem) {
      els.sheetSelectedChordInspector.style.display = 'none';
      return;
    }

    els.sheetSelectedChordInspector.style.display = 'block';
    if (els.inspectorRawChordInput && document.activeElement !== els.inspectorRawChordInput) {
      els.inspectorRawChordInput.value = chordItem.raw;
    }

    const tr = MusicTheory.transposeChord(chordItem.raw, state.sourceKey, state.targetKey);
    if (!tr) {
      els.inspectorVoicingSummary.innerHTML = `<span style="color:#f43f5e; font-weight:700;">⚠️ 無法解析「${chordItem.raw}」，請於左側輸入正確和弦格式</span>`;
      return;
    }

    els.inspectorVoicingSummary.innerHTML = `
      <span>原譜 <strong style="color:#cbd5e1;">${chordItem.raw}</strong> ➔ 新調 <strong style="color:#34d399; font-size:1.18rem;">${tr.englishChord}</strong> <span style="color:#fbbf24; font-weight:700;">(數字: ${tr.fixedNumberChord})</span></span>
      <span>｜ 英文組成音: <strong style="color:#60a5fa;">${tr.notes.english.join(' - ')}</strong></span>
      <span>｜ 簡譜組成音: <strong style="color:#fbbf24;">${tr.notes.fixedNumber.join(' - ')}</strong></span>
      <span>｜ 左手Bass: <strong style="color:#f59e0b;">${tr.notes.bassEnglish}(${tr.notes.bassFixedNumber})</strong></span>
    `;

    // 同步更新模式三的單一和弦查詢輸入框
    if (els.chordLookupInput) {
      els.chordLookupInput.value = chordItem.raw;
    }
  }

  /**
   * 將當前琴譜頁已辨識出的和弦陣列 (pageObj.chords) 依據目標調性與顯示模式，
   * 渲染為上方和弦對照膠囊列 (#recognizedChordsBar) 與琴譜覆蓋標籤 (#sheetOverlayLayer)
   */
  function renderSheetOverlayAndChordsBar() {
    if (!window.SheetViewer || !els.sheetOverlayLayer) return;
    const pageObj = SheetViewer.getCurrentPage();

    if (!pageObj || !Array.isArray(pageObj.chords) || pageObj.chords.length === 0) {
      els.sheetOverlayLayer.innerHTML = '';
      if (els.recognizedChordsBar) {
        els.recognizedChordsBar.style.display = 'none';
        els.recognizedChordsBar.innerHTML = '';
      }
      if (els.sheetSelectedChordInspector) {
        els.sheetSelectedChordInspector.style.display = 'none';
      }
      return;
    }

    // 若尚未選取任何標籤，預設選取第一個和弦以展示鋼琴與組成音
    if (!state.selectedSheetTagId || !pageObj.chords.some(c => c.id === state.selectedSheetTagId)) {
      state.selectedSheetTagId = pageObj.chords[0].id;
    }

    // 1. 渲染上方已辨識和弦膠囊清單
    if (els.recognizedChordsBar) {
      els.recognizedChordsBar.style.display = 'flex';
      const pillsHTML = pageObj.chords.map((ch) => {
        const tr = MusicTheory.transposeChord(ch.raw, state.sourceKey, state.targetKey);
        const tgtText = tr
          ? (state.displayMode === 'number' ? tr.fixedNumberChord : tr.englishChord)
          : ch.raw;
        const isSel = ch.id === state.selectedSheetTagId;
        const borderStyle = isSel ? 'border-color:#60a5fa; background:rgba(59,130,246,0.22);' : '';
        return `
          <span class="rec-chord-pill" data-id="${ch.id}" data-raw="${ch.raw}" style="${borderStyle}" title="點擊查看鋼琴組成音或修改">
            <span style="color:#94a3b8;">${ch.raw}</span>
            <span>➔</span>
            <strong style="color:#34d399;">${tgtText}</strong>
          </span>`;
      }).join('');

      els.recognizedChordsBar.innerHTML = `
        <span style="font-size:0.82rem; font-weight:800; color:#60a5fa; width:100%;">
          🎯 本頁共 ${pageObj.chords.length} 個和弦標記（點擊任一標籤可看鋼琴組成音與修改文字，在譜面上按住滑鼠可直接拖曳微調位置）：
        </span>
        ${pillsHTML}
      `;

      els.recognizedChordsBar.querySelectorAll('.rec-chord-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          state.selectedSheetTagId = pill.getAttribute('data-id');
          renderSheetOverlayAndChordsBar();
          renderSheetSelectedInspector(true);
        });
      });
    }

    // 2. 渲染琴譜畫布上的轉調和弦標籤 (#sheetOverlayLayer)
    els.sheetOverlayLayer.style.display = state.tagsVisible ? 'block' : 'none';
    els.sheetOverlayLayer.classList.toggle('add-chord-cursor', state.addChordOnSheetMode);

    const tagsHTML = pageObj.chords.map((ch) => {
      const tr = MusicTheory.transposeChord(ch.raw, state.sourceKey, state.targetKey);
      let labelText = ch.raw;
      let tooltipText = ch.raw;

      if (tr) {
        if (state.displayMode === 'number') {
          labelText = tr.fixedNumberChord;
        } else if (state.displayMode === 'practice') {
          labelText = `${ch.raw}➔${tr.englishChord}`;
        } else {
          labelText = tr.englishChord;
        }
        tooltipText = `原譜: ${ch.raw} ➔ 新調: ${tr.englishChord} (${tr.fixedNumberChord}) | 組成音: ${tr.notes.english.join('-')} (${tr.notes.fixedNumber.join('-')}) [可按住拖曳位置]`;
      }

      const isSelected = ch.id === state.selectedSheetTagId;
      const cls = `sheet-chord-tag style-${state.tagStyle} ${isSelected ? 'selected' : ''}`;

      return `
        <div class="${cls}"
             data-id="${ch.id}"
             data-raw="${ch.raw}"
             style="left: ${ch.xPercent}%; top: ${ch.yPercent}%; font-size: ${state.tagFontSize}px;"
             title="${tooltipText}">
          ${labelText}
        </div>`;
    }).join('');

    els.sheetOverlayLayer.innerHTML = tagsHTML;

    // 3. 為每個標籤綁定「點擊選取 (連動鋼琴組成音)」與「按住滑鼠直接拖曳位置」事件
    els.sheetOverlayLayer.querySelectorAll('.sheet-chord-tag').forEach(tag => {
      tag.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();

        const tagId = tag.getAttribute('data-id');
        const chordItem = pageObj.chords.find(c => c.id === tagId);
        if (!chordItem) return;

        state.selectedSheetTagId = tagId;

        const rect = els.sheetOverlayLayer.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;
        const origXPercent = chordItem.xPercent;
        const origYPercent = chordItem.yPercent;
        let hasDragged = false;

        const onMouseMove = (moveEvt) => {
          const dx = moveEvt.clientX - startX;
          const dy = moveEvt.clientY - startY;
          if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
            hasDragged = true;
          }
          if (!hasDragged || rect.width === 0 || rect.height === 0) return;

          const newX = Math.max(1, Math.min(99, origXPercent + (dx / rect.width) * 100));
          const newY = Math.max(1, Math.min(99, origYPercent + (dy / rect.height) * 100));
          chordItem.xPercent = Math.round(newX * 10) / 10;
          chordItem.yPercent = Math.round(newY * 10) / 10;

          tag.style.left = `${chordItem.xPercent}%`;
          tag.style.top = `${chordItem.yPercent}%`;
        };

        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);

          if (hasDragged) {
            persistCurrentPageChords();
          }
          renderSheetOverlayAndChordsBar();
          renderSheetSelectedInspector(!hasDragged);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    });

    renderSheetSelectedInspector(false);
  }

  /**
   * 執行琴譜和弦辨識：
   * - 若 allPages = true (預設點擊「🤖 智慧辨識全曲所有頁面」)，會自動依序辨識整份 PDF 的每一頁（第 1 頁、第 2 頁...），翻頁時直接就緒不用再按一次！
   * - 若 forceRefresh = true (點擊「🔄 重新辨識本頁」)，則針對當前頁強制重新呼叫 Gemini AI。
   */
  async function executeCurrentPageRecognition(forceRefresh = false, allPages = !forceRefresh) {
    if (!window.SheetViewer || !window.SheetParser) return;
    const viewerState = SheetViewer.getState();
    const currentPageObj = SheetViewer.getCurrentPage();
    if (!currentPageObj || !Array.isArray(viewerState.pages) || viewerState.pages.length === 0) return;

    const targetPages = allPages ? viewerState.pages : [currentPageObj];
    const totalCount = targetPages.length;

    try {
      els.btnRunAiRecognize.disabled = true;
      els.btnForceAiRecognize.disabled = true;

      let totalChordsFound = 0;
      let usedGeminiCount = 0;
      let sessionTokensUsed = 0;

      for (let i = 0; i < totalCount; i++) {
        const pageItem = targetPages[i];
        els.aiRecognizeSummary.textContent = forceRefresh
          ? `⏳ 正在強制呼叫 Gemini AI 重新辨識第 ${pageItem.pageNumber} 頁...`
          : `⏳ 正在辨識全曲進度：第 ${pageItem.pageNumber} / ${viewerState.pages.length} 頁...`;
        els.aiRecognizeSummary.style.color = '#fde68a';

        const result = await SheetParser.recognizeSheetPage(pageItem.dataUrl, {
          fileName: viewerState.fileName,
          pageNumber: pageItem.pageNumber,
          forceRefresh
        });

        pageItem.chords = result.chords || [];
        totalChordsFound += pageItem.chords.length;
        if (result.source === 'gemini') {
          usedGeminiCount++;
          sessionTokensUsed += (result.usage?.totalTokens || 0);
        }
      }

      renderTokenUsageStatsBar(sessionTokensUsed);

      if (totalCount > 1) {
        els.aiRecognizeSummary.textContent = usedGeminiCount > 0
          ? `🤖 全曲共 ${totalCount} 頁 AI 辨識完成（共抓取 ${totalChordsFound} 個和弦，翻頁可直接檢視）！`
          : `⚡ 全曲共 ${totalCount} 頁已從快取載入完成（共 ${totalChordsFound} 個和弦，0 Token 消耗）！`;
      } else {
        els.aiRecognizeSummary.textContent = usedGeminiCount > 0
          ? `🤖 第 ${currentPageObj.pageNumber} 頁 Gemini AI 辨識完成 — 共抓取 ${currentPageObj.chords.length} 個和弦`
          : `⚡ 第 ${currentPageObj.pageNumber} 頁已從快取載入 — 共 ${currentPageObj.chords.length} 個和弦 (0 Token)`;
      }
      els.aiRecognizeSummary.style.color = '#6ee7b7';

      renderSheetOverlayAndChordsBar();
    } catch (err) {
      els.aiRecognizeSummary.textContent = `⚠️ ${err.message || '辨識失敗'}`;
      els.aiRecognizeSummary.style.color = '#fda4af';
      if (String(err.message).includes('MISSING_API_KEY') && els.apiKeyConfigBox) {
        els.apiKeyConfigBox.style.display = 'block';
      }
    } finally {
      els.btnRunAiRecognize.disabled = false;
      els.btnForceAiRecognize.disabled = false;
    }
  }

  // ============================================================================
  // 9. 事件綁定與啟動
  // ============================================================================

  function bindEvents() {
    // 分頁切換
    els.viewTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab(btn.getAttribute('data-tab'));
      });
    });

    // 原調與目標調變更 (方案 1 + 方案 2：切換原譜調性時，目標調性自動同步對齊，且目標調選單群組依原譜大小調自動置頂)
    els.sourceKeySelect.addEventListener('change', () => {
      state.sourceKey = els.sourceKeySelect.value;
      state.targetKey = state.sourceKey;
      updateAllViews();
    });

    els.targetKeySelect.addEventListener('change', () => {
      state.targetKey = els.targetKeySelect.value;
      updateAllViews();
    });

    els.btnSemitoneDown.addEventListener('click', () => shiftTargetKeyBySemitones(-1));
    els.btnSemitoneUp.addEventListener('click', () => shiftTargetKeyBySemitones(1));
    els.btnSemitoneReset.addEventListener('click', () => {
      state.targetKey = state.sourceKey;
      els.targetKeySelect.value = state.targetKey;
      updateAllViews();
    });

    // 顯示模式切換
    els.modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        els.modeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.displayMode = btn.getAttribute('data-mode');
        renderReferenceTable();
        renderTransposedSheet();
        renderSheetOverlayAndChordsBar();
      });
    });

    // 音效開關
    els.btnAudioToggle.addEventListener('click', () => {
      state.audioEnabled = !state.audioEnabled;
      els.btnAudioToggle.textContent = state.audioEnabled ? '🔊 琴音試聽：開啟' : '🔇 琴音試聽：靜音';
      els.btnAudioToggle.className = state.audioEnabled ? 'btn btn-emerald' : 'btn';
    });

    // 模式一：快速調性組合按鈕
    els.quickPairBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        state.sourceKey = btn.getAttribute('data-src');
        state.targetKey = btn.getAttribute('data-tgt');
        els.sourceKeySelect.value = state.sourceKey;
        els.targetKeySelect.value = state.targetKey;
        updateAllViews();
      });
    });

    // 模式一：特殊和弦快速換算框
    els.quickSingleChordInput.addEventListener('input', () => {
      renderQuickSingleConverter();
    });

    // 模式一：級數篩選按鈕
    els.degreeFilterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        els.degreeFilterBtns.forEach(b => b.className = 'btn');
        btn.className = 'btn btn-primary';
        state.degreeFilter = btn.getAttribute('data-filter');
        renderReferenceTable();
      });
    });

    // 模式二：單一和弦即時輸入查詢与試聽
    els.chordLookupInput.addEventListener('input', () => {
      renderSelectedChordAndPiano(false);
    });

    els.btnPlayCurrentChord.addEventListener('click', () => {
      const rawInput = (els.chordLookupInput.value || state.selectedRawChord || 'Cm').trim();
      const transposed = MusicTheory.transposeChord(rawInput, state.sourceKey, state.targetKey);
      if (transposed) {
        PianoVisualizer.playChordAudio(transposed);
      }
    });

    // 模式三：範例譜載入與即時文字編輯
    els.btnPresetChangHuan.addEventListener('click', () => loadPresetSheet('changHuan'));
    els.btnPresetKawa.addEventListener('click', () => loadPresetSheet('kawaNoNagare'));

    els.sheetInputTextarea.addEventListener('input', () => {
      renderTransposedSheet();
    });

    // 模式二 (T2-1 & T2-2)：初始化 PDF / JPG 琴譜載入、預覽與 Gemini AI 抓譜模組
    if (window.SheetViewer) {
      updateApiKeyStatusUI();

      SheetViewer.init({
        statusText: els.sheetViewerStatus,
        dropZone: els.sheetDropZone,
        fileInput: els.sheetFileInput,
        btnPrevPage: els.btnSheetPrevPage,
        pageIndicator: els.sheetPageIndicator,
        btnNextPage: els.btnSheetNextPage,
        pageQuickBtns: els.sheetPageQuickBtns,
        btnZoomOut: els.btnSheetZoomOut,
        btnZoomReset: els.btnSheetZoomReset,
        zoomLabel: els.sheetZoomLabel,
        btnZoomIn: els.btnSheetZoomIn,
        emptyPlaceholder: els.sheetEmptyPlaceholder,
        canvasStageWrapper: els.sheetCanvasStageWrapper,
        sheetViewportInner: els.sheetViewportInner,
        baseCanvas: els.sheetBaseCanvas,
        overlayLayer: els.sheetOverlayLayer
      }, {
        onPageChange: (pageObj, pageIdx, totalPages) => {
          if (els.btnRunAiRecognize) els.btnRunAiRecognize.disabled = false;
          if (els.btnForceAiRecognize) els.btnForceAiRecognize.disabled = false;
          if (els.btnExportPageJpg) els.btnExportPageJpg.disabled = false;
          if (els.btnExportAllPdf) els.btnExportAllPdf.disabled = false;
          if (els.btnExportProjectJson) els.btnExportProjectJson.disabled = false;

          // 自動檢查整份琴譜每一頁的快取，確保未翻到的第 2 頁也能在匯出全曲 PDF 時一併帶入已快取的和弦
          const vState = SheetViewer.getState();
          if (window.SheetParser && Array.isArray(vState.pages)) {
            vState.pages.forEach(p => {
              if (!p.chords || p.chords.length === 0) {
                const cachedPage = SheetParser.getCachedRecognition(vState.fileName, p.pageNumber);
                if (cachedPage && Array.isArray(cachedPage.chords) && cachedPage.chords.length > 0) {
                  p.chords = cachedPage.chords;
                }
              }
            });
          }

          if (pageObj.chords && pageObj.chords.length > 0) {
            const isBuiltin = window.SheetParser && SheetParser.hasBuiltInSampleCache(vState.fileName, pageObj.pageNumber);
            els.aiRecognizeSummary.textContent = isBuiltin
              ? `⚡ 已自動套用內建範例精準和弦座標 (第 ${pageObj.pageNumber} 頁共 ${pageObj.chords.length} 個和弦，0 Token)`
              : `✅ 第 ${pageObj.pageNumber} 頁已載入 ${pageObj.chords.length} 個轉調和弦標籤 (0 Token 快取)`;
            els.aiRecognizeSummary.style.color = '#6ee7b7';
          } else {
            els.aiRecognizeSummary.textContent = `第 ${pageObj.pageNumber} / ${totalPages} 頁已就緒，請點擊「🤖 智慧辨識全曲所有頁面」`;
            els.aiRecognizeSummary.style.color = '#94a3b8';
          }

          renderSheetOverlayAndChordsBar();
        }
      });

      // 綁定 AI 辨識與 API Key 設定按鈕
      if (els.btnRunAiRecognize) {
        els.btnRunAiRecognize.addEventListener('click', () => executeCurrentPageRecognition(false));
      }
      if (els.btnForceAiRecognize) {
        els.btnForceAiRecognize.addEventListener('click', () => executeCurrentPageRecognition(true));
      }
      if (els.btnToggleApiKeyBox && els.apiKeyConfigBox) {
        els.btnToggleApiKeyBox.addEventListener('click', () => {
          const isHidden = els.apiKeyConfigBox.style.display === 'none';
          els.apiKeyConfigBox.style.display = isHidden ? 'block' : 'none';
          if (isHidden && els.geminiApiKeyInput && window.SheetParser) {
            els.geminiApiKeyInput.value = SheetParser.getApiKey();
          }
        });
      }
      if (els.btnSaveApiKey && window.SheetParser) {
        els.btnSaveApiKey.addEventListener('click', () => {
          SheetParser.setApiKey(els.geminiApiKeyInput.value);
          if (els.geminiModelSelect) {
            SheetParser.setModelName(els.geminiModelSelect.value);
          }
          updateApiKeyStatusUI();
          els.apiKeyConfigBox.style.display = 'none';
        });
      }
      if (els.btnClearApiKey && window.SheetParser) {
        els.btnClearApiKey.addEventListener('click', () => {
          SheetParser.setApiKey('');
          if (els.geminiApiKeyInput) els.geminiApiKeyInput.value = '';
          updateApiKeyStatusUI();
        });
      }

      if (els.btnLoadSamplePdf) {
        els.btnLoadSamplePdf.addEventListener('click', async () => {
          state.sourceKey = 'Am';
          state.targetKey = 'Cm';
          els.sourceKeySelect.value = state.sourceKey;
          els.targetKeySelect.value = state.targetKey;
          updateAllViews();
          await SheetViewer.loadBuiltInSample('changHuanPdf');
        });
      }

      if (els.btnLoadSampleJpg) {
        els.btnLoadSampleJpg.addEventListener('click', async () => {
          state.sourceKey = 'C';
          state.targetKey = 'D';
          els.sourceKeySelect.value = state.sourceKey;
          els.targetKeySelect.value = state.targetKey;
          updateAllViews();
          await SheetViewer.loadBuiltInSample('kawaJpg');
        });
      }

      // ======================================================================
      // T2-3：原譜覆蓋標籤互動微調、新增/修改/刪除與鋼琴聯動事件綁定
      // ======================================================================

      // 1. 點擊譜面新增和弦模式開關
      if (els.btnToggleAddChordMode) {
        els.btnToggleAddChordMode.addEventListener('click', () => {
          state.addChordOnSheetMode = !state.addChordOnSheetMode;
          els.btnToggleAddChordMode.textContent = state.addChordOnSheetMode
            ? '➕ 點擊譜面新增和弦：開啟中 (請點譜面任意位置)'
            : '➕ 點擊譜面新增和弦：關閉';
          els.btnToggleAddChordMode.className = state.addChordOnSheetMode ? 'btn btn-amber' : 'btn';
          renderSheetOverlayAndChordsBar();
        });
      }

      // 在譜面空白處點擊以新增和弦標籤
      if (els.sheetOverlayLayer) {
        els.sheetOverlayLayer.addEventListener('click', (e) => {
          if (!state.addChordOnSheetMode) return;
          if (e.target !== els.sheetOverlayLayer) return;

          const pageObj = SheetViewer.getCurrentPage();
          if (!pageObj) return;

          const rect = els.sheetOverlayLayer.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;

          const xPercent = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
          const yPercent = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;

          const defaultRaw = state.sourceKey.endsWith('m') ? '6m' : 'C';
          const newId = `user_tag_${Date.now().toString(36)}`;
          if (!Array.isArray(pageObj.chords)) pageObj.chords = [];

          pageObj.chords.push({
            id: newId,
            raw: defaultRaw,
            xPercent: Math.max(1, Math.min(99, xPercent)),
            yPercent: Math.max(1, Math.min(99, yPercent)),
            line: 1
          });

          state.selectedSheetTagId = newId;
          persistCurrentPageChords();
          renderSheetOverlayAndChordsBar();
          renderSheetSelectedInspector(true);

          if (els.inspectorRawChordInput) {
            els.inspectorRawChordInput.focus();
            els.inspectorRawChordInput.select();
          }
        });
      }

      // 2. 顯示/隱藏覆蓋標籤 (方便臨時看原譜底字對照)
      if (els.btnToggleTagsVisible) {
        els.btnToggleTagsVisible.addEventListener('click', () => {
          state.tagsVisible = !state.tagsVisible;
          els.btnToggleTagsVisible.textContent = state.tagsVisible
            ? '👁️ 覆蓋標籤：顯示中 (點此對照原譜)'
            : '🙈 覆蓋標籤：已隱藏 (顯示原譜)';
          els.btnToggleTagsVisible.className = state.tagsVisible ? 'btn btn-emerald' : 'btn';
          renderSheetOverlayAndChordsBar();
        });
      }

      // 3. 重置本頁座標為初始辨識狀態
      if (els.btnResetPageChords) {
        els.btnResetPageChords.addEventListener('click', () => {
          const vState = SheetViewer.getState();
          const pageObj = SheetViewer.getCurrentPage();
          if (!pageObj || !window.SheetParser) return;

          const restored = SheetParser.resetPageCache(vState.fileName, pageObj.pageNumber);
          pageObj.chords = restored && Array.isArray(restored.chords) ? restored.chords : [];
          state.selectedSheetTagId = pageObj.chords[0] ? pageObj.chords[0].id : null;
          renderSheetOverlayAndChordsBar();
        });
      }

      // 4. 標籤樣式與字體大小切換
      if (els.tagStyleSelect) {
        els.tagStyleSelect.addEventListener('change', () => {
          state.tagStyle = els.tagStyleSelect.value;
          renderSheetOverlayAndChordsBar();
        });
      }
      if (els.tagSizeSelect) {
        els.tagSizeSelect.addEventListener('change', () => {
          state.tagFontSize = parseInt(els.tagSizeSelect.value, 10) || 15;
          renderSheetOverlayAndChordsBar();
        });
      }

      // 5. 全頁標籤批次位置微調 (上/下/左/右)
      function nudgeAllPageChords(dx, dy) {
        const pageObj = SheetViewer.getCurrentPage();
        if (!pageObj || !Array.isArray(pageObj.chords)) return;
        pageObj.chords.forEach(c => {
          c.xPercent = Math.round(Math.max(1, Math.min(99, c.xPercent + dx)) * 10) / 10;
          c.yPercent = Math.round(Math.max(1, Math.min(99, c.yPercent + dy)) * 10) / 10;
        });
        persistCurrentPageChords();
        renderSheetOverlayAndChordsBar();
      }

      if (els.btnNudgeUp) els.btnNudgeUp.addEventListener('click', () => nudgeAllPageChords(0, -0.6));
      if (els.btnNudgeDown) els.btnNudgeDown.addEventListener('click', () => nudgeAllPageChords(0, 0.6));
      if (els.btnNudgeLeft) els.btnNudgeLeft.addEventListener('click', () => nudgeAllPageChords(-0.6, 0));
      if (els.btnNudgeRight) els.btnNudgeRight.addEventListener('click', () => nudgeAllPageChords(0.6, 0));

      // 6. 選取標籤之原譜和弦文字修改與刪除
      function applySelectedTagChordEdit() {
        const pageObj = SheetViewer.getCurrentPage();
        if (!pageObj || !Array.isArray(pageObj.chords) || !state.selectedSheetTagId) return;
        const newRaw = (els.inspectorRawChordInput.value || '').trim();
        if (!newRaw) return;

        const chordItem = pageObj.chords.find(c => c.id === state.selectedSheetTagId);
        if (!chordItem) return;

        chordItem.raw = newRaw;
        persistCurrentPageChords();
        renderSheetOverlayAndChordsBar();
        renderSheetSelectedInspector(true);
      }

      if (els.btnInspectorUpdateChord) {
        els.btnInspectorUpdateChord.addEventListener('click', applySelectedTagChordEdit);
      }
      if (els.inspectorRawChordInput) {
        els.inspectorRawChordInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            applySelectedTagChordEdit();
          }
        });
      }

      if (els.btnInspectorDeleteChord) {
        els.btnInspectorDeleteChord.addEventListener('click', () => {
          const pageObj = SheetViewer.getCurrentPage();
          if (!pageObj || !Array.isArray(pageObj.chords) || !state.selectedSheetTagId) return;
          pageObj.chords = pageObj.chords.filter(c => c.id !== state.selectedSheetTagId);
          state.selectedSheetTagId = pageObj.chords[0] ? pageObj.chords[0].id : null;
          persistCurrentPageChords();
          renderSheetOverlayAndChordsBar();
        });
      }

      if (els.btnInspectorPlayAudio) {
        els.btnInspectorPlayAudio.addEventListener('click', () => {
          renderSheetSelectedInspector(true);
        });
      }

      if (els.btnToggleInlinePiano) {
        els.btnToggleInlinePiano.addEventListener('click', () => {
          state.inlinePianoVisible = !state.inlinePianoVisible;
          if (els.sheetInlinePianoWrapper) {
            els.sheetInlinePianoWrapper.style.display = state.inlinePianoVisible ? 'block' : 'none';
          }
        });
      }

      // ======================================================================
      // T3-1 & T3-2：另存轉調後新琴譜 (JPG / PDF) 與專案檔 (.json) 事件綁定
      // ======================================================================

      function getExportRenderOptions() {
        return {
          sourceKey: state.sourceKey,
          targetKey: state.targetKey,
          displayMode: state.displayMode,
          tagStyle: state.tagStyle,
          tagFontSize: state.tagFontSize,
          tagsVisible: state.tagsVisible
        };
      }

      // 1. 另存本頁為高清 JPG 圖片 (T3-1A)
      if (els.btnExportPageJpg && window.SheetExporter) {
        els.btnExportPageJpg.addEventListener('click', async () => {
          try {
            els.btnExportPageJpg.disabled = true;
            const outName = await SheetExporter.exportCurrentPageAsJpg(
              SheetViewer.getState(),
              getExportRenderOptions()
            );
            els.aiRecognizeSummary.textContent = `🖼️ 已成功匯出並下載本頁圖片：「${outName}」`;
            els.aiRecognizeSummary.style.color = '#6ee7b7';
          } catch (err) {
            els.aiRecognizeSummary.textContent = `⚠️ 匯出 JPG 失敗：${err.message}`;
            els.aiRecognizeSummary.style.color = '#fda4af';
          } finally {
            els.btnExportPageJpg.disabled = false;
          }
        });
      }

      // 2. 另存全曲所有頁面為單一新 PDF 琴譜 (T3-1B)
      if (els.btnExportAllPdf && window.SheetExporter) {
        els.btnExportAllPdf.addEventListener('click', async () => {
          try {
            els.btnExportAllPdf.disabled = true;
            const outName = await SheetExporter.exportAllPagesAsPdf(
              SheetViewer.getState(),
              getExportRenderOptions(),
              (cur, total) => {
                els.aiRecognizeSummary.textContent = `⏳ 正在合成高清 PDF 琴譜：第 ${cur} / ${total} 頁...`;
                els.aiRecognizeSummary.style.color = '#fde68a';
              }
            );
            els.aiRecognizeSummary.textContent = `📑 已成功匯出並下載全曲 PDF 琴譜：「${outName}」`;
            els.aiRecognizeSummary.style.color = '#6ee7b7';
          } catch (err) {
            els.aiRecognizeSummary.textContent = `⚠️ 匯出 PDF 失敗：${err.message}`;
            els.aiRecognizeSummary.style.color = '#fda4af';
          } finally {
            els.btnExportAllPdf.disabled = false;
          }
        });
      }

      // 3. 儲存當前校對完成的琴譜為 .json 專案檔 (T3-2A)
      if (els.btnExportProjectJson && window.SheetExporter) {
        els.btnExportProjectJson.addEventListener('click', () => {
          try {
            const outName = SheetExporter.exportProjectJson(
              SheetViewer.getState(),
              getExportRenderOptions()
            );
            els.aiRecognizeSummary.textContent = `💾 已成功儲存琴譜專案檔：「${outName}」(下次可直接載入免重新辨識)`;
            els.aiRecognizeSummary.style.color = '#6ee7b7';
          } catch (err) {
            els.aiRecognizeSummary.textContent = `⚠️ 儲存專案檔失敗：${err.message}`;
            els.aiRecognizeSummary.style.color = '#fda4af';
          }
        });
      }

      // 4. 載入 .json 琴譜專案檔 (T3-2B)
      if (els.projectJsonFileInput && window.SheetExporter) {
        els.projectJsonFileInput.addEventListener('change', async (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          try {
            const proj = await SheetExporter.parseProjectJsonFile(file);
            if (proj.sourceKey) {
              state.sourceKey = proj.sourceKey;
              els.sourceKeySelect.value = state.sourceKey;
            }
            if (proj.targetKey) {
              state.targetKey = proj.targetKey;
              els.targetKeySelect.value = state.targetKey;
            }
            if (proj.displayMode) {
              state.displayMode = proj.displayMode;
              els.modeButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-mode') === state.displayMode));
            }
            if (proj.tagStyle && els.tagStyleSelect) {
              state.tagStyle = proj.tagStyle;
              els.tagStyleSelect.value = state.tagStyle;
            }
            if (proj.tagFontSize && els.tagSizeSelect) {
              state.tagFontSize = Number(proj.tagFontSize) || 15;
              els.tagSizeSelect.value = String(state.tagFontSize);
            }

            // 將專案檔各頁和弦同步寫入本機快取
            if (window.SheetParser && Array.isArray(proj.pages)) {
              proj.pages.forEach(p => {
                SheetParser.saveCachedRecognition(proj.fileName, p.pageNumber, {
                  detectedSourceKey: proj.sourceKey,
                  detectedTargetKey: proj.targetKey,
                  chords: p.chords || []
                });
              });
            }

            SheetViewer.loadFromProjectData(proj);
            updateAllViews();
            els.aiRecognizeSummary.textContent = `📂 已成功載入專案檔「${file.name}」（共 ${proj.pages.length} 頁，0 Token）`;
            els.aiRecognizeSummary.style.color = '#6ee7b7';
          } catch (err) {
            els.aiRecognizeSummary.textContent = `⚠️ 載入專案檔失敗：${err.message}`;
            els.aiRecognizeSummary.style.color = '#fda4af';
          } finally {
            els.projectJsonFileInput.value = '';
          }
        });
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initDOMReferences();
    populateKeySelects();
    renderQuickChordChips();
    bindEvents();
    // 方案 1：初次開啟網頁維持 C 大調 ➔ C 大調 (0 半音標準歸零狀態)，僅預填模式三的範例文字而不強制覆寫調性
    loadPresetSheet('changHuan', false);
  });
})();
