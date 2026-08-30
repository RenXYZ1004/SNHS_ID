/**
 * api/upload-photo.js — the serverless endpoint that writes ID photos to
 * Vercel Blob. Runs the real handler against a mock req/res; no network is
 * needed except the final case, which lets a bad token reach Vercel so the
 * error path is exercised for real.
 */

const path = require('path');
const handler = require(path.resolve(__dirname, '..', 'api', 'upload-photo.js'));

function mockRes() {
  const r = { code: 0, body: null, headers: {} };
  r.status = c => { r.code = c; return r; };
  r.json = b => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  return r;
}
const req = (method, body) => ({ method, body, on() {} });

module.exports = async function (t) {
  const original = process.env.BLOB_READ_WRITE_TOKEN;

  t.section('diagnostic endpoint');
  delete process.env.BLOB_READ_WRITE_TOKEN;
  let res = mockRes();
  await handler(req('GET'), res);
  t('GET returns 200', res.code === 200, String(res.code));
  t('reports missing token', res.body.tokenPresent === false);
  t('never leaks a token value', !JSON.stringify(res.body).includes('vercel_blob_rw_'));

  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_AbC_secretpart';
  res = mockRes();
  await handler(req('GET'), res);
  t('reports token present', res.body.tokenPresent === true && res.body.tokenLooksValid === true);
  t('still no token in body', !JSON.stringify(res.body).includes('secretpart'));

  res = mockRes();
  await handler(req('PUT'), res);
  t('PUT rejected', res.code === 405, String(res.code));

  t.section('configuration');
  delete process.env.BLOB_READ_WRITE_TOKEN;
  res = mockRes();
  await handler(req('POST', { dataUrl: 'data:image/jpeg;base64,AAAA' }), res);
  t('no store -> 501 not 500', res.code === 501, String(res.code));
  t('501 explains itself', /not configured/i.test(res.body.error));

  t.section('input validation');
  process.env.BLOB_READ_WRITE_TOKEN = 'fake';
  const bad = [
    ['missing dataUrl', {}, 400],
    ['plain URL', { dataUrl: 'https://evil.example/x.jpg' }, 400],
    ['html payload', { dataUrl: 'data:text/html;base64,PHNjcmlwdD4=' }, 415],
    ['svg (stored XSS vector)', { dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' }, 415],
    ['oversized', { dataUrl: 'data:image/jpeg;base64,' + 'A'.repeat(3600000) }, 413]
  ];
  for (const [label, body, expected] of bad) {
    res = mockRes();
    await handler(req('POST', body), res);
    t(label + ' -> ' + expected, res.code === expected, String(res.code));
  }

  t.section('upstream failure');
  res = mockRes();
  await handler(req('POST', { dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==', refCode: 'R1' }), res);
  t('bad token -> 502, no throw', res.code === 502, String(res.code));
  t('detail passed to the client', !!res.body.detail, JSON.stringify(res.body).slice(0, 60));

  if (original === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
  else process.env.BLOB_READ_WRITE_TOKEN = original;
};
