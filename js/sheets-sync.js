/**
 * sheets-sync.js
 * Real-time Google Sheets Integration using Google Apps Script Web App.
 * Handles auto-saving student registrations, staff credential verification,
 * and fetching submissions directly from Google Sheets.
 */

const SheetsSync = {
  // Config state
  config: {
    webhookUrl: '',
    sheetName: 'Student_Registrations',
    staffSheetName: 'Staff_Accounts',
    autoSync: true,
    lastSyncTime: null
  },

  // Ready-to-use Google Apps Script Code Template
  appsScriptCode: `/**
 * SNHS ID STUDIO - Google Apps Script Backend
 * Paste this into Google Sheets > Extensions > Apps Script
 * Then click "Deploy" > "New Deployment" > Web App > Access: "Anyone".
 */

function doGet(e) {
  var action = e.parameter.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === 'getStudents') {
    var sheet = getOrCreateSheet(ss, 'Student_Registrations');
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', students: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var headers = data[0];
    var students = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        obj[headers[j]] = row[j];
      }
      students.push(obj);
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', students: students }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'authStaff') {
    var user = e.parameter.username;
    var pass = e.parameter.password;
    var staffSheet = getOrCreateSheet(ss, 'Staff_Accounts');
    var staffData = staffSheet.getDataRange().getValues();
    
    // Default admin if sheet is empty
    if (staffData.length <= 1) {
      if (user === 'admin' && pass === 'snhs2026') {
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', authorized: true, role: 'Administrator' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    for (var k = 1; k < staffData.length; k++) {
      if (String(staffData[k][0]).toLowerCase() === String(user).toLowerCase() && String(staffData[k][1]) === String(pass)) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', authorized: true, role: staffData[k][2] || 'Staff' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', authorized: false, message: 'Invalid credentials' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'SNHS Sheets API Active' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var contents = JSON.parse(e.postData.contents);
    var action = contents.action || 'registerStudent';
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'registerStudent') {
      var sheet = getOrCreateSheet(ss, 'Student_Registrations');
      
      // Check headers
      if (sheet.getLastRow() === 0) {
        sheet.appendRow([
          'Timestamp', 'RefCode', 'LRN', 'FullName', 'GradeSection', 
          'TrackStrand', 'EmergencyContact', 'EmergencyPhone', 'Address', 
          'BloodType', 'BirthDate', 'Status'
        ]);
        sheet.getRange(1, 1, 1, 12).setFontWeight('bold').setBackground('#0b2545').setFontColor('#ffffff');
      }

      var s = contents.student;
      sheet.appendRow([
        new Date().toISOString(),
        s.refCode || '',
        "'" + (s.lrn || ''),
        s.fullName || '',
        s.gradeSection || '',
        s.trackStrand || '',
        s.emergencyContact || '',
        "'" + (s.emergencyPhone || ''),
        s.address || '',
        s.bloodType || '',
        s.birthDate || '',
        s.status || 'Registered Online'
      ]);

      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Student registered in Google Sheet' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === 'Staff_Accounts') {
      sheet.appendRow(['Username', 'Password', 'Role', 'FullName']);
      sheet.appendRow(['admin', 'snhs2026', 'Administrator', 'School Registrar']);
      sheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#134074').setFontColor('#ffffff');
    }
  }
  return sheet;
}`,

  // Initialize
  init() {
    try { this.staffToken = localStorage.getItem('snhs_staff_token') || null; } catch (e) {}
    this.loadConfig();
    this.bindEvents();
    this.updateStatusIndicator();
  },

  // Server-side proxy. It holds the shared key and the /exec URL, so neither
  // ships to the browser. Set to null once we learn it is not deployed, so a
  // static-only hosting setup does not retry a 404 on every call.
  proxyUrl: '/api/sheets',
  proxyAvailable: true,
  staffToken: null,

  // Calls the proxy. Resolves { ok, data } on success, or { ok:false,
  // unavailable:true } when the proxy is simply not deployed, which tells the
  // caller to fall back to the legacy direct-to-Apps-Script path.
  async viaProxy(action, payload) {
    if (!this.proxyAvailable || !this.proxyUrl) return { ok: false, unavailable: true };

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (this.staffToken) headers['Authorization'] = 'Bearer ' + this.staffToken;

      const res = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(Object.assign({ action: action }, payload || {}))
      });

      if (res.status === 404) {
        this.proxyAvailable = false;
        console.warn('Sheets proxy not deployed; falling back to the direct Apps Script URL.');
        return { ok: false, unavailable: true };
      }

      const data = await res.json().catch(() => null);

      if (res.status === 501) {
        this.proxyAvailable = false;
        console.warn('Sheets proxy not configured (' + ((data && data.hint) || 'missing environment variables') + '); falling back to the direct URL.');
        return { ok: false, unavailable: true };
      }

      if (res.status === 401) {
        this.staffToken = null;
        try { localStorage.removeItem('snhs_staff_token'); } catch (e) {}
        return { ok: false, unauthorized: true, data: data };
      }

      if (!res.ok) return { ok: false, data: data, status: res.status };
      return { ok: true, data: data };
    } catch (err) {
      console.warn('Sheets proxy request failed:', err);
      return { ok: false, error: err };
    }
  },

  loadConfig() {
    // Check APP_CONFIG default first
    if (window.APP_CONFIG && window.APP_CONFIG.googleSheets) {
      if (window.APP_CONFIG.googleSheets.webhookUrl) {
        this.config.webhookUrl = window.APP_CONFIG.googleSheets.webhookUrl;
      }
      if (window.APP_CONFIG.googleSheets.autoSyncOnRegister !== undefined) {
        this.config.autoSync = window.APP_CONFIG.googleSheets.autoSyncOnRegister;
      }
    }

    // A URL saved from the Settings tab overrides config.js -- but only while
    // config.js still holds the URL it was saved against. Otherwise a stale
    // browser entry would silently pin the app to a dead endpoint after the
    // deployed config was updated, which is impossible to spot from the UI.
    try {
      const saved = localStorage.getItem('snhs_sheets_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        const fileUrl = (window.APP_CONFIG && window.APP_CONFIG.googleSheets && window.APP_CONFIG.googleSheets.webhookUrl) || '';

        if (parsed.configUrlAtSave && fileUrl && parsed.configUrlAtSave !== fileUrl) {
          console.warn('Saved Sheets URL was kept from an older config.js; using the current one instead.');
          delete parsed.webhookUrl;
        }
        this.config = Object.assign(this.config, parsed);
        if (fileUrl) this.config.configUrlAtSave = fileUrl;
      }
    } catch(e) {}
  },

  saveConfig() {
    try {
      // Record which config.js URL this override was saved against, so
      // loadConfig can drop it once the deployed config moves on.
      const fileUrl = (window.APP_CONFIG && window.APP_CONFIG.googleSheets && window.APP_CONFIG.googleSheets.webhookUrl) || '';
      this.config.configUrlAtSave = fileUrl;
      localStorage.setItem('snhs_sheets_config', JSON.stringify(this.config));
      this.updateStatusIndicator();
    } catch(e) {}
  },

  bindEvents() {
    const inputUrl = document.getElementById('sheets-webhook-url');
    const btnSave = document.getElementById('btn-save-sheets-config');
    const btnTest = document.getElementById('btn-test-sheets-conn');
    const btnCopyScript = document.getElementById('btn-copy-apps-script');
    const btnFetchSheets = document.getElementById('btn-fetch-from-sheets');
    const btnOpenSetupModal = document.getElementById('btn-open-sheets-setup');
    const btnCloseSetupModal = document.getElementById('btn-close-sheets-setup');

    if (inputUrl) {
      inputUrl.value = this.config.webhookUrl || '';
    }

    if (btnSave && inputUrl) {
      btnSave.addEventListener('click', () => {
        this.config.webhookUrl = inputUrl.value.trim();
        this.saveConfig();
        App.showToast('Google Sheets Webhook URL saved.', 'success');
        this.testConnection();
      });
    }

    if (btnTest) {
      btnTest.addEventListener('click', () => this.testConnection());
    }

    if (btnCopyScript) {
      btnCopyScript.addEventListener('click', () => {
        navigator.clipboard.writeText(this.appsScriptCode);
        App.showToast('Google Apps Script code copied to clipboard!', 'success');
      });
    }

    if (btnFetchSheets) {
      btnFetchSheets.addEventListener('click', () => this.fetchStudentsFromSheet());
    }

    if (btnOpenSetupModal) {
      btnOpenSetupModal.addEventListener('click', () => {
        document.getElementById('modal-sheets-setup')?.classList.add('active');
      });
    }

    if (btnCloseSetupModal) {
      btnCloseSetupModal.addEventListener('click', () => {
        document.getElementById('modal-sheets-setup')?.classList.remove('active');
      });
    }
  },

  updateStatusIndicator() {
    const indicators = document.querySelectorAll('.sheets-conn-indicator');
    const isConnected = !!(this.config.webhookUrl && this.config.webhookUrl.startsWith('http'));

    indicators.forEach(el => {
      if (isConnected) {
        el.className = 'sheets-conn-indicator connected';
        el.innerHTML = '<i class="fa-solid fa-circle-check"></i> <span>Google Sheet Connected</span>';
      } else {
        el.className = 'sheets-conn-indicator offline';
        el.innerHTML = '<i class="fa-solid fa-circle-dot"></i> <span>Local Storage (Connect Sheet)</span>';
      }
    });
  },

  // Test Webhook Connection
  async testConnection() {
    if (!this.config.webhookUrl) {
      App.showToast('Please enter a Google Apps Script Webhook URL first.', 'error');
      return;
    }

    App.showToast('Testing Google Sheets connection...', 'info');

    try {
      const testUrl = this.config.webhookUrl + (this.config.webhookUrl.includes('?') ? '&' : '?') + 'action=test&t=' + Date.now();
      const res = await fetch(testUrl, { method: 'GET', mode: 'cors' });
      const data = await res.json();

      if (data && data.status === 'success') {
        this.config.lastSyncTime = new Date().toLocaleTimeString();
        this.saveConfig();
        App.showToast('Google Sheet connection verified successfully!', 'success');
      } else {
        App.showToast('Connected, but received non-standard response from script.', 'info');
      }
    } catch (err) {
      // Fallback for CORS mode
      App.showToast('Webhook URL saved. Ready to transmit registrations.', 'success');
      this.updateStatusIndicator();
    }
  },

  // Send Single Student Registration to Google Sheet
  async sendStudentToSheet(studentData) {
    if (!this.config.webhookUrl) {
      console.warn('Google Sheets webhook not configured. Registration stored locally only.');
      App.showToast('Saved locally. No Google Sheet is connected yet.', 'error');
      return false;
    }

    try {
      const payload = {
        action: 'registerStudent',
        student: {
          refCode: studentData.refCode,
          lrn: studentData.lrn,
          fullName: studentData.fullName,
          gradeSection: studentData.gradeSection,
          trackStrand: studentData.trackStrand,
          emergencyContact: studentData.emergencyContact,
          emergencyPhone: studentData.emergencyPhone,
          address: studentData.address,
          bloodType: studentData.bloodType,
          birthDate: studentData.birthDate,
          photoUrl: studentData.hostedPhotoUrl || '',
          status: 'Submitted Online'
        }
      };

      // Preferred path: the proxy talks to Apps Script server-to-server, where
      // there is no CORS, so the script's real answer is readable and no
      // read-back guess is needed. It also means a student's browser never
      // gets an endpoint that can read the sheet.
      const viaProxy = await this.viaProxy('registerStudent', { student: payload.student });
      if (viaProxy.ok) {
        const okData = viaProxy.data;
        if (okData && okData.status === 'success') {
          this.config.lastSyncTime = new Date().toISOString();
          App.showToast('Registration saved to the Google Sheet.', 'success');
          return true;
        }
        App.showToast('Saved locally, but the Google Sheet rejected it: ' + ((okData && okData.message) || 'unknown reason'), 'error');
        return false;
      }
      if (!viaProxy.unavailable) {
        App.showToast('Saved locally, but the Google Sheet could not be reached.', 'error');
        return false;
      }

      // Apps Script answers a POST with a redirect to a googleusercontent.com
      // URL that carries no CORS headers, so this fetch rejects even when the
      // row was written. The rejection therefore tells us nothing and must be
      // ignored -- we confirm the write with a follow-up read instead.
      try {
        await fetch(this.config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
      } catch (e) {
        /* expected: opaque cross-origin redirect */
      }

      return await this.confirmStudentSaved(studentData.refCode);
    } catch(err) {
      console.warn('Sheets sync dispatch failed:', err);
      App.showToast('Saved locally, but the Google Sheet could not be reached.', 'error');
      return false;
    }
  },

  // Reads the sheet back to prove the row actually landed. Without this a
  // failed sync is invisible: the POST looks identical whether it succeeded,
  // hit a sign-in wall, or was rejected by the script.
  async confirmStudentSaved(refCode, attempts = 3) {
    for (let i = 0; i < attempts; i++) {
      await new Promise(r => setTimeout(r, 700 * (i + 1)));
      try {
        const res = await fetch(`${this.config.webhookUrl}?action=getStudents&t=${Date.now()}`);
        const data = await res.json();
        const rows = (data && data.students) || [];
        const found = rows.some(r => String(r.RefCode || r.refCode || '').trim() === String(refCode).trim());
        if (found) {
          this.config.lastSyncTime = new Date().toISOString();
          App.showToast('Registration saved to the Google Sheet.', 'success');
          return true;
        }
      } catch (e) {
        // network hiccup or sign-in wall -- retry, then report below
      }
    }

    console.warn('Sheets sync: row ' + refCode + ' was not found after posting.');
    App.showToast('Saved locally, but it did NOT reach the Google Sheet. Check the Apps Script deployment access.', 'error');
    return false;
  },

  // Fetch submitted registrations from Google Sheet
  async fetchStudentsFromSheet() {
    if (!this.config.webhookUrl) {
      App.showToast('Configure your Google Sheets Webhook URL in Settings first.', 'error');
      return;
    }

    App.showToast('Fetching latest records from Google Sheet...', 'info');

    try {
      let data = null;

      // Preferred path: through the proxy, which attaches the staff session.
      const viaProxy = await this.viaProxy('getStudents', {});
      if (viaProxy.ok) {
        data = viaProxy.data;
      } else if (viaProxy.unauthorized) {
        App.showToast('Your staff session expired. Please log in again.', 'error');
        return;
      } else if (viaProxy.unavailable) {
        const fetchUrl = this.config.webhookUrl + (this.config.webhookUrl.includes('?') ? '&' : '?') + 'action=getStudents&t=' + Date.now();
        const res = await fetch(fetchUrl);
        data = await res.json();
      } else {
        App.showToast('Could not reach the Google Sheet service.', 'error');
        return;
      }

      if (data && data.status === 'success' && Array.isArray(data.students)) {
        // The Apps Script names each field after row 1 of the sheet. If that
        // row holds a registration instead of headers, every lookup below
        // returns undefined and the import silently adds nothing -- so fall
        // back to column order, which the script always writes the same way.
        const rows = data.students;
        const headed = rows.some(r => r && (Object.prototype.hasOwnProperty.call(r, 'LRN') || Object.prototype.hasOwnProperty.call(r, 'RefCode')));

        if (!headed && rows.length) {
          console.warn('Sheet has no header row; falling back to column order.');
          App.showToast('The sheet is missing its header row - importing by column order. Add the headers to fix this properly.', 'error');
        }

        const byPosition = (row) => {
          const v = Object.values(row);
          const wide = v.length >= 13;
          return {
            Timestamp: v[0], RefCode: v[1], LRN: v[2], FullName: v[3],
            GradeSection: v[4], TrackStrand: v[5], EmergencyContact: v[6],
            EmergencyPhone: v[7], Address: v[8], BloodType: v[9], BirthDate: v[10],
            PhotoURL: wide ? v[11] : '', Status: wide ? v[12] : v[11]
          };
        };

        let addedCount = 0;
        let skipped = 0;
        rows.forEach((raw, idx) => {
          const row = headed ? raw : byPosition(raw);
          const lrn = String(row.LRN || '').replace(/^'/, '').trim();
          if (!lrn) { skipped++; return; }

          const exists = Portal.registeredStudents.some(s => s.lrn === lrn);
          if (!exists) {
            Portal.registeredStudents.unshift({
              id: 'sheets_' + Date.now() + '_' + idx,
              refCode: row.RefCode || `SNHS-REG-SHEET-${idx + 1}`,
              lrn: lrn,
              fullName: row.FullName || 'Student',
              gradeSection: row.GradeSection || 'Grade 12',
              trackStrand: row.TrackStrand || 'Academic Track',
              emergencyContact: row.EmergencyContact || 'Guardian',
              emergencyPhone: String(row.EmergencyPhone || '').replace(/^'/, ''),
              address: row.Address || 'Busuanga, Palawan',
              bloodType: row.BloodType || 'O+',
              birthDate: row.BirthDate || '2008-05-14',
              dateRegistered: row.Timestamp ? row.Timestamp.split('T')[0] : '2026-08-30',
              photoUrl: row.PhotoURL || Templates.getRandomSampleAvatar('m', idx),
              signatureUrl: Templates.getDefaultSignatureSVG(),
              status: row.Status || 'From Google Sheet'
            });
            addedCount++;
          }
        });

        Portal.saveDatabase();

        if (addedCount) {
          App.showToast(`Fetched ${addedCount} new student record${addedCount === 1 ? '' : 's'} from Google Sheets.`, 'success');
        } else if (skipped) {
          App.showToast(`${skipped} row${skipped === 1 ? '' : 's'} in the sheet had no LRN and were skipped.`, 'error');
        } else if (rows.length) {
          App.showToast('Already up to date - every sheet record is already here.', 'info');
        } else {
          App.showToast('The Google Sheet has no student records yet.', 'info');
        }
      } else {
        App.showToast('The Google Sheet returned an unexpected response.', 'error');
      }
    } catch(err) {
      console.error(err);
      App.showToast('Could not fetch from sheet. Check Webhook URL and Apps Script deployment.', 'error');
    }
  },

  // Authenticate Staff via Google Sheet or config.js credentials
  // Staff accounts live in the Staff_Accounts tab of the Google Sheet.
  // There is deliberately no local credential fallback: shipping passwords in
  // client-side JS would expose them to anyone who opens DevTools.
  async authenticateStaff(username, password) {
    // Preferred path: the proxy posts the credentials server-side and returns
    // a signed session token, so the password never appears in a URL.
    const viaProxy = await this.viaProxy('authStaff', { username: username, password: password });

    if (viaProxy.ok) {
      const data = viaProxy.data;
      if (data && data.authorized) {
        this.lastStaffRole = data.role || 'Staff';
        this.lastStaffName = data.name || username;
        this.staffToken = data.token || null;
        try {
          if (this.staffToken) localStorage.setItem('snhs_staff_token', this.staffToken);
        } catch (e) {}
        return true;
      }
      return false;
    }

    if (!viaProxy.unavailable) {
      App.showToast('Could not reach the staff account service. Check your connection.', 'error');
      return false;
    }

    // Fallback for a static-only deployment, kept so an unconfigured site still
    // works. This sends the password as a query parameter, which is why the
    // proxy exists -- configure it and this path stops being used.
    if (!this.config.webhookUrl) {
      App.showToast('Staff accounts are stored in Google Sheets. Set the Webhook URL in Settings first.', 'error');
      return false;
    }

    try {
      const authUrl = `${this.config.webhookUrl}?action=authStaff&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&t=${Date.now()}`;
      const res = await fetch(authUrl);
      const data = await res.json();

      if (data && data.status === 'success' && data.authorized) {
        this.lastStaffRole = data.role || 'Staff';
        this.lastStaffName = data.name || username;
        return true;
      }
      return false;
    } catch (e) {
      console.warn('Staff auth request failed:', e);
      App.showToast('Could not reach the staff account sheet. Check your connection.', 'error');
      return false;
    }
  }
};

window.SheetsSync = SheetsSync;
