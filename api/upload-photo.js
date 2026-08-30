/**
 * api/upload-photo.js
 *
 * Vercel Serverless Function: stores a student ID photo in Vercel Blob and
 * returns its public URL.
 *
 * The browser sends the cropped photo as a data URL. Keeping the upload on the
 * server means the Blob write token never reaches the client -- BLOB_READ_WRITE_TOKEN
 * is injected by Vercel when a Blob store is connected to the project.
 *
 * Request : POST { dataUrl: "data:image/jpeg;base64,...", refCode: "SNHS-REG-..." }
 * Response: 200 { url }  |  501 not configured  |  4xx/5xx { error }
 */

const { put } = require('@vercel/blob');

// Vercel caps a serverless request body at 4.5 MB. Photos are normalised to
// 400x470 JPEG in the browser (~100 KB as base64), so this ceiling is generous
// and exists only to reject obviously wrong input.
const MAX_BASE64_CHARS = 3_500_000;

const ALLOWED = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try { return Promise.resolve(JSON.parse(req.body)); } catch (e) { return Promise.resolve(null); }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > MAX_BASE64_CHARS + 5000) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch (e) { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}

function slug(value, fallback) {
  const cleaned = String(value || '').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 60);
  return cleaned || fallback;
}

module.exports = async function handler(req, res) {
  // GET reports whether the function and its token are wired up, so a failing
  // upload can be diagnosed without posting an image. Never returns the token.
  if (req.method === 'GET') {
    const token = process.env.BLOB_READ_WRITE_TOKEN || '';
    return res.status(200).json({
      ok: true,
      endpoint: 'alive',
      tokenPresent: !!token,
      tokenLooksValid: /^vercel_blob_rw_/.test(token),
      tokenLength: token.length,
      node: process.version
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Without a Blob store connected there is nothing to write to. Say so
  // explicitly so the client can fall back instead of guessing.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(501).json({
      error: 'Blob store not configured',
      hint: 'Create a Blob store in the Vercel dashboard and connect it to this project.'
    });
  }

  const body = await readJsonBody(req);
  if (!body || !body.dataUrl) {
    return res.status(400).json({ error: 'Expected JSON body with a dataUrl field' });
  }

  const match = /^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/.exec(String(body.dataUrl));
  if (!match) {
    return res.status(400).json({ error: 'dataUrl must be a base64 data URL' });
  }

  const contentType = match[1];
  const base64 = match[2];
  const ext = ALLOWED[contentType];

  if (!ext) {
    return res.status(415).json({ error: 'Unsupported image type: ' + contentType });
  }
  if (base64.length > MAX_BASE64_CHARS) {
    return res.status(413).json({ error: 'Image too large' });
  }

  let buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch (e) {
    return res.status(400).json({ error: 'Malformed base64 image data' });
  }
  if (!buffer.length) {
    return res.status(400).json({ error: 'Empty image data' });
  }

  const name = slug(body.refCode, 'student') + '-' + Date.now() + '.' + ext;

  try {
    const blob = await put('student-photos/' + name, buffer, {
      access: 'public',
      contentType,
      addRandomSuffix: true
    });
    return res.status(200).json({ url: blob.url, pathname: blob.pathname });
  } catch (err) {
    console.error('Blob upload failed:', err);
    return res.status(502).json({ error: 'Blob upload failed', detail: String(err && err.message || err) });
  }
};
