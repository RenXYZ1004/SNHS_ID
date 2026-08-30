/**
 * Photo and signature capture.
 *
 * Regression guards:
 *  - The cropper and signature modals are shared between the staff studio and
 *    the student wizard. Both modules once bound the same Apply button, App via
 *    addEventListener and Portal via .onclick. App ran first, applied the photo
 *    to the staff card, then nulled App.cropper -- so Portal's handler found no
 *    cropper and silently did nothing. The student's photo went to the wrong
 *    card with no thumbnail and no error.
 *  - If Cropper.js fails to load, Apply used to be a dead button and the modal
 *    could not be dismissed.
 */

const { boot } = require('./harness');

module.exports = async function (t) {
  const app = await boot();
  const { d, Portal, App, CardRenderer } = app;

  const cardPhoto0 = CardRenderer.state.photoUrl;
  const cardSig0 = CardRenderer.state.signatureUrl;

  t.section('student photo reaches the registration form');
  app.pickFile('input-reg-photo-file');
  await app.wait(300);
  t('cropper opened', d.getElementById('crop-modal').classList.contains('active'));
  t('target is student', App.cropTarget === 'student', App.cropTarget);
  app.click('btn-apply-crop');
  t('student photo set', Portal.studentForm.photoUrl === 'data:image/jpeg;base64,CROPPED_PHOTO',
    String(Portal.studentForm.photoUrl).slice(0, 40));
  t('thumbnail updated', d.getElementById('reg-preview-photo').getAttribute('src') === 'data:image/jpeg;base64,CROPPED_PHOTO');
  t('thumb marked has-image', d.getElementById('reg-photo-thumb-container').classList.contains('has-image'));
  t('staff card not contaminated', CardRenderer.state.photoUrl === cardPhoto0);

  t.section('student signature');
  app.click('btn-reg-draw-sig');
  t('target is student', App.sigTarget === 'student', App.sigTarget);
  app.click('btn-save-sig-pad');
  t('student signature set', Portal.studentForm.signatureUrl === 'data:image/png;base64,SIGDATA');
  t('staff card sig not contaminated', CardRenderer.state.signatureUrl === cardSig0);

  t.section('staff generator still works');
  app.pickFile('input-photo-file');
  await app.wait(300);
  t('target back to card', App.cropTarget === 'card', App.cropTarget);
  app.click('btn-apply-crop');
  t('staff card photo set', CardRenderer.state.photoUrl === 'data:image/jpeg;base64,CROPPED_PHOTO');
  t('student photo untouched', Portal.studentForm.photoUrl === 'data:image/jpeg;base64,CROPPED_PHOTO');
  app.click('btn-draw-sig');
  t('sig target back to card', App.sigTarget === 'card', App.sigTarget);
  app.click('btn-save-sig-pad');
  t('staff card sig set', CardRenderer.state.signatureUrl === 'data:image/png;base64,SIGDATA');

  t.section('Cropper.js unavailable (blocked CDN)');
  const noCrop = await boot({ withCropper: false });
  const before = noCrop.Portal.studentForm.photoUrl;
  noCrop.pickFile('input-reg-photo-file');
  await noCrop.wait(300);
  t('photo accepted uncropped', noCrop.Portal.studentForm.photoUrl !== before);
  t('modal not left stuck open', !noCrop.d.getElementById('crop-modal').classList.contains('active'));

  t.section('file size limit');
  t('5 MB allowed', App.validateImageFile(app.file(5 * 1024 * 1024)) === true);
  app.clearToasts();
  t('over 5 MB rejected', App.validateImageFile(app.file(5 * 1024 * 1024 + 1)) === false);
  t('names size and cap', app.toasts().some(x => /5\.0 MB/.test(x) && /Maximum is/.test(x)),
    JSON.stringify(app.toasts()));
  app.clearToasts();
  t('non-image rejected', App.validateImageFile(app.file(1000, 'application/pdf')) === false);
  t('explains not an image', app.toasts().some(x => /not an image/i.test(x)));

  const big = await boot();
  big.clearToasts();
  big.pickFile('input-reg-photo-file', big.file(9 * 1024 * 1024));
  await big.wait(150);
  t('oversized never reaches cropper', !big.d.getElementById('crop-modal').classList.contains('active'));
  t('and is explained', big.toasts().some(x => /Maximum is/.test(x)));
};
