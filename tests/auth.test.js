/**
 * Staff authentication.
 *
 * Regression guard: the login shipped three passwords inside client-side
 * JavaScript (APP_CONFIG.staffCredentials), pre-filled admin/snhs2026 into the
 * form, printed the same pair on screen as a hint, and offered a "1-Click Demo
 * Login" button that granted staff access with no credential check at all.
 * Accounts now live in the Staff_Accounts sheet tab, with no local fallback --
 * a fallback would mean shipping passwords to every visitor again.
 */

const { boot } = require('./harness');

module.exports = async function (t) {
  let reply = { status: 'error', authorized: false };
  let lastUrl = '';
  let shouldThrow = false;

  const app = await boot({
    fetch: u => {
      lastUrl = String(u);
      if (shouldThrow) return Promise.reject(new Error('network down'));
      return Promise.resolve({ ok: true, json: async () => reply, text: async () => JSON.stringify(reply) });
    }
  });
  const { d, SheetsSync, window } = app;

  t.section('no credentials in the shipped page');
  t('demo login button gone', !d.getElementById('btn-demo-quick-login'));
  t('demo hint gone', !/Demo Login/i.test(d.body.innerHTML));
  t('username not pre-filled', d.getElementById('login-username').value === '',
    JSON.stringify(d.getElementById('login-username').value));
  t('password not pre-filled', d.getElementById('login-password').value === '',
    JSON.stringify(d.getElementById('login-password').value));
  t('APP_CONFIG has no staffCredentials', window.APP_CONFIG.staffCredentials === undefined);

  t.section('authentication goes to the sheet');
  reply = { status: 'success', authorized: true, role: 'Administrator', name: 'School Registrar' };
  t('valid credentials accepted', (await SheetsSync.authenticateStaff('admin', 'realpw')) === true);
  t('calls the authStaff action', /action=authStaff/.test(lastUrl));

  reply = { status: 'error', authorized: false };
  t('wrong password rejected', (await SheetsSync.authenticateStaff('admin', 'wrong')) === false);

  t.section('retired demo passwords no longer work');
  for (const [u, p] of [['admin', 'snhs2026'], ['faculty', 'faculty2026'], ['principal', 'principal2026'], ['staff', '123456']]) {
    t(u + '/' + p + ' rejected', (await SheetsSync.authenticateStaff(u, p)) === false);
  }

  t.section('fails closed');
  shouldThrow = true;
  t('offline: no local fallback', (await SheetsSync.authenticateStaff('admin', 'snhs2026')) === false);
  shouldThrow = false;

  const saved = SheetsSync.config.webhookUrl;
  SheetsSync.config.webhookUrl = '';
  t('no webhook: refuses login', (await SheetsSync.authenticateStaff('admin', 'snhs2026')) === false);
  SheetsSync.config.webhookUrl = saved;
};
