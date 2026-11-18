/**
 * 單元測試腳本：驗證 T1-1 核心樂理解析器 (music-theory.js)
 * 測試範圍涵蓋：
 * 1. 《償還》全曲方框級數和弦 (Am 原調 -> 轉女調 Cm / 男調 Fm)
 * 2. 《川の流れのように》全曲紅色英文和弦 (含華文前置升降記號 bE，C 原調 -> 轉 D 調)
 * 3. 各類延伸音、變化音、分數轉位與組成音計算驗證
 */

const assert = require('assert');
const MusicTheory = require('../js/music-theory.js');

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

console.log('\n🎉 所有測試案例 100% 通過！');
