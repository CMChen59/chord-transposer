/**
 * 🎹 智慧和弦轉調與組成音查詢工具 - 核心樂理引擎 (music-theory.js)
 *
 * 支援功能 (對應任務 T1-1 ~ T1-3)：
 * 1. 標準英文和弦解析 (Cm, FM7, G7, Gsus4, Dm7b5, C/E 等)
 * 2. 華文簡譜前置升降號相容 (bE -> Eb, #F -> F# 等)
 * 3. 電子琴簡譜方框級數和弦解析 (6m, 2m, 37, 37-9+5, 67+5, 5m6/7b, 7b, 4M7, /5 等)
 * 4. 智慧五度圈轉調與三種顯示模式 (英文字母 / 固定調數字 / 練功對照)
 * 5. 和弦組成音計算 (輸出英文音名、固定調簡譜數字、音程結構與 MIDI 鍵盤位置)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MusicTheory = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ============================================================================
  // 1. 基礎音高、簡譜數字與五度圈調性定義
  // ============================================================================

  /** 升記號音名表 (Pitch Class 0 ~ 11) */
  const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  /** 降記號音名表 (Pitch Class 0 ~ 11) */
  const NOTES_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  /** 固定調簡譜數字表 (升記號偏好，1=C) */
  const NUM_SHARP = ['1', '#1', '2', '#2', '3', '4', '#4', '5', '#5', '6', '#6', '7'];
  /** 固定調簡譜數字表 (降記號偏好，1=C) */
  const NUM_FLAT  = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];

  /** 自然大調七個級數對應之半音位置 (1=0, 2=2, 3=4, 4=5, 5=7, 6=9, 7=11) */
  const DEGREE_TO_SEMITONE = {
    '1': 0,
    '2': 2,
    '3': 4,
    '4': 5,
    '5': 7,
    '6': 9,
    '7': 11
  };

  /** 英文字母音名對應之半音位置 */
  const LETTER_TO_SEMITONE = {
    'C': 0,
    'D': 2,
    'E': 4,
    'F': 5,
    'G': 7,
    'A': 9,
    'B': 11
  };

  /**
   * 調性資料庫：定義各大小調的根音半音、關係大調基準音 (1=?)，以及偏好使用 # 或 b
   * 注意：在簡譜級數系統中，大調以 1 為主音，小調以 6m 為主音（例如 Am 調的 6m=Am, 1=C；Cm 調的 6m=Cm, 1=Eb）
   */
  const KEY_SIGNATURES = {
    // 大調 (Major Keys)
    'C':  { tonic: 0,  majorBase: 0,  isMinor: false, preferFlat: false, label: 'C 大調' },
    'Db': { tonic: 1,  majorBase: 1,  isMinor: false, preferFlat: true,  label: 'Db 大調 (C#)' },
    'C#': { tonic: 1,  majorBase: 1,  isMinor: false, preferFlat: false, label: 'C# 大調 (Db)' },
    'D':  { tonic: 2,  majorBase: 2,  isMinor: false, preferFlat: false, label: 'D 大調' },
    'Eb': { tonic: 3,  majorBase: 3,  isMinor: false, preferFlat: true,  label: 'Eb 大調 (bE)' },
    'E':  { tonic: 4,  majorBase: 4,  isMinor: false, preferFlat: false, label: 'E 大調' },
    'F':  { tonic: 5,  majorBase: 5,  isMinor: false, preferFlat: true,  label: 'F 大調' },
    'F#': { tonic: 6,  majorBase: 6,  isMinor: false, preferFlat: false, label: 'F# 大調 (Gb)' },
    'Gb': { tonic: 6,  majorBase: 6,  isMinor: false, preferFlat: true,  label: 'Gb 大調 (F#)' },
    'G':  { tonic: 7,  majorBase: 7,  isMinor: false, preferFlat: false, label: 'G 大調' },
    'Ab': { tonic: 8,  majorBase: 8,  isMinor: false, preferFlat: true,  label: 'Ab 大調 (bA)' },
    'A':  { tonic: 9,  majorBase: 9,  isMinor: false, preferFlat: false, label: 'A 大調' },
    'Bb': { tonic: 10, majorBase: 10, isMinor: false, preferFlat: true,  label: 'Bb 大調 (bB)' },
    'B':  { tonic: 11, majorBase: 11, isMinor: false, preferFlat: false, label: 'B 大調' },

    // 小調 (Minor Keys) - majorBase 為其關係大調 (Relative Major = tonic + 3 semitones)
    'Am':  { tonic: 9,  majorBase: 0,  isMinor: true, preferFlat: false, label: 'Am 小調 (關係大調 C)' },
    'Bbm': { tonic: 10, majorBase: 1,  isMinor: true, preferFlat: true,  label: 'Bbm 小調 (關係大調 Db)' },
    'A#m': { tonic: 10, majorBase: 1,  isMinor: true, preferFlat: false, label: 'A#m 小調 (關係大調 C#)' },
    'Bm':  { tonic: 11, majorBase: 2,  isMinor: true, preferFlat: false, label: 'Bm 小調 (關係大調 D)' },
    'Cm':  { tonic: 0,  majorBase: 3,  isMinor: true, preferFlat: true,  label: 'Cm 小調 (關係大調 Eb)' },
    'C#m': { tonic: 1,  majorBase: 4,  isMinor: true, preferFlat: false, label: 'C#m 小調 (關係大調 E)' },
    'Dm':  { tonic: 2,  majorBase: 5,  isMinor: true, preferFlat: true,  label: 'Dm 小調 (關係大調 F)' },
    'D#m': { tonic: 3,  majorBase: 6,  isMinor: true, preferFlat: false, label: 'D#m 小調 (關係大調 F#)' },
    'Ebm': { tonic: 3,  majorBase: 6,  isMinor: true, preferFlat: true,  label: 'Ebm 小調 (關係大調 Gb)' },
    'Em':  { tonic: 4,  majorBase: 7,  isMinor: true, preferFlat: false, label: 'Em 小調 (關係大調 G)' },
    'Fm':  { tonic: 5,  majorBase: 8,  isMinor: true, preferFlat: true,  label: 'Fm 小調 (關係大調 Ab)' },
    'F#m': { tonic: 6,  majorBase: 9,  isMinor: true, preferFlat: false, label: 'F#m 小調 (關係大調 A)' },
    'Gm':  { tonic: 7,  majorBase: 10, isMinor: true, preferFlat: true,  label: 'Gm 小調 (關係大調 Bb)' },
    'G#m': { tonic: 8,  majorBase: 11, isMinor: true, preferFlat: false, label: 'G#m 小調 (關係大調 B)' },
    'Abm': { tonic: 8,  majorBase: 11, isMinor: true, preferFlat: true,  label: 'Abm 小調 (關係大調 Cb)' }
  };

  // ============================================================================
  // 2. 和弦性質 (Chord Qualities) 與音程公式定義
  // ============================================================================

  /**
   * 定義各類和弦的半音音程結構 (相對於根音 0) 與簡譜唱名公式
   */
  const CHORD_FORMULAS = {
    '':         { intervals: [0, 4, 7],             formula: ['1', '3', '5'],               name: '大三和弦 (Major)' },
    'm':        { intervals: [0, 3, 7],             formula: ['1', 'b3', '5'],              name: '小三和弦 (Minor)' },
    'dim':      { intervals: [0, 3, 6],             formula: ['1', 'b3', 'b5'],             name: '減三和弦 (Diminished)' },
    'dim7':     { intervals: [0, 3, 6, 9],          formula: ['1', 'b3', 'b5', 'bb7'],      name: '減七和弦 (Diminished 7th)' },
    'aug':      { intervals: [0, 4, 8],             formula: ['1', '3', '#5'],              name: '增三和弦 (Augmented)' },
    'sus2':     { intervals: [0, 2, 7],             formula: ['1', '2', '5'],               name: '掛二和弦 (Suspended 2nd)' },
    'sus4':     { intervals: [0, 5, 7],             formula: ['1', '4', '5'],               name: '掛四和弦 (Suspended 4th)' },
    '7sus4':    { intervals: [0, 5, 7, 10],         formula: ['1', '4', '5', 'b7'],         name: '屬七掛四和弦 (7sus4)' },
    '6':        { intervals: [0, 4, 7, 9],          formula: ['1', '3', '5', '6'],          name: '大六和弦 (Major 6th)' },
    'm6':       { intervals: [0, 3, 7, 9],          formula: ['1', 'b3', '5', '6'],         name: '小六和弦 (Minor 6th)' },
    '7':        { intervals: [0, 4, 7, 10],         formula: ['1', '3', '5', 'b7'],         name: '屬七和弦 (Dominant 7th)' },
    'M7':       { intervals: [0, 4, 7, 11],         formula: ['1', '3', '5', '7'],          name: '大七和弦 (Major 7th)' },
    'm7':       { intervals: [0, 3, 7, 10],         formula: ['1', 'b3', '5', 'b7'],        name: '小七和弦 (Minor 7th)' },
    'mM7':      { intervals: [0, 3, 7, 11],         formula: ['1', 'b3', '5', '7'],         name: '小大七和弦 (Minor Major 7th)' },
    'm7b5':     { intervals: [0, 3, 6, 10],         formula: ['1', 'b3', 'b5', 'b7'],       name: '半減七和弦 (Half-Diminished)' },
    '7b5':      { intervals: [0, 4, 6, 10],         formula: ['1', '3', 'b5', 'b7'],        name: '屬七降五和弦 (7b5)' },
    '7(#5)':    { intervals: [0, 4, 8, 10],         formula: ['1', '3', '#5', 'b7'],        name: '屬七升五和弦 (7#5 / 7+5)' },
    '7(b9)':    { intervals: [0, 4, 7, 10, 13],     formula: ['1', '3', '5', 'b7', 'b9'],   name: '屬七降九和弦 (7b9 / 7-9)' },
    '7(#9)':    { intervals: [0, 4, 7, 10, 15],     formula: ['1', '3', '5', 'b7', '#9'],   name: '屬七升九和弦 (7#9 / 7+9)' },
    '7(b9#5)':  { intervals: [0, 4, 8, 10, 13],     formula: ['1', '3', '#5', 'b7', 'b9'],  name: '屬七降九升五和弦 (7-9+5)' },
    '7(b9b5)':  { intervals: [0, 4, 6, 10, 13],     formula: ['1', '3', 'b5', 'b7', 'b9'],  name: '屬七降九降五和弦 (7-9-5)' },
    'add9':     { intervals: [0, 4, 7, 14],         formula: ['1', '3', '5', '9'],          name: '加九和弦 (Add 9th)' },
    'madd9':    { intervals: [0, 3, 7, 14],         formula: ['1', 'b3', '5', '9'],         name: '小加九和弦 (Minor Add 9th)' },
    '9':        { intervals: [0, 4, 7, 10, 14],     formula: ['1', '3', '5', 'b7', '9'],    name: '屬九和弦 (Dominant 9th)' },
    'M9':       { intervals: [0, 4, 7, 11, 14],     formula: ['1', '3', '5', '7', '9'],     name: '大九和弦 (Major 9th)' },
    'm9':       { intervals: [0, 3, 7, 10, 14],     formula: ['1', 'b3', '5', 'b7', '9'],   name: '小九和弦 (Minor 9th)' },
    '11':       { intervals: [0, 4, 7, 10, 14, 17], formula: ['1', '3', '5', 'b7', '9', '11'], name: '屬十一和弦 (11th)' },
    'm11':      { intervals: [0, 3, 7, 10, 14, 17], formula: ['1', 'b3', '5', 'b7', '9', '11'], name: '小十一和弦 (Minor 11th)' },
    '13':       { intervals: [0, 4, 7, 10, 14, 21], formula: ['1', '3', '5', 'b7', '9', '13'], name: '屬十三和弦 (13th)' }
  };

  // ============================================================================
  // 3. 內部解析輔助函式
  // ============================================================================

  /**
   * 將升降記號字串轉為半音偏移量
   * @param {string} acc - '#', 'b', '♯', '♭', '##', 'bb'
   * @returns {number}
   */
  function parseAccidentalOffset(acc) {
    if (!acc) return 0;
    let offset = 0;
    for (const ch of acc) {
      if (ch === '#' || ch === '♯') offset += 1;
      else if (ch === 'b' || ch === '♭') offset -= 1;
    }
    return offset;
  }

  /**
   * 計算自然半音模數 (0 ~ 11)
   */
  function mod12(n) {
    return ((n % 12) + 12) % 12;
  }

  /**
   * 解析單一音名或簡譜級數根音 (支援標準英文 C#, Eb、前置升降 bE, #F、簡譜級數 6, b7, 7b, #4, 4#)
   * @param {string} token - 根音或 Bass 字串
   * @returns {{ type: 'english'|'numbered', pitchFromC: number, rawRoot: string, degree?: string, accidentalOffset: number } | null}
   */
  function parseRootOrBassToken(token) {
    if (!token) return null;
    const clean = token.trim();

    // 1. 華文前置升降記號英文音名：如 bE, #F, bB, #C
    const prefixEngMatch = clean.match(/^([#b♯♭]{1,2})([A-G])$/);
    if (prefixEngMatch) {
      const acc = prefixEngMatch[1];
      const letter = prefixEngMatch[2];
      const accOffset = parseAccidentalOffset(acc);
      const pitchFromC = mod12(LETTER_TO_SEMITONE[letter] + accOffset);
      return {
        type: 'english',
        letter,
        accidentalOffset: accOffset,
        pitchFromC,
        rawRoot: clean
      };
    }

    // 2. 標準後置升降記號英文音名：如 C, C#, Eb, F#
    const stdEngMatch = clean.match(/^([A-G])([#b♯♭]{0,2})$/);
    if (stdEngMatch) {
      const letter = stdEngMatch[1];
      const acc = stdEngMatch[2];
      const accOffset = parseAccidentalOffset(acc);
      const pitchFromC = mod12(LETTER_TO_SEMITONE[letter] + accOffset);
      return {
        type: 'english',
        letter,
        accidentalOffset: accOffset,
        pitchFromC,
        rawRoot: clean
      };
    }

    // 3. 簡譜數字根音（前置或後置升降記號）：如 6, b7, 7b, #4, 4#
    const numMatch = clean.match(/^([#b♯♭]{0,2})([1-7])([#b♯♭]{0,2})$/);
    if (numMatch && !(numMatch[1] && numMatch[3])) {
      const acc = numMatch[1] || numMatch[3] || '';
      const degree = numMatch[2];
      const accOffset = parseAccidentalOffset(acc);
      const pitchFromC = mod12(DEGREE_TO_SEMITONE[degree] + accOffset);
      return {
        type: 'numbered',
        degree,
        accidentalOffset: accOffset,
        pitchFromC,
        rawRoot: clean
      };
    }

    return null;
  }

  /**
   * 正規化和弦屬性字串 (Quality & Tensions)
   * 將各種別名與電子琴譜記號 (如 maj7, △7, -9+5, +5, m7-5) 轉為標準屬性代號，同時保留電子琴簡譜風格屬性字串
   * @param {string} rawQuality
   * @returns {{ canonicalQuality: string, numberStyleQuality: string, formulaInfo: { intervals: number[], formula: string[], name: string } }}
   */
  function normalizeQuality(rawQuality) {
    let q = (rawQuality || '').trim();

    // 統一常見別名
    q = q
      .replace(/^maj7|^Maj7|^△7|^Δ7|^M7/, 'M7')
      .replace(/^maj9|^Maj9|^△9|^Δ9/, 'M9')
      .replace(/^min7|^mi7|^-7/, 'm7')
      .replace(/^min6|^mi6|^-6/, 'm6')
      .replace(/^min9|^mi9|^-9(?!\+|-)/, 'm9')
      .replace(/^min|^mi|^-(?![0-9])/, 'm')
      .replace(/^ø7?/, 'm7b5')
      .replace(/^o7|^°7/, 'dim7')
      .replace(/^o|^°/, 'dim')
      .replace(/^\+(?![0-9])/, 'aug')
      .replace(/^sus$/, 'sus4');

    // 處理電子琴譜常見變化音寫法：如 7-9+5, 7+5, 7-9, m7-5, 7(#5), 7(b9#5)
    const stripped = q.replace(/[()]/g, '');

    let canonical = q;
    let numStyle = q;

    if (stripped === '7-9+5' || stripped === '7b9#5' || stripped === '7+5-9' || stripped === '7#5b9') {
      canonical = '7(b9#5)';
      numStyle = '7-9+5';
    } else if (stripped === '7-9-5' || stripped === '7b9b5' || stripped === '7-5-9' || stripped === '7b5b9') {
      canonical = '7(b9b5)';
      numStyle = '7-9-5';
    } else if (stripped === '7+5' || stripped === '7#5' || stripped === 'aug7' || stripped === '+7') {
      canonical = '7(#5)';
      numStyle = '7+5';
    } else if (stripped === '7-5' || stripped === '7b5') {
      canonical = '7b5';
      numStyle = '7-5';
    } else if (stripped === '7-9' || stripped === '7b9') {
      canonical = '7(b9)';
      numStyle = '7-9';
    } else if (stripped === '7+9' || stripped === '7#9') {
      canonical = '7(#9)';
      numStyle = '7+9';
    } else if (stripped === 'm7-5' || stripped === 'm7b5') {
      canonical = 'm7b5';
      numStyle = 'm7-5';
    }

    // 若在預設字典中找得到，直接回傳
    if (CHORD_FORMULAS[canonical]) {
      return {
        canonicalQuality: canonical,
        numberStyleQuality: numStyle,
        formulaInfo: CHORD_FORMULAS[canonical]
      };
    }

    // 動態解析未列舉的複合延伸音 (Fallback dynamic parser)
    const intervals = new Set([0]);
    const formula = ['1'];

    // 判斷三音 (3rd)
    if (canonical.startsWith('m') && !canonical.startsWith('maj')) {
      intervals.add(3);
      formula.push('b3');
    } else if (canonical.includes('sus2')) {
      intervals.add(2);
      formula.push('2');
    } else if (canonical.includes('sus4') || canonical.includes('sus')) {
      intervals.add(5);
      formula.push('4');
    } else {
      intervals.add(4);
      formula.push('3');
    }

    // 判斷五音 (5th)
    if (canonical.includes('b5') || canonical.includes('-5') || canonical.includes('dim')) {
      intervals.add(6);
      formula.push('b5');
    } else if (canonical.includes('#5') || canonical.includes('+5') || canonical.includes('aug')) {
      intervals.add(8);
      formula.push('#5');
    } else {
      intervals.add(7);
      formula.push('5');
    }

    // 判斷六音或七音
    if (canonical.includes('dim7')) {
      intervals.add(9);
      formula.push('bb7');
    } else if (canonical.includes('M7') || canonical.includes('M9') || canonical.includes('maj7')) {
      intervals.add(11);
      formula.push('7');
    } else if (canonical.includes('7') || canonical.includes('9') || canonical.includes('11') || canonical.includes('13')) {
      if (!canonical.includes('add')) {
        intervals.add(10);
        formula.push('b7');
      }
    } else if (canonical.includes('6')) {
      intervals.add(9);
      formula.push('6');
    }

    // 判斷九音、十一音、十三音
    if (canonical.includes('b9') || canonical.includes('-9')) {
      intervals.add(13);
      formula.push('b9');
    } else if (canonical.includes('#9') || canonical.includes('+9')) {
      intervals.add(15);
      formula.push('#9');
    } else if (canonical.includes('9') || canonical.includes('11') || canonical.includes('13')) {
      intervals.add(14);
      formula.push('9');
    }

    if (canonical.includes('#11') || canonical.includes('+11')) {
      intervals.add(18);
      formula.push('#11');
    } else if (canonical.includes('11')) {
      intervals.add(17);
      formula.push('11');
    }

    if (canonical.includes('b13') || canonical.includes('-13')) {
      intervals.add(20);
      formula.push('b13');
    } else if (canonical.includes('13')) {
      intervals.add(21);
      formula.push('13');
    }

    return {
      canonicalQuality: canonical,
      numberStyleQuality: numStyle,
      formulaInfo: {
        intervals: Array.from(intervals).sort((a, b) => a - b),
        formula,
        name: `複合和弦 (${canonical})`
      }
    };
  }

  // ============================================================================
  // 4. 核心和弦解析器 (T1-1 主函式：parseChord)
  // ============================================================================

  /**
   * 解析任意輸入之和弦字串（支援英文和弦、前置升降號和弦、電子琴方框級數和弦、轉位與純 Bass 和弦）
   *
   * @param {string} rawInput - 原始和弦字串，例如 "Cm", "bE", "6m", "37-9+5", "5m6/7b", "/5", "4M7"
   * @returns {object | null} 解析後的結構化樂理物件
   */
  function parseChord(rawInput) {
    if (!rawInput || typeof rawInput !== 'string') return null;
    const input = rawInput.trim();
    if (!input) return null;

    // 1. 處理「純 Bass 轉位標記」：如《償還》第 2 頁第 3 行的 "/5" 或 "/G"
    if (input.startsWith('/')) {
      const bassStr = input.slice(1).trim();
      const bassParsed = parseRootOrBassToken(bassStr);
      if (!bassParsed) return null;
      return {
        raw: input,
        isValid: true,
        isBassOnly: true,
        notationType: bassParsed.type,
        rootPitchFromC: null,
        canonicalQuality: '',
        numberStyleQuality: '',
        bassPitchFromC: bassParsed.pitchFromC,
        bassRaw: bassStr,
        intervals: [],
        formula: [],
        chordTypeName: '純低音轉位 (Slash Bass)'
      };
    }

    // 2. 拆解轉位分數和弦 (Slash Chord)：如 "5m6/7b", "C/E", "Am/G"
    let mainPart = input;
    let bassPart = null;
    if (input.includes('/')) {
      const parts = input.split('/');
      if (parts.length === 2 && parts[1].trim() !== '') {
        mainPart = parts[0].trim();
        bassPart = parts[1].trim();
      }
    }

    let rootInfo = null;
    let rawQuality = '';

    // 3A. 嘗試匹配「華文前置升降號英文和弦」：如 bE, #Fm7, bBmaj7
    const prefixEngChordMatch = mainPart.match(/^([#b♯♭]{1,2})([A-G])(.*)$/);
    if (prefixEngChordMatch) {
      const rootToken = prefixEngChordMatch[1] + prefixEngChordMatch[2];
      rootInfo = parseRootOrBassToken(rootToken);
      rawQuality = prefixEngChordMatch[3];
    }

    // 3B. 嘗試匹配「標準英文和弦」：如 C, Cm, FM7, Gsus4, Dm7b5
    if (!rootInfo) {
      const stdEngChordMatch = mainPart.match(/^([A-G][#b♯♭]{0,2})(.*)$/);
      if (stdEngChordMatch) {
        rootInfo = parseRootOrBassToken(stdEngChordMatch[1]);
        rawQuality = stdEngChordMatch[2];
      }
    }

    // 3C. 嘗試匹配「簡譜數字／級數和弦」：如 6m, 2m, 37, 37-9+5, 67+5, 7b, b7, 4M7, 5m6
    if (!rootInfo) {
      // 注意區分：
      // - "7b" -> 根音是 "7b" (降七級大三和弦)，屬性是 ""
      // - "7b5" -> 根音是 "7"，屬性是 "b5"
      // - "b77" -> 根音是 "b7"，屬性是 "7"
      // - "37-9+5" -> 根音是 "3"，屬性是 "7-9+5"
      const numChordMatch = mainPart.match(/^([#b♯♭]{0,2}[1-7])([#b♯♭]?)(.*)$/);
      if (numChordMatch) {
        let rootToken = numChordMatch[1];
        const possiblePostAcc = numChordMatch[2];
        let restQuality = numChordMatch[3];

        // 判斷緊接在數字後的 #/b 是「根音的後置升降號 (如 7b)」還是「和弦變化音 (如 7b5, 7b9)」
        if (possiblePostAcc) {
          const hasPrefixAcc = /^[#b♯♭]/.test(rootToken);
          const isTensionInterval = /^(5|9|11|13)/.test(restQuality);
          if (!hasPrefixAcc && !isTensionInterval) {
            // 例如 "7b" 或 "7bM7" -> 將 b 歸入根音 "7b"
            rootToken += possiblePostAcc;
          } else {
            // 例如 "7b5" -> 將 b 歸入屬性 "b5"
            restQuality = possiblePostAcc + restQuality;
          }
        }

        rootInfo = parseRootOrBassToken(rootToken);
        rawQuality = restQuality;
      }
    }

    if (!rootInfo) return null;

    // 4. 解析 Bass 音 (若有)
    let bassInfo = null;
    if (bassPart) {
      bassInfo = parseRootOrBassToken(bassPart);
      if (!bassInfo) return null;
    }

    // 5. 正規化和弦屬性與計算音程
    const qualityData = normalizeQuality(rawQuality);

    return {
      raw: input,
      isValid: true,
      isBassOnly: false,
      notationType: rootInfo.type, // 'english' | 'numbered'
      rootPitchFromC: rootInfo.pitchFromC,
      rootRaw: rootInfo.rawRoot,
      canonicalQuality: qualityData.canonicalQuality,
      numberStyleQuality: qualityData.numberStyleQuality,
      bassPitchFromC: bassInfo ? bassInfo.pitchFromC : null,
      bassRaw: bassInfo ? bassInfo.rawRoot : null,
      intervals: qualityData.formulaInfo.intervals,
      formula: qualityData.formulaInfo.formula,
      chordTypeName: qualityData.formulaInfo.name
    };
  }

  // ============================================================================
  // 5. 智慧轉調與多模式格式化引擎 (支援 T1-1 & T1-2)
  // ============================================================================

  /**
   * 取得調性資訊（支援大小調名稱，如 "Am", "Cm", "Fm", "C", "Eb", "bE"）
   */
  function getKeyInfo(keyName) {
    if (!keyName) return KEY_SIGNATURES['C'];
    const clean = keyName.trim();
    if (KEY_SIGNATURES[clean]) return KEY_SIGNATURES[clean];

    // 支援 bE, bB, bA, bE m 等華文調號寫法
    const isMinor = clean.endsWith('m');
    const rootStr = isMinor ? clean.slice(0, -1) : clean;
    const parsed = parseRootOrBassToken(rootStr);
    if (parsed) {
      const preferFlat = rootStr.includes('b') || rootStr.includes('♭') || [1, 3, 5, 8, 10].includes(parsed.pitchFromC);
      const noteName = (preferFlat ? NOTES_FLAT : NOTES_SHARP)[parsed.pitchFromC];
      const lookupKey = noteName + (isMinor ? 'm' : '');
      if (KEY_SIGNATURES[lookupKey]) return KEY_SIGNATURES[lookupKey];
    }
    return KEY_SIGNATURES['C'];
  }

  /**
   * 根據目標調性與和弦屬性，智慧決定某個半音 (0~11) 應該顯示為 # 還是 b
   * 例如在 Cm 調 (preferFlat=true) 中，G7 的三音 B (11) 是自然音，AbM7 的根音 8 顯示為 Ab (b6)；
   * 而在 Am 調中，E7 的三音 8 顯示為 G# (#5)。
   */
  function formatPitchToEnglish(pitchClass, preferFlat = false) {
    const pc = mod12(pitchClass);
    return preferFlat ? NOTES_FLAT[pc] : NOTES_SHARP[pc];
  }

  /**
   * 將半音 (0~11) 轉為「固定調簡譜數字」(1=C, 2=D, 3=E, 4=F, 5=G, 6=A, 7=B)
   * 例如：Cm -> 1m, Fm -> 4m, G7 -> 57, AbM7 -> b6M7
   */
  function formatPitchToFixedNumber(pitchClass, preferFlat = false) {
    const pc = mod12(pitchClass);
    return preferFlat ? NUM_FLAT[pc] : NUM_SHARP[pc];
  }

  /**
   * 將已解析的和弦進行轉調，並同時產出「英文和弦」、「固定調數字和弦」、「首調級數和弦」與「組成音資訊」
   *
   * @param {string | object} chordInput - 原始和弦字串或 parseChord 結果
   * @param {string} sourceKey - 原調名稱 (例如《償還》為 "Am"，或《川の流れ》為 "C")
   * @param {string} targetKey - 目標調名稱 (例如女調 "Cm"、男調 "Fm"、或 "D")
   * @param {number} [extraSemitones=0] - 額外微調半音數
   */
  function transposeChord(chordInput, sourceKey = 'C', targetKey = 'C', extraSemitones = 0) {
    const parsed = typeof chordInput === 'string' ? parseChord(chordInput) : chordInput;
    if (!parsed || !parsed.isValid) return null;

    const srcKeyInfo = getKeyInfo(sourceKey);
    const tgtKeyInfo = getKeyInfo(targetKey);

    // 計算轉調半音差：
    // 若原和弦是「簡譜級數和弦 (如《償還》的 6m, 2m, 37)」，其數字本身是以 C大調/Am小調 (majorBase=0) 為基準撰寫的！
    // 當使用者將原調 Am 轉為目標調 Cm 時，半音位移量為 tgtKeyInfo.tonic - srcKeyInfo.tonic (+3 半音)
    const semitoneShift = mod12((tgtKeyInfo.tonic - srcKeyInfo.tonic) + extraSemitones);
    const preferFlat = tgtKeyInfo.preferFlat;

    // 處理純 Bass 轉位 (如 "/5")
    if (parsed.isBassOnly) {
      const baseBassPitch = parsed.notationType === 'numbered'
        ? mod12(parsed.bassPitchFromC + srcKeyInfo.majorBase)
        : parsed.bassPitchFromC;
      const newBassPitch = mod12(baseBassPitch + semitoneShift);
      const engBass = formatPitchToEnglish(newBassPitch, preferFlat);
      const numBass = formatPitchToFixedNumber(newBassPitch, preferFlat);
      const relBass = formatPitchToFixedNumber(mod12(newBassPitch - tgtKeyInfo.majorBase), preferFlat);

      return {
        originalRaw: parsed.raw,
        isBassOnly: true,
        semitoneShift,
        englishChord: `/${engBass}`,
        fixedNumberChord: `/${numBass}`,
        relativeDegreeChord: `/${relBass}`,
        practiceDisplay: `${parsed.raw} ➔ /${engBass} (/${numBass})`,
        notes: {
          english: [engBass],
          fixedNumber: [numBass],
          formula: ['Bass'],
          midiNotes: [36 + newBassPitch]
        }
      };
    }

    // 計算原和弦在絕對音高上的實際 Pitch (0 ~ 11)
    // 若原譜為級數和弦 (numbered)，在預設 Am (majorBase=0) 時 6m 即 A(9)m；若原譜為 D 調級數譜則加上 majorBase
    const origRootPitch = parsed.notationType === 'numbered'
      ? mod12(parsed.rootPitchFromC + srcKeyInfo.majorBase)
      : parsed.rootPitchFromC;

    const newRootPitch = mod12(origRootPitch + semitoneShift);

    let newBassPitch = null;
    if (parsed.bassPitchFromC !== null) {
      const origBassPitch = parsed.notationType === 'numbered'
        ? mod12(parsed.bassPitchFromC + srcKeyInfo.majorBase)
        : parsed.bassPitchFromC;
      newBassPitch = mod12(origBassPitch + semitoneShift);
    }

    // 格式化根音與 Bass 音
    const engRoot = formatPitchToEnglish(newRootPitch, preferFlat);
    const numRoot = formatPitchToFixedNumber(newRootPitch, preferFlat);
    const relRoot = formatPitchToFixedNumber(mod12(newRootPitch - tgtKeyInfo.majorBase), preferFlat);

    const engBassSuffix = newBassPitch !== null ? `/${formatPitchToEnglish(newBassPitch, preferFlat)}` : '';
    const numBassSuffix = newBassPitch !== null ? `/${formatPitchToFixedNumber(newBassPitch, preferFlat)}` : '';
    const relBassSuffix = newBassPitch !== null
      ? `/${formatPitchToFixedNumber(mod12(newBassPitch - tgtKeyInfo.majorBase), preferFlat)}`
      : '';

    const englishChord = `${engRoot}${parsed.canonicalQuality}${engBassSuffix}`;
    const fixedNumberChord = `${numRoot}${parsed.numberStyleQuality}${numBassSuffix}`;
    const relativeDegreeChord = `${relRoot}${parsed.numberStyleQuality}${relBassSuffix}`;

    // 計算組成音 (Voicing Notes)
    const voicing = getChordNotes(newRootPitch, parsed.intervals, parsed.formula, newBassPitch, preferFlat, parsed.canonicalQuality);

    return {
      originalRaw: parsed.raw,
      isBassOnly: false,
      semitoneShift,
      rootPitch: newRootPitch,
      bassPitch: newBassPitch,
      canonicalQuality: parsed.canonicalQuality,
      chordTypeName: parsed.chordTypeName,
      // 三種顯示模式字串
      englishChord,          // 模式 1 (預設)：英文字母和弦，如 "Cm", "Fm", "G7(b9#5)"
      fixedNumberChord,      // 模式 2：固定調數字和弦 (1=C)，如 "1m", "4m", "57-9+5", "b6M7"
      relativeDegreeChord,   // 模式 3A：首調級數和弦，如 "6m", "2m", "37-9+5"
      practiceDisplay: `${parsed.raw} ➔ ${englishChord} (${fixedNumberChord})`, // 模式 3B：練功對照模式
      notes: voicing
    };
  }

  // ============================================================================
  // 6. 和弦組成音計算器 (支援 T1-3)
  // ============================================================================

  /**
   * 根據根音半音、音程陣列與調性偏好，計算和弦組成音的「英文音名」、「固定調簡譜數字」與「MIDI 琴鍵編號」
   */
  function getChordNotes(rootPitch, intervals, formula, bassPitch = null, preferFlat = false, quality = '') {
    // 小調五級屬七和弦 (如 Am 的 E7、Cm 的 G7) 的三音通常是升記號導音 (G#, B)，避免把 E7 的三音顯示成 Ab
    let notePreferFlat = preferFlat;
    if (!preferFlat || (quality.startsWith('7') && [4, 9, 11, 2].includes(rootPitch))) {
      notePreferFlat = false;
    }

    const englishNotes = [];
    const fixedNumberNotes = [];
    const rightHandMidi = [];

    // 右手和弦基準八度：C4 (MIDI 60)
    const baseMidi = 60 + rootPitch;

    intervals.forEach((interval, idx) => {
      const pc = mod12(rootPitch + interval);
      const stepFormula = formula[idx] || '';

      // 針對降五音 (b5)、降九音 (b9)、降七音 (b7) 強制使用降記號顯示才符合樂理直覺；升五 (#5)、升九 (#9) 則用升記號
      let useFlatForThisNote = notePreferFlat;
      if (stepFormula.startsWith('b')) useFlatForThisNote = true;
      else if (stepFormula.startsWith('#')) useFlatForThisNote = false;

      englishNotes.push(formatPitchToEnglish(pc, useFlatForThisNote));
      fixedNumberNotes.push(formatPitchToFixedNumber(pc, useFlatForThisNote));
      rightHandMidi.push(baseMidi + interval);
    });

    // 左手根音或轉位 Bass 音基準八度：C3 (MIDI 48)
    const effectiveBassPitch = bassPitch !== null ? bassPitch : rootPitch;
    const leftHandBassMidi = 48 + effectiveBassPitch;
    const bassEnglish = formatPitchToEnglish(effectiveBassPitch, preferFlat);
    const bassFixedNumber = formatPitchToFixedNumber(effectiveBassPitch, preferFlat);

    return {
      english: englishNotes,           // 如 ['C', 'Eb', 'G']
      fixedNumber: fixedNumberNotes,   // 如 ['1', 'b3', '5']
      formula: formula.slice(),        // 如 ['1', 'b3', '5'] (相對音程公式)
      bassEnglish,
      bassFixedNumber,
      leftHandBassMidi,                // 左手低音 MIDI 編號
      rightHandMidi                    // 右手和弦組成音 MIDI 編號陣列
    };
  }

  // 匯出公開 API
  return {
    NOTES_SHARP,
    NOTES_FLAT,
    NUM_SHARP,
    NUM_FLAT,
    KEY_SIGNATURES,
    CHORD_FORMULAS,
    parseChord,
    transposeChord,
    getChordNotes,
    getKeyInfo,
    formatPitchToEnglish,
    formatPitchToFixedNumber
  };
});
