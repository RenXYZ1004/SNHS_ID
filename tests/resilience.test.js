/**
 * Behaviour when the environment is degraded.
 *
 * Regression guards:
 *  - Export features call html2canvas, jsPDF and saveAs, all loaded from a CDN
 *    and none of them guarded. On a blocked network the globals are absent and
 *    the buttons threw an uncaught TypeError, appearing dead.
 *  - A full localStorage quota was logged to the console and otherwise ignored,
 *    so a registration could vanish on reload while appearing to have saved.
 */

const { boot } = require('./harness');

module.exports = async function (t) {

  t.section('missing CDN libraries are explained, not thrown');
  {
    // withLibs defaults to false: html2canvas / jspdf / saveAs are undefined
    const app = await boot();
    const cases = [
      ['download front PNG', () => app.ExportEngine.downloadSinglePNG('front')],
      ['download combined PNG', () => app.ExportEngine.downloadCombinedPNG()],
      ['download card PDF', () => app.ExportEngine.downloadSinglePDF()],
      ['export A4 sheet', () => app.ExportEngine.exportA4PrintPDF()],
      ['download digital ID', () => app.Portal.downloadStudentDigitalID()]
    ];
    for (const [label, fn] of cases) {
      app.clearToasts();
      let threw = null;
      try { await fn(); } catch (e) { threw = e; }
      t(label + ': no crash', threw === null, threw && threw.message);
      t(label + ': names the problem', app.toasts().some(x => /failed to load/i.test(x)),
        JSON.stringify(app.toasts()).slice(0, 70));
    }
  }

  t.section('storage failure is reported');
  {
    const app = await boot();
    app.Portal.registeredStudents = [{ id: 'x', refCode: 'SNHS-REG-2026-0001' }];

    const realSet = app.window.Storage.prototype.setItem;
    app.clearToasts();
    app.window.Storage.prototype.setItem = function () {
      const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e;
    };
    t('saveDatabase reports failure', app.Portal.saveDatabase() === false);
    t('user told storage is full', app.toasts().some(x => /out of storage/i.test(x)),
      JSON.stringify(app.toasts()).slice(0, 80));

    app.window.Storage.prototype.setItem = realSet;
    app.clearToasts();
    t('saveDatabase reports success', app.Portal.saveDatabase() === true);
    t('no toast on success', app.toasts().length === 0);
  }

  t.section('branding comes from config, not markup');
  {
    const app = await boot();
    const name = app.d.getElementById('disp-school-name').textContent.trim();
    t('school name matches config', name === app.window.APP_CONFIG.school.name, name);
    const region = app.d.getElementById('disp-region-text').textContent.trim();
    t('region matches config', region === app.window.APP_CONFIG.school.region, region);
  }

  t.section('card back has a QR and no barcode');
  {
    const app = await boot();
    const back = app.CardRenderer.createCardDOM({ lrn: '109283746501', fullName: 'Test' }, 'back', 324, 514);
    t('no barcode markup', !/barcode/i.test(back.innerHTML));
    t('QR container present', !!back.querySelector('.qr-canvas-holder'));
    t('exactly one code box', back.querySelectorAll('.qr-code-box').length === 1);
    const landscape = app.CardRenderer.createCardDOM({ lrn: '1' }, 'back', 514, 324);
    t('landscape card tagged', landscape.classList.contains('orientation-landscape'));
  }

  t.section('zoom composes with the responsive scale');
  {
    const app = await boot();
    const wrapper = app.d.getElementById('cards-wrapper');
    app.click('btn-zoom-in');
    t('zoom sets --zoom', wrapper.style.getPropertyValue('--zoom') !== '', wrapper.style.cssText);
    t('no inline transform override', !wrapper.style.transform);
  }
};
