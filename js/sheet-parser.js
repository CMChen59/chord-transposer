/**
 * 🤖 智慧和弦轉調與組成音查詢工具 - Gemini Vision API 樂譜視覺辨識與快取模組 (js/sheet-parser.js)
 *
 * 對應任務 T2-2：
 * 1. 提供安全的 Gemini API Key 與模型設定管理（僅儲存於瀏覽器本機 localStorage，不上傳 Git）
 * 2. 針對電子琴／編曲機簡譜設計專用 Vision Prompt：
 *    - 自動過濾 R1~R8 註冊記憶、Style/Main/Fill 段落標記與下方簡譜旋律數字
 *    - 精準提取「圓角方框級數和弦 (如 6m, 37-9+5, 5m6/7b)」與「紅色/上方英文字母和弦 (如 CM7, Gsus4, bE)」及其 (xPercent, yPercent) 座標
 *    - 透過 MusicTheory.parseChord() 進行雙重語法驗證，100% 攔截非和弦雜訊
 * 3. 實作辨識結果快取機制（Memory + localStorage）與內建範例琴譜預校對座標，辨識 1 次即可無限次 0 Token 轉調
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const MusicTheory = require('./music-theory.js');
    module.exports = factory(MusicTheory);
  } else {
    root.SheetParser = factory(root.MusicTheory);
  }
})(typeof self !== 'undefined' ? self : this, function (MusicTheory) {
  'use strict';

  const STORAGE_KEY_API = 'chord_transposer_gemini_api_key';
  const STORAGE_KEY_MODEL = 'chord_transposer_gemini_model';
  const STORAGE_KEY_CACHE = 'chord_transposer_vision_cache_v1';
  const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

  // ============================================================================
  // 1. 內建兩份範例琴譜之預先辨識座標資料 (0 Token 離線即開即看示範)
  // ============================================================================

  const BUILTIN_SAMPLE_RECOGNITION = {
    '償還_Am.pdf::page_1': {
      detectedSourceKey: 'Am',
      detectedTargetKey: 'Cm',
      chords: [
        // Line 1 (Intro I)
        { id: 'p1_1',  raw: '6m',     xPercent: 46.2, yPercent: 14.3, line: 1 },
        // Line 4 (Main A - 1)
        { id: 'p1_2',  raw: '6m',     xPercent: 11.8, yPercent: 41.2, line: 4 },
        { id: 'p1_3',  raw: '2m',     xPercent: 56.0, yPercent: 40.8, line: 4 },
        // Line 5 (Main A - 2)
        { id: 'p1_4',  raw: '37',     xPercent: 11.0, yPercent: 52.3, line: 5 },
        { id: 'p1_5',  raw: '6m',     xPercent: 56.0, yPercent: 51.7, line: 5 },
        { id: 'p1_6',  raw: '37',     xPercent: 85.5, yPercent: 50.1, line: 5 },
        { id: 'p1_7',  raw: '37-9+5', xPercent: 87.6, yPercent: 52.4, line: 5 },
        // Line 6 (Main B - 1)
        { id: 'p1_8',  raw: '6m',     xPercent: 11.0, yPercent: 62.6, line: 6 },
        { id: 'p1_9',  raw: '6',      xPercent: 32.5, yPercent: 62.6, line: 6 },
        { id: 'p1_10', raw: '67',     xPercent: 40.2, yPercent: 60.4, line: 6 },
        { id: 'p1_11', raw: '67+5',   xPercent: 41.5, yPercent: 62.7, line: 6 },
        { id: 'p1_12', raw: '2m',     xPercent: 50.5, yPercent: 62.6, line: 6 },
        // Line 7 (Main B - 2)
        { id: 'p1_13', raw: '6m',     xPercent: 10.8, yPercent: 73.5, line: 7 },
        { id: 'p1_14', raw: '77',     xPercent: 33.3, yPercent: 73.5, line: 7 },
        { id: 'p1_15', raw: '37',     xPercent: 45.3, yPercent: 73.5, line: 7 },
        { id: 'p1_16', raw: '6m',     xPercent: 57.5, yPercent: 73.5, line: 7 },
        // Line 8 (Main C - 1)
        { id: 'p1_17', raw: '2m7',    xPercent: 11.6, yPercent: 84.3, line: 8 },
        { id: 'p1_18', raw: '37',     xPercent: 29.5, yPercent: 84.3, line: 8 },
        { id: 'p1_19', raw: '6m',     xPercent: 53.5, yPercent: 83.8, line: 8 }
      ]
    },

    '償還_Am.pdf::page_2': {
      detectedSourceKey: 'Am',
      detectedTargetKey: 'Cm',
      chords: [
        // Line 1 (Main C - 2)
        { id: 'p2_1',  raw: '2m',     xPercent: 9.0,  yPercent: 14.2, line: 1 },
        { id: 'p2_2',  raw: '57',     xPercent: 36.2, yPercent: 14.2, line: 1 },
        { id: 'p2_3',  raw: '1',      xPercent: 68.8, yPercent: 14.2, line: 1 },
        { id: 'p2_4',  raw: '7b',     xPercent: 87.2, yPercent: 12.3, line: 1 },
        { id: 'p2_5',  raw: '5m6/7b', xPercent: 89.6, yPercent: 14.6, line: 1 },
        // Line 2 (Main D - 1)
        { id: 'p2_6',  raw: '67',     xPercent: 24.3, yPercent: 25.4, line: 2 },
        { id: 'p2_7',  raw: '2m',     xPercent: 38.6, yPercent: 25.4, line: 2 },
        { id: 'p2_8',  raw: '37',     xPercent: 64.5, yPercent: 25.4, line: 2 },
        // Line 3 (Main D - 2)
        { id: 'p2_9',  raw: '6m',     xPercent: 8.8,  yPercent: 36.6, line: 3 },
        { id: 'p2_10', raw: '/5',     xPercent: 27.2, yPercent: 36.6, line: 3 },
        { id: 'p2_11', raw: '4M7',    xPercent: 36.0, yPercent: 36.6, line: 3 },
        { id: 'p2_12', raw: '77',     xPercent: 67.2, yPercent: 36.6, line: 3 },
        // Line 4 (Intro II / III)
        { id: 'p2_13', raw: '37',     xPercent: 8.8,  yPercent: 48.2, line: 4 },
        { id: 'p2_14', raw: '37',     xPercent: 22.8, yPercent: 46.8, line: 4 },
        { id: 'p2_15', raw: '37-9+5', xPercent: 19.6, yPercent: 48.6, line: 4 },
        { id: 'p2_16', raw: '6m',     xPercent: 31.0, yPercent: 48.5, line: 4 },
        // Line 7 (Intro III / Ending B)
        { id: 'p2_17', raw: '6m',     xPercent: 9.2,  yPercent: 77.5, line: 7 },
        { id: 'p2_18', raw: '6m',     xPercent: 53.5, yPercent: 77.5, line: 7 }
      ]
    },

    '川の流れのように_C.jpg::page_1': {
      detectedSourceKey: 'C',
      detectedTargetKey: 'D',
      chords: [
        // Row 1
        { id: 'kw_1',  raw: 'C',     xPercent: 47.2, yPercent: 22.0, line: 2 },
        { id: 'kw_2',  raw: 'Am',    xPercent: 65.8, yPercent: 22.0, line: 2 },
        { id: 'kw_3',  raw: 'C',     xPercent: 80.8, yPercent: 22.0, line: 2 },
        { id: 'kw_4',  raw: 'Em',    xPercent: 90.5, yPercent: 22.0, line: 2 },
        // Row 2
        { id: 'kw_5',  raw: 'Dm',    xPercent: 6.2,  yPercent: 29.8, line: 3 },
        { id: 'kw_6',  raw: 'G',     xPercent: 12.0, yPercent: 29.8, line: 3 },
        { id: 'kw_7',  raw: 'C',     xPercent: 19.2, yPercent: 29.8, line: 3 },
        { id: 'kw_8',  raw: 'Am',    xPercent: 36.2, yPercent: 29.8, line: 3 },
        { id: 'kw_9',  raw: 'Em',    xPercent: 53.0, yPercent: 29.8, line: 3 },
        { id: 'kw_10', raw: 'F',     xPercent: 60.2, yPercent: 29.8, line: 3 },
        { id: 'kw_11', raw: 'G',     xPercent: 64.2, yPercent: 29.8, line: 3 },
        { id: 'kw_12', raw: 'C',     xPercent: 68.5, yPercent: 29.8, line: 3 },
        { id: 'kw_13', raw: 'Am',    xPercent: 83.0, yPercent: 29.8, line: 3 },
        // Row 3
        { id: 'kw_14', raw: 'Em',    xPercent: 5.5,  yPercent: 37.8, line: 4 },
        { id: 'kw_15', raw: 'Am',    xPercent: 19.2, yPercent: 37.8, line: 4 },
        { id: 'kw_16', raw: 'Em',    xPercent: 35.8, yPercent: 37.8, line: 4 },
        { id: 'kw_17', raw: 'F',     xPercent: 48.5, yPercent: 37.8, line: 4 },
        { id: 'kw_18', raw: 'Fm',    xPercent: 57.5, yPercent: 37.8, line: 4 },
        { id: 'kw_19', raw: 'Em',    xPercent: 66.2, yPercent: 37.8, line: 4 },
        { id: 'kw_20', raw: 'Am',    xPercent: 74.2, yPercent: 37.8, line: 4 },
        { id: 'kw_21', raw: 'Dm',    xPercent: 83.2, yPercent: 37.5, line: 4 },
        // Row 4
        { id: 'kw_22', raw: 'Gsus4', xPercent: 6.0,  yPercent: 44.8, line: 5 },
        { id: 'kw_23', raw: 'G',     xPercent: 19.2, yPercent: 44.8, line: 5 },
        { id: 'kw_24', raw: 'C',     xPercent: 34.8, yPercent: 44.8, line: 5 },
        { id: 'kw_25', raw: 'CM7',   xPercent: 41.2, yPercent: 43.5, line: 5 },
        { id: 'kw_26', raw: 'C7',    xPercent: 50.0, yPercent: 45.2, line: 5 },
        { id: 'kw_27', raw: 'Em',    xPercent: 67.2, yPercent: 45.2, line: 5 },
        { id: 'kw_28', raw: 'bE',    xPercent: 91.5, yPercent: 44.8, line: 5 },
        // Row 5
        { id: 'kw_29', raw: 'Dm',    xPercent: 5.8,  yPercent: 55.2, line: 6 },
        { id: 'kw_30', raw: 'Em',    xPercent: 19.8, yPercent: 55.2, line: 6 },
        { id: 'kw_31', raw: 'F',     xPercent: 34.8, yPercent: 55.2, line: 6 },
        { id: 'kw_32', raw: 'D7',    xPercent: 44.2, yPercent: 55.2, line: 6 },
        { id: 'kw_33', raw: 'Gsus4', xPercent: 52.0, yPercent: 55.2, line: 6 },
        { id: 'kw_34', raw: 'G',     xPercent: 58.6, yPercent: 53.3, line: 6 },
        { id: 'kw_35', raw: 'C',     xPercent: 66.0, yPercent: 55.2, line: 6 },
        { id: 'kw_36', raw: 'CM7',   xPercent: 72.8, yPercent: 53.2, line: 6 },
        { id: 'kw_37', raw: 'C7',    xPercent: 80.5, yPercent: 55.2, line: 6 },
        // Row 6
        { id: 'kw_38', raw: 'Em',    xPercent: 5.5,  yPercent: 64.2, line: 7 },
        { id: 'kw_39', raw: 'bE',    xPercent: 29.8, yPercent: 64.2, line: 7 },
        { id: 'kw_40', raw: 'Dm',    xPercent: 35.2, yPercent: 64.2, line: 7 },
        { id: 'kw_41', raw: 'Em',    xPercent: 50.2, yPercent: 64.2, line: 7 },
        { id: 'kw_42', raw: 'Fm',    xPercent: 68.0, yPercent: 64.2, line: 7 },
        { id: 'kw_43', raw: 'Gsus4', xPercent: 79.2, yPercent: 64.2, line: 7 },
        // Row 7
        { id: 'kw_44', raw: 'C',     xPercent: 6.0,  yPercent: 75.2, line: 8 }
      ]
    }
  };

  // ============================================================================
  // 2. API Key 與模型設定管理 (儲存於瀏覽器本機 localStorage)
  // ============================================================================

  function getApiKey() {
    if (typeof localStorage === 'undefined') return '';
    return (localStorage.getItem(STORAGE_KEY_API) || '').trim();
  }

  function setApiKey(key) {
    if (typeof localStorage === 'undefined') return;
    const clean = (key || '').trim();
    if (clean) {
      localStorage.setItem(STORAGE_KEY_API, clean);
    } else {
      localStorage.removeItem(STORAGE_KEY_API);
    }
  }

  function hasApiKey() {
    return getApiKey().length > 10;
  }

  function getModelName() {
    if (typeof localStorage === 'undefined') return DEFAULT_GEMINI_MODEL;
    return localStorage.getItem(STORAGE_KEY_MODEL) || DEFAULT_GEMINI_MODEL;
  }

  function setModelName(model) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY_MODEL, (model || DEFAULT_GEMINI_MODEL).trim());
  }

  // ============================================================================
  // 3. 辨識結果快取管理 (避免同一張譜重複呼叫 API 消耗 Token)
  // ============================================================================

  const memoryCache = new Map();

  function makeCacheKey(fileName, pageNumber) {
    return `${(fileName || 'sheet').trim()}::page_${pageNumber || 1}`;
  }

  function getCachedRecognition(fileName, pageNumber) {
    const key = makeCacheKey(fileName, pageNumber);

    if (memoryCache.has(key)) {
      return JSON.parse(JSON.stringify(memoryCache.get(key)));
    }

    if (typeof localStorage !== 'undefined') {
      try {
        const rawStore = localStorage.getItem(STORAGE_KEY_CACHE);
        if (rawStore) {
          const parsedStore = JSON.parse(rawStore);
          if (parsedStore && parsedStore[key]) {
            memoryCache.set(key, parsedStore[key]);
            return JSON.parse(JSON.stringify(parsedStore[key]));
          }
        }
      } catch (e) {
        // ignore storage parse error
      }
    }

    // 若為內建兩份範例琴譜，可直接回傳預先校對之高精準座標快取 (0 Token)
    if (BUILTIN_SAMPLE_RECOGNITION[key]) {
      return JSON.parse(JSON.stringify(BUILTIN_SAMPLE_RECOGNITION[key]));
    }

    return null;
  }

  function saveCachedRecognition(fileName, pageNumber, recognitionData) {
    const key = makeCacheKey(fileName, pageNumber);
    memoryCache.set(key, recognitionData);

    if (typeof localStorage !== 'undefined') {
      try {
        const rawStore = localStorage.getItem(STORAGE_KEY_CACHE);
        const parsedStore = rawStore ? JSON.parse(rawStore) : {};
        parsedStore[key] = recognitionData;
        localStorage.setItem(STORAGE_KEY_CACHE, JSON.stringify(parsedStore));
      } catch (e) {
        // ignore quota error
      }
    }
  }

  function hasBuiltInSampleCache(fileName, pageNumber) {
    const key = makeCacheKey(fileName, pageNumber);
    return Boolean(BUILTIN_SAMPLE_RECOGNITION[key]);
  }

  /**
   * 清除指定頁面的自訂修改快取，若為內建範例則恢復為預校對之初始座標
   */
  function resetPageCache(fileName, pageNumber) {
    const key = makeCacheKey(fileName, pageNumber);
    memoryCache.delete(key);

    if (typeof localStorage !== 'undefined') {
      try {
        const rawStore = localStorage.getItem(STORAGE_KEY_CACHE);
        if (rawStore) {
          const parsedStore = JSON.parse(rawStore);
          delete parsedStore[key];
          localStorage.setItem(STORAGE_KEY_CACHE, JSON.stringify(parsedStore));
        }
      } catch (e) {
        // ignore
      }
    }

    if (BUILTIN_SAMPLE_RECOGNITION[key]) {
      return JSON.parse(JSON.stringify(BUILTIN_SAMPLE_RECOGNITION[key]));
    }
    return null;
  }

  // ============================================================================
  // 4. 電子琴簡譜專用 Gemini Vision Prompt 與 API 呼叫引擎
  // ============================================================================

  /**
   * 建構針對電子琴／編曲機簡譜的結構化視覺辨識提示詞
   */
  function buildSheetVisionPrompt() {
    return `你是一位精通電子琴（Yamaha Tyros/Genos/PSR）簡譜與和弦樂理的專業 AI 讀譜專家。
請仔細檢視這張琴譜圖片，提取出譜面上所有的「和弦標記 (Chord Symbols)」以及它們在圖片上的精確中心位置百分比座標 (xPercent, yPercent)。

【重要辨識規則】：
1. 譜面上的和弦可能為以下兩種型態之一：
   - 型態 A（圓角方框級數和弦）：包在黑色圓角方框內的簡譜級數和弦，位於簡譜旋律線上方。例如："6m", "2m", "37", "37-9+5", "6", "67", "67+5", "77", "2m7", "57", "1", "7b", "5m6/7b", "/5", "4M7"。請務必將方框內的上下標完整還原為平面字串（如 3 上標 7 寫為 "37"；3 上標 7-9+5 寫為 "37-9+5"；5m6/7b 寫為 "5m6/7b"）。
   - 型態 B（英文字母和弦）：印在簡譜旋律小節上方的英文字母和弦（常為紅色或粗體字），例如："C", "Am", "Em", "Dm", "G", "F", "Fm", "Gsus4", "CM7", "C7", "D7", "bE"（注意華文簡譜常將 Eb 寫成前置降號 "bE"）。

2. 【嚴格排除以下非和弦干擾項】：
   - 絕對不要提取電子琴註冊記憶標記：如 "R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R3.6", "R4.7.8", "AG", "EP"。
   - 絕對不要提取節奏段落控制標記：如 "Intro I", "Main A", "Main B", "Main C", "Main D", "Fill B", "Fill C", "Fill D", "Ending B", "Style-1", "Sync Start"。
   - 絕對不要提取下方的簡譜旋律音符數字（如 "| 3 - 2 - |", "| 7 66 6 - |"）或歌詞文字。

3. 【座標定義】：
   - xPercent：該和弦標記中心點距離圖片左邊緣的水平百分比（0.0 ~ 100.0，精確到小數點後 1 位）。
   - yPercent：該和弦標記中心點距離圖片上邊緣的垂直百分比（0.0 ~ 100.0，精確到小數點後 1 位）。
   - line：該和弦屬於譜面由上往下第幾行樂譜（1, 2, 3...）。

4. 【調性資訊提取】：
   - 若譜面頂部有標註「預設調性 / 原調 / 1=X」與「建議調性 / 男調 / 女調」，請一併填入 detectedSourceKey 與 detectedTargetKey（如 "Am", "Cm", "C", "D"）。

請只回傳符合以下格式的純 JSON 物件（不要加 markdown 語法框）：
{
  "detectedSourceKey": "Am",
  "detectedTargetKey": "Cm",
  "chords": [
    { "raw": "6m", "xPercent": 46.2, "yPercent": 14.3, "line": 1 }
  ]
}`;
  }

  /**
   * 清洗並使用 MusicTheory.parseChord() 驗證 AI 回傳的和弦清單，自動過濾無效雜訊
   */
  function sanitizeAndValidateChords(rawChordsList, pageNumber = 1) {
    if (!Array.isArray(rawChordsList)) return [];

    const validated = [];
    rawChordsList.forEach((item, idx) => {
      if (!item || typeof item.raw !== 'string') return;
      const cleanRaw = item.raw.trim()
        .replace(/^\[|\]$/g, '') // 去除可能包覆的括號
        .replace(/♯/g, '#')
        .replace(/♭/g, 'b')
        .replace(/Δ|△/g, 'M');

      // 過濾常見電子琴控制字眼
      if (/^(R\d|Main|Fill|Intro|Ending|Style|Sync|Tempo|Mod)/i.test(cleanRaw)) {
        return;
      }

      // 使用核心樂理解析器驗證是否為合法和弦
      if (MusicTheory && typeof MusicTheory.parseChord === 'function') {
        const parsed = MusicTheory.parseChord(cleanRaw);
        if (!parsed || !parsed.isValid) return;
      }

      const x = Math.max(1, Math.min(98, parseFloat(item.xPercent) || 50));
      const y = Math.max(1, Math.min(98, parseFloat(item.yPercent) || 50));

      validated.push({
        id: `ai_p${pageNumber}_${idx + 1}_${Date.now().toString(36)}`,
        raw: cleanRaw,
        xPercent: Math.round(x * 10) / 10,
        yPercent: Math.round(y * 10) / 10,
        line: parseInt(item.line, 10) || 1
      });
    });

    return validated;
  }

  /**
   * 呼叫 Gemini Vision API 辨識單頁琴譜圖片 (DataURL)
   *
   * @param {string} imageDataUrl - 該頁琴譜之 image/jpeg DataURL
   * @param {object} [options] - { fileName, pageNumber, forceRefresh, apiKey, model }
   * @returns {Promise<{ source: 'cache'|'builtin'|'gemini', detectedSourceKey?: string, detectedTargetKey?: string, chords: Array }>}
   */
  async function recognizeSheetPage(imageDataUrl, options = {}) {
    const fileName = options.fileName || 'sheet';
    const pageNumber = options.pageNumber || 1;
    const forceRefresh = Boolean(options.forceRefresh);

    // 1. 若未強制重抓，優先檢查快取或內建範例座標 (0 Token)
    if (!forceRefresh) {
      const cached = getCachedRecognition(fileName, pageNumber);
      if (cached && Array.isArray(cached.chords) && cached.chords.length > 0) {
        const isBuiltin = hasBuiltInSampleCache(fileName, pageNumber);
        return {
          source: isBuiltin ? 'builtin' : 'cache',
          detectedSourceKey: cached.detectedSourceKey || null,
          detectedTargetKey: cached.detectedTargetKey || null,
          chords: cached.chords
        };
      }
    }

    // 2. 準備呼叫 Gemini Vision API
    const apiKey = (options.apiKey || getApiKey()).trim();
    if (!apiKey) {
      throw new Error('MISSING_API_KEY: 請先在上方「🔑 Gemini API Key 設定」輸入您的免費 API Key（或使用內建範例譜的 0 Token 預載辨識結果）。');
    }

    const model = options.model || getModelName();
    const base64Data = imageDataUrl.includes(',') ? imageDataUrl.split(',')[1] : imageDataUrl;
    const mimeMatch = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const payload = {
      contents: [
        {
          parts: [
            { text: buildSheetVisionPrompt() },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errDetail = `HTTP ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson && errJson.error && errJson.error.message) {
          errDetail = errJson.error.message;
        }
      } catch (e) {
        // ignore json parse error
      }
      throw new Error(`Gemini API 呼叫失敗 (${errDetail})`);
    }

    const resultJson = await response.json();
    const rawText =
      resultJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!rawText) {
      throw new Error('Gemini API 未回傳任何辨識文字，請稍後再試或檢查圖片清晰度。');
    }

    // 解析 JSON (相容可能帶有的 ```json 標籤)
    const cleanedJsonStr = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let parsedObj = null;
    try {
      parsedObj = JSON.parse(cleanedJsonStr);
    } catch (e) {
      throw new Error('AI 回傳格式解析失敗，請再點一次辨識。');
    }

    const validChords = sanitizeAndValidateChords(parsedObj.chords || [], pageNumber);

    const finalData = {
      detectedSourceKey: parsedObj.detectedSourceKey || null,
      detectedTargetKey: parsedObj.detectedTargetKey || null,
      chords: validChords
    };

    // 寫入快取，後續無限次轉調皆 0 Token
    saveCachedRecognition(fileName, pageNumber, finalData);

    return {
      source: 'gemini',
      ...finalData
    };
  }

  return {
    BUILTIN_SAMPLE_RECOGNITION,
    getApiKey,
    setApiKey,
    hasApiKey,
    getModelName,
    setModelName,
    getCachedRecognition,
    saveCachedRecognition,
    hasBuiltInSampleCache,
    resetPageCache,
    buildSheetVisionPrompt,
    sanitizeAndValidateChords,
    recognizeSheetPage
  };
});
