/**
 * export-engine.js
 * High-Resolution Canvas Rasterization, PDF Generator (CR80 & A4 Multi-up Sheet),
 * and Print Layout Engine.
 */

const ExportEngine = {
  init() {
    this.bindEvents();
    this.updatePrintSheet();
  },

  bindEvents() {
    // Single Card Export Buttons
    const btnFront = document.getElementById('btn-dl-front-png');
    const btnBack = document.getElementById('btn-dl-back-png');
    const btnCombined = document.getElementById('btn-dl-combined-png');
    const btnPdf = document.getElementById('btn-dl-card-pdf');
    const btnHeaderExport = document.getElementById('btn-header-export');

    if (btnFront) btnFront.addEventListener('click', () => this.downloadSinglePNG('front'));
    if (btnBack) btnBack.addEventListener('click', () => this.downloadSinglePNG('back'));
    if (btnCombined) btnCombined.addEventListener('click', () => this.downloadCombinedPNG());
    if (btnPdf) btnPdf.addEventListener('click', () => this.downloadSinglePDF());
    if (btnHeaderExport) btnHeaderExport.addEventListener('click', () => this.downloadCombinedPNG());

    // Print Sheet Controls
    const srcSelect = document.getElementById('print-cards-source');
    const layoutSelect = document.getElementById('print-layout-style');
    const cutMarksSelect = document.getElementById('print-cut-marks');
    const btnPrint = document.getElementById('btn-trigger-print');
    const btnPrintPdf = document.getElementById('btn-export-print-pdf');

    if (srcSelect) srcSelect.addEventListener('change', () => this.updatePrintSheet());
    if (layoutSelect) layoutSelect.addEventListener('change', () => this.updatePrintSheet());
    if (cutMarksSelect) cutMarksSelect.addEventListener('change', () => this.updatePrintSheet());
    
    if (btnPrint) btnPrint.addEventListener('click', () => {
      this.updatePrintSheet();
      window.print();
    });

    if (btnPrintPdf) btnPrintPdf.addEventListener('click', () => this.exportA4PrintPDF());
  },

  // Helper to get sanitized filename
  getFileName(suffix, ext = 'png') {
    const name = (CardRenderer.state.fullName || 'Student').replace(/[^a-zA-Z0-9]/g, '_');
    const lrn = CardRenderer.state.lrn || 'ID';
    return `${lrn}_${name}_${suffix}.${ext}`;
  },

  // Download Single Side PNG (High DPI)
  async downloadSinglePNG(side = 'front') {
    const el = document.getElementById(`card-${side}-element`);
    if (!el) return;

    App.showToast(`Rendering High-Resolution ${side.toUpperCase()} card...`, 'info');

    // Temporarily ensure 3D transform doesn't distort html2canvas
    const origTransform = el.style.transform;
    el.style.transform = 'none';

    try {
      const canvas = await html2canvas(el, {
        scale: 3, // Crisp 300+ DPI
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      el.style.transform = origTransform;

      canvas.toBlob((blob) => {
        saveAs(blob, this.getFileName(side.toUpperCase()));
        App.showToast(`Downloaded ${side.toUpperCase()} card image.`, 'success');
      });
    } catch (err) {
      el.style.transform = origTransform;
      console.error(err);
      App.showToast('Failed to export image: ' + err.message, 'error');
    }
  },

  // Download Combined Dual-Side PNG
  async downloadCombinedPNG() {
    const frontEl = document.getElementById('card-front-element');
    const backEl = document.getElementById('card-back-element');
    if (!frontEl || !backEl) return;

    App.showToast('Generating Dual-Side High-Res ID...', 'info');

    const origFrontTrans = frontEl.style.transform;
    const origBackTrans = backEl.style.transform;
    frontEl.style.transform = 'none';
    backEl.style.transform = 'none';

    try {
      const [canvasFront, canvasBack] = await Promise.all([
        html2canvas(frontEl, { scale: 3, useCORS: true, backgroundColor: '#ffffff', logging: false }),
        html2canvas(backEl, { scale: 3, useCORS: true, backgroundColor: '#ffffff', logging: false })
      ]);

      frontEl.style.transform = origFrontTrans;
      backEl.style.transform = origBackTrans;

      // Merge onto a single composite canvas with padding
      const padding = 40;
      const combined = document.createElement('canvas');
      combined.width = canvasFront.width + canvasBack.width + padding * 3;
      combined.height = Math.max(canvasFront.height, canvasBack.height) + padding * 2;

      const ctx = combined.getContext('2d');
      ctx.fillStyle = '#0f172a'; // Sleek dark presentation background
      ctx.fillRect(0, 0, combined.width, combined.height);

      // Draw subtle header text
      ctx.fillStyle = '#94a3b8';
      ctx.font = '24px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`SNHS ID CARD - ${CardRenderer.state.fullName.toUpperCase()}`, padding, 28);

      // Draw cards with subtle shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 10;

      ctx.drawImage(canvasFront, padding, padding);
      ctx.drawImage(canvasBack, canvasFront.width + padding * 2, padding);

      combined.toBlob((blob) => {
        saveAs(blob, this.getFileName('COMBINED'));
        App.showToast('Downloaded Dual-Side Combined ID image.', 'success');
      });
    } catch (err) {
      frontEl.style.transform = origFrontTrans;
      backEl.style.transform = origBackTrans;
      console.error(err);
      App.showToast('Export failed: ' + err.message, 'error');
    }
  },

  // Download Standard CR80 PDF (Page 1 Front, Page 2 Back)
  async downloadSinglePDF() {
    const frontEl = document.getElementById('card-front-element');
    const backEl = document.getElementById('card-back-element');
    if (!frontEl || !backEl) return;

    App.showToast('Generating CR80 PVC Standard PDF...', 'info');

    const origFrontTrans = frontEl.style.transform;
    const origBackTrans = backEl.style.transform;
    frontEl.style.transform = 'none';
    backEl.style.transform = 'none';

    try {
      const [canvasFront, canvasBack] = await Promise.all([
        html2canvas(frontEl, { scale: 3, useCORS: true, backgroundColor: '#ffffff', logging: false }),
        html2canvas(backEl, { scale: 3, useCORS: true, backgroundColor: '#ffffff', logging: false })
      ]);

      frontEl.style.transform = origFrontTrans;
      backEl.style.transform = origBackTrans;

      const isLandscape = CardRenderer.state.orientation === 'landscape';
      const cardW = isLandscape ? 85.6 : 53.98;
      const cardH = isLandscape ? 53.98 : 85.6;

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [cardW, cardH]
      });

      // Page 1: Front
      const imgFrontData = canvasFront.toDataURL('image/png');
      pdf.addImage(imgFrontData, 'PNG', 0, 0, cardW, cardH);

      // Page 2: Back
      pdf.addPage([cardW, cardH], isLandscape ? 'landscape' : 'portrait');
      const imgBackData = canvasBack.toDataURL('image/png');
      pdf.addImage(imgBackData, 'PNG', 0, 0, cardW, cardH);

      pdf.save(this.getFileName('CR80_PVC', 'pdf'));
      App.showToast('CR80 PVC PDF downloaded successfully.', 'success');
    } catch (err) {
      frontEl.style.transform = origFrontTrans;
      backEl.style.transform = origBackTrans;
      console.error(err);
      App.showToast('PDF generation error: ' + err.message, 'error');
    }
  },

  // Update Dynamic A4 Sheet Preview
  updatePrintSheet() {
    const sheet = document.getElementById('a4-print-sheet');
    if (!sheet) return;

    const src = document.getElementById('print-cards-source')?.value || 'batch';
    const layout = document.getElementById('print-layout-style')?.value || '8-cards';
    const cutMarks = document.getElementById('print-cut-marks')?.value || 'visible';

    sheet.innerHTML = '';

    // Decide items to render
    let items = [];
    if (src === 'batch' && BulkGenerator.dataset.length > 0) {
      items = BulkGenerator.dataset;
    } else {
      // Current single card repeated
      items = Array(4).fill(CardRenderer.state);
    }

    const isCutMarks = cutMarks !== 'none';

    // Set A4 grid class based on orientation
    const isLandscape = CardRenderer.state.orientation === 'landscape';
    if (!isLandscape) {
      sheet.classList.add('grid-portrait');
    } else {
      sheet.classList.remove('grid-portrait');
    }

    // Populate Cards into Sheet
    items.slice(0, 8).forEach((item) => {
      // If layout is 8-cards (duplex pairs: Front and Back for each item)
      if (layout === '8-cards') {
        // Front
        const cellFront = document.createElement('div');
        cellFront.className = `a4-card-cell ${isCutMarks ? 'with-crop-marks' : ''}`;
        const domFront = CardRenderer.createCardDOM(item, 'front', isLandscape ? 324 : 204, isLandscape ? 204 : 324);
        cellFront.appendChild(domFront);
        sheet.appendChild(cellFront);

        // Back
        const cellBack = document.createElement('div');
        cellBack.className = `a4-card-cell ${isCutMarks ? 'with-crop-marks' : ''}`;
        const domBack = CardRenderer.createCardDOM(item, 'back', isLandscape ? 324 : 204, isLandscape ? 204 : 324);
        cellBack.appendChild(domBack);
        sheet.appendChild(cellBack);
      } else if (layout === 'front-only') {
        const cell = document.createElement('div');
        cell.className = `a4-card-cell ${isCutMarks ? 'with-crop-marks' : ''}`;
        const dom = CardRenderer.createCardDOM(item, 'front', isLandscape ? 324 : 204, isLandscape ? 204 : 324);
        cell.appendChild(dom);
        sheet.appendChild(cell);
      } else if (layout === 'back-only') {
        const cell = document.createElement('div');
        cell.className = `a4-card-cell ${isCutMarks ? 'with-crop-marks' : ''}`;
        const dom = CardRenderer.createCardDOM(item, 'back', isLandscape ? 324 : 204, isLandscape ? 204 : 324);
        cell.appendChild(dom);
        sheet.appendChild(cell);
      } else {
        // 10 cards front
        const cell = document.createElement('div');
        cell.className = `a4-card-cell ${isCutMarks ? 'with-crop-marks' : ''}`;
        const dom = CardRenderer.createCardDOM(item, 'front', isLandscape ? 324 : 204, isLandscape ? 204 : 324);
        cell.appendChild(dom);
        sheet.appendChild(cell);
      }
    });
  },

  // Export A4 Sheet as Print-Ready PDF
  async exportA4PrintPDF() {
    const sheet = document.getElementById('a4-print-sheet');
    if (!sheet) return;

    App.showToast('Rendering high-precision A4 Print PDF...', 'info');

    try {
      const canvas = await html2canvas(sheet, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('portrait', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');

      // A4 is 210 x 297 mm
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
      pdf.save(`SNHS_ID_A4_Print_Sheet_${Date.now()}.pdf`);
      App.showToast('A4 Print Sheet PDF downloaded!', 'success');
    } catch (err) {
      console.error(err);
      App.showToast('Failed to export A4 PDF: ' + err.message, 'error');
    }
  }
};

window.ExportEngine = ExportEngine;
