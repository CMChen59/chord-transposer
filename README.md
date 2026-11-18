# 🎹 智慧和弦轉調與組成音查詢工具 (Chord Transposer & Voicing Analyzer)

專為電子琴／編曲機簡譜（含級數方框和弦與英文字母和弦）設計的轉調、組成音視覺化與 AI 樂譜判讀工具。

---

## 📁 專案文件與追蹤架構（跨電腦同步核心）

為了確保在**公司**與**家裡**兩台電腦切換開發時，所有的討論脈絡、開發進度與問題追蹤保持 100% 一致，本專案將所有紀錄直接納管於 Git 版本控制中：

| 檔案路徑 | 用途說明 |
| :--- | :--- |
| [`README.md`](./README.md) | 專案架構總覽、環境說明與跨電腦 Git 同步作業流程 |
| [`TASKS.md`](./TASKS.md) | **任務清單**：記錄各階段開發項目、目前進度狀態與完成紀錄 |
| [`ISSUES.md`](./ISSUES.md) | **問題追蹤清單**：記錄辨識誤差、樂理特例、UI 調整需求與解決方案 |
| [`docs/DISCUSSION_LOG.md`](./docs/DISCUSSION_LOG.md) | **討論與執行日誌**：完整保存每次的需求討論、技術決策與實作變更紀錄 |

> 💡 **換電腦時的 AI 接續方式**：
> 當您在另一台電腦執行 `git pull` 後，只需對 AI 說：
> *「請先讀取 `README.md`、`TASKS.md`、`ISSUES.md` 與 `docs/DISCUSSION_LOG.md` 了解目前進度，我們繼續推進下一個任務。」*
> AI 即可瞬間掌握所有上下文，無縫接軌！

---

## 🏗️ 系統架構設計

```
d:\Vibe Coding\和弦轉調工具\
├── index.html               # 主應用程式介面 (單頁式 Web App，免安裝環境直接開啟)
├── css/
│   └── style.css            # 介面樣式、鋼琴鍵盤與原譜覆蓋標籤樣式
├── js/
│   ├── music-theory.js      # 核心樂理引擎 (英文/簡譜級數互轉、五度圈升降記號、組成音計算)
│   ├── piano-visualizer.js  # 互動式鋼琴鍵盤繪製模組 (顯示根音與右手和弦組成音)
│   ├── sheet-parser.js      # PDF.js 與 Gemini Vision API 樂譜視覺辨識模組
│   └── app.js               # 狀態管理、UI 互動與轉調模式切換控制
├── samples/                 # 測試用範例樂譜 (PDF / JPG)
├── docs/
│   └── DISCUSSION_LOG.md    # 討論記錄與執行過程日誌
├── TASKS.md                 # 任務進度追蹤清單
└── ISSUES.md                # Issue 問題追蹤清單
```

---

## 🔄 公司 ↔ 家裡 Git 同步標準流程

1. **結束當前電腦的工作前**：
   ```powershell
   git add .
   git commit -m "進度更新：簡述本次完成的任務或討論"
   git push
   ```
2. **切換到另一台電腦開始工作前**：
   ```powershell
   git pull
   ```
3. **安全性提醒**：
   - 個人申請的 `Gemini API Key` 將儲存在瀏覽器本機的 `localStorage` 中，**不會**寫入程式碼或上傳至 Git，確保帳號安全。
