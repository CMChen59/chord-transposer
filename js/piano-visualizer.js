/**
 * 🎹 智慧和弦轉調與組成音查詢工具 - 互動式鋼琴鍵盤與發聲視覺化模組 (piano-visualizer.js)
 *
 * 支援功能 (對應任務 T1-3)：
 * 1. 繪製高解析 SVG 鋼琴鍵盤 (預設 C3 ~ B5 共 3 個八度、36 個琴鍵)
 * 2. 清楚區分「左手根音/轉位 Bass 音 (C3~B3)」與「右手和弦組成音 (C4~B5)」
 * 3. 在每個發亮琴鍵上同時標示「英文音名 (如 Eb)」、「固定調簡譜數字 (如 b3)」與「音程角色 (如 b3, b7, b9)」
 * 4. 支援「新調性音階與升降記號 (黑鍵提示)」鍵盤檢視模式
 * 5. 內建 Web Audio API 溫暖電鋼琴音源，支援點擊琴鍵單音試聽與整組和弦琶音/齊奏試聽
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const MusicTheory = require('./music-theory.js');
    module.exports = factory(MusicTheory);
  } else {
    root.PianoVisualizer = factory(root.MusicTheory);
  }
})(typeof self !== 'undefined' ? self : this, function (MusicTheory) {
  'use strict';

  // ============================================================================
  // 1. 琴鍵幾何尺寸與八度結構定義
  // ============================================================================

  const WHITE_KEY_WIDTH = 42;
  const WHITE_KEY_HEIGHT = 175;
  const BLACK_KEY_WIDTH = 26;
  const BLACK_KEY_HEIGHT = 110;

  /** 單一八度內的 12 個半音定義 (0=C ~ 11=B) */
  const OCTAVE_LAYOUT = [
    { pc: 0,  isBlack: false, whiteIndex: 0 }, // C
    { pc: 1,  isBlack: true,  whiteOffset: 0.65 }, // C# / Db
    { pc: 2,  isBlack: false, whiteIndex: 1 }, // D
    { pc: 3,  isBlack: true,  whiteOffset: 1.72 }, // D# / Eb
    { pc: 4,  isBlack: false, whiteIndex: 2 }, // E
    { pc: 5,  isBlack: false, whiteIndex: 3 }, // F
    { pc: 6,  isBlack: true,  whiteOffset: 3.62 }, // F# / Gb
    { pc: 7,  isBlack: false, whiteIndex: 4 }, // G
    { pc: 8,  isBlack: true,  whiteOffset: 4.68 }, // G# / Ab
    { pc: 9,  isBlack: false, whiteIndex: 5 }, // A
    { pc: 10, isBlack: true,  whiteOffset: 5.74 }, // A# / Bb
    { pc: 11, isBlack: false, whiteIndex: 6 }  // B
  ];

  // ============================================================================
  // 2. 計算鋼琴鍵盤狀態資料模型 (可於 Node.js 進行自動化單元測試)
  // ============================================================================

  /**
   * 根據轉調後的和弦物件，產生鋼琴鍵盤 (MIDI startMidi ~ endMidi) 每個琴鍵的標亮與標籤狀態
   *
   * @param {object} transposedChord - MusicTheory.transposeChord() 回傳之物件
   * @param {object} [options] - 設定項 (startOctave=3, octaves=3, preferFlat=false)
   * @returns {object} 包含所有琴鍵狀態與摘要資訊的模型
   */
  function buildKeyboardState(transposedChord, options = {}) {
    const startOctave = options.startOctave || 3; // 預設 C3 (MIDI 48)
    const octaves = options.octaves || 3;         // 預設 3 個八度 (C3 ~ B5, MIDI 48 ~ 83)
    const startMidi = (startOctave + 1) * 12;     // C3 = 48
    const totalSemitones = octaves * 12;

    // 判斷該和弦組成音偏好升號或降號顯示
    const notesObj = transposedChord && transposedChord.notes ? transposedChord.notes : null;
    const leftBassMidi = notesObj ? notesObj.leftHandBassMidi : null;
    const rightMidiList = notesObj && Array.isArray(notesObj.rightHandMidi) ? notesObj.rightHandMidi : [];

    // 建立右手 MIDI 對應之音名、簡譜數字與音程角色查找表
    const rightMidiMap = new Map();
    if (notesObj && notesObj.english && notesObj.fixedNumber) {
      rightMidiList.forEach((midi, idx) => {
        rightMidiMap.set(midi, {
          english: notesObj.english[idx],
          fixedNumber: notesObj.fixedNumber[idx],
          formulaRole: (notesObj.formula && notesObj.formula[idx]) ? notesObj.formula[idx] : '',
          isRoot: idx === 0
        });
      });
    }

    const keys = [];
    for (let i = 0; i < totalSemitones; i++) {
      const midi = startMidi + i;
      const octave = Math.floor(midi / 12) - 1;
      const pc = midi % 12;
      const layout = OCTAVE_LAYOUT[pc];
      const octaveIndex = octave - startOctave;

      // 計算 X 座標
      let x = 0;
      if (!layout.isBlack) {
        const globalWhiteIdx = octaveIndex * 7 + layout.whiteIndex;
        x = globalWhiteIdx * WHITE_KEY_WIDTH;
      } else {
        x = (octaveIndex * 7 + layout.whiteOffset) * WHITE_KEY_WIDTH;
      }

      // 判斷是否為標亮琴鍵
      let activeRole = null; // 'bass' | 'root' | 'chordTone' | null
      let displayEng = MusicTheory ? MusicTheory.formatPitchToEnglish(pc, false) : '';
      let displayNum = MusicTheory ? MusicTheory.formatPitchToFixedNumber(pc, false) : '';
      let intervalLabel = '';

      if (leftBassMidi === midi) {
        activeRole = 'bass';
        displayEng = notesObj.bassEnglish || displayEng;
        displayNum = notesObj.bassFixedNumber || displayNum;
        intervalLabel = 'Bass';
      } else if (rightMidiMap.has(midi)) {
        const info = rightMidiMap.get(midi);
        activeRole = info.isRoot ? 'root' : 'chordTone';
        displayEng = info.english;
        displayNum = info.fixedNumber;
        intervalLabel = info.formulaRole;
      }

      keys.push({
        midi,
        octave,
        pitchClass: pc,
        isBlack: layout.isBlack,
        x: Math.round(x * 100) / 100,
        width: layout.isBlack ? BLACK_KEY_WIDTH : WHITE_KEY_WIDTH,
        height: layout.isBlack ? BLACK_KEY_HEIGHT : WHITE_KEY_HEIGHT,
        activeRole,
        isHighlighted: activeRole !== null,
        displayEng,
        displayNum,
        intervalLabel
      });
    }

    const totalWhiteKeys = octaves * 7;
    const svgWidth = totalWhiteKeys * WHITE_KEY_WIDTH;
    const svgHeight = WHITE_KEY_HEIGHT + 36; // 底部預留音程與角色標籤空間

    return {
      chordTitle: transposedChord ? transposedChord.englishChord : '',
      fixedNumberTitle: transposedChord ? transposedChord.fixedNumberChord : '',
      chordTypeName: transposedChord ? transposedChord.chordTypeName : '',
      svgWidth,
      svgHeight,
      keys,
      highlightedKeys: keys.filter(k => k.isHighlighted)
    };
  }

  // ============================================================================
  // 3. 產生 SVG 向量鋼琴鍵盤字串 (renderPianoSVG)
  // ============================================================================

  /**
   * 渲染單一琴鍵之 SVG 片段
   */
  function renderSingleKeySVG(k) {
    // 配色定義
    let fill = k.isBlack ? 'url(#blackKeyGrad)' : 'url(#whiteKeyGrad)';
    let stroke = k.isBlack ? '#111827' : '#cbd5e1';
    let textColor = k.isBlack ? '#9ca3af' : '#64748b';
    let badgeBg = '';

    if (k.activeRole === 'bass') {
      fill = k.isBlack ? '#d97706' : '#fbbf24'; // 左手 Bass：琥珀橘金色
      stroke = '#b45309';
      textColor = k.isBlack ? '#ffffff' : '#78350f';
      badgeBg = '#f59e0b';
    } else if (k.activeRole === 'root') {
      fill = k.isBlack ? '#2563eb' : '#60a5fa'; // 右手根音：寶石藍
      stroke = '#1d4ed8';
      textColor = '#ffffff';
      badgeBg = '#2563eb';
    } else if (k.activeRole === 'chordTone') {
      fill = k.isBlack ? '#059669' : '#34d399'; // 右手和弦組成音：翠綠青色
      stroke = '#047857';
      textColor = k.isBlack ? '#ffffff' : '#064e3b';
      badgeBg = '#10b981';
    }

    const centerX = k.x + k.width / 2;
    const rx = k.isBlack ? 4 : 6;
    const keyClass = `piano-key ${k.isBlack ? 'black-key' : 'white-key'} ${k.activeRole ? 'active-' + k.activeRole : ''}`;

    let labelMarkup = '';
    if (k.isHighlighted) {
      const noteY = k.isBlack ? k.height - 34 : k.height - 42;
      const numY = k.isBlack ? k.height - 14 : k.height - 18;
      const roleY = WHITE_KEY_HEIGHT + 22;

      labelMarkup = `
        <g class="key-active-labels" pointer-events="none">
          <text x="${centerX}" y="${noteY}" text-anchor="middle" font-size="${k.isBlack ? '11' : '13'}" font-weight="800" fill="${textColor}">${k.displayEng}</text>
          <text x="${centerX}" y="${numY}" text-anchor="middle" font-size="${k.isBlack ? '10' : '12'}" font-weight="700" fill="${textColor}">(${k.displayNum})</text>
          <rect x="${centerX - 16}" y="${WHITE_KEY_HEIGHT + 6}" width="32" height="22" rx="5" fill="${badgeBg}" />
          <text x="${centerX}" y="${roleY}" text-anchor="middle" font-size="11" font-weight="700" fill="#ffffff">${k.intervalLabel}</text>
        </g>`;
    } else if (!k.isBlack && k.pitchClass === 0) {
      // 在未標亮的 C 鍵上標示 C3 / C4 / C5 八度參考點
      labelMarkup = `
        <text x="${centerX}" y="${k.height - 12}" text-anchor="middle" font-size="11" font-weight="600" fill="#94a3b8" pointer-events="none">C${k.octave}</text>`;
    }

    return `
      <g class="${keyClass}" data-midi="${k.midi}" data-note="${k.displayEng}" style="cursor: pointer;">
        <rect x="${k.x}" y="0" width="${k.width}" height="${k.height}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" />
        ${labelMarkup}
      </g>`;
  }

  /**
   * 產生完整的互動式 SVG 鋼琴鍵盤 HTML 字串
   * 注意：必須先繪製所有白鍵，再繪製所有黑鍵，黑鍵才會正確疊在白鍵上方
   *
   * @param {object} transposedChord - MusicTheory.transposeChord() 回傳之物件
   * @param {object} [options] - 設定項
   * @returns {string} SVG 字串
   */
  function renderPianoSVG(transposedChord, options = {}) {
    const state = buildKeyboardState(transposedChord, options);
    const whiteKeys = state.keys.filter(k => !k.isBlack);
    const blackKeys = state.keys.filter(k => k.isBlack);

    const whiteSvg = whiteKeys.map(renderSingleKeySVG).join('');
    const blackSvg = blackKeys.map(renderSingleKeySVG).join('');

    // 分隔左手伴奏區 (C3~B3) 與右手和弦區 (C4~B5) 的頂部指示條
    const leftHandWidth = 7 * WHITE_KEY_WIDTH;
    const rightHandWidth = state.svgWidth - leftHandWidth;

    return `
<svg class="piano-svg" viewBox="0 -28 ${state.svgWidth} ${state.svgHeight + 28}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="whiteKeyGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#f8fafc" />
    </linearGradient>
    <linearGradient id="blackKeyGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#374151" />
      <stop offset="100%" stop-color="#111827" />
    </linearGradient>
  </defs>

  <!-- 左右手音域指示條 -->
  <g class="hand-zone-header">
    <rect x="0" y="-26" width="${leftHandWidth - 2}" height="22" rx="4" fill="#fef3c7" stroke="#f59e0b" stroke-width="1" />
    <text x="${leftHandWidth / 2}" y="-11" text-anchor="middle" font-size="11" font-weight="700" fill="#b45309">左手低音 / Bass 根音區 (C3~B3)</text>

    <rect x="${leftHandWidth + 2}" y="-26" width="${rightHandWidth - 2}" height="22" rx="4" fill="#eff6ff" stroke="#3b82f6" stroke-width="1" />
    <text x="${leftHandWidth + rightHandWidth / 2}" y="-11" text-anchor="middle" font-size="11" font-weight="700" fill="#1d4ed8">右手和弦組成音區 (C4~B5) — 藍:根音(1) / 綠:組成音</text>
  </g>

  <!-- 白鍵層 -->
  <g class="white-keys-layer">${whiteSvg}</g>

  <!-- 黑鍵層 -->
  <g class="black-keys-layer">${blackSvg}</g>
</svg>`.trim();
  }

  // ============================================================================
  // 4. Web Audio API 內建和弦發聲器 (免外部音源檔，點擊即可聽和弦與單音)
  // ============================================================================

  let audioCtx = null;

  function getAudioContext() {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  /**
   * 將 MIDI 音高轉為頻率 (Hz)，A4 (MIDI 69) = 440Hz
   */
  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /**
   * 播放單一 MIDI 琴鍵音色（溫暖電鋼琴包絡線）
   */
  function playNoteAudio(midi, duration = 1.1, delay = 0, volume = 0.18) {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    // 混合 Triangle 與 Sine 波營造溫暖柔和的鍵盤音色
    osc1.type = 'triangle';
    osc2.type = 'sine';
    const freq = midiToFreq(midi);
    osc1.frequency.setValueAtTime(freq, now);
    osc2.frequency.setValueAtTime(freq * 2, now); // 高八度泛音

    const osc2Gain = ctx.createGain();
    osc2Gain.gain.setValueAtTime(0.15, now);

    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(volume, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    osc1.connect(gainNode);
    osc2.connect(osc2Gain);
    osc2Gain.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
  }

  /**
   * 播放整組轉調後和弦（左手 Bass + 右手組成音微琶音）
   */
  function playChordAudio(transposedChord) {
    if (!transposedChord || !transposedChord.notes) return;
    const { leftHandBassMidi, rightHandMidi } = transposedChord.notes;

    if (typeof leftHandBassMidi === 'number') {
      playNoteAudio(leftHandBassMidi, 1.5, 0, 0.22);
    }
    if (Array.isArray(rightHandMidi)) {
      rightHandMidi.forEach((midi, idx) => {
        playNoteAudio(midi, 1.4, 0.04 * (idx + 1), 0.16);
      });
    }
  }

  /**
   * 將互動式鋼琴鍵盤掛載至指定的 DOM 容器，並自動綁定點擊琴鍵發聲事件
   */
  function mountPiano(containerEl, transposedChord, options = {}) {
    if (!containerEl) return null;
    const state = buildKeyboardState(transposedChord, options);
    containerEl.innerHTML = renderPianoSVG(transposedChord, options);

    // 綁定滑鼠點擊單一琴鍵試聽
    const keyElements = containerEl.querySelectorAll('.piano-key');
    keyElements.forEach(el => {
      el.addEventListener('click', () => {
        const midi = parseInt(el.getAttribute('data-midi'), 10);
        if (!isNaN(midi)) {
          playNoteAudio(midi, 1.0, 0, 0.22);
        }
      });
    });

    return state;
  }

  return {
    buildKeyboardState,
    renderPianoSVG,
    mountPiano,
    playNoteAudio,
    playChordAudio,
    midiToFreq
  };
});
