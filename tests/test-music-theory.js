/**
 * 單元測試腳本：驗證 T1-1 核心樂理解析器 (music-theory.js)
 * 測試範圍涵蓋：
 * 1. 《償還》全曲方框級數和弦 (Am 原調 -> 轉女調 Cm / 男調 Fm)
 * 2. 《川の流れのように》全曲紅色英文和弦 (含華文前置升降記號 bE，C 原調 -> 轉 D 調)
 * 3. 各類延伸音、變化音、分數轉位與組成音計算驗證
 */

const assert = require('assert');
const MusicTheory = require('../js/music-theory.js');
const PianoVisualizer = require('../js/piano-visualizer.js');
const SheetParser = require('../js/sheet-parser.js');
const SheetExporter = require('../js/sheet-exporter.js');

console.log('=== 開始執行 T1-1 核心樂理解析器測試 ===\n');

// 1. 測試《償還》譜面出現的所有方框級數和弦 (原調 Am -> 目標女調 Cm)
const changHuanCases = [
  { raw: '6m',      expectedEngCm: 'Cm',       expectedNumCm: '1m',       expectedEngFm: 'Fm',       expectedNotesCm: ['C', 'Eb', 'G'] },
  { raw: '2m',      expectedEngCm: 'Fm',       expectedNumCm: '4m',       expectedEngFm: 'Bbm',      expectedNotesCm: ['F', 'Ab', 'C'] },
  { raw: '37',      expectedEngCm: 'G7',       expectedNumCm: '57',       expectedEngFm: 'C7',       expectedNotesCm: ['G', 'B', 'D', 'F'] },
  { raw: '37-9+5',  expectedEngCm: 'G7(b9#5)', expectedNumCm: '57-9+5',   expectedEngFm: 'C7(b9#5)', expectedNotesCm: ['G', 'B', 'D#', 'F', 'Ab'] },
  { raw: '6',       expectedEngCm: 'C',        expectedNumCm: '1',        expectedEngFm: 'F',        expectedNotesCm: ['C', 'E', 'G'] },
  { raw: '67',      expectedEngCm: 'C7',       expectedNumCm: '17',       expectedEngFm: 'F7',       expectedNotesCm: ['C', 'E', 'G', 'Bb'] },
  { raw: '67+5',    expectedEngCm: 'C7(#5)',   expectedNumCm: '17+5',     expectedEngFm: 'F7(#5)',   expectedNotesCm: ['C', 'E', 'G#', 'Bb'] },
  { raw: '77',      expectedEngCm: 'D7',       expectedNumCm: '27',       expectedEngFm: 'G7',       expectedNotesCm: ['D', 'F#', 'A', 'C'] },
  { raw: '2m7',     expectedEngCm: 'Fm7',      expectedNumCm: '4m7',      expectedEngFm: 'Bbm7',     expectedNotesCm: ['F', 'Ab', 'C', 'Eb'] },
  { raw: '57',      expectedEngCm: 'Bb7',      expectedNumCm: 'b77',      expectedEngFm: 'Eb7',      expectedNotesCm: ['Bb', 'D', 'F', 'Ab'] },
  { raw: '1',       expectedEngCm: 'Eb',       expectedNumCm: 'b3',       expectedEngFm: 'Ab',       expectedNotesCm: ['Eb', 'G', 'Bb'] },
  { raw: '7b',      expectedEngCm: 'Db',       expectedNumCm: 'b2',       expectedEngFm: 'Gb',       expectedNotesCm: ['Db', 'F', 'Ab'] },
  { raw: '5m6/7b',  expectedEngCm: 'Bbm6/Db',  expectedNumCm: 'b7m6/b2',  expectedEngFm: 'Ebm6/Gb',  expectedNotesCm: ['Bb', 'Db', 'F', 'G'] },
  { raw: '/5',      expectedEngCm: '/Bb',      expectedNumCm: '/b7',      expectedEngFm: '/Eb',      expectedNotesCm: ['Bb'] },
  { raw: '4M7',     expectedEngCm: 'AbM7',     expectedNumCm: 'b6M7',     expectedEngFm: 'DbM7',     expectedNotesCm: ['Ab', 'C', 'Eb', 'G'] }
];

console.log('【測試組 1】《償還》簡譜級數和弦解析與轉調 (原調 Am ➔ 女調 Cm / 男調 Fm)：');
for (const tc of changHuanCases) {
  const resCm = MusicTheory.transposeChord(tc.raw, 'Am', 'Cm');
  const resFm = MusicTheory.transposeChord(tc.raw, 'Am', 'Fm');

  assert(resCm !== null, `解析失敗: ${tc.raw}`);
  assert.strictEqual(resCm.englishChord, tc.expectedEngCm, `${tc.raw} 轉 Cm 英文和弦錯誤: 預期 ${tc.expectedEngCm}, 實際 ${resCm.englishChord}`);
  assert.strictEqual(resCm.fixedNumberChord, tc.expectedNumCm, `${tc.raw} 轉 Cm 固定調數字錯誤: 預期 ${tc.expectedNumCm}, 實際 ${resCm.fixedNumberChord}`);
  assert.strictEqual(resFm.englishChord, tc.expectedEngFm, `${tc.raw} 轉 Fm 英文和弦錯誤: 預期 ${tc.expectedEngFm}, 實際 ${resFm.englishChord}`);
  assert.deepStrictEqual(resCm.notes.english, tc.expectedNotesCm, `${tc.raw} 轉 Cm 組成音錯誤`);

  console.log(`  ✔ 原譜 [${tc.raw.padEnd(7)}] ➔ 女調(Cm): ${resCm.englishChord.padEnd(9)} | 數字: ${resCm.fixedNumberChord.padEnd(8)} | 男調(Fm): ${resFm.englishChord.padEnd(9)} | Cm組成音: ${resCm.notes.english.join('-')} (${resCm.notes.fixedNumber.join('-')})`);
}

// 2. 測試《川の流れのように》譜面出現的所有紅色英文和弦 (原調 C -> 建議調 D)
const kawaCases = [
  { raw: 'C',     expectedD: 'D',     expectedNumD: '2',     expectedNotesD: ['D', 'F#', 'A'] },
  { raw: 'Am',    expectedD: 'Bm',    expectedNumD: '7m',    expectedNotesD: ['B', 'D', 'F#'] },
  { raw: 'Em',    expectedD: 'F#m',   expectedNumD: '#4m',   expectedNotesD: ['F#', 'A', 'C#'] },
  { raw: 'Dm',    expectedD: 'Em',    expectedNumD: '3m',    expectedNotesD: ['E', 'G', 'B'] },
  { raw: 'G',     expectedD: 'A',     expectedNumD: '6',     expectedNotesD: ['A', 'C#', 'E'] },
  { raw: 'F',     expectedD: 'G',     expectedNumD: '5',     expectedNotesD: ['G', 'B', 'D'] },
  { raw: 'Fm',    expectedD: 'Gm',    expectedNumD: '5m',    expectedNotesD: ['G', 'Bb', 'D'] },
  { raw: 'Gsus4', expectedD: 'Asus4', expectedNumD: '6sus4', expectedNotesD: ['A', 'D', 'E'] },
  { raw: 'CM7',   expectedD: 'DM7',   expectedNumD: '2M7',   expectedNotesD: ['D', 'F#', 'A', 'C#'] },
  { raw: 'C7',    expectedD: 'D7',    expectedNumD: '27',    expectedNotesD: ['D', 'F#', 'A', 'C'] },
  { raw: 'bE',    expectedD: 'F',     expectedNumD: '4',     expectedNotesD: ['F', 'A', 'C'] },
  { raw: 'D7',    expectedD: 'E7',    expectedNumD: '37',    expectedNotesD: ['E', 'G#', 'B', 'D'] }
];

console.log('\n【測試組 2】《川の流れのように》英文與前置升降號和弦解析與轉調 (原調 C ➔ 目標調 D)：');
for (const tc of kawaCases) {
  const resD = MusicTheory.transposeChord(tc.raw, 'C', 'D');
  assert(resD !== null, `解析失敗: ${tc.raw}`);
  assert.strictEqual(resD.englishChord, tc.expectedD, `${tc.raw} 轉 D 英文和弦錯誤: 預期 ${tc.expectedD}, 實際 ${resD.englishChord}`);
  assert.strictEqual(resD.fixedNumberChord, tc.expectedNumD, `${tc.raw} 轉 D 固定調數字錯誤: 預期 ${tc.expectedNumD}, 實際 ${resD.fixedNumberChord}`);
  assert.deepStrictEqual(resD.notes.english, tc.expectedNotesD, `${tc.raw} 轉 D 組成音錯誤`);

  console.log(`  ✔ 原譜 [${tc.raw.padEnd(6)}] ➔ D調: ${resD.englishChord.padEnd(6)} | 數字: ${resD.fixedNumberChord.padEnd(6)} | D調組成音: ${resD.notes.english.join('-')} (${resD.notes.fixedNumber.join('-')})`);
}

// 3. 測試新調性升降記號與音階資訊查詢 (getKeySignatureDetails)
console.log('\n【測試組 3】新調性升降記號、音階與導音提示驗證：');
const keyTestCases = [
  { key: 'Am', expectedType: 'none',  expectedCount: 0, expectedAccEng: [],                       expectedAccNum: [] },
  { key: 'Cm', expectedType: 'flat',  expectedCount: 3, expectedAccEng: ['Bb', 'Eb', 'Ab'],       expectedAccNum: ['b7', 'b3', 'b6'] },
  { key: 'Fm', expectedType: 'flat',  expectedCount: 4, expectedAccEng: ['Bb', 'Eb', 'Ab', 'Db'], expectedAccNum: ['b7', 'b3', 'b6', 'b2'] },
  { key: 'D',  expectedType: 'sharp', expectedCount: 2, expectedAccEng: ['F#', 'C#'],             expectedAccNum: ['#4', '#1'] },
  { key: 'G',  expectedType: 'sharp', expectedCount: 1, expectedAccEng: ['F#'],                   expectedAccNum: ['#4'] },
  { key: 'bE', expectedType: 'flat',  expectedCount: 3, expectedAccEng: ['Bb', 'Eb', 'Ab'],       expectedAccNum: ['b7', 'b3', 'b6'] }
];

for (const kt of keyTestCases) {
  const details = MusicTheory.getKeySignatureDetails(kt.key);
  assert.strictEqual(details.accidentalType, kt.expectedType);
  assert.strictEqual(details.accidentalCount, kt.expectedCount);
  assert.deepStrictEqual(details.accidentalsEnglish, kt.expectedAccEng);
  assert.deepStrictEqual(details.accidentalsFixedNumber, kt.expectedAccNum);

  console.log(`  ✔ [${details.keyLabel}] ➔ ${details.badgeText}：${details.detailText}`);
  console.log(`     音階: ${details.scaleEnglish.join('-')} (${details.scaleFixedNumber.join('-')})${details.harmonicMinorNote ? ' | 💡 ' + details.harmonicMinorNote : ''}`);
}

// 4. 測試 T1-3 互動式鋼琴鍵盤狀態模型與 SVG 渲染 (PianoVisualizer)
console.log('\n【測試組 4】T1-3 鋼琴鍵盤視覺化模組 (左右手分區、黑白鍵判定與雙語標籤)：');
const pianoSamples = [
  { raw: '6m',     src: 'Am', tgt: 'Cm', desc: '《償還》主和弦 6m 轉 Cm' },
  { raw: '37-9+5', src: 'Am', tgt: 'Cm', desc: '《償還》變化屬七 37-9+5 轉 G7(b9#5)' },
  { raw: '5m6/7b', src: 'Am', tgt: 'Cm', desc: '《償還》轉位和弦 5m6/7b 轉 Bbm6/Db' }
];

for (const ps of pianoSamples) {
  const transposed = MusicTheory.transposeChord(ps.raw, ps.src, ps.tgt);
  const kbState = PianoVisualizer.buildKeyboardState(transposed);
  const svgStr = PianoVisualizer.renderPianoSVG(transposed);

  assert(kbState.keys.length === 36, '預設應產生 3 個八度共 36 個琴鍵');
  assert(kbState.highlightedKeys.length === 1 + transposed.notes.english.length, '標亮琴鍵數應等於 1 個左手低音 + 右手組成音數量');
  assert(svgStr.startsWith('<svg') && svgStr.endsWith('</svg>'), '應正確輸出 SVG 向量標籤');

  const keySummary = kbState.highlightedKeys.map(k => {
    const bw = k.isBlack ? '黑鍵' : '白鍵';
    return `[${k.intervalLabel}] ${k.displayEng}(${k.displayNum})(${bw}, MIDI:${k.midi})`;
  }).join(' | ');

  console.log(`  ✔ ${ps.desc} ➔ 標亮琴鍵: ${keySummary}`);
}

// 5. 測試 T2-2 Gemini Vision 樂譜解析過濾器與快取座標 (SheetParser)
console.log('\n【測試組 5】T2-2 樂譜視覺辨識過濾器 (過濾 R1~R8/Fill/Main 雜訊) 與內建實譜座標快取驗證：');
const mockAiRawList = [
  { raw: '[6m]',     xPercent: 11.8, yPercent: 41.2, line: 4 },
  { raw: 'R1',       xPercent: 32.0, yPercent: 12.0, line: 1 }, // 應被過濾
  { raw: 'Main A',   xPercent: 18.0, yPercent: 41.0, line: 4 }, // 應被過濾
  { raw: 'Fill B',   xPercent: 78.0, yPercent: 50.0, line: 5 }, // 應被過濾
  { raw: '37-9+5',   xPercent: 87.6, yPercent: 52.4, line: 5 },
  { raw: '5m6/7b',   xPercent: 89.6, yPercent: 14.6, line: 1 },
  { raw: 'bE',       xPercent: 91.5, yPercent: 44.8, line: 5 },
  { raw: 'R3.6',     xPercent: 25.0, yPercent: 45.0, line: 5 }  // 應被過濾
];

const filteredChords = SheetParser.sanitizeAndValidateChords(mockAiRawList, 1);
assert.strictEqual(filteredChords.length, 4, '應精準保留 4 個合法和弦並剔除 4 個電子琴控制標記');
assert.deepStrictEqual(
  filteredChords.map(c => c.raw),
  ['6m', '37-9+5', '5m6/7b', 'bE'],
  '清洗後的和弦字串應完全正確'
);
console.log(`  ✔ 雜訊過濾測試通過：輸入 8 項含 R1/Main A/Fill B/R3.6 雜訊，精準保留 [${filteredChords.map(c => c.raw).join(', ')}]`);

// 驗證內建範例譜座標快取中的所有和弦皆可 100% 轉調
const sampleKeys = Object.keys(SheetParser.BUILTIN_SAMPLE_RECOGNITION);
assert.strictEqual(sampleKeys.length, 3, '應包含《償還》第 1、2 頁與《川の流れ》共 3 頁預校對座標快取');
for (const sk of sampleKeys) {
  const pageData = SheetParser.BUILTIN_SAMPLE_RECOGNITION[sk];
  assert(pageData.chords.length > 0);
  pageData.chords.forEach(ch => {
    const tr = MusicTheory.transposeChord(ch.raw, pageData.detectedSourceKey, pageData.detectedTargetKey);
    assert(tr !== null, `${sk} 中的和弦 ${ch.raw} 轉調失敗`);
  });
  console.log(`  ✔ 預載快取 [${sk}] 共 ${pageData.chords.length} 個和弦座標與轉調驗證 100% 通過`);
}

// 6. 測試 T3-1 & T3-2 匯出標籤文字格式化與配色主題定義 (SheetExporter)
console.log('\n【測試組 6】T3-1 & T3-2 琴譜匯出標籤文字格式化與 4 種視覺主題驗證：');
assert.strictEqual(SheetExporter.formatTransposedTagText('37-9+5', 'Am', 'Cm', 'english'), 'G7(b9#5)');
assert.strictEqual(SheetExporter.formatTransposedTagText('37-9+5', 'Am', 'Cm', 'number'), '57-9+5');
assert.strictEqual(SheetExporter.formatTransposedTagText('37-9+5', 'Am', 'Cm', 'practice'), '37-9+5➔G7(b9#5)');
assert.deepStrictEqual(Object.keys(SheetExporter.TAG_THEME_STYLES), ['red-box', 'clean-cover', 'blue-box', 'yellow-box']);
console.log('  ✔ 匯出標籤三種模式格式化 (英文 / 固定調數字 / 練功對照) 與 4 種匯出配色主題驗證 100% 通過');

console.log('\n🎉 所有測試案例 100% 通過！');
