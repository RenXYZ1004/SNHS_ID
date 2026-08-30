/**
 * blob-upload.js
 * Uploads student ID photos to Vercel Blob via the /api/upload-photo function.
 *
 * Registration must never fail because photo storage is unavailable, so every
 * error path here resolves to null and the caller keeps the local data URL.
 */

const BlobStore = {
  endpoint: '/api/upload-photo',

  // Set to false once we learn the endpoint isn't deployed, so a static-only
  // deployment doesn't retry a 404 on every single registration.
  available: true,

  // Redraws a photo at ID-card proportions before upload. The cropper already
  // outputs 400x470, but the "crop tool unavailable" fallback passes the raw
  // camera file straight through, which can be several megabytes.
  normalize(dataUrl, w = 400, h = 470) {
    return new Promise((resolve) => {
      try {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            const scale = Math.max(w / img.width, h / img.height);
            const dw = img.width * scale;
            const dh = img.height * scale;
            ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
            resolve(canvas.toDataURL('image/jpeg', 0.92));
          } catch (e) {
            resolve(dataUrl);
          }
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      } catch (e) {
        resolve(dataUrl);
      }
    });
  },

  // Returns the public blob URL, or null when the photo should stay local.
  async uploadPhoto(dataUrl, refCode) {
    if (!this.available) return null;
    if (!dataUrl || !/^data:image\//.test(dataUrl)) return null;

    try {
      const normalized = await this.normalize(dataUrl);
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: normalized, refCode: refCode })
      });

      if (res.status === 404) {
        // Static-only deployment: the function isn't there at all.
        this.available = false;
        console.warn('Photo upload endpoint not deployed; photos stay in this browser.');
        return null;
      }

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 501) {
          this.available = false;
          console.warn('Vercel Blob store not connected; photos stay in this browser.');
        } else {
          // Surface the server's reason -- a bare 502 in the console says
          // nothing about which of token / store / payload is at fault.
          const reason = (data && (data.detail || data.error)) || ('HTTP ' + res.status);
          console.warn('Photo upload failed (' + res.status + '):', reason);
          if (window.App && App.showToast) {
            App.showToast('Photo could not be stored: ' + reason, 'error');
          }
        }
        return null;
      }

      return (data && data.url) || null;
    } catch (err) {
      console.warn('Photo upload request failed:', err);
      return null;
    }
  }
};

window.BlobStore = BlobStore;
