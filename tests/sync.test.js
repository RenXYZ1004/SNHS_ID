/**
 * Google Sheets sync and Vercel Blob photo storage.
 *
 * Regression guards:
 *  - SheetsSync.init() was never called from App.init(), so loadConfig() never
 *    ran and the webhook URL configured in config.js never reached
 *    SheetsSync.config. Every registration returned early and was stored only
 *    in localStorage, with nothing sent anywhere.
 *  - sendStudentToSheet swallowed every outcome in .catch(() => {}) and always
 *    returned true, so a sync blocked by a sign-in wall looked like success.
 *  - A URL saved from the Settings tab overrode config.js forever, pinning the
 *    app to a dead endpoint after the deployed config moved on.
 */

const { boot } = require('./harness');

module.exports = async function (t) {

  t.section('webhook config actually loads');
  {
    const calls = [];
    const app = await boot({
      fetch: (u, o) => {
        calls.push({ url: String(u), method: (o && o.method) || 'GET' });
        if (o && o.method === 'POST') return Promise.reject(new Error('opaque redirect'));
        return Promise.resolve({ ok: true, json: async () => ({ status: 'success', students: [] }) });
      }
    });
    t('config.js URL reaches SheetsSync',
      app.SheetsSync.config.webhookUrl === app.window.APP_CONFIG.googleSheets.webhookUrl,
      JSON.stringify(app.SheetsSync.config.webhookUrl));
    t('auto-sync enabled', app.SheetsSync.config.autoSync === true);
  }

  t.section('registration goes through the proxy');
  {
    const calls = [];
    const app = await boot({
      fetch: (u, o) => {
        calls.push({ url: String(u), body: o && o.body ? JSON.parse(o.body) : null });
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: 'success', message: 'saved' }) });
      }
    });
    app.clearToasts();
    const ok = await app.SheetsSync.sendStudentToSheet({ refCode: 'SNHS-REG-TEST-1', lrn: '1', fullName: 'A' });
    t('returns true', ok === true);
    t('posted to /api/sheets', calls[0] && calls[0].url.indexOf('/api/sheets') >= 0, calls[0] && calls[0].url);
    t('action in the body', calls[0] && calls[0].body.action === 'registerStudent');
    t('no read-back needed', calls.length === 1, String(calls.length));
    t('success reported', app.toasts().some(x => /saved to the Google Sheet/i.test(x)), JSON.stringify(app.toasts()));
  }

  t.section('proxy reports a rejected write');
  {
    const app = await boot({
      fetch: () => Promise.resolve({ ok: true, status: 200, json: async () => ({ status: 'error', message: 'bad key' }) })
    });
    app.clearToasts();
    const ok = await app.SheetsSync.sendStudentToSheet({ refCode: 'SNHS-REG-TEST-2', lrn: '2', fullName: 'B' });
    t('returns false', ok === false);
    t('reason surfaced', app.toasts().some(x => /rejected it/i.test(x)), JSON.stringify(app.toasts()));
  }

  t.section('legacy fallback still confirms by read-back');
  {
    const rows = [];
    const app = await boot({
      fetch: (u, o) => {
        const url = String(u);
        if (url.indexOf('/api/sheets') >= 0) return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
        if (o && o.method === 'POST') {
          rows.push(JSON.parse(o.body).student.refCode);
          return Promise.reject(new Error('opaque redirect'));
        }
        return Promise.resolve({ ok: true, json: async () => ({ status: 'success', students: rows.map(r => ({ RefCode: r })) }) });
      }
    });
    app.clearToasts();
    const ok = await app.SheetsSync.sendStudentToSheet({ refCode: 'SNHS-REG-TEST-3', lrn: '3', fullName: 'C' });
    t('returns true via fallback', ok === true);
    t('success reported', app.toasts().some(x => /saved to the Google Sheet/i.test(x)), JSON.stringify(app.toasts()));
  }

  t.section('legacy fallback reports a vanished write');
  {
    const app = await boot({
      fetch: (u, o) => {
        const url = String(u);
        if (url.indexOf('/api/sheets') >= 0) return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
        if (o && o.method === 'POST') return Promise.reject(new Error('opaque redirect'));
        return Promise.resolve({ ok: true, json: async () => ({ status: 'success', students: [] }) });
      }
    });
    app.clearToasts();
    const ok = await app.SheetsSync.sendStudentToSheet({ refCode: 'SNHS-REG-TEST-4', lrn: '4', fullName: 'D' });
    t('returns false', ok === false);
    t('failure surfaced', app.toasts().some(x => /did NOT reach the Google Sheet/i.test(x)), JSON.stringify(app.toasts()));
  }

  t.section('no webhook configured');
  {
    const app = await boot();
    app.SheetsSync.config.webhookUrl = '';
    app.clearToasts();
    const ok = await app.SheetsSync.sendStudentToSheet({ refCode: 'X' });
    t('returns false', ok === false);
    t('tells the user', app.toasts().some(x => /No Google Sheet is connected/i.test(x)));
  }

  t.section('blob photo storage');
  {
    let mode = 'ok';
    const uploads = [];
    const sheetRows = [];
    const app = await boot({
      fetch: (u, o) => {
        const url = String(u);
        if (url.indexOf('/api/upload-photo') >= 0) {
          uploads.push(JSON.parse(o.body));
          if (mode === 'ok') return Promise.resolve({ ok: true, status: 200, json: async () => ({ url: 'https://blob.example/x.jpg' }) });
          if (mode === '404') return Promise.resolve({ ok: false, status: 404, json: async () => ({ error: 'nf' }) });
          if (mode === '501') return Promise.resolve({ ok: false, status: 501, json: async () => ({ error: 'not configured' }) });
          return Promise.reject(new Error('offline'));
        }
        if (o && o.method === 'POST') { sheetRows.push(JSON.parse(o.body)); return Promise.reject(new Error('opaque')); }
        return Promise.resolve({ ok: true, json: async () => ({ status: 'success', students: sheetRows.map(r => ({ RefCode: r.student.refCode })) }) });
      }
    });

    app.fillRegistration();
    app.Portal.studentForm.photoUrl = 'data:image/jpeg;base64,PHOTO';
    await app.Portal.handleStudentSubmit();
    await app.wait(60);

    const rec = app.Portal.registeredStudents[0];
    const stored = JSON.parse(app.window.localStorage.getItem('snhs_registered_students') || '[]');
    t('upload attempted', uploads.length === 1, String(uploads.length));
    t('photo normalized first', uploads[0] && /^data:image\//.test(uploads[0].dataUrl));
    t('hosted URL on record', rec.hostedPhotoUrl === 'https://blob.example/x.jpg', String(rec.hostedPhotoUrl));
    t('hosted URL persisted', stored[0] && stored[0].hostedPhotoUrl === 'https://blob.example/x.jpg');
    t('sheet payload carries it', sheetRows.length > 0 && sheetRows[sheetRows.length - 1].student.photoUrl === 'https://blob.example/x.jpg');

    t.section('blob storage unavailable never blocks registration');
    mode = '501'; app.BlobStore.available = true;
    app.fillRegistration();
    app.Portal.studentForm.photoUrl = 'data:image/jpeg;base64,P2';
    let n = app.Portal.registeredStudents.length;
    await app.Portal.handleStudentSubmit();
    await app.wait(60);
    t('501: registration still succeeds', app.Portal.registeredStudents.length === n + 1);
    t('501: marks itself unavailable', app.BlobStore.available === false);

    mode = '404'; app.BlobStore.available = true;
    app.fillRegistration();
    app.Portal.studentForm.photoUrl = 'data:image/jpeg;base64,P3';
    n = app.Portal.registeredStudents.length;
    await app.Portal.handleStudentSubmit();
    await app.wait(60);
    t('404: registration still succeeds', app.Portal.registeredStudents.length === n + 1);
    t('404: stops retrying', app.BlobStore.available === false);

    mode = 'throw'; app.BlobStore.available = true;
    t('network error resolves null', (await app.BlobStore.uploadPhoto('data:image/jpeg;base64,Z', 'R')) === null);
  }

  t.section('upload progress is visible');
  {
    let release;
    const app = await boot({
      fetch: (u, o) => {
        if (String(u).indexOf('/api/upload-photo') >= 0) {
          return new Promise(r => { release = () => r({ ok: true, status: 200, json: async () => ({ url: 'https://blob.example/y.jpg' }) }); });
        }
        if (o && o.method === 'POST') return Promise.reject(new Error('opaque'));
        return Promise.resolve({ ok: true, json: async () => ({ status: 'success', students: [] }) });
      }
    });
    app.fillRegistration();
    app.Portal.studentForm.photoUrl = 'data:image/jpeg;base64,PHOTO';
    const btn = app.d.getElementById('btn-submit-registration');
    const submitting = app.Portal.handleStudentSubmit();
    await app.wait(60);
    t('submit locked during upload', btn.disabled === true);
    t('spinner shown', /fa-spin/.test(btn.innerHTML));
    t('says Uploading photo', /Uploading photo/.test(btn.textContent), btn.textContent.trim());
    t('receipt held back', !app.d.getElementById('modal-reg-success').classList.contains('active'));
    release();
    await submitting;
    await app.wait(40);
    t('submit re-enabled', btn.disabled === false);
    t('label restored', /Submit Registration/.test(btn.textContent), btn.textContent.trim());
    t('receipt shown after', app.d.getElementById('modal-reg-success').classList.contains('active'));
  }
};
