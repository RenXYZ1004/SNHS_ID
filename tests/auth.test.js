/**
 * Staff authentication.
 *
 * Regression guards:
 *  - The login shipped three passwords inside client-side JavaScript
 *    (APP_CONFIG.staffCredentials), pre-filled admin/snhs2026 into the form,
 *    printed the same pair on screen as a hint, and offered a "1-Click Demo
 *    Login" button that granted staff access with no credential check at all.
 *  - Credentials went to Apps Script as URL query parameters, landing in
 *    execution logs and browser history. They now go through api/sheets.js as
 *    a POST body, and the direct URL is only used when that proxy is absent.
 */

const { boot } = require('./harness');

const PROXY = '/api/sheets';

module.exports = async function (t) {

  t.section('no credentials in the shipped page');
  {
    const app = await boot();
    const { d, window } = app;
    t('demo login button gone', !d.getElementById('btn-demo-quick-login'));
    t('demo hint gone', !/Demo Login/i.test(d.body.innerHTML));
    t('username not pre-filled', d.getElementById('login-username').value === '');
    t('password not pre-filled', d.getElementById('login-password').value === '');
    t('APP_CONFIG has no staffCredentials', window.APP_CONFIG.staffCredentials === undefined);
  }

  t.section('authentication goes through the proxy');
  {
    const calls = [];
    let reply = { status: 'success', authorized: true, role: 'Administrator', name: 'Registrar', token: 'tok.abc' };
    const app = await boot({
      fetch: (u, o) => {
        calls.push({ url: String(u), body: o && o.body ? JSON.parse(o.body) : null, headers: (o && o.headers) || {} });
        return Promise.resolve({ ok: true, status: 200, json: async () => reply });
      }
    });

    const ok = await app.SheetsSync.authenticateStaff('admin', 'realpw');
    t('valid credentials accepted', ok === true);
    t('posted to the proxy', calls[0] && calls[0].url.indexOf(PROXY) >= 0, calls[0] && calls[0].url);
    t('action sent in the body', calls[0] && calls[0].body.action === 'authStaff');
    t('password not in the URL', calls[0] && calls[0].url.indexOf('realpw') < 0, calls[0] && calls[0].url);
    t('session token stored', app.SheetsSync.staffToken === 'tok.abc', String(app.SheetsSync.staffToken));

    reply = { status: 'error', authorized: false };
    t('wrong password rejected', (await app.SheetsSync.authenticateStaff('admin', 'wrong')) === false);
  }

  t.section('staff token is attached to reads');
  {
    const calls = [];
    const app = await boot({
      fetch: (u, o) => {
        calls.push({ url: String(u), headers: (o && o.headers) || {} });
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: 'success', students: [] }) });
      }
    });
    app.SheetsSync.staffToken = 'tok.xyz';
    await app.SheetsSync.viaProxy('getStudents', {});
    t('sends Authorization header', calls[0] && calls[0].headers['Authorization'] === 'Bearer tok.xyz',
      JSON.stringify(calls[0] && calls[0].headers));
  }

  t.section('expired session is discarded');
  {
    const app = await boot({
      fetch: () => Promise.resolve({ ok: false, status: 401, json: async () => ({ error: 'Staff sign-in required.' }) })
    });
    app.SheetsSync.staffToken = 'stale';
    const r = await app.SheetsSync.viaProxy('getStudents', {});
    t('reports unauthorized', r.unauthorized === true);
    t('clears the stale token', app.SheetsSync.staffToken === null);
  }

  t.section('falls back to the direct URL when the proxy is absent');
  {
    const calls = [];
    const app = await boot({
      fetch: (u, o) => {
        const url = String(u);
        calls.push(url);
        if (url.indexOf(PROXY) >= 0) return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
        return Promise.resolve({ ok: true, json: async () => ({ status: 'success', authorized: true, role: 'Staff', name: 'x' }) });
      }
    });
    const ok = await app.SheetsSync.authenticateStaff('admin', 'pw');
    t('still authenticates', ok === true);
    t('used the direct Apps Script URL', calls.some(u => /action=authStaff/.test(u)), calls.join(' | '));
    t('stops retrying the proxy', app.SheetsSync.proxyAvailable === false);
  }

  t.section('retired demo passwords no longer work');
  {
    const app = await boot({
      fetch: () => Promise.resolve({ ok: true, status: 200, json: async () => ({ status: 'error', authorized: false }) })
    });
    for (const [u, p] of [['admin', 'snhs2026'], ['faculty', 'faculty2026'], ['principal', 'principal2026'], ['staff', '123456']]) {
      t(u + '/' + p + ' rejected', (await app.SheetsSync.authenticateStaff(u, p)) === false);
    }
  }

  t.section('fails closed');
  {
    const app = await boot({ fetch: () => Promise.reject(new Error('network down')) });
    app.SheetsSync.proxyAvailable = false; // force the legacy path
    t('offline: no local fallback', (await app.SheetsSync.authenticateStaff('admin', 'snhs2026')) === false);

    const app2 = await boot({ fetch: () => Promise.resolve({ ok: false, status: 404, json: async () => ({}) }) });
    app2.SheetsSync.config.webhookUrl = '';
    t('no proxy and no webhook: refuses', (await app2.SheetsSync.authenticateStaff('admin', 'snhs2026')) === false);
  }
};
