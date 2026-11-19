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
    sourceKey: 'Am',
    targetKey: 'Cm',
    displayMode: 'english', // 'english' | 'number' | 'practice'
    audioEnabled: true,
    activeTab: 'tab-reference-table',
    degreeFilter: 'common', // 'common' | 'all' | '1' ~ '7'
    activePresetKey: 'changHuan',
    selectedRawChord: '6m',
    selectedCardIndex: null
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

    // 模式二 (T2-1)：琴譜 PDF / JPG 載入與高清預覽區
    els.sheetViewerStatus = document.getElementById('sheetViewerStatus');
    els.sheetDropZone = document.getElementById('sheetDropZone');
    els.sheetFileInput = document.getElementById('sheetFileInput');
    els.btnLoadSamplePdf = document.getElementById('btnLoadSamplePdf');
    els.btnLoadSampleJpg = document.getElementById('btnLoadSampleJpg');
    els.btnSheetPrevPage = document.getElementById('btnSheetPrevPage');
    els.sheetPageIndicator = document.getElementById('sheetPageIndicator');
    els.btnSheetNextPage = document.getElementById('btnSheetNextPage');
    els.sheetPageQuickBtns = document.getElementById('sheetPageQuickBtns');
    els.btnSheetZoomOut = document.getElementById('btnSheetZoomOut');
    els.btnSheetZoomReset = document.getElementById('btnSheetZoomReset');
    els.sheetZoomLabel = document.getElementById('sheetZoomLabel');
    els.btnSheetZoomIn = document.getElementById('btnSheetZoomIn');
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

  function populateKeySelects() {
    [els.sourceKeySelect, els.targetKeySelect].forEach(selectEl => {
      selectEl.innerHTML = '';

      const grpMajor = document.createElement('optgroup');
      grpMajor.label = '大調 (Major Keys)';
      KEY_OPTIONS_MAJOR.forEach(k => {
        const info = MusicTheory.getKeyInfo(k);
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = info.label;
        grpMajor.appendChild(opt);
      });

      const grpMinor = document.createElement('optgroup');
      grpMinor.label = '小調 (Minor Keys)';
      KEY_OPTIONS_MINOR.forEach(k => {
        const info = MusicTheory.getKeyInfo(k);
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = info.label;
        grpMinor.appendChild(opt);
      });

      selectEl.appendChild(grpMajor);
      selectEl.appendChild(grpMinor);
    });

    els.sourceKeySelect.value = state.sourceKey;
    els.targetKeySelect.value = state.targetKey;
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

  function loadPresetSheet(presetKey) {
    const preset = PRESET_SHEETS[presetKey];
    if (!preset) return;

    state.activePresetKey = presetKey;
    state.sourceKey = preset.sourceKey;
    state.targetKey = preset.targetKey;
    state.selectedCardIndex = 0;

    els.sourceKeySelect.value = state.sourceKey;
    els.targetKeySelect.value = state.targetKey;
    els.sheetInputTextarea.value = preset.content;

    const firstChord = presetKey === 'changHuan' ? '6m' : 'C';
    els.chordLookupInput.value = firstChord;

    updateAllViews();
  }

  function updateAllViews() {
    renderKeySignatureBanner();
    renderQuickSingleConverter();
    renderReferenceTable();
    renderQuickKeyPresets();
    renderSelectedChordAndPiano(false);
    renderTransposedSheet();
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

    // 原調與目標調變更
    els.sourceKeySelect.addEventListener('change', () => {
      state.sourceKey = els.sourceKeySelect.value;
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

    // 模式二 (T2-1)：初始化 PDF / JPG 琴譜載入與預覽模組
    if (window.SheetViewer) {
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
      });

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
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initDOMReferences();
    populateKeySelects();
    renderQuickChordChips();
    bindEvents();
    loadPresetSheet('changHuan');
  });
})();
