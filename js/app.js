/**
 * 🎹 智慧和弦轉調與組成音查詢工具 - 前端應用程式主控制器 (js/app.js)
 *
 * 負責：
 * 1. 全域狀態管理 (原調 sourceKey、目標調 targetKey、顯示模式 displayMode、選中和弦 selectedChordRaw、音效開關 audioEnabled)
 * 2. 新調性升降記號、自然音階與小調導音提示橫幅渲染
 * 3. 單一和弦即時查詢區與 3 八度互動式 SVG 鋼琴鍵盤連動
 * 4. 整首和弦譜批次轉調（內建《償還》方框級數譜與《川の流れのように》紅色英文和弦譜完整範例）
 */

(function () {
  'use strict';

  // ============================================================================
  // 1. 內建實譜範例資料 (來自使用者提供的兩份電子琴簡譜)
  // ============================================================================

  const PRESET_SHEETS = {
    changHuan: {
      title: '《償還》鄧麗君 (電子琴方框級數譜 - 全曲)',
      sourceKey: 'Am',
      targetKey: 'Cm', // 譜面建議女調 Cm (男調 Fm)
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
      targetKey: 'D', // 譜面建議 C+2 (1=D)
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

  // 依照大小調分組的調性選單清單
  const KEY_OPTIONS_MINOR = ['Am', 'Bbm', 'Bm', 'Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m'];
  const KEY_OPTIONS_MAJOR = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

  // ============================================================================
  // 2. 應用程式狀態 (App State)
  // ============================================================================

  const state = {
    sourceKey: 'Am',
    targetKey: 'Cm',
    displayMode: 'english', // 'english' (預設英文) | 'number' (固定調數字) | 'practice' (練功雙語對照)
    audioEnabled: true,
    activePresetKey: 'changHuan',
    selectedRawChord: '37-9+5',
    selectedCardIndex: null
  };

  // ============================================================================
  // 3. DOM 元素參照與初始化
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

    // 新調性升降記號橫幅
    els.ksBanner = document.getElementById('keySignatureBanner');

    // 單一和弦查詢與鋼琴區
    els.chordLookupInput = document.getElementById('chordLookupInput');
    els.btnPlayCurrentChord = document.getElementById('btnPlayCurrentChord');
    els.quickChordChips = document.getElementById('quickChordChips');
    els.voicingDetailBox = document.getElementById('voicingDetailBox');
    els.pianoContainer = document.getElementById('pianoContainer');

    // 批次和弦譜轉調區
    els.btnPresetChangHuan = document.getElementById('btnPresetChangHuan');
    els.btnPresetKawa = document.getElementById('btnPresetKawa');
    els.sheetInputTextarea = document.getElementById('sheetInputTextarea');
    els.quickKeyPresetsBar = document.getElementById('quickKeyPresetsBar');
    els.transposedSheetOutput = document.getElementById('transposedSheetOutput');
  }

  /**
   * 填充原調與目標調下拉選單
   */
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
  // 4. 新調性升降記號與音階橫幅渲染
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

    // 升降記號黑鍵清單膠囊
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

    // 自然音階列表
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
  // 5. 單一和弦組成音與互動式鋼琴鍵盤渲染
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

    // 渲染 3 八度互動式鋼琴鍵盤
    PianoVisualizer.mountPiano(els.pianoContainer, transposed);

    if (triggerAudio && state.audioEnabled) {
      PianoVisualizer.playChordAudio(transposed);
    }
  }

  /**
   * 建立快速測試和弦按鈕列
   */
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

  // ============================================================================
  // 6. 批次和弦譜解析與小節卡片渲染
  // ============================================================================

  /**
   * 解析多行和弦譜文字，保留段落標籤 [Intro] 與小節結構
   */
  function parseSheetText(text) {
    const lines = (text || '').split(/\r?\n/);
    const sections = [];
    let currentSection = { title: '樂譜段落', bars: [] };

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // 判斷是否為段落標題，如 [Main A 主歌]
      const secMatch = trimmed.match(/^\[(.*)\]$/);
      if (secMatch) {
        if (currentSection.bars.length > 0) {
          sections.push(currentSection);
        }
        currentSection = { title: secMatch[1], bars: [] };
        return;
      }

      // 以小節線 | 分割小節，再以空白分割小節內的多個和弦
      const barStrings = trimmed.split('|').map(s => s.trim()).filter(Boolean);
      barStrings.forEach((barStr, barIdx) => {
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

  /**
   * 渲染快速目標調性切換列 (針對當前載入的範例曲目)
   */
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

  /**
   * 渲染整首轉調後的小節和弦卡片網格
   */
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

        // 依據顯示模式決定主顯示與副顯示文字
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

    // 綁定點擊任一小節和弦卡，連動上方鋼琴鍵盤與發聲
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
  // 7. 半音升降與範例載入輔助函式
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

    // 預設選取該譜的第一個特殊和弦展示於鋼琴上
    const firstChord = presetKey === 'changHuan' ? '6m' : 'C';
    els.chordLookupInput.value = firstChord;

    updateAllViews();
  }

  function updateAllViews() {
    renderKeySignatureBanner();
    renderQuickKeyPresets();
    renderSelectedChordAndPiano(false);
    renderTransposedSheet();
  }

  // ============================================================================
  // 8. 事件綁定與啟動
  // ============================================================================

  function bindEvents() {
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

    // 顯示模式切換 (英文字母 / 固定調數字 / 練功對照)
    els.modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        els.modeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.displayMode = btn.getAttribute('data-mode');
        renderTransposedSheet();
      });
    });

    // 音效開關
    els.btnAudioToggle.addEventListener('click', () => {
      state.audioEnabled = !state.audioEnabled;
      els.btnAudioToggle.textContent = state.audioEnabled ? '🔊 琴音試聽：開啟' : '🔇 琴音試聽：靜音';
      els.btnAudioToggle.className = state.audioEnabled ? 'btn btn-emerald' : 'btn';
    });

    // 單一和弦即時輸入查詢
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

    // 範例譜載入與即時文字編輯
    els.btnPresetChangHuan.addEventListener('click', () => loadPresetSheet('changHuan'));
    els.btnPresetKawa.addEventListener('click', () => loadPresetSheet('kawaNoNagare'));

    els.sheetInputTextarea.addEventListener('input', () => {
      renderTransposedSheet();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initDOMReferences();
    populateKeySelects();
    renderQuickChordChips();
    bindEvents();
    loadPresetSheet('changHuan');
  });
})();
