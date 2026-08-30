/**
 * api/sheets.js
 *
 * Server-side proxy between the browser and the Google Apps Script web app.
 *
 * WHY THIS EXISTS
 * The Apps Script /exec URL used to sit in js/config.js, which ships to every
 * visitor and is committed to a public repository. Because the script accepts
 * anonymous requests, anyone holding that URL could call
 *   GET <exec>?action=getStudents
 * and receive every student record: full names, LRNs, birthdates, home
 * addresses, guardian names and phone numbers. They could also POST fabricated
 * registrations into the sheet.
 *
 * All sheet traffic now goes through this function, which holds the shared key
 * in SHEETS_API_KEY and adds it server-side. The browser never sees the key or
 * the /exec URL, and once the Apps Script is configured to demand the key, this
 * function is the only caller it will accept.
 *
 * Reads are gated further: registering is public (any student may enrol), but
 * getStudents requires a short-lived token issued on a successful staff login
 * and signed with SESSION_SECRET.
 *
 * A second benefit: server-to-server calls have no CORS, so the Apps Script's
 * real reply is readable here. In the browser it was opaque, which is why the
 * old code had to guess at success.
 *
 * Environment:
 *   SHEETS_WEBHOOK_URL  the Apps Script /exec URL
 *   SHEETS_API_KEY      shared secret, also set as API_KEY in the script's
 *                       Script Properties
 *   SESSION_SECRET      random string used to sign staff session tokens
 */

const crypto = require('crypto');

const WEBHOOK = process.env.SHEETS_WEBHOOK_URL || '';
const API_KEY = process.env.SHEETS_API_KEY || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';

const SESSION_HOURS = 8;
const PUBLIC_ACTIONS = ['registerStudent', 'authStaff'];
const STAFF_ACTIONS = ['getStudents', 'diagnose'];

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(str) {
  return Buffer.from(String(str).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function issueToken(username, role) {
  const payload = { u: username, r: role, exp: Date.now() + SESSION_HOURS * 3600 * 1000 };
  const body = b64url(JSON.stringify(payload));
  const mac = b64url(crypto.createHmac('sha256', SESSION_SECRET).update(body).digest());
  return body + '.' + mac;
}

function verifyToken(token) {
  if (!token || !SESSION_SECRET) return null;
  const parts = String(token).split('.');
  if (parts.length !== 2) return null;

  const expected = b64url(crypto.createHmac('sha256', SESSION_SECRET).update(parts[0]).digest());
  const a = Buffer.from(parts[1]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(unb64url(parts[0]));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try { return Promise.resolve(JSON.parse(req.body)); } catch (e) { return Promise.resolve(null); }
  }
  return new Promise(resolve => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 2_000_000) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch (e) { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}

async function callScript(params, postBody) {
  const url = new URL(WEBHOOK);
  Object.keys(params || {}).forEach(k => url.searchParams.set(k, params[k]));
  if (API_KEY) url.searchParams.set('key', API_KEY);

  const init = postBody
    ? {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({}, postBody, API_KEY ? { key: API_KEY } : {}))
      }
    : { method: 'GET' };

  // Server to server: the redirect to googleusercontent.com is followed and
  // the body is readable, unlike the opaque response a browser would get.
  const res = await fetch(url.toString(), init);
  const text = await res.text();

  if (/<!doctype html|accounts\.google\.com/i.test(text.slice(0, 400))) {
    const err = new Error('The Apps Script deployment is not public - it redirected to a Google sign-in page.');
    err.code = 'NOT_PUBLIC';
    throw err;
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    const err = new Error('The Apps Script returned a non-JSON response.');
    err.code = 'BAD_RESPONSE';
    throw err;
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      endpoint: 'alive',
      webhookConfigured: !!WEBHOOK,
      keyConfigured: !!API_KEY,
      sessionsConfigured: !!SESSION_SECRET,
      publicActions: PUBLIC_ACTIONS,
      staffActions: STAFF_ACTIONS
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!WEBHOOK) {
    return res.status(501).json({
      error: 'Sheets proxy not configured',
      hint: 'Set SHEETS_WEBHOOK_URL (and SHEETS_API_KEY, SESSION_SECRET) in the project environment.'
    });
  }

  const body = await readBody(req);
  if (!body || !body.action) {
    return res.status(400).json({ error: 'Expected JSON body with an action field' });
  }

  const action = String(body.action);
  if (PUBLIC_ACTIONS.indexOf(action) < 0 && STAFF_ACTIONS.indexOf(action) < 0) {
    return res.status(400).json({ error: 'Unknown action: ' + action });
  }

  // Reads are staff-only. A student registering never gains read access.
  if (STAFF_ACTIONS.indexOf(action) >= 0) {
    if (!SESSION_SECRET) {
      return res.status(501).json({ error: 'SESSION_SECRET is not set, so staff sessions cannot be verified.' });
    }
    const header = req.headers && (req.headers.authorization || req.headers.Authorization);
    const token = header ? String(header).replace(/^Bearer\s+/i, '') : body.token;
    if (!verifyToken(token)) {
      return res.status(401).json({ error: 'Staff sign-in required.' });
    }
  }

  try {
    if (action === 'registerStudent') {
      const result = await callScript(null, { action: 'registerStudent', student: body.student || {} });
      return res.status(200).json(result);
    }

    if (action === 'authStaff') {
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      if (!username || !password) {
        return res.status(400).json({ status: 'error', authorized: false, message: 'Username and password are required.' });
      }

      // Sent as a POST body rather than a query string so the password stays
      // out of URLs, proxy logs and Apps Script execution history.
      const result = await callScript(null, { action: 'authStaff', username, password });

      if (result && result.authorized) {
        if (!SESSION_SECRET) {
          return res.status(501).json({ status: 'error', authorized: false, message: 'SESSION_SECRET is not set, so a session cannot be issued.' });
        }
        return res.status(200).json({
          status: 'success',
          authorized: true,
          role: result.role || 'Staff',
          name: result.name || username,
          token: issueToken(username, result.role || 'Staff'),
          expiresInHours: SESSION_HOURS
        });
      }
      return res.status(200).json({ status: 'error', authorized: false, message: 'Invalid username or password.' });
    }

    // getStudents / diagnose
    const result = await callScript({ action, t: Date.now() });
    return res.status(200).json(result);

  } catch (err) {
    const code = err && err.code === 'NOT_PUBLIC' ? 502 : 502;
    console.error('Sheets proxy failed:', err);
    return res.status(code).json({ error: 'Sheets request failed', detail: String(err && err.message || err) });
  }
};
