/**
 * 💾 智慧和弦轉調與組成音查詢工具 - 轉調琴譜匯出 (JPG / PDF) 與專案檔存檔模組 (js/sheet-exporter.js)
 *
 * 對應任務 T3-1 & T3-2：
 * 1. T3-1：將原譜高清底圖與轉調後的新和弦覆蓋標籤依實際像素比例 1:1 合成繪製至高解析度 Canvas
 *    - 支援「🖼️ 另存本頁為 JPG 圖片」
 *    - 支援「📑 另存全曲為 PDF 琴譜」（整合 jsPDF 自動將單頁或多頁琴譜打包為單一高清 PDF 檔案）
 *    - 支援「🖨️ 直接列印琴譜」
 * 2. T3-2：支援將辨識並校對微調完成的整份琴譜（含底圖、所有頁面和弦座標、調性與樣式設定）匯出為 `.json` 專案檔，
 *    並支援隨時一鍵載入 `.json` 專案檔（跨電腦免重新辨識、0 Token 秒開）
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const MusicTheory = require('./music-theory.js');
    module.exports = factory(MusicTheory);
  } else {
    root.SheetExporter = factory(root.MusicTheory);
  }
})(typeof self !== 'undefined' ? self : this, function (MusicTheory) {
  'use strict';

  const BASE_VIEWPORT_WIDTH = 860; // 網頁預覽標準基準寬度 (px)，用於換算高清 Canvas 上的字體與標籤縮放比例

  /**
   * 標籤配色主題定義 (與 css/style.css 中的 4 種樣式一致)
   */
  const TAG_THEME_STYLES = {
    'red-box': {
      bgColor: '#ffffff',
      textColor: '#dc2626',
      borderColor: '#dc2626',
      borderWidth: 2,
      shadow: true
    },
    'clean-cover': {
      bgColor: '#ffffff',
      textColor: '#dc2626',
      borderColor: '#ffffff',
      borderWidth: 1,
      shadow: false
    },
    'blue-box': {
      bgColor: '#ffffff',
      textColor: '#1d4ed8',
      borderColor: '#2563eb',
      borderWidth: 2,
      shadow: true
    },
    'yellow-box': {
      bgColor: '#fef08a',
      textColor: '#111827',
      borderColor: '#ca8a04',
      borderWidth: 2,
      shadow: true
    }
  };

  /**
   * 在 Canvas 2D Context 上繪製圓角矩形
   */
  function drawRoundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /**
   * 根據調性與顯示模式計算單一和弦標籤要顯示的文字
   */
  function formatTransposedTagText(rawChord, sourceKey, targetKey, displayMode) {
    if (!MusicTheory || typeof MusicTheory.transposeChord !== 'function') {
      return rawChord;
    }
    const tr = MusicTheory.transposeChord(rawChord, sourceKey, targetKey);
    if (!tr) return rawChord;

    if (displayMode === 'number') {
      return tr.fixedNumberChord;
    }
    if (displayMode === 'practice') {
      return `${rawChord}➔${tr.englishChord}`;
    }
    return tr.englishChord;
  }

  /**
   * 將單頁琴譜底圖與所有轉調和弦標籤合成為高解析度 HTMLCanvasElement
   *
   * @param {object} pageObj - { pageNumber, width, height, dataUrl, chords }
   * @param {object} renderOptions - { sourceKey, targetKey, displayMode, tagStyle, tagFontSize, tagsVisible }
   * @returns {Promise<HTMLCanvasElement>}
   */
  function renderCompositePageCanvas(pageObj, renderOptions = {}) {
    return new Promise((resolve, reject) => {
      if (!pageObj || !pageObj.dataUrl) {
        reject(new Error('無效的琴譜頁面資料'));
        return;
      }

      const img = new Image();
      img.onload = () => {
        const width = pageObj.width || img.naturalWidth || img.width;
        const height = pageObj.height || img.naturalHeight || img.height;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // 1. 繪製白色背景與原譜高清底圖
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // 2. 若開啟顯示覆蓋標籤，將所有轉調和弦標籤按真實比例繪製上去
        const tagsVisible = renderOptions.tagsVisible !== false;
        const chords = Array.isArray(pageObj.chords) ? pageObj.chords : [];

        if (tagsVisible && chords.length > 0) {
          const scale = width / BASE_VIEWPORT_WIDTH;
          const baseFontSize = Number(renderOptions.tagFontSize) || 15;
          const scaledFontSize = Math.round(baseFontSize * scale * 10) / 10;
          const themeKey = renderOptions.tagStyle || 'red-box';
          const theme = TAG_THEME_STYLES[themeKey] || TAG_THEME_STYLES['red-box'];

          ctx.font = `900 ${scaledFontSize}px "Segoe UI", "Microsoft JhengHei", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const padX = 7 * scale;
          const padY = 3.5 * scale;
          const radius = (themeKey === 'clean-cover' ? 3 : 6) * scale;

          chords.forEach(ch => {
            const labelText = formatTransposedTagText(
              ch.raw,
              renderOptions.sourceKey || 'C',
              renderOptions.targetKey || 'C',
              renderOptions.displayMode || 'english'
            );

            const centerX = (Number(ch.xPercent) / 100) * width;
            const centerY = (Number(ch.yPercent) / 100) * height;

            const metrics = ctx.measureText(labelText);
            const textWidth = metrics.width;
            const boxWidth = textWidth + padX * 2;
            const boxHeight = scaledFontSize * 1.28 + padY * 2;
            const boxX = centerX - boxWidth / 2;
            const boxY = centerY - boxHeight / 2;

            ctx.save();

            // 陰影與背景填充
            if (theme.shadow) {
              ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
              ctx.shadowBlur = 4 * scale;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 1.5 * scale;
            }

            drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, radius);
            ctx.fillStyle = theme.bgColor;
            ctx.fill();

            // 邊框
            ctx.shadowColor = 'transparent';
            ctx.lineWidth = theme.borderWidth * scale;
            ctx.strokeStyle = theme.borderColor;
            ctx.stroke();

            // 和弦文字
            ctx.fillStyle = theme.textColor;
            ctx.fillText(labelText, centerX, centerY + 0.5 * scale);

            ctx.restore();
          });
        }

        resolve(canvas);
      };

      img.onerror = () => reject(new Error('載入琴譜底圖影像失敗'));
      img.src = pageObj.dataUrl;
    });
  }

  /**
   * 去除原檔名的副檔名以便重新命名
   */
  function getCleanBaseName(fileName) {
    if (!fileName) return '琴譜';
    return fileName.replace(/\.(pdf|jpg|jpeg|png|webp|bmp|json)$/i, '');
  }

  /**
   * 觸發瀏覽器下載 DataURL 或 Blob URL
   */
  function triggerBrowserDownload(url, downloadFileName) {
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /**
   * T3-1A：將當前頁面匯出並另存為高畫質 JPG 圖片
   */
  async function exportCurrentPageAsJpg(viewerState, renderOptions = {}) {
    if (!viewerState || !Array.isArray(viewerState.pages) || viewerState.pages.length === 0) {
      throw new Error('請先載入琴譜後再執行匯出');
    }

    const pageObj = viewerState.pages[viewerState.currentPageIndex] || viewerState.pages[0];
    const canvas = await renderCompositePageCanvas(pageObj, renderOptions);
    const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.95);

    const baseName = getCleanBaseName(viewerState.fileName);
    const tgtKey = renderOptions.targetKey || 'C';
    const pageSuffix = viewerState.pages.length > 1 ? `_第${pageObj.pageNumber}頁` : '';
    const outName = `${baseName}_轉${tgtKey}調${pageSuffix}.jpg`;

    triggerBrowserDownload(jpgDataUrl, outName);
    return outName;
  }

  /**
   * T3-1B：將全曲所有頁面（單頁或多頁）合成並另存為單一高畫質 PDF 琴譜檔案
   */
  async function exportAllPagesAsPdf(viewerState, renderOptions = {}, onProgress = null) {
    if (!viewerState || !Array.isArray(viewerState.pages) || viewerState.pages.length === 0) {
      throw new Error('請先載入琴譜後再執行匯出');
    }

    const jspdfNS = typeof window !== 'undefined' ? window.jspdf : null;
    if (!jspdfNS || !jspdfNS.jsPDF) {
      throw new Error('尚未載入 jsPDF 函式庫，請確認網路連線或使用「🖨️ 直接列印 / 另存 PDF」功能。');
    }

    const { jsPDF } = jspdfNS;
    let pdfDoc = null;

    for (let i = 0; i < viewerState.pages.length; i++) {
      const pageObj = viewerState.pages[i];
      if (typeof onProgress === 'function') {
        onProgress(i + 1, viewerState.pages.length);
      }

      const canvas = await renderCompositePageCanvas(pageObj, renderOptions);
      const imgData = canvas.toDataURL('image/jpeg', 0.94);
      const w = canvas.width;
      const h = canvas.height;
      const orientation = w > h ? 'l' : 'p';

      if (i === 0) {
        pdfDoc = new jsPDF({
          orientation,
          unit: 'px',
          format: [w, h],
          compress: true
        });
      } else {
        pdfDoc.addPage([w, h], orientation);
      }

      pdfDoc.addImage(imgData, 'JPEG', 0, 0, w, h, undefined, 'FAST');
    }

    const baseName = getCleanBaseName(viewerState.fileName);
    const tgtKey = renderOptions.targetKey || 'C';
    const outName = `${baseName}_轉${tgtKey}調.pdf`;

    pdfDoc.save(outName);
    return outName;
  }

  /**
   * T3-2A：將當前辨識並微調完成的琴譜與和弦座標儲存為 `.json` 專案檔
   */
  function exportProjectJson(viewerState, appState = {}) {
    if (!viewerState || !Array.isArray(viewerState.pages) || viewerState.pages.length === 0) {
      throw new Error('請先載入琴譜後再儲存專案檔');
    }

    const projectPayload = {
      projectVersion: '1.0',
      exportedAt: new Date().toISOString(),
      fileName: viewerState.fileName || '未命名琴譜',
      fileType: viewerState.fileType || 'pdf',
      sourceKey: appState.sourceKey || 'C',
      targetKey: appState.targetKey || 'C',
      displayMode: appState.displayMode || 'english',
      tagStyle: appState.tagStyle || 'red-box',
      tagFontSize: appState.tagFontSize || 15,
      pages: viewerState.pages.map(p => ({
        pageNumber: p.pageNumber,
        width: p.width,
        height: p.height,
        dataUrl: p.dataUrl,
        chords: Array.isArray(p.chords) ? p.chords : []
      }))
    };

    const jsonStr = JSON.stringify(projectPayload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);

    const baseName = getCleanBaseName(viewerState.fileName);
    const tgtKey = appState.targetKey || 'C';
    const outName = `${baseName}_轉${tgtKey}調_專案檔.json`;

    triggerBrowserDownload(blobUrl, outName);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
    return outName;
  }

  /**
   * T3-2B：讀取並驗證使用者上傳的 `.json` 琴譜專案檔
   */
  function parseProjectJsonFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('未選擇檔案'));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (!data || !Array.isArray(data.pages) || data.pages.length === 0) {
            reject(new Error('此 JSON 檔案不是有效的琴譜轉調專案檔'));
            return;
          }
          resolve(data);
        } catch (err) {
          reject(new Error('JSON 專案檔格式解析失敗'));
        }
      };
      reader.onerror = () => reject(new Error('讀取專案檔失敗'));
      reader.readAsText(file, 'utf-8');
    });
  }

  return {
    TAG_THEME_STYLES,
    formatTransposedTagText,
    renderCompositePageCanvas,
    exportCurrentPageAsJpg,
    exportAllPagesAsPdf,
    exportProjectJson,
    parseProjectJsonFile
  };
});
