/**
 * api/sheets.js — the server-side proxy that holds the Apps Script key.
 *
 * What this protects: the /exec URL used to be enough, on its own, to call
 * action=getStudents and receive every student record — names, LRNs,
 * birthdates, addresses, guardian phone numbers — with no authentication at
 * all. These checks pin the gate shut.
 */

const path = require('path');

function mockRes() {
  const r = { code: 0, body: null, headers: {} };
  r.status = c => { r.code = c; return r; };
  r.json = b => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  return r;
}
const req = (method, body, headers) => ({ method, body, headers: headers || {}, on() {} });

// The module reads env at load time, so re-require it under fresh settings.
function loadHandler(env) {
  const p = path.resolve(__dirname, '..', 'api', 'sheets.js');
  delete require.cache[p];
  const saved = {};
  for (const k of ['SHEETS_WEBHOOK_URL', 'SHEETS_API_KEY', 'SESSION_SECRET']) {
    saved[k] = process.env[k];
    if (env && env[k] !== undefined) process.env[k] = env[k];
    else delete process.env[k];
  }
  const handler = require(p);
  return { handler, restore: () => { for (const k in saved) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } } };
}

const CONFIGURED = {
  SHEETS_WEBHOOK_URL: 'https://script.google.com/macros/s/TEST/exec',
  SHEETS_API_KEY: 'test-key',
  SESSION_SECRET: 'test-secret-value'
};

module.exports = async function (t) {

  t.section('diagnostics');
  {
    const { handler, restore } = loadHandler(CONFIGURED);
    const res = mockRes();
    await handler(req('GET'), res);
    t('GET reports configuration', res.code === 200 && res.body.webhookConfigured === true);
    t('never leaks the key', !JSON.stringify(res.body).includes('test-key'));
    t('never leaks the session secret', !JSON.stringify(res.body).includes('test-secret-value'));
    t('never leaks the webhook URL', !JSON.stringify(res.body).includes('script.google.com'));
    restore();
  }

  t.section('unconfigured proxy fails loudly, not silently');
  {
    const { handler, restore } = loadHandler({});
    const res = mockRes();
    await handler(req('POST', { action: 'registerStudent', student: {} }), res);
    t('POST without webhook -> 501', res.code === 501, String(res.code));
    restore();
  }

  t.section('request shape');
  {
    const { handler, restore } = loadHandler(CONFIGURED);
    let res = mockRes();
    await handler(req('PUT'), res);
    t('PUT rejected', res.code === 405, String(res.code));

    res = mockRes();
    await handler(req('POST', {}), res);
    t('missing action -> 400', res.code === 400, String(res.code));

    res = mockRes();
    await handler(req('POST', { action: 'deleteEverything' }), res);
    t('unknown action -> 400', res.code === 400, String(res.code));
    restore();
  }

  t.section('reads require a staff session');
  {
    const { handler, restore } = loadHandler(CONFIGURED);

    let res = mockRes();
    await handler(req('POST', { action: 'getStudents' }), res);
    t('getStudents with no token -> 401', res.code === 401, String(res.code));

    res = mockRes();
    await handler(req('POST', { action: 'getStudents' }, { authorization: 'Bearer not.a.real.token' }), res);
    t('getStudents with junk token -> 401', res.code === 401, String(res.code));

    res = mockRes();
    await handler(req('POST', { action: 'diagnose' }), res);
    t('diagnose also gated -> 401', res.code === 401, String(res.code));
    restore();
  }

  t.section('forged and expired tokens are refused');
  {
    const { handler, restore } = loadHandler(CONFIGURED);
    const crypto = require('crypto');
    const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // Correct shape, signed with the wrong secret
    const body = b64({ u: 'attacker', r: 'Administrator', exp: Date.now() + 3600000 });
    const wrongMac = crypto.createHmac('sha256', 'not-the-secret').update(body).digest('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    let res = mockRes();
    await handler(req('POST', { action: 'getStudents', token: body + '.' + wrongMac }), res);
    t('wrong signature refused', res.code === 401, String(res.code));

    // Correctly signed but expired
    const expiredBody = b64({ u: 'admin', r: 'Administrator', exp: Date.now() - 1000 });
    const goodMac = crypto.createHmac('sha256', CONFIGURED.SESSION_SECRET).update(expiredBody).digest('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    res = mockRes();
    await handler(req('POST', { action: 'getStudents', token: expiredBody + '.' + goodMac }), res);
    t('expired session refused', res.code === 401, String(res.code));

    // Unsigned payload
    res = mockRes();
    await handler(req('POST', { action: 'getStudents', token: body }), res);
    t('unsigned token refused', res.code === 401, String(res.code));
    restore();
  }

  t.section('login requires both fields');
  {
    const { handler, restore } = loadHandler(CONFIGURED);
    const res = mockRes();
    await handler(req('POST', { action: 'authStaff', username: 'admin' }), res);
    t('missing password -> 400', res.code === 400, String(res.code));
    restore();
  }

  t.section('a sign-in wall upstream is reported, not mistaken for success');
  {
    const { handler, restore } = loadHandler(CONFIGURED);
    const realFetch = global.fetch;
    global.fetch = async () => ({ text: async () => '<!doctype html><html>accounts.google.com sign in' });
    const res = mockRes();
    await handler(req('POST', { action: 'registerStudent', student: { refCode: 'X' } }), res);
    t('non-public deployment -> 502', res.code === 502, String(res.code));
    t('says the deployment is not public', /not public/i.test(res.body.detail || ''), res.body.detail);
    global.fetch = realFetch;
    restore();
  }

  t.section('a successful login issues a usable session');
  {
    const { handler, restore } = loadHandler(CONFIGURED);
    const realFetch = global.fetch;
    global.fetch = async () => ({ text: async () => JSON.stringify({ status: 'success', authorized: true, role: 'Administrator', name: 'Registrar' }) });

    let res = mockRes();
    await handler(req('POST', { action: 'authStaff', username: 'admin', password: 'pw' }), res);
    t('login succeeds', res.code === 200 && res.body.authorized === true, JSON.stringify(res.body).slice(0, 80));
    t('token issued', typeof res.body.token === 'string' && res.body.token.indexOf('.') > 0);
    t('password not echoed back', !JSON.stringify(res.body).includes('pw"'));

    const token = res.body.token;
    global.fetch = async () => ({ text: async () => JSON.stringify({ status: 'success', students: [] }) });
    res = mockRes();
    await handler(req('POST', { action: 'getStudents' }, { authorization: 'Bearer ' + token }), res);
    t('token unlocks getStudents', res.code === 200, String(res.code));

    global.fetch = realFetch;
    restore();
  }

  t.section('the shared key is attached server-side');
  {
    const { handler, restore } = loadHandler(CONFIGURED);
    const realFetch = global.fetch;
    let sentUrl = '', sentBody = null;
    global.fetch = async (u, init) => {
      sentUrl = String(u);
      sentBody = init && init.body ? JSON.parse(init.body) : null;
      return { text: async () => JSON.stringify({ status: 'success' }) };
    };
    const res = mockRes();
    await handler(req('POST', { action: 'registerStudent', student: { refCode: 'R' } }), res);
    t('key added to the upstream call', (sentBody && sentBody.key === 'test-key') || sentUrl.indexOf('key=test-key') >= 0,
      sentUrl + ' ' + JSON.stringify(sentBody));
    t('client response carries no key', !JSON.stringify(res.body).includes('test-key'));
    global.fetch = realFetch;
    restore();
  }
};
