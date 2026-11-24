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
  const STORAGE_KEY_MODEL = 'chord_transposer_gemini_model_v3';
  const STORAGE_KEY_CACHE = 'chord_transposer_vision_cache_v1';
  const STORAGE_KEY_TOKEN_STATS = 'chord_transposer_token_stats_v1';

  // 經 Google 官方 API 實測支援 Vision 多模態且於 Free Tier 可用之模型清單 (依穩定度與回應速度排序)
  const AVAILABLE_VISION_MODELS = [
    'gemini-3.6-flash',
    'gemini-3-flash-preview',
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash'
  ];
  const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';

  // Google AI Studio 免費方案 (Free Tier) 單一模型每組 Key 每日基礎額度參考值 (RPD = 20)
  const FREE_DAILY_REQUEST_LIMIT = 20;
  const FREE_DAILY_TOKEN_LIMIT = 1000000;

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
  // 2. API Key 與模型設定管理 (支援多組 Key 金鑰池與輪替，儲存於 localStorage)
  // ============================================================================

  let activeApiKeyIndex = 0;

  /**
   * 取得所有設定之 API Keys 陣列 (支援換行、逗號、分號分隔多組 Key)
   * @returns {string[]}
   */
  function getApiKeys() {
    if (typeof localStorage === 'undefined') return [];
    const raw = (localStorage.getItem(STORAGE_KEY_API) || '').trim();
    if (!raw) return [];
    return raw
      .split(/[\r\n,;]+/)
      .map(k => k.trim())
      .filter(k => k.length > 10);
  }

  /**
   * 取得當前作用中的 API Key
   * @returns {string}
   */
  function getApiKey() {
    const keys = getApiKeys();
    if (keys.length === 0) return '';
    return keys[activeApiKeyIndex % keys.length];
  }

  /**
   * 取得未經解析的原始輸入字串 (供 UI 編輯器還原文字)
   * @returns {string}
   */
  function getRawApiKeysText() {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem(STORAGE_KEY_API) || '';
  }

  /**
   * 取得當前作用中 Key 的索引 (0-based)
   * @returns {number}
   */
  function getActiveApiKeyIndex() {
    const keys = getApiKeys();
    if (keys.length === 0) return 0;
    return activeApiKeyIndex % keys.length;
  }

  /**
   * 切換至下一組 API Key
   * @returns {string}
   */
  function rotateApiKey() {
    const keys = getApiKeys();
    if (keys.length <= 1) return getApiKey();
    activeApiKeyIndex = (activeApiKeyIndex + 1) % keys.length;
    return keys[activeApiKeyIndex];
  }

  /**
   * 取得金鑰池狀態資訊
   * @returns {{ total: number, activeIndex: number, activeKeyMasked: string }}
   */
  function getApiKeyPoolInfo() {
    const keys = getApiKeys();
    return {
      total: keys.length,
      activeIndex: keys.length > 0 ? (activeApiKeyIndex % keys.length) : 0,
      activeKeyMasked: keys.length > 0
        ? keys[activeApiKeyIndex % keys.length].replace(/^(.{6})(.*)(.{4})$/, '$1...$3')
        : ''
    };
  }

  function setApiKey(keysText) {
    if (typeof localStorage === 'undefined') return;
    const clean = (keysText || '').trim();
    if (clean) {
      localStorage.setItem(STORAGE_KEY_API, clean);
    } else {
      localStorage.removeItem(STORAGE_KEY_API);
    }
    activeApiKeyIndex = 0; // 重置作用中的指針
  }

  function hasApiKey() {
    return getApiKeys().length > 0;
  }

  function getModelName() {
    if (typeof localStorage === 'undefined') return DEFAULT_GEMINI_MODEL;
    const saved = (localStorage.getItem(STORAGE_KEY_MODEL) || '').trim();
    // 自動將未設定、已停用或不存在之舊模型 (如 gemini-3.8-pro, gemini-2.5-flash, gemini-2.0-flash) 校正為實測可用模型
    if (!saved || !AVAILABLE_VISION_MODELS.includes(saved)) {
      localStorage.setItem(STORAGE_KEY_MODEL, DEFAULT_GEMINI_MODEL);
      return DEFAULT_GEMINI_MODEL;
    }
    return saved;
  }

  function setModelName(model) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY_MODEL, (model || DEFAULT_GEMINI_MODEL).trim());
  }

  /**
   * 取得今日日期字串 (YYYY-MM-DD)，用於每日免費額度自動重置計算
   */
  function getTodayDateString() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * 讀取本機累計與今日 Token 用量統計與預估剩餘免費額度
   */
  function getTokenUsageStats() {
    const today = getTodayDateString();
    const defaultStats = {
      date: today,
      lastPromptTokens: 0,
      lastOutputTokens: 0,
      lastTotalTokens: 0,
      todayRequests: 0,
      todayTokens: 0,
      allTimeRequests: 0,
      allTimeTokens: 0
    };

    if (typeof localStorage === 'undefined') {
      return enrichStatsWithQuota(defaultStats);
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY_TOKEN_STATS);
      if (!raw) return enrichStatsWithQuota(defaultStats);
      const parsed = JSON.parse(raw);
      if (parsed.date !== today) {
        // 跨日自動將「今日用量」歸零，保留歷史總累計
        parsed.date = today;
        parsed.todayRequests = 0;
        parsed.todayTokens = 0;
        parsed.lastPromptTokens = 0;
        parsed.lastOutputTokens = 0;
        parsed.lastTotalTokens = 0;
        localStorage.setItem(STORAGE_KEY_TOKEN_STATS, JSON.stringify(parsed));
      }
      return enrichStatsWithQuota({ ...defaultStats, ...parsed });
    } catch (e) {
      return enrichStatsWithQuota(defaultStats);
    }
  }

  function enrichStatsWithQuota(stats) {
    const keys = getApiKeys();
    const keyCount = Math.max(1, keys.length);
    const totalDailyRequestLimit = FREE_DAILY_REQUEST_LIMIT * keyCount;
    const remainingRequests = Math.max(0, totalDailyRequestLimit - stats.todayRequests);
    const remainingTokens = Math.max(0, FREE_DAILY_TOKEN_LIMIT - stats.todayTokens);
    const remainingPercent = Math.max(
      0,
      Math.min(100, Math.round((remainingTokens / FREE_DAILY_TOKEN_LIMIT) * 1000) / 10)
    );
    return {
      ...stats,
      keyCount,
      freeDailyRequestLimit: totalDailyRequestLimit,
      freeDailyTokenLimit: FREE_DAILY_TOKEN_LIMIT,
      remainingRequests,
      remainingTokens,
      remainingPercent
    };
  }

  /**
   * 記錄單次 Gemini API 回傳之官方 usageMetadata Token 數據
   */
  function recordTokenUsage(usageMetadata) {
    const current = getTokenUsageStats();
    const promptTokens = Number(usageMetadata?.promptTokenCount) || 0;
    const outputTokens = Number(usageMetadata?.candidatesTokenCount) || 0;
    const totalTokens = Number(usageMetadata?.totalTokenCount) || (promptTokens + outputTokens);

    const updated = {
      date: getTodayDateString(),
      lastPromptTokens: promptTokens,
      lastOutputTokens: outputTokens,
      lastTotalTokens: totalTokens,
      todayRequests: current.todayRequests + 1,
      todayTokens: current.todayTokens + totalTokens,
      allTimeRequests: current.allTimeRequests + 1,
      allTimeTokens: current.allTimeTokens + totalTokens
    };

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_TOKEN_STATS, JSON.stringify(updated));
      } catch (e) {
        // ignore
      }
    }

    return enrichStatsWithQuota(updated);
  }

  // ============================================================================
  // 3. 辨識結果快取管理 (避免同一張譜重複呼叫 API 消耗 Token)
  // ============================================================================

  const memoryCache = new Map();

  function makeCacheKey(fileName, pageNumber) {
    return `${(fileName || 'sheet').trim()}::page_${pageNumber || 1}`;
  }

  /**
   * 檢測快取或辨識出的和弦座標是否發生異常堆疊或截斷
   * （例如：舊版因模型回傳 0~1000 座標被 Math.min(98) 全數壓在 98% 右下角，或因欄位名稱差異全數退回 50% 正中央）
   */
  function isCoordinateCacheCorrupted(chords) {
    if (!Array.isArray(chords) || chords.length === 0) return true;
    if (chords.length < 3) return false;

    let clamped98Count = 0;
    let clamped1Count = 0;
    let default50Count = 0;
    const coordFreq = new Map();

    for (let i = 0; i < chords.length; i++) {
      const c = chords[i];
      const x = Number(c && c.xPercent);
      const y = Number(c && c.yPercent);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return true;

      if (x >= 97.5 || y >= 97.5) clamped98Count++;
      if (x <= 1.5 && y <= 1.5) clamped1Count++;
      if (Math.abs(x - 50) < 0.2 && Math.abs(y - 50) < 0.2) default50Count++;

      const posKey = `${Math.round(x)}_${Math.round(y)}`;
      coordFreq.set(posKey, (coordFreq.get(posKey) || 0) + 1);
    }

    const total = chords.length;
    let maxSameSpot = 0;
    coordFreq.forEach(cnt => {
      if (cnt > maxSameSpot) maxSameSpot = cnt;
    });

    // 若超過 35% 的和弦被擠壓在 98% 邊界、1% 邊界、50% 預設點，或超過 40% 的標籤重疊在同一個座標點，判定為座標異常快取
    if (clamped98Count / total >= 0.35) return true;
    if (clamped1Count / total >= 0.35) return true;
    if (default50Count / total >= 0.35) return true;
    if (total >= 4 && maxSameSpot / total >= 0.4) return true;

    return false;
  }

  function getCachedRecognition(fileName, pageNumber) {
    const key = makeCacheKey(fileName, pageNumber);

    if (memoryCache.has(key)) {
      const memData = memoryCache.get(key);
      if (memData && !isCoordinateCacheCorrupted(memData.chords)) {
        return JSON.parse(JSON.stringify(memData));
      }
      memoryCache.delete(key);
    }

    if (typeof localStorage !== 'undefined') {
      try {
        const rawStore = localStorage.getItem(STORAGE_KEY_CACHE);
        if (rawStore) {
          const parsedStore = JSON.parse(rawStore);
          if (parsedStore && parsedStore[key]) {
            const storedData = parsedStore[key];
            // 自動攔截並清除座標異常（如全數被夾在 98% 或 50% 看不到標籤）的舊快取
            if (isCoordinateCacheCorrupted(storedData.chords)) {
              delete parsedStore[key];
              localStorage.setItem(STORAGE_KEY_CACHE, JSON.stringify(parsedStore));
            } else {
              memoryCache.set(key, storedData);
              return JSON.parse(JSON.stringify(storedData));
            }
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
   * 內建「跨尺度座標自動正規化」：
   * - 自動相容 0~100 百分比、Gemini 原生 0~1000 空間座標 (如 gemini-3-flash-preview 常回傳 0~1000)、0.0~1.0 正規化座標與 box_2d 邊界框
   */
  function sanitizeAndValidateChords(rawChordsList, pageNumber = 1) {
    if (!Array.isArray(rawChordsList)) return [];

    // 第一階段：提取合法和弦與原始數值座標，供整頁尺度判定
    const candidates = [];
    const finiteCoords = [];

    rawChordsList.forEach((item, idx) => {
      if (!item || typeof item !== 'object') return;
      const rawVal = item.raw ?? item.chord ?? item.symbol ?? item.name ?? item.text ?? item.label;
      if (rawVal === undefined || rawVal === null) return;

      const cleanRaw = String(rawVal).trim()
        .replace(/^[\[\]【】「」『』()（）]+|[\[\]【】「」『』()（）]+$/g, '')
        .replace(/♯/g, '#')
        .replace(/♭/g, 'b')
        .replace(/Δ|△/g, 'M');

      if (!cleanRaw) return;

      // 過濾常見電子琴控制字眼
      if (/^(R\d|Main|Fill|Intro|Ending|Style|Sync|Tempo|Mod)/i.test(cleanRaw)) {
        return;
      }

      // 使用核心樂理解析器驗證是否為合法和弦
      if (MusicTheory && typeof MusicTheory.parseChord === 'function') {
        const parsed = MusicTheory.parseChord(cleanRaw);
        if (!parsed || !parsed.isValid) return;
      }

      let rawX = parseFloat(item.xPercent ?? item.x_percent ?? item.x ?? item.left);
      let rawY = parseFloat(item.yPercent ?? item.y_percent ?? item.y ?? item.top);

      // 相容 Gemini 原生 box_2d: [ymin, xmin, ymax, xmax]
      if ((!Number.isFinite(rawX) || !Number.isFinite(rawY)) && Array.isArray(item.box_2d) && item.box_2d.length >= 4) {
        const ymin = parseFloat(item.box_2d[0]);
        const xmin = parseFloat(item.box_2d[1]);
        const ymax = parseFloat(item.box_2d[2]);
        const xmax = parseFloat(item.box_2d[3]);
        if (Number.isFinite(xmin) && Number.isFinite(xmax)) rawX = (xmin + xmax) / 2;
        if (Number.isFinite(ymin) && Number.isFinite(ymax)) rawY = (ymin + ymax) / 2;
      }

      if (Number.isFinite(rawX)) finiteCoords.push(rawX);
      if (Number.isFinite(rawY)) finiteCoords.push(rawY);

      candidates.push({
        idx,
        cleanRaw,
        rawX,
        rawY,
        line: parseInt(item.line, 10) || 1
      });
    });

    if (candidates.length === 0) return [];

    // 第二階段：根據整頁最大座標值，自動判定模型使用的座標尺度 (0~100 vs 0~1000 vs 0~1 vs 像素尺寸)
    const maxCoord = finiteCoords.length > 0 ? Math.max(...finiteCoords) : 100;
    let scaleDivisor = 1;
    if (maxCoord > 1005) {
      // 像素座標 (對應壓縮後 1600px 畫布)
      scaleDivisor = Math.max(16, maxCoord / 95);
    } else if (maxCoord > 100) {
      // Gemini 3 原生 0 ~ 1000 空間座標尺度 (例如 254 代表 25.4%)
      scaleDivisor = 10;
    } else if (maxCoord > 0 && maxCoord <= 1.05) {
      // 0.0 ~ 1.0 正規化浮點數尺度 (例如 0.254 代表 25.4%)
      scaleDivisor = 0.01;
    }

    const validated = candidates.map((c) => {
      const normX = Number.isFinite(c.rawX) ? (c.rawX / scaleDivisor) : 50;
      const normY = Number.isFinite(c.rawY) ? (c.rawY / scaleDivisor) : 50;
      const x = Math.max(1, Math.min(98, normX));
      const y = Math.max(1, Math.min(98, normY));

      return {
        id: `ai_p${pageNumber}_${c.idx + 1}_${Date.now().toString(36)}`,
        raw: c.cleanRaw,
        xPercent: Math.round(x * 10) / 10,
        yPercent: Math.round(y * 10) / 10,
        line: c.line
      };
    });

    return validated;
  }

  /**
   * 呼叫 Gemini Vision API 並內建 25 秒逾時保護 (Timeout) 與 High Demand 自動退避重試
   *
   * @param {string} endpoint - API 網址
   * @param {object} payload - 請求主體
   * @param {object} [options] - { signal, onRetry }
   * @returns {Promise<object>} API 回傳之 JSON 物件
   */
  async function callGeminiApiWithRetry(endpoint, payload, options = {}) {
    const maxRetries = 1; // 單一模型最多快速重試 1 次 (若仍塞車或斷線則交由外層自動切換至備援模型)
    const timeoutMs = 35000; // 單次請求 35 秒逾時上限 (給予整頁 50+ 個和弦座標充裕輸出時間並防卡死)
    const userSignal = options.signal;
    const onRetry = options.onRetry;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (userSignal && userSignal.aborted) {
        throw new DOMException('Aborted by user', 'AbortError');
      }

      const internalController = new AbortController();
      let isTimedOut = false;
      const timer = setTimeout(() => {
        isTimedOut = true;
        internalController.abort('TIMEOUT');
      }, timeoutMs);

      const abortHandler = () => {
        clearTimeout(timer);
        internalController.abort('ABORTED_BY_USER');
      };
      if (userSignal) {
        userSignal.addEventListener('abort', abortHandler, { once: true });
      }

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: internalController.signal
        });

        clearTimeout(timer);
        if (userSignal) {
          userSignal.removeEventListener('abort', abortHandler);
        }

        if (!response.ok) {
          let errDetail = `HTTP ${response.status}`;
          let isRetryable = (response.status === 503 || response.status === 500);
          try {
            const errJson = await response.json();
            if (errJson && errJson.error && errJson.error.message) {
              errDetail = errJson.error.message;
              const lower = errDetail.toLowerCase();
              const isQuota = lower.includes('quota exceeded') || errDetail.includes('limit: 20') || lower.includes('limit: 0');
              if (!isQuota && (
                  lower.includes('high demand') ||
                  lower.includes('spikes in demand') ||
                  lower.includes('temporarily unavailable') ||
                  lower.includes('overloaded') ||
                  lower.includes('exhausted'))) {
                isRetryable = true;
              }
            }
          } catch (e) {
            // ignore json parse error
          }

          if (isRetryable && attempt < maxRetries) {
            const waitSec = 2;
            if (typeof onRetry === 'function') {
              onRetry(attempt + 1, maxRetries, waitSec, '伺服器尖峰負載 (High Demand)');
            }
            await new Promise((resolve, reject) => {
              const waitTimer = setTimeout(resolve, waitSec * 1000);
              if (userSignal) {
                userSignal.addEventListener('abort', () => {
                  clearTimeout(waitTimer);
                  reject(new DOMException('Aborted by user', 'AbortError'));
                }, { once: true });
              }
            });
            continue;
          }

          if (errDetail.toLowerCase().includes('quota exceeded') || errDetail.includes('limit: 20') || errDetail.includes('limit: 0')) {
            const lowerDetail = errDetail.toLowerCase();
            const isPerMinute = lowerDetail.includes('per_minute') ||
                                lowerDetail.includes('per minute') ||
                                (!lowerDetail.includes('per_day') && !lowerDetail.includes('per day') && !errDetail.includes('limit: 20') && /retry in \d+(\.\d+)?s/i.test(errDetail));
            if (isPerMinute && attempt < maxRetries) {
              const waitSec = 3;
              if (typeof onRetry === 'function') {
                onRetry(attempt + 1, maxRetries, waitSec, '連續辨識觸發每分鐘流量保護 (RPM)，稍候重試中');
              }
              await new Promise((resolve, reject) => {
                const waitTimer = setTimeout(resolve, waitSec * 1000);
                if (userSignal) {
                  userSignal.addEventListener('abort', () => {
                    clearTimeout(waitTimer);
                    reject(new DOMException('Aborted by user', 'AbortError'));
                  }, { once: true });
                }
              });
              continue;
            }
            const timeMatch = errDetail.match(/retry in ([0-9]+h[0-9]+m|[0-9]+m|[0-9]+(?:\.[0-9]+)?s)/i);
            const retryHint = timeMatch ? `（Google 預計於 ${timeMatch[1]} 後重置額度）` : '';
            if (isPerMinute) {
              throw new Error(`每分鐘請求頻率達上限 (RPM Rate Limit)${retryHint}`);
            }
            throw new Error(`今日免費額度已達上限：Google 針對此模型的免費配額為每日 20 次${retryHint}。`);
          }

          throw new Error(`Gemini API 呼叫失敗 (${errDetail})`);
        }

        return await response.json();
      } catch (err) {
        clearTimeout(timer);
        if (userSignal) {
          userSignal.removeEventListener('abort', abortHandler);
        }

        if (userSignal && userSignal.aborted) {
          throw new DOMException('Aborted by user', 'AbortError');
        }

        const errMsgLower = String(err && err.message || '').toLowerCase();
        const isNetworkFetchError = errMsgLower.includes('failed to fetch') ||
                                    errMsgLower.includes('networkerror') ||
                                    errMsgLower.includes('load failed');

        if (isTimedOut || (err.name === 'AbortError' && internalController.signal.reason === 'TIMEOUT') || isNetworkFetchError) {
          if (attempt < maxRetries) {
            const waitSec = 2;
            if (typeof onRetry === 'function') {
              onRetry(attempt + 1, maxRetries, waitSec, isNetworkFetchError ? '伺服器連線瞬斷重試中' : '連線逾時重試中');
            }
            await new Promise((resolve, reject) => {
              const waitTimer = setTimeout(resolve, waitSec * 1000);
              if (userSignal) {
                userSignal.addEventListener('abort', () => {
                  clearTimeout(waitTimer);
                  reject(new DOMException('Aborted by user', 'AbortError'));
                }, { once: true });
              }
            });
            continue;
          }
          if (isNetworkFetchError) {
            throw new Error('Failed to fetch: Google 伺服器連線中斷或瞬時無回應');
          }
          throw new Error('辨識逾時 (超過 25 秒 Google 伺服器未回應)：伺服器目前連線繁忙，已自動中斷。');
        }

        throw err;
      }
    }
  }

  /**
   * 將高解析度琴譜圖片適度壓縮至 AI Vision 最佳辨識尺寸 (最長邊 1600px, JPEG 0.84)
   * 僅用於傳送給 Gemini API（不影響畫面上的 2 倍高清預覽與匯出畫質），大幅降低上傳體積與 Failed to fetch 斷線率
   */
  function compressImageForVision(imageDataUrl, maxDim = 1600, quality = 0.84) {
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      return Promise.resolve(imageDataUrl);
    }
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h || (w <= maxDim && h <= maxDim && imageDataUrl.length < 600000)) {
          resolve(imageDataUrl);
          return;
        }
        const scale = Math.min(1, maxDim / Math.max(w, h));
        const targetW = Math.round(w * scale);
        const targetH = Math.round(h * scale);
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(imageDataUrl);
      img.src = imageDataUrl;
    });
  }

  /**
   * 依模型特性建立最佳化 generationConfig：
   * - Gemini 3.x 標準 Flash 模型預設開啟深度思考 (Thinking)，在算整頁 40+ 個和弦座標時會思考超過 25 秒導致伺服器斷線 (Failed to fetch)
   * - 設定 thinkingBudget: 0 (關閉冗長思考直接輸出座標) 可將整頁辨識速度由 25 秒斷線縮短至 5~6 秒極速完成！
   * - 註：含 -lite 之輕量模型本身無 thinkingConfig 欄位，不帶入以免 400 Bad Request
   */
  function buildGenerationConfigForModel(modelName) {
    const cfg = {
      temperature: 0.1,
      responseMimeType: 'application/json'
    };
    if (!String(modelName || '').toLowerCase().includes('lite')) {
      cfg.thinkingConfig = { thinkingBudget: 0 };
    }
    return cfg;
  }

  /**
   * 從 Gemini API 回傳結構中提取並解析 JSON 物件（相容多 part 回傳、markdown 語法框與前後夾雜說明文字）
   */
  function extractAndParseResponseJson(apiResponse) {
    const parts = apiResponse?.candidates?.[0]?.content?.parts;
    let rawText = '';
    if (Array.isArray(parts)) {
      rawText = parts
        .filter(p => p && !p.thought && typeof p.text === 'string')
        .map(p => p.text)
        .join('\n')
        .trim();
      if (!rawText && parts[0] && typeof parts[0].text === 'string') {
        rawText = parts[0].text.trim();
      }
    }

    if (!rawText) {
      throw new Error('Gemini API 未回傳任何辨識文字，請稍後再試或檢查圖片清晰度。');
    }

    const cleanedJsonStr = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let parsed = null;
    try {
      parsed = JSON.parse(cleanedJsonStr);
    } catch (firstErr) {
      // 若模型在 JSON 前後夾雜了額外字元，嘗試擷取最外層 { ... } 或 [ ... ] 區段
      const firstBrace = cleanedJsonStr.indexOf('{');
      const lastBrace = cleanedJsonStr.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
          parsed = JSON.parse(cleanedJsonStr.slice(firstBrace, lastBrace + 1));
        } catch (secondErr) {
          // 繼續拋出下方標準錯誤
        }
      }
      if (!parsed) {
        throw new Error('AI 回傳格式解析失敗，正自動重試或切換備援模型。');
      }
    }

    if (Array.isArray(parsed)) {
      return { detectedSourceKey: null, detectedTargetKey: null, chords: parsed };
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed.chords)) {
      const altArray = parsed.chordList || parsed.items || parsed.data || parsed.results;
      if (Array.isArray(altArray)) {
        parsed.chords = altArray;
      }
    }
    return parsed;
  }

  /**
   * 呼叫 Gemini Vision API 辨識單頁琴譜圖片 (DataURL)
   *
   * @param {string} imageDataUrl - 該頁琴譜之 image/jpeg DataURL
   * @param {object} [options] - { fileName, pageNumber, forceRefresh, apiKey, model, signal, onRetry }
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

    // 2. 準備呼叫 Gemini Vision API (支援多組 Key 智慧輪替與故障轉移)
    const allKeys = options.apiKey ? [options.apiKey.trim()] : getApiKeys();
    if (allKeys.length === 0) {
      throw new Error('MISSING_API_KEY: 請先在上方「🔑 Gemini API Key 設定」輸入您的免費 API Key（支援多組，每行輸入一組）。');
    }

    const model = options.model || getModelName();
    const optimizedImageUrl = await compressImageForVision(imageDataUrl, 1600, 0.84);
    const base64Data = optimizedImageUrl.includes(',') ? optimizedImageUrl.split(',')[1] : optimizedImageUrl;
    const mimeMatch = optimizedImageUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const promptText = buildSheetVisionPrompt();

    let resultJson = null;
    let parsedObj = null;
    let validChords = [];
    let lastError = null;
    let usedModel = model;
    const totalKeys = allKeys.length;
    // 建立模型自動備援順序：優先使用目前選取之模型，若遭遇 503 High Demand / Failed to fetch / 逾時 / 額度耗盡，自動無縫切換至其他實測暢通之視覺模型
    const candidateModels = [model, ...AVAILABLE_VISION_MODELS.filter(m => m !== model)];

    outerModelLoop:
    for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
      const currentModel = candidateModels[mIdx];
      const payload = {
        contents: [
          {
            parts: [
              { text: promptText },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: buildGenerationConfigForModel(currentModel)
      };

      for (let keyAttempt = 0; keyAttempt < totalKeys; keyAttempt++) {
        const currentKeyIndex = (activeApiKeyIndex + keyAttempt) % totalKeys;
        const currentApiKey = allKeys[currentKeyIndex];
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:generateContent?key=${encodeURIComponent(currentApiKey)}`;

        try {
          const rawResponse = await callGeminiApiWithRetry(endpoint, payload, options);
          // 於備援迴圈內直接驗證 JSON 解析與座標正規化是否有效，若格式截斷、0 和弦或座標重疊異常，自動由下一個模型備援
          const candidateParsed = extractAndParseResponseJson(rawResponse);
          const candidateChords = sanitizeAndValidateChords(candidateParsed.chords || [], pageNumber);
          if (candidateChords.length === 0 || isCoordinateCacheCorrupted(candidateChords)) {
            throw new Error('AI 回傳和弦座標異常或為空，正自動切換備援模型重試。');
          }
          parsedObj = candidateParsed;
          validChords = candidateChords;
          resultJson = rawResponse;
          // 成功後將 activeApiKeyIndex 推進至下一組 Key (Round-Robin 多頁分流)，
          // 讓第 1 頁、第 2 頁自動交替使用不同組 Key，徹底避免連續頁面撞上單一 Key 的每分鐘 RPM 限流
          activeApiKeyIndex = (currentKeyIndex + 1) % totalKeys;
          usedModel = currentModel;
          break outerModelLoop;
        } catch (err) {
          if (err && err.name === 'AbortError') {
            throw err;
          }
          lastError = err;
          const errMsg = String(err.message || '');
          const lowerMsg = errMsg.toLowerCase();
          const isRpmLimit = errMsg.includes('每分鐘請求頻率達上限') ||
                             lowerMsg.includes('per_minute') ||
                             lowerMsg.includes('per minute');
          const isQuotaExceeded = isRpmLimit ||
                                  errMsg.includes('今日免費額度已達上限') ||
                                  lowerMsg.includes('quota exceeded') ||
                                  errMsg.includes('limit: 20') ||
                                  errMsg.includes('limit: 0');
          const isHighDemandOrUnavailable = lowerMsg.includes('high demand') ||
                                            lowerMsg.includes('spikes in demand') ||
                                            lowerMsg.includes('temporarily unavailable') ||
                                            lowerMsg.includes('overloaded') ||
                                            lowerMsg.includes('http 503') ||
                                            lowerMsg.includes('not found') ||
                                            lowerMsg.includes('no longer available') ||
                                            lowerMsg.includes('failed to fetch') ||
                                            lowerMsg.includes('networkerror') ||
                                            lowerMsg.includes('load failed') ||
                                            errMsg.includes('連線中斷') ||
                                            errMsg.includes('辨識逾時') ||
                                            errMsg.includes('格式解析失敗') ||
                                            errMsg.includes('座標異常或為空') ||
                                            errMsg.includes('未回傳任何辨識文字');

          // 情況 A：當前 Key 觸發每分鐘 RPM 限流或每日額度已滿，且手邊有多組 Key ➔ 優先切換至下一組 API Key 分流！
          if (isQuotaExceeded && keyAttempt < totalKeys - 1) {
            const nextIndex = (currentKeyIndex + 1) % totalKeys;
            if (typeof options.onRetry === 'function') {
              options.onRetry(
                1, 1, 1,
                `第 ${currentKeyIndex + 1} 組 Key 於 ${currentModel} 觸發限流或額度已滿，自動切換至第 ${nextIndex + 1} 組 Key`
              );
            }
            await new Promise(resolve => setTimeout(resolve, 600));
            continue;
          }

          // 情況 B：當前模型伺服器塞車、斷線 (Failed to fetch / 503 / Timeout / 格式或座標異常) 或停用 ➔ 直接跳出內層迴圈，秒切下一個暢通備援模型！
          if (isHighDemandOrUnavailable && mIdx < candidateModels.length - 1) {
            const nextModel = candidateModels[mIdx + 1];
            if (typeof options.onRetry === 'function') {
              options.onRetry(
                1, 1, 1,
                `模型 ${currentModel} 連線繁忙或座標異常，正自動切換至暢通備援模型 ${nextModel}`
              );
            }
            await new Promise(resolve => setTimeout(resolve, 400));
            break; // 跳至外層 candidateModels 的下一個模型
          }

          // 情況 C：所有 Key 在此模型的額度皆已滿（或觸發 RPM 限流），但還有其他備援模型可試 ➔ 自動切換至下一個備援模型
          if (isQuotaExceeded && mIdx < candidateModels.length - 1) {
            const nextModel = candidateModels[mIdx + 1];
            if (typeof options.onRetry === 'function') {
              options.onRetry(
                1, 1, 1,
                `模型 ${currentModel} 額度或頻率已滿，正自動切換至備援模型 ${nextModel} 繼續辨識`
              );
            }
            await new Promise(resolve => setTimeout(resolve, 600));
            break;
          }

          throw err;
        }
      }
    }

    if (!resultJson || !parsedObj) {
      throw lastError || new Error('所有可用視覺模型與 API Key 皆無法完成辨識，請稍後再試。');
    }

    // 記錄 Google API 官方回傳之精確 Token 消耗量 (usageMetadata)
    const usageMeta = resultJson?.usageMetadata || {};
    const tokenStats = recordTokenUsage(usageMeta);

    const finalData = {
      detectedSourceKey: parsedObj.detectedSourceKey || null,
      detectedTargetKey: parsedObj.detectedTargetKey || null,
      chords: validChords
    };

    // 僅在有成功辨識出和弦時寫入快取，避免空白結果覆蓋快取導致後續無法補抓
    if (validChords.length > 0) {
      saveCachedRecognition(fileName, pageNumber, finalData);
    }

    return {
      source: 'gemini',
      usedModel,
      usage: {
        promptTokens: tokenStats.lastPromptTokens,
        outputTokens: tokenStats.lastOutputTokens,
        totalTokens: tokenStats.lastTotalTokens
      },
      tokenStats,
      ...finalData
    };
  }

  return {
    AVAILABLE_VISION_MODELS,
    BUILTIN_SAMPLE_RECOGNITION,
    getApiKey,
    getApiKeys,
    getRawApiKeysText,
    getActiveApiKeyIndex,
    rotateApiKey,
    getApiKeyPoolInfo,
    setApiKey,
    hasApiKey,
    getModelName,
    setModelName,
    getTokenUsageStats,
    recordTokenUsage,
    isCoordinateCacheCorrupted,
    getCachedRecognition,
    saveCachedRecognition,
    hasBuiltInSampleCache,
    resetPageCache,
    buildSheetVisionPrompt,
    sanitizeAndValidateChords,
    recognizeSheetPage
  };
});
