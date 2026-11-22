# 🐛 問題追蹤清單 (Issue Tracker)

本文件用於記錄開發與實測過程中發現的問題、邊界條件 (Edge Cases) 與解決方案，確保每個問題都有被追蹤與妥善解決。

- **狀態圖示**：`🔴 Open (待處理)` ｜ `🟡 In Progress (處理中)` ｜ `🟢 Resolved (已解決)`

---

## 目前追蹤中之技術議題 (Pre-identified Design Issues)

### [ISSUE-001] 掃描型 PDF 內無文字層，且方框級數和弦含特殊上下標語法
- **狀態**：`🟢 Resolved (已於 T1-1 & T2-2 實作並通過單元測試)`
- **發現日期**：2026-11-18
- **來源樣本**：範例譜 1《償還》(PDF)
- **問題描述**：
  1. 該 PDF 為掃描圖片型 PDF，無法單純使用文字抽取，需先透過 `PDF.js` 轉為 Canvas 影像後送交視覺模型辨識。
  2. 譜內和弦以圓角黑框包覆，且使用簡譜級數搭配上下標與加減號（如 `37` 代表 `III7`、`37-9+5` 代表 `III7(b9#5)`、`5m6/7b` 代表 `Vm6/bVII`、`/5` 代表純 Bass 轉位）。
- **解決方案**：
  - 於 `music-theory.js` 實作專屬正規表達式與級數語法轉換器，支援將 `-9`/`+5` 轉為標準 `b9`/`#5`，並支援依目標調性轉換為標準英文字母和弦或固定調數字。
  - 於 `sheet-parser.js` 建立專用 Vision Prompt 與預校對快取座標，完整覆蓋《償還》第 1、2 頁共 37 個方框級數和弦。

---

### [ISSUE-002] 華文簡譜常見「前置升降記號」寫法與電子琴控制標記干擾
- **狀態**：`🟢 Resolved (已於 T1-1 & T2-2 實作並通過單元測試)`
- **發現日期**：2026-11-18
- **來源樣本**：範例譜 2《川の流れのように》(JPG)
- **問題描述**：
  1. 譜面上的降 E 和弦寫成 `bE`（升降記號在前），而非西方標準的 `Eb`。
  2. 譜面上包含大量電子琴註冊記憶與段落標記（如 `R1`, `R2`, `R3.6`, `Style-1 Main A`, `Fill B`），容易干擾一般 OCR。
- **解決方案**：
  - 於 `music-theory.js` 雙向相容前置升降號（`bE`、`#F`）與後置升降號（`Eb`、`F#`）。
  - 於 `sheet-parser.js` 的 Gemini Vision Prompt 與 `sanitizeAndValidateChords()` 中雙重攔截排除 `R1~R8`, `Style`, `Main`, `Fill` 等標記，僅保留通過 `MusicTheory.parseChord()` 驗證之合法和弦。

---

### [ISSUE-003] 跨電腦使用時 API Key 安全性與資料同步問題
- **狀態**：`🟢 Resolved (已確立方案)`
- **發現日期**：2026-11-18
- **問題描述**：
  - 使用者會在公司與家裡兩台電腦透過 Git 同步專案，若將 Gemini API Key 寫死在程式碼中上傳 Git 會有資安外洩風險（GitHub 亦會攔截或撤銷外洩的 Key）。
- **解決方案**：
  - 系統介面提供「API Key 設定」輸入框，將 Key 儲存於各台電腦瀏覽器的 `localStorage` 中，不寫入任何受 Git 控管的檔案。

---

### [ISSUE-004] 第一階段 UI 應同時提供「極簡直覺的調性對應和弦＆組成音總表」並保留「互動鋼琴工作台」
- **狀態**：`🟢 Resolved (已透過雙模式分頁架構解決)`
- **發現日期**：2026-11-18
- **問題描述**：
  - 使用者對於第一階段的原始構想是：單純選擇「原調性」與「目標調性」後，直接提供一張一目了然的「原調 ➔ 目標調 常用對應和弦與組成音對照總表」；同時也覺得原先實作的「互動鋼琴鍵盤＋發聲試聽工作台」很不錯，希望能保留下來有空時把玩。
- **解決方案**：
  - 於 `index.html` 頂部設計雙模式分頁切換列（Tabs）：
    1. **【📊 模式一：調性對應和弦 ＆ 組成音總表 (預設首頁)】**：選好原調與目標調後，直接自動產生 1~7 級常用對應和弦、英文組成音、固定調數字組成音對照表，並附帶單一特殊和弦快速換算列。
    2. **【🎹 模式二：互動鋼琴鍵盤 ＆ 整首和弦工作台】**：完整保留 3 八度 SVG 互動式鋼琴鍵盤、電鋼琴發聲試聽與整首範例譜批次轉調卡片；且在模式一表格點擊「🎹 看琴鍵」可直接帶入該和弦跳轉至鋼琴檢視。

---

### [ISSUE-005] `file://` 本地直接開啟時 PDF.js 載入報錯 `Cannot read properties of undefined (reading 'WorkerMessageHandler')`
- **狀態**：`🟢 Resolved (已修復)`
- **發現日期**：2026-11-19
- **問題描述**：
  - 使用者於瀏覽器點擊「載入範例 1：《償還_Am.pdf》」時，出現錯誤訊息：`❌ PDF 載入失敗：Setting up fake worker failed: "Cannot read properties of undefined (reading 'WorkerMessageHandler')".`。
- **原因分析**：
  - 當透過 `file://` 協定開啟網頁時，瀏覽器基於安全限制（Origin `null`）不允許建立 Web Worker，因此 `PDF.js` 會自動降級為「主執行緒模式（Fake Worker）」，嘗試將 `workerSrc` 當作一般 `<script>` 載入到主執行緒並讀取 `window.pdfjsWorker.WorkerMessageHandler`。
  - 原先在 `initPdfJsWorker()` 中將 `workerSrc` 設為內含 `importScripts(...)` 的 `Blob URL`，導致在主執行緒執行時因主執行緒無 `importScripts` 函式而失敗，`window.pdfjsWorker` 為 `undefined`。
- **解決方案**：
  - 於 `index.html` 中直接透過 `<script src=".../pdf.worker.min.js"></script>` 預先載入 `pdf.worker.min.js`（其 UMD 封裝會自動在 `window.pdfjsWorker` 註冊 `WorkerMessageHandler`）。
  - 修改 `js/sheet-viewer.js` 的 `initPdfJsWorker()`，偵測到 `window.pdfjsWorker.WorkerMessageHandler` 已存在時直接使用，不再覆寫為 Blob URL。

---

### [ISSUE-006] 新申請之 Gemini API Key 不再開放舊版 `gemini-2.5-flash`，需升級為 `gemini-3.8-flash`
- **狀態**：`🟢 Resolved (已修復並自動升級 localStorage 模型名稱)`
- **發現日期**：2026-11-19
- **問題描述**：
  - 使用者申請新版 Google AI Studio API Key 後呼叫視覺辨識時，API 回傳錯誤：`This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.8-flash for the latest features and improvements.`。
- **解決方案**：
  - 將 `js/sheet-parser.js` 的 `DEFAULT_GEMINI_MODEL` 與 `index.html` 的模型選單全面更新為 **`gemini-3.8-flash`**（並提供 `gemini-3.8-pro` 選項）。
  - 在 `getModelName()` 中加入自動遷移邏輯，若偵測到 `localStorage` 存有舊版 `gemini-2.5-flash` 則自動升級為 `gemini-3.8-flash`，無須重新設定金鑰。

---

### [ISSUE-007] Gemini 伺服器高負載 (High Demand) 導致前端無逾時卡死懸掛
- **狀態**：`🟢 Resolved (已修復)`
- **發現日期**：2026-11-21
- **問題描述**：
  - 使用者辨識樂譜時連續遭遇兩次 `This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.`，隨後第 3 次呼叫時連線卡死在「⏳ 正在辨識全曲進度：第 1 / 2 頁...」長達 5 分鐘，按鈕鎖定無法操作。
  - 原因為 `fetch` 缺乏超時上限與取消機制，當 Google 伺服器因負載臨界掛起連線時，瀏覽器無限期空等。
- **解決方案**：
  1. **25 秒強制逾時保護 (Timeout)**：於 `js/sheet-parser.js` 實作 `callGeminiApiWithRetry()`，若超過 25 秒無回應自動斷線解鎖畫面，提示重試。
  2. **High Demand 自動退避重試**：偵測到 503 / 429 或 High Demand 錯誤時，自動在背景倒數等待 3 秒並重試最多 2 次，不需使用者手動一直點。
  3. **動態秒數計時與可視化**：辨識中即時更新 `(已耗時 X 秒...)`，清楚得知連線狀態。
  4. **提供「🛑 取消辨識」紅色按鈕**：辨識中可隨時手動一鍵中斷，秒解鎖按鈕。
  5. **擴充備用模型選單**：支援選用 `gemini-3.8-pro` 等備用模型分散負載。

---

### [ISSUE-008] `gemini-3.8-flash` 免費額度上限實為每日 20 次 (RPD=20)，觸發 Quota Exceeded
- **狀態**：`🟢 Resolved (已校正額度常數並最佳化提示)`
- **發現日期**：2026-11-21
- **問題描述**：
  - 使用者呼叫辨識時報錯：`Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.8-flash, description: Generate content requests per day limit exceeded on Free Tier. Please retry in 17h19m...`。
  - 原先程式預設以舊版 1.5-flash 的每日 1,500 次為基準顯示剩餘額度，但 Google AI Studio 對最新旗艦模型 `gemini-3.8-flash` 在 Free Tier 的每日上限收緊為 20 次 (RPD = 20)。
- **解決方案**：
  1. 將 `js/sheet-parser.js` 的 `FREE_DAILY_REQUEST_LIMIT` 由 1,500 校正為 20，確保前台「今日免費額度預估剩餘」準確反映官方限制。
  2. 於 API 錯誤攔截器中精確解析 `Quota exceeded` 與 `retry in XhYm` 倒數時間，以繁體中文清楚引導使用者「更換另一個 Google 帳號的 API Key」或「載入已儲存的專案檔 (.json)」。

---

### [ISSUE-009] 單一 Key 每日 20 次限制過嚴，需支援多組 API Key 金鑰池與自動輪替
- **狀態**：`🟢 Resolved (已實作多組 Key 輸入與 Quota 耗盡自動輪替)`
- **發現日期**：2026-11-21
- **問題描述**：
  - 因 Google 對於 `gemini-3.8-flash` 免費額度每日僅限 20 次，使用者若手邊有多組 Google 帳號申請的 API Key，手動複製貼上切換極為繁瑣且中斷流程。
- **解決方案**：
  1. 將設定輸入框升級為可容納多行的 `textarea`，支援一行貼一組 Key（或逗號/分號分隔）。
  2. 於 `js/sheet-parser.js` 實作金鑰池管理（`getApiKeys()`, `getApiKeyPoolInfo()`, `rotateApiKey()`），額度上限自動依金鑰數量倍增（如 2 組 40 次、3 組 60 次）。
  3. 於辨識流程中實作自動故障轉移（Auto-failover）：當偵測到某組 Key 額度耗盡時，自動於背景切換至下一組可用 Key 繼續辨識，達成 0 中斷全自動抓譜。

---

### [ISSUE-010] Google 官方全面停用舊版 Flash (2.0/2.5/1.5)，指定唯一支援 `gemini-3.8-flash`
- **狀態**：`🟢 Resolved (已鎖定官方唯一指定模型並加強 High Demand 容錯)`
- **發現日期**：2026-11-22
- **問題描述**：
  - 使用者呼叫 `gemini-2.0-flash` 時，Google API 明確回傳：`This model models/gemini-2.0-flash is no longer available. Please update your code to use models/gemini-3.8-flash for the latest features and improvements.`。
  - 證實 Google 官方在該端點已全面淘汰 2.0/2.5/Pro 等舊型號，**唯一強制支援之視覺模型僅有 `gemini-3.8-flash`**。
- **解決方案**：
  1. 將系統模型單一鎖定為 Google 官方唯一指定之 **`gemini-3.8-flash`**，移除所有已失效模型選項。
  2. 針對 `gemini-3.8-flash` 尖峰時段的 High Demand 塞車現象，將自動退避重試次數提升至 **4 次**（漸進等待 2s, 4s, 6s, 8s，涵蓋 Google 尖峰 20 秒週期）。
  3. 連動多組 API Key 金鑰池容錯：若 Key 1 遭遇 High Demand 或 Quota 額度耗盡，自動嘗試輪替切換至 Key 2 繼續執行。

---

## 歷史已解決問題紀錄 (Resolved Issues)
*(待開發階段實測後陸續歸檔於此)*
