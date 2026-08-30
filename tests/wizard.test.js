/**
 * Registration wizard: step navigation, validation, and where the
 * back-of-ID fields live.
 *
 * Regression guard: goToWizardStep once built element ids with
 * `wizard-panel-i`.replace('i', i), which replaced the first "i" -- the one in
 * "wizard" -- and looked up "w1zard-panel-i". getElementById returned null,
 * the `if (panel)` guard swallowed it, and Continue silently did nothing.
 */

const { boot } = require('./harness');

module.exports = async function (t) {
  const app = await boot();
  const { d, Portal } = app;

  t.section('navigation');
  app.fillRegistration();
  t('starts on step 1', app.activePanel() === 'wizard-panel-1', app.activePanel());
  app.click('btn-wiz-next-1');
  t('Continue -> step 2', app.activePanel() === 'wizard-panel-2', app.activePanel());
  app.click('btn-wiz-next-2');
  t('Continue -> step 3', app.activePanel() === 'wizard-panel-3', app.activePanel());
  app.click('btn-wiz-prev-3');
  t('Back -> step 2', app.activePanel() === 'wizard-panel-2', app.activePanel());
  app.click('btn-wiz-prev-2');
  t('Back -> step 1', app.activePanel() === 'wizard-panel-1', app.activePanel());

  t.section('validation');
  app.set('reg-lrn', '12');
  app.clearToasts();
  app.click('btn-wiz-next-1');
  t('short LRN blocks advance', app.activePanel() === 'wizard-panel-1', app.activePanel());
  t('and says why', app.toasts().some(x => /12-digit LRN/i.test(x)), JSON.stringify(app.toasts()));
  app.set('reg-lrn', '109283746501');

  app.set('reg-first-name', '');
  app.clearToasts();
  app.click('btn-wiz-next-1');
  t('missing name blocks advance', app.activePanel() === 'wizard-panel-1');
  app.set('reg-first-name', 'Juan');

  t.section('forms ship empty');
  const fresh = await boot();
  const perStudent = ['reg-lrn', 'reg-first-name', 'reg-last-name', 'reg-section',
    'reg-guardian-name', 'reg-guardian-phone', 'reg-address',
    'input-full-name', 'input-lrn', 'input-address'];
  for (const id of perStudent) {
    const el = fresh.d.getElementById(id);
    t(id + ' is blank', el && el.value === '', el ? JSON.stringify(el.value) : 'missing');
  }
  const schoolWide = fresh.d.getElementById('input-principal-name');
  t('school-wide config kept', schoolWide && schoolWide.value.length > 0);

  t.section('back-of-ID fields live in step 3');
  const inPanel3 = id => {
    const el = d.getElementById(id);
    return !!el && !!el.closest('#wizard-panel-3');
  };
  t('date of birth in step 3', inPanel3('reg-birthdate'));
  t('blood type in step 3', inPanel3('reg-blood-type'));
  t('guardian in step 3', inPanel3('reg-guardian-name'));

  const ids = [...d.querySelectorAll('[id]')].map(e => e.id);
  const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
  t('no duplicate element ids', dupes.length === 0, dupes.join(','));

  t.section('reference codes stay unique');
  Portal.registeredStudents = [
    { id: 'a', refCode: 'SNHS-REG-2026-0001' },
    { id: 'b', refCode: 'SNHS-REG-2026-0002' },
    { id: 'c', refCode: 'SNHS-REG-2026-0003' }
  ];
  t('3 records -> next is 4', Portal.nextRefSequence() === 4, String(Portal.nextRefSequence()));
  Portal.registeredStudents = Portal.registeredStudents.filter(s => s.id !== 'b');
  t('after delete -> no reuse', Portal.nextRefSequence() === 4, String(Portal.nextRefSequence()));
  Portal.registeredStudents = [];
  t('empty -> 1', Portal.nextRefSequence() === 1);
  Portal.registeredStudents = [{ refCode: 'garbage' }, { refCode: null }, {}];
  t('malformed refCodes tolerated', Portal.nextRefSequence() === 1);
};
