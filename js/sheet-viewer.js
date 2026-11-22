/**
 * 🎼 智慧和弦轉調與組成音查詢工具 - 樂譜檔案載入與高清畫布預覽模組 (js/sheet-viewer.js)
 *
 * 對應任務 T2-1：
 * 1. 整合 PDF.js，支援將多頁 PDF 樂譜（如《償還_Am.pdf》共 2 頁）渲染為高清 Canvas 畫布並支援快速翻頁
 * 2. 支援 JPG / PNG 圖片譜（如《川の流れのように_C.jpg》）拖曳上傳 (Drag & Drop) 或檔案選取載入
 * 3. 支援一鍵載入內建範例琴譜（相容 file:// 離線直接開啟）
 * 4. 支援畫面縮放預覽 (50% ~ 175% 及適應寬度)，並同步對齊上層 #sheetOverlayLayer 供後續 T2-2/T2-3 覆蓋轉調和弦標籤
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SheetViewer = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PDFJS_CDN_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const LOCAL_PDFJS_WORKER = 'js/pdf.worker.min.js';

  // 內部狀態
  const viewerState = {
    fileName: '',
    fileType: '', // 'pdf' | 'image'
    pages: [],    // [{ pageNumber, width, height, dataUrl, chords: [] }]
    currentPageIndex: 0,
    zoomPercent: 100, // 50 ~ 175
    isLoading: false,
    onPageChangeCallback: null
  };

  let dom = {};

  /**
   * 初始化 PDF.js Worker
   * 注意：在 file:// 本地直接開啟 index.html 時，若全域以 <script> 載入 pdf.worker.min.js，
   * 全域即存在 window.pdfjsWorker.WorkerMessageHandler，PDF.js 會自動使用 Main Thread (Fake Worker) 模式；
   * 同時設定 workerSrc 指向本地 js/pdf.worker.min.js，避免 PDF.js 內部報 No workerSrc 錯誤。
   */
  function initPdfJsWorker() {
    if (typeof window === 'undefined' || !window.pdfjsLib) return;
    if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = LOCAL_PDFJS_WORKER;
    }
  }

  /**
   * 將 Base64 字串轉為 Uint8Array (供 PDF.js 讀取)
   */
  function base64ToUint8Array(base64) {
    const raw = window.atob(base64);
    const uint8Array = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      uint8Array[i] = raw.charCodeAt(i);
    }
    return uint8Array;
  }

  /**
   * 更新載入狀態訊息列
   */
  function setStatus(message, type = 'info') {
    if (!dom.statusText) return;
    dom.statusText.textContent = message;
    dom.statusText.className = `sheet-status-badge status-${type}`;
  }

  /**
   * 讀取 PDF Uint8Array 並將每一頁渲染為高解析度影像快取
   */
  async function loadPdfDocument(uint8Array, fileName) {
    if (!window.pdfjsLib) {
      setStatus('⚠️ 尚未載入 PDF.js 函式庫，請確認網路連線或重新整理頁面。', 'error');
      return false;
    }

    initPdfJsWorker();
    viewerState.isLoading = true;
    setStatus(`⏳ 正在解析 PDF 樂譜「${fileName}」並渲染高清畫布...`, 'loading');

    try {
      const loadingTask = window.pdfjsLib.getDocument({ data: uint8Array });
      const pdfDoc = await loadingTask.promise;
      const numPages = pdfDoc.numPages;
      const renderedPages = [];

      // 使用 2.0 倍高清取樣確保簡譜方框與上下標小字極度清晰
      const renderScale = 2.0;

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        setStatus(`⏳ 正在渲染「${fileName}」第 ${pageNum} / ${numPages} 頁...`, 'loading');
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: renderScale });

        const offCanvas = document.createElement('canvas');
        offCanvas.width = Math.floor(viewport.width);
        offCanvas.height = Math.floor(viewport.height);
        const ctx = offCanvas.getContext('2d');

        // 填入白色背景避免透明底 PDF 顯示異常
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);

        await page.render({
          canvasContext: ctx,
          viewport: viewport
        }).promise;

        renderedPages.push({
          pageNumber: pageNum,
          width: offCanvas.width,
          height: offCanvas.height,
          dataUrl: offCanvas.toDataURL('image/jpeg', 0.92),
          chords: [] // 預留給 T2-2 / T2-3 存放該頁辨識出的和弦座標與內容
        });
      }

      viewerState.fileName = fileName;
      viewerState.fileType = 'pdf';
      viewerState.pages = renderedPages;
      viewerState.currentPageIndex = 0;
      viewerState.isLoading = false;

      renderCurrentPageToStage();
      setStatus(
        `✅ 已載入 PDF 樂譜：${fileName}（共 ${numPages} 頁｜高清畫布 ${renderedPages[0].width} × ${renderedPages[0].height} px）`,
        'success'
      );
      return true;
    } catch (err) {
      console.error('PDF 解析失敗:', err);
      viewerState.isLoading = false;
      setStatus(`❌ PDF 載入失敗：${err.message || '格式無法讀取'}`, 'error');
      return false;
    }
  }

  /**
   * 讀取單張圖片 (JPG / PNG DataURL) 並轉為高清畫布頁
   */
  function loadImageDataUrl(dataUrl, fileName) {
    return new Promise((resolve) => {
      viewerState.isLoading = true;
      setStatus(`⏳ 正在載入圖片琴譜「${fileName}」...`, 'loading');

      const img = new Image();
      img.onload = () => {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = img.naturalWidth || img.width;
        offCanvas.height = img.naturalHeight || img.height;
        const ctx = offCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);
        ctx.drawImage(img, 0, 0);

        viewerState.fileName = fileName;
        viewerState.fileType = 'image';
        viewerState.pages = [{
          pageNumber: 1,
          width: offCanvas.width,
          height: offCanvas.height,
          dataUrl: offCanvas.toDataURL('image/jpeg', 0.94),
          chords: []
        }];
        viewerState.currentPageIndex = 0;
        viewerState.isLoading = false;

        renderCurrentPageToStage();
        setStatus(
          `✅ 已載入圖片琴譜：${fileName}（共 1 頁｜原始解析度 ${offCanvas.width} × ${offCanvas.height} px）`,
          'success'
        );
        resolve(true);
      };

      img.onerror = () => {
        viewerState.isLoading = false;
        setStatus(`❌ 圖片載入失敗：「${fileName}」不是有效的圖片格式`, 'error');
        resolve(false);
      };

      img.src = dataUrl;
    });
  }

  /**
   * 處理使用者透過檔案選擇器或拖曳上傳之 File 物件
   */
  function handleUserFile(file) {
    if (!file) return;
    const name = file.name || '未命名琴譜';
    const lower = name.toLowerCase();

    if (file.type === 'application/pdf' || lower.endsWith('.pdf')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const uint8 = new Uint8Array(e.target.result);
        loadPdfDocument(uint8, name);
      };
      reader.onerror = (err) => {
        console.error('檔案讀取失敗:', err);
        setStatus(`❌ 讀取檔案失敗：「${name}」無法存取`, 'error');
      };
      reader.readAsArrayBuffer(file);
    } else if (file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp)$/.test(lower)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        loadImageDataUrl(e.target.result, name);
      };
      reader.onerror = (err) => {
        console.error('圖片讀取失敗:', err);
        setStatus(`❌ 讀取圖片失敗：「${name}」無法存取`, 'error');
      };
      reader.readAsDataURL(file);
    } else {
      setStatus(`⚠️ 不支援的檔案格式「${name}」，請上傳 PDF、JPG 或 PNG 琴譜檔案。`, 'error');
    }
  }

  /**
   * 載入內建範例琴譜 ('changHuanPdf' 或 'kawaJpg')
   */
  async function loadBuiltInSample(sampleKey) {
    const sampleStore = window.SAMPLE_SHEETS_DATA;
    if (!sampleStore || !sampleStore[sampleKey]) {
      setStatus('⚠️ 找不到內建範例資料，請直接拖曳上傳 samples 資料夾內的檔案。', 'error');
      return false;
    }

    const item = sampleStore[sampleKey];
    if (item.type === 'pdf') {
      const uint8 = base64ToUint8Array(item.base64);
      return await loadPdfDocument(uint8, item.name);
    } else {
      const dataUrl = `data:${item.mime || 'image/jpeg'};base64,${item.base64}`;
      return await loadImageDataUrl(dataUrl, item.name);
    }
  }

  /**
   * 將目前選取的頁面繪製至主預覽 Canvas，並更新頁碼與縮放比例
   */
  function renderCurrentPageToStage() {
    if (!dom.baseCanvas || viewerState.pages.length === 0) return;

    const pageObj = viewerState.pages[viewerState.currentPageIndex];
    if (!pageObj) return;

    const img = new Image();
    img.onload = () => {
      dom.baseCanvas.width = pageObj.width;
      dom.baseCanvas.height = pageObj.height;
      const ctx = dom.baseCanvas.getContext('2d');
      ctx.clearRect(0, 0, pageObj.width, pageObj.height);
      ctx.drawImage(img, 0, 0, pageObj.width, pageObj.height);

      applyZoomStyle();
      updatePaginationUI();

      if (dom.emptyPlaceholder) {
        dom.emptyPlaceholder.style.display = 'none';
      }
      if (dom.canvasStageWrapper) {
        dom.canvasStageWrapper.style.display = 'flex';
      }

      if (typeof viewerState.onPageChangeCallback === 'function') {
        try {
          viewerState.onPageChangeCallback(pageObj, viewerState.currentPageIndex, viewerState.pages.length);
        } catch (cbErr) {
          console.error('onPageChangeCallback 執行錯誤:', cbErr);
        }
      }
    };
    img.src = pageObj.dataUrl;
  }

  /**
   * 套用縮放百分比至畫布容器 (維持底層 Canvas 高清像素，僅透過 CSS 寬度無損縮放)
   */
  function applyZoomStyle() {
    if (!dom.sheetViewportInner || viewerState.pages.length === 0) return;
    const baseDisplayWidth = 860; // 100% 標準檢視寬度 (px)
    const targetWidth = Math.round((baseDisplayWidth * viewerState.zoomPercent) / 100);
    dom.sheetViewportInner.style.width = `${targetWidth}px`;

    if (dom.zoomLabel) {
      dom.zoomLabel.textContent = `${viewerState.zoomPercent}%`;
    }
  }

  /**
   * 更新多頁切換按鈕與頁碼顯示
   */
  function updatePaginationUI() {
    const total = viewerState.pages.length;
    const cur = viewerState.currentPageIndex;

    if (dom.pageIndicator) {
      dom.pageIndicator.textContent = total > 0 ? `第 ${cur + 1} / ${total} 頁` : '尚未載入頁數';
    }
    if (dom.btnPrevPage) {
      dom.btnPrevPage.disabled = cur <= 0;
    }
    if (dom.btnNextPage) {
      dom.btnNextPage.disabled = cur >= total - 1;
    }

    // 渲染快速頁碼按鈕 (例如 [第 1 頁] [第 2 頁])
    if (dom.pageQuickBtns) {
      if (total <= 1) {
        dom.pageQuickBtns.innerHTML = '';
      } else {
        dom.pageQuickBtns.innerHTML = viewerState.pages.map((p, idx) => {
          const activeClass = idx === cur ? 'btn btn-primary' : 'btn';
          return `<button type="button" class="${activeClass}" data-page-idx="${idx}" style="padding:4px 10px;">第 ${idx + 1} 頁</button>`;
        }).join('');

        dom.pageQuickBtns.querySelectorAll('button[data-page-idx]').forEach(btn => {
          btn.addEventListener('click', () => {
            goToPage(parseInt(btn.getAttribute('data-page-idx'), 10));
          });
        });
      }
    }
  }

  function goToPage(pageIdx) {
    if (pageIdx < 0 || pageIdx >= viewerState.pages.length) return;
    viewerState.currentPageIndex = pageIdx;
    renderCurrentPageToStage();
  }

  function changeZoom(deltaPercent) {
    const next = Math.max(50, Math.min(175, viewerState.zoomPercent + deltaPercent));
    viewerState.zoomPercent = next;
    applyZoomStyle();
  }

  function resetZoom() {
    viewerState.zoomPercent = 100;
    applyZoomStyle();
  }

  /**
   * 綁定 DOM 元素與拖曳/點擊事件
   */
  function init(domRefs, options = {}) {
    dom = domRefs || {};
    if (options.onPageChange) {
      viewerState.onPageChangeCallback = options.onPageChange;
    }

    // 瀏覽檔案按鈕
    if (dom.btnBrowse) {
      dom.btnBrowse.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dom.fileInput) {
          dom.fileInput.value = '';
          dom.fileInput.click();
        }
      });
    }

    // 檔案選取器
    if (dom.fileInput) {
      dom.fileInput.addEventListener('click', (e) => {
        // 重置 value，確保選取相同檔案時亦能觸發 change 事件
        e.target.value = '';
      });
      dom.fileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) handleUserFile(file);
      });
    }

    // 點擊拖曳上傳區任一處即可觸發檔案選取 (若非點擊瀏覽按鈕)
    if (dom.dropZone) {
      dom.dropZone.addEventListener('click', (e) => {
        if (dom.fileInput && (!dom.btnBrowse || !dom.btnBrowse.contains(e.target))) {
          dom.fileInput.value = '';
          dom.fileInput.click();
        }
      });
    }

    // 拖曳上傳區 (Drag & Drop) - 同時監聽上傳盒、空白預留區與舞台容器
    const dropTargets = [dom.dropZone, dom.emptyPlaceholder, dom.canvasStageWrapper].filter(t => t && typeof t.addEventListener === 'function');
    dropTargets.forEach(target => {
      ['dragenter', 'dragover'].forEach(evtName => {
        target.addEventListener(evtName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (dom.dropZone) dom.dropZone.classList.add('drag-over');
        });
      });

      ['dragleave', 'drop'].forEach(evtName => {
        target.addEventListener(evtName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (dom.dropZone) dom.dropZone.classList.remove('drag-over');
        });
      });

      target.addEventListener('drop', (e) => {
        const files = e.dataTransfer && e.dataTransfer.files;
        if (files && files.length > 0) {
          handleUserFile(files[0]);
        }
      });
    });

    // 避免拖曳檔案到瀏覽器視窗空白處時直接跳離頁面開啟檔案
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('dragover', (e) => e.preventDefault());
      window.addEventListener('drop', (e) => e.preventDefault());
    }

    // 翻頁與縮放按鈕
    if (dom.btnPrevPage) {
      dom.btnPrevPage.addEventListener('click', () => goToPage(viewerState.currentPageIndex - 1));
    }
    if (dom.btnNextPage) {
      dom.btnNextPage.addEventListener('click', () => goToPage(viewerState.currentPageIndex + 1));
    }
    if (dom.btnZoomOut) {
      dom.btnZoomOut.addEventListener('click', () => changeZoom(-15));
    }
    if (dom.btnZoomReset) {
      dom.btnZoomReset.addEventListener('click', () => resetZoom());
    }
    if (dom.btnZoomIn) {
      dom.btnZoomIn.addEventListener('click', () => changeZoom(15));
    }
  }

  function getState() {
    return viewerState;
  }

  function getCurrentPage() {
    return viewerState.pages[viewerState.currentPageIndex] || null;
  }

  /**
   * T3-2：從已儲存的 .json 專案檔資料直接還原所有頁面畫布與和弦座標
   */
  function loadFromProjectData(projectData) {
    if (!projectData || !Array.isArray(projectData.pages) || projectData.pages.length === 0) {
      setStatus('❌ 載入專案檔失敗：無有效的頁面資料', 'error');
      return false;
    }

    viewerState.fileName = projectData.fileName || '已存檔琴譜';
    viewerState.fileType = projectData.fileType || 'pdf';
    viewerState.pages = projectData.pages.map((p, idx) => ({
      pageNumber: p.pageNumber || (idx + 1),
      width: p.width || 1190,
      height: p.height || 1684,
      dataUrl: p.dataUrl,
      chords: Array.isArray(p.chords) ? p.chords : []
    }));
    viewerState.currentPageIndex = 0;
    viewerState.isLoading = false;

    renderCurrentPageToStage();
    setStatus(
      `✅ 已載入琴譜專案檔：${viewerState.fileName}（共 ${viewerState.pages.length} 頁｜含已校對之和弦座標，0 Token）`,
      'success'
    );
    return true;
  }

  return {
    init,
    getState,
    getCurrentPage,
    handleUserFile,
    loadBuiltInSample,
    loadFromProjectData,
    goToPage,
    changeZoom,
    resetZoom
  };
});
