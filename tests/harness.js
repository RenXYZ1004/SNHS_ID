/**
 * tests/harness.js
 *
 * Boots the app inside jsdom so the suites can drive real DOM events against
 * the real js/ files. No bundler and no browser required.
 *
 * Two things this deliberately handles, both of which produced false failures
 * while these tests were being written:
 *
 *  1. jsdom fires its own DOMContentLoaded once parsing finishes. If we also
 *     dispatch one, App.init() runs twice, Portal.loadDatabase() swaps the
 *     registeredStudents array mid-test, and object identity breaks. So we
 *     wait for the document to settle before evaluating any script.
 *
 *  2. Each window.eval() gets its own lexical scope, so `const App` in app.js
 *     is not reachable from a later eval. Everything is concatenated into one
 *     eval, exactly as separate <script> tags would share the global scope.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');

// Load order must match index.html
const SCRIPTS = [
  'js/config.js',
  'js/templates.js',
  'js/card-renderer.js',
  'js/blob-upload.js',
  'js/sheets-sync.js',
  'js/portal.js',
  'js/bulk-generator.js',
  'js/export-engine.js',
  'js/app.js'
];

function stubCanvas(window, dataUrl) {
  window.HTMLCanvasElement.prototype.getContext = () => ({
    fillRect() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
    stroke() {}, drawImage() {}, fillText() {}, save() {}, restore() {},
    scale() {}, translate() {}, setLineDash() {}, closePath() {}, arc() {},
    fill() {}, lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: ''
  });
  window.HTMLCanvasElement.prototype.toDataURL = () => dataUrl;
}

/**
 * @param {object} opts
 *   fetch      - replacement for window.fetch
 *   withCropper- define a stub Cropper (default true)
 *   withLibs   - define html2canvas/jsPDF/saveAs stubs (default false)
 *   canvasData - what toDataURL returns
 */
async function boot(opts) {
  opts = opts || {};

  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    .replace(/<script[^>]+src="https?:\/\/[^"]+"[^>]*><\/script>/g, '')
    .replace(/<link[^>]+href="https?:\/\/[^"]+"[^>]*>/g, '');

  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(e.message));

  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    url: 'http://127.0.0.1:8080/',
    virtualConsole: vc
  });
  const { window } = dom;
  const document = window.document;

  // See note (1) above.
  if (document.readyState !== 'complete') {
    await new Promise(r => window.addEventListener('load', r, { once: true }));
  }

  window.QRCode = function (el) { el.appendChild(document.createElement('canvas')); };
  window.QRCode.CorrectLevel = { M: 0, L: 1, Q: 2, H: 3 };
  stubCanvas(window, opts.canvasData || 'data:image/png;base64,SIGDATA');

  // Images never decode in jsdom, so fail fast and let normalize() fall back.
  // The attribute must still be written: <img> thumbnails are asserted on, and
  // an override that only schedules onerror silently drops every src.
  Object.defineProperty(window.Image.prototype, 'src', {
    set(value) {
      this.setAttribute('src', value);
      const self = this;
      setTimeout(() => self.onerror && self.onerror(), 0);
    },
    get() { return this.getAttribute('src') || ''; },
    configurable: true
  });

  if (opts.withCropper !== false) {
    window.Cropper = function (img) { this.img = img; };
    window.Cropper.prototype.getCroppedCanvas = () => ({
      toDataURL: () => 'data:image/jpeg;base64,CROPPED_PHOTO'
    });
    window.Cropper.prototype.destroy = function () {};
    window.Cropper.prototype.rotate = function () {};
  }

  if (opts.withLibs) {
    window.html2canvas = async () => ({ toBlob: cb => cb(new window.Blob([''])), toDataURL: () => 'data:image/png;base64,X', width: 10, height: 10 });
    window.jspdf = { jsPDF: function () { this.addImage = () => {}; this.save = () => {}; this.addPage = () => {}; } };
    window.saveAs = () => {};
    window.JSZip = function () {};
    window.XLSX = {};
  }

  window.fetch = opts.fetch || (() => Promise.resolve({
    ok: true, status: 200,
    json: async () => ({ status: 'success', students: [] }),
    text: async () => '{}'
  }));

  // See note (2) above.
  const bundle = SCRIPTS
    .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8'))
    .join('\n;\n');
  window.eval(bundle + '\n;window.__App = App; window.__ExportEngine = ExportEngine;');

  document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));

  return {
    window,
    d: document,
    errors,
    App: window.__App,
    ExportEngine: window.__ExportEngine,
    Portal: window.Portal,
    CardRenderer: window.CardRenderer,
    SheetsSync: window.SheetsSync,
    BlobStore: window.BlobStore,

    click: id => document.getElementById(id)
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })),

    set: (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = value;
      el.dispatchEvent(new window.Event('input', { bubbles: true }));
      el.dispatchEvent(new window.Event('change', { bubbles: true }));
    },

    pickFile: (inputId, file) => {
      const i = document.getElementById(inputId);
      const f = file || new window.File([new Uint8Array([1, 2, 3])], 'p.jpg', { type: 'image/jpeg' });
      Object.defineProperty(i, 'files', { value: [f], configurable: true });
      i.dispatchEvent(new window.Event('change', { bubbles: true }));
    },

    file: (bytes, type) => {
      const f = new window.File([new Uint8Array(1)], 'p.jpg', { type: type || 'image/jpeg' });
      Object.defineProperty(f, 'size', { value: bytes });
      return f;
    },

    toasts: () => [...document.querySelectorAll('#toast-container .toast')].map(x => x.textContent.trim()),
    clearToasts: () => document.querySelectorAll('#toast-container .toast').forEach(x => x.remove()),

    fillRegistration: function () {
      this.set('reg-lrn', '109283746501');
      this.set('reg-first-name', 'Juan');
      this.set('reg-last-name', 'Dela Cruz');
      this.set('reg-section', 'STEM-A');
      this.set('reg-birthdate', '2008-05-14');
      this.set('reg-guardian-name', 'Maria Dela Cruz');
      this.set('reg-guardian-phone', '0917-123-4567');
      this.set('reg-address', 'Brgy. Salvacion, Busuanga, Palawan');
    },

    wait: ms => new Promise(r => setTimeout(r, ms || 50)),
    activePanel: () => ([...document.querySelectorAll('.wizard-step-panel')]
      .filter(p => p.classList.contains('active')).map(p => p.id)[0] || 'NONE')
  };
}

module.exports = { boot, ROOT, SCRIPTS };
