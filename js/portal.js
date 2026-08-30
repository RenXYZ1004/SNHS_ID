/**
 * portal.js
 * Manages the Main Menu (Landing View), User-Friendly 3-Step Student Registration,
 * Google Sheets Cloud Sync, Staff Authentication, and Registered Database.
 */

const Portal = {
  // State
  currentView: 'landing', // 'landing', 'student-portal', 'staff-dashboard'
  currentRegStep: 1, // 1, 2, or 3
  isStaffLoggedIn: false,
  registeredStudents: [],

  // Active student registration form state
  studentForm: {
    lrn: '',
    firstName: '',
    middleName: '',
    lastName: '',
    grade: 'Grade 12',
    section: '',
    strand: '',
    birthDate: '',
    bloodType: 'O+',
    gender: 'm',
    guardianName: '',
    guardianPhone: '',
    address: '',
    photoUrl: '',
    signatureUrl: ''
  },

  // Last submitted student for receipt modal
  lastSubmittedRecord: null,

  // Initialize Portal
  init() {
    this.loadDatabase();
    this.checkAuthStatus();
    this.bindNavigation();
    this.bindStudentForm();
    this.bindWizardSteps();
    this.bindStaffAuth();
    this.updateStats();
  },

  // Load registered students from localStorage
  loadDatabase() {
    try {
      const saved = localStorage.getItem('snhs_registered_students');
      if (saved) {
        this.registeredStudents = JSON.parse(saved);
      } else {
        // Seed 3 realistic pre-registered students for demo
        this.registeredStudents = [
          {
            id: 'reg_demo_1',
            refCode: 'SNHS-REG-2026-0001',
            lrn: '109283746501',
            fullName: 'Juan M. Dela Cruz',
            gradeSection: 'Grade 12 - STEM-A',
            trackStrand: 'Academic Track - STEM',
            emergencyContact: 'Maria Dela Cruz',
            emergencyPhone: '0917-123-4567',
            address: 'Brgy. Salvacion, Busuanga, Palawan',
            bloodType: 'O+',
            birthDate: '2008-05-14',
            dateRegistered: '2026-08-28',
            photoUrl: Templates.getRandomSampleAvatar('m', 1),
            signatureUrl: Templates.getDefaultSignatureSVG(),
            status: 'Approved'
          },
          {
            id: 'reg_demo_2',
            refCode: 'SNHS-REG-2026-0002',
            lrn: '109283746502',
            fullName: 'Angelica R. Santos',
            gradeSection: 'Grade 12 - ABM-B',
            trackStrand: 'Academic Track - ABM',
            emergencyContact: 'Roberto Santos',
            emergencyPhone: '0918-234-5678',
            address: 'Busuanga, Palawan',
            bloodType: 'A+',
            birthDate: '2008-08-22',
            dateRegistered: '2026-08-29',
            photoUrl: Templates.getRandomSampleAvatar('f', 2),
            signatureUrl: Templates.getDefaultSignatureSVG(),
            status: 'Pending'
          },
          {
            id: 'reg_demo_3',
            refCode: 'SNHS-REG-2026-0003',
            lrn: '109283746503',
            fullName: 'Mark Anthony D. Reyes',
            gradeSection: 'Grade 11 - HUMSS-1',
            trackStrand: 'Academic Track - HUMSS',
            emergencyContact: 'Elena Reyes',
            emergencyPhone: '0920-345-6789',
            address: 'Busuanga, Palawan',
            bloodType: 'B+',
            birthDate: '2009-01-30',
            dateRegistered: '2026-08-30',
            photoUrl: Templates.getRandomSampleAvatar('m', 3),
            signatureUrl: Templates.getDefaultSignatureSVG(),
            status: 'Pending'
          }
        ];
        this.saveDatabase();
      }
    } catch(e) {
      console.warn('Failed to load registered database:', e);
      this.registeredStudents = [];
    }
  },

  // Save to localStorage
  saveDatabase() {
    try {
      localStorage.setItem('snhs_registered_students', JSON.stringify(this.registeredStudents));
      this.updateStats();
      this.renderRegisteredTable();
      return true;
    } catch(e) {
      console.error('Storage error:', e);
      // Almost always the ~5 MB quota, filled by base64 photos. Silence here
      // means the record is gone on reload while the user thinks it saved.
      const full = e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);
      App.showToast(
        full
          ? 'This browser is out of storage. Export or clear old registrations before adding more.'
          : 'Could not save to this browser. The record may be lost when you reload.',
        'error'
      );
      this.updateStats();
      this.renderRegisteredTable();
      return false;
    }
  },

  // Update counter badges across the app
  updateStats() {
    const count = this.registeredStudents.length;
    const statHome = document.getElementById('stat-registered-count');
    const badgeNav = document.getElementById('registered-badge-count');
    const badgeTab = document.getElementById('tab-reg-count');
    const badgeOnline = document.getElementById('online-reg-count-badge');

    if (statHome) statHome.textContent = count;
    if (badgeNav) badgeNav.textContent = count;
    if (badgeTab) badgeTab.textContent = count;
    if (badgeOnline) badgeOnline.textContent = `${count} Online Submissions`;
  },

  // Check saved staff authentication session
  checkAuthStatus() {
    const auth = localStorage.getItem('snhs_staff_auth');
    if (auth === 'true') {
      this.setStaffLoggedIn(true, false);
    } else {
      this.setStaffLoggedIn(false, false);
    }
  },

  setStaffLoggedIn(status, showToast = true) {
    this.isStaffLoggedIn = status;
    localStorage.setItem('snhs_staff_auth', status ? 'true' : 'false');

    const guestState = document.getElementById('auth-guest-state');
    const staffState = document.getElementById('auth-staff-state');

    if (status) {
      if (guestState) guestState.style.display = 'none';
      if (staffState) staffState.style.display = 'flex';
      if (showToast) App.showToast('Staff Authorized. Access granted to ID Studio.', 'success');
    } else {
      if (guestState) guestState.style.display = 'block';
      if (staffState) staffState.style.display = 'none';
    }
  },

  // View Navigation
  bindNavigation() {
    const brandLink = document.getElementById('brand-home-link');
    if (brandLink) brandLink.addEventListener('click', () => this.switchView('landing'));

    const btnHome = document.getElementById('nav-btn-home');
    const btnRegister = document.getElementById('nav-btn-register');
    const btnStudio = document.getElementById('nav-btn-studio');

    if (btnHome) btnHome.addEventListener('click', () => this.switchView('landing'));
    if (btnRegister) btnRegister.addEventListener('click', () => this.switchView('student-portal'));
    
    if (btnStudio) {
      btnStudio.addEventListener('click', () => {
        if (this.isStaffLoggedIn) {
          this.switchView('staff-dashboard');
        } else {
          this.openStaffLoginModal();
        }
      });
    }

    const btnStartReg = document.getElementById('btn-start-registration');
    const btnStartStudio = document.getElementById('btn-start-studio');
    const cardReg = document.getElementById('card-goto-registration');
    const cardStudio = document.getElementById('card-goto-studio');

    if (btnStartReg) btnStartReg.addEventListener('click', () => this.switchView('student-portal'));
    if (cardReg) cardReg.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON') this.switchView('student-portal');
    });

    if (btnStartStudio) {
      btnStartStudio.addEventListener('click', () => {
        if (this.isStaffLoggedIn) {
          this.switchView('staff-dashboard');
        } else {
          this.openStaffLoginModal();
        }
      });
    }
    if (cardStudio) {
      cardStudio.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') {
          if (this.isStaffLoggedIn) {
            this.switchView('staff-dashboard');
          } else {
            this.openStaffLoginModal();
          }
        }
      });
    }

    const btnBack1 = document.getElementById('btn-back-to-home-1');
    if (btnBack1) btnBack1.addEventListener('click', () => this.switchView('landing'));
  },

  // Switch Active View
  switchView(viewName) {
    this.currentView = viewName;

    document.querySelectorAll('.portal-nav-btn').forEach(btn => {
      const isTarget = btn.dataset.view === viewName;
      btn.classList.toggle('active', isTarget);
    });

    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active');
    });

    const targetSec = document.getElementById(`view-${viewName}`);
    if (targetSec) {
      targetSec.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (viewName === 'student-portal') {
      this.goToWizardStep(1);
      this.initStudentPortalPreview();
    } else if (viewName === 'staff-dashboard') {
      this.renderRegisteredTable();
      CardRenderer.render();
    }
  },

  // =========================================================================
  // USER-FRIENDLY MULTI-STEP WIZARD
  // =========================================================================
  bindWizardSteps() {
    const btnNext1 = document.getElementById('btn-wiz-next-1');
    const btnPrev2 = document.getElementById('btn-wiz-prev-2');
    const btnNext2 = document.getElementById('btn-wiz-next-2');
    const btnPrev3 = document.getElementById('btn-wiz-prev-3');

    if (btnNext1) {
      btnNext1.addEventListener('click', () => {
        // Validate Step 1
        const lrn = document.getElementById('reg-lrn')?.value.trim();
        const firstName = document.getElementById('reg-first-name')?.value.trim();
        const lastName = document.getElementById('reg-last-name')?.value.trim();
        const section = document.getElementById('reg-section')?.value.trim();

        if (!lrn || lrn.length < 10) {
          App.showToast('Please enter your 12-digit LRN number.', 'error');
          document.getElementById('reg-lrn')?.focus();
          return;
        }
        if (!firstName || !lastName || !section) {
          App.showToast('Please complete your name and section before continuing.', 'error');
          return;
        }

        this.goToWizardStep(2);
      });
    }

    if (btnPrev2) btnPrev2.addEventListener('click', () => this.goToWizardStep(1));
    if (btnNext2) btnNext2.addEventListener('click', () => this.goToWizardStep(3));
    if (btnPrev3) btnPrev3.addEventListener('click', () => this.goToWizardStep(2));

    // Wizard Step Pills
    document.querySelectorAll('.wizard-step-item').forEach(pill => {
      pill.addEventListener('click', () => {
        const step = parseInt(pill.dataset.step, 10);
        if (step) this.goToWizardStep(step);
      });
    });
  },

  // Called by App when the shared cropper / signature pad was opened
  // on behalf of the student registration wizard.
  setStudentPhoto(dataUrl) {
    this.studentForm.photoUrl = dataUrl;
    const thumb = document.getElementById('reg-preview-photo');
    const thumbBox = document.getElementById('reg-photo-thumb-container');
    if (thumb) thumb.src = dataUrl;
    if (thumbBox) thumbBox.classList.add('has-image');
    this.updateStudentPortalPreview();
  },

  setStudentSignature(dataUrl) {
    this.studentForm.signatureUrl = dataUrl;
    const thumb = document.getElementById('reg-preview-sig');
    const thumbBox = document.getElementById('reg-sig-thumb-container');
    if (thumb) thumb.src = dataUrl;
    if (thumbBox) thumbBox.classList.add('has-image');
    this.updateStudentPortalPreview();
  },

  goToWizardStep(stepNumber) {
    this.currentRegStep = stepNumber;

    // Update Step panels
    for (let i = 1; i <= 3; i++) {
      const panel = document.getElementById(`wizard-panel-${i}`);
      const pill = document.getElementById(`wiz-step-pill-${i}`);
      const isCurrent = i === stepNumber;
      const isPast = i < stepNumber;

      if (panel) panel.classList.toggle('active', isCurrent);
      if (pill) {
        pill.classList.toggle('active', isCurrent);
        pill.classList.toggle('completed', isPast);
      }
    }

    // Update connector lines
    const line1 = document.getElementById('wiz-line-1');
    const line2 = document.getElementById('wiz-line-2');
    if (line1) line1.classList.toggle('active', stepNumber >= 2);
    if (line2) line2.classList.toggle('active', stepNumber >= 3);

    this.updateStudentPortalPreview();
  },

  // =========================================================================
  // STUDENT REGISTRATION FORM LOGIC
  // =========================================================================
  bindStudentForm() {
    this.studentForm.photoUrl = Templates.getDefaultAvatarSVG();
    this.studentForm.signatureUrl = Templates.getDefaultSignatureSVG();

    const form = document.getElementById('student-reg-form');
    if (!form) return;

    const fieldMap = [
      { id: 'reg-lrn', key: 'lrn' },
      { id: 'reg-first-name', key: 'firstName' },
      { id: 'reg-middle-name', key: 'middleName' },
      { id: 'reg-last-name', key: 'lastName' },
      { id: 'reg-grade', key: 'grade' },
      { id: 'reg-section', key: 'section' },
      { id: 'reg-strand', key: 'strand' },
      { id: 'reg-birthdate', key: 'birthDate' },
      { id: 'reg-blood-type', key: 'bloodType' },
      { id: 'reg-guardian-name', key: 'guardianName' },
      { id: 'reg-guardian-phone', key: 'guardianPhone' },
      { id: 'reg-address', key: 'address' }
    ];

    fieldMap.forEach(item => {
      const el = document.getElementById(item.id);
      if (el) {
        el.addEventListener('input', () => {
          this.studentForm[item.key] = el.value;
          this.updateStudentPortalPreview();
        });
        el.addEventListener('change', () => {
          this.studentForm[item.key] = el.value;
          this.updateStudentPortalPreview();
        });
      }
    });

    // Student Photo Upload
    const btnPhotoUpload = document.getElementById('btn-reg-upload-photo');
    const photoInput = document.getElementById('input-reg-photo-file');
    if (btnPhotoUpload && photoInput) {
      btnPhotoUpload.addEventListener('click', () => photoInput.click());
      photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && App.validateImageFile(file)) {
          const reader = new FileReader();
          reader.onload = (ev) => App.openCropperModal(ev.target.result, 'student');
          reader.readAsDataURL(file);
          e.target.value = '';
        }
      });
    }

    // Student Webcam
    const btnRegWebcam = document.getElementById('btn-reg-webcam');
    if (btnRegWebcam) {
      btnRegWebcam.addEventListener('click', () => {
        App.openWebcamModal('student');
      });
    }

    // Student Signature
    const btnRegDrawSig = document.getElementById('btn-reg-draw-sig');
    const btnRegUploadSig = document.getElementById('btn-reg-upload-sig');
    const sigInput = document.getElementById('input-reg-sig-file');

    if (btnRegDrawSig) {
      btnRegDrawSig.addEventListener('click', () => App.openSigModal('student'));
    }

    if (btnRegUploadSig && sigInput) {
      btnRegUploadSig.addEventListener('click', () => sigInput.click());
      sigInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && App.validateImageFile(file)) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            this.studentForm.signatureUrl = ev.target.result;
            const thumb = document.getElementById('reg-preview-sig');
            const thumbBox = document.getElementById('reg-sig-thumb-container');
            if (thumb) thumb.src = ev.target.result;
            if (thumbBox) thumbBox.classList.add('has-image');
            this.updateStudentPortalPreview();
            App.showToast('Signature uploaded.', 'success');
          };
          reader.readAsDataURL(file);
          e.target.value = '';
        }
      });
    }

    // Form Submit
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleStudentSubmit();
    });

    // Receipt Modal Close & Download
    const btnCloseReceipt = document.getElementById('btn-close-reg-success');
    const btnDoneReceipt = document.getElementById('btn-done-reg-success');
    const btnDlReceipt = document.getElementById('btn-download-my-digital-id');

    if (btnCloseReceipt) btnCloseReceipt.addEventListener('click', () => this.closeReceiptModal());
    if (btnDoneReceipt) btnDoneReceipt.addEventListener('click', () => {
      this.closeReceiptModal();
      this.switchView('landing');
    });

    if (btnDlReceipt) {
      btnDlReceipt.addEventListener('click', () => this.downloadStudentDigitalID());
    }
  },

  studentPreviewSide: 'front', // 'front', 'back', 'both'

  // Initialize and Render Live Student ID Card Preview
  initStudentPortalPreview() {
    // Bind Student Live Preview Front/Back buttons
    const btnFront = document.getElementById('btn-student-view-front');
    const btnBack = document.getElementById('btn-student-view-back');
    const btnBoth = document.getElementById('btn-student-view-both');

    const updateBtns = (activeBtn) => {
      [btnFront, btnBack, btnBoth].forEach(b => {
        if (b) b.classList.remove('active');
      });
      if (activeBtn) activeBtn.classList.add('active');
    };

    if (btnFront) {
      btnFront.onclick = () => {
        this.studentPreviewSide = 'front';
        updateBtns(btnFront);
        this.updateStudentPortalPreview();
      };
    }
    if (btnBack) {
      btnBack.onclick = () => {
        this.studentPreviewSide = 'back';
        updateBtns(btnBack);
        this.updateStudentPortalPreview();
      };
    }
    if (btnBoth) {
      btnBoth.onclick = () => {
        this.studentPreviewSide = 'both';
        updateBtns(btnBoth);
        this.updateStudentPortalPreview();
      };
    }

    // Bind Receipt Download buttons
    const btnDlFront = document.getElementById('btn-dl-receipt-front');
    const btnDlBack = document.getElementById('btn-dl-receipt-back');

    if (btnDlFront) {
      btnDlFront.onclick = () => this.downloadReceiptCardSide('front');
    }
    if (btnDlBack) {
      btnDlBack.onclick = () => this.downloadReceiptCardSide('back');
    }

    this.updateStudentPortalPreview();
  },

  updateStudentPortalPreview() {
    const target = document.getElementById('student-card-preview-target');
    if (!target) return;

    const fullName = `${this.studentForm.firstName || ''} ${this.studentForm.middleName || ''} ${this.studentForm.lastName || ''}`.trim() || 'Juan M. Dela Cruz';
    const gradeSection = `${this.studentForm.grade || 'Grade 12'} - ${this.studentForm.section || 'STEM-A'}`;

    const studentData = {
      fullName: fullName,
      lrn: this.studentForm.lrn || '109283746501',
      idNumber: 'SNHS-2026-REG',
      gradeSection: gradeSection,
      trackStrand: this.studentForm.strand || 'Academic Track - STEM',
      bloodType: this.studentForm.bloodType || 'O+',
      birthDate: this.studentForm.birthDate || '2008-05-14',
      emergencyContact: this.studentForm.guardianName || 'Maria Dela Cruz',
      emergencyPhone: this.studentForm.guardianPhone || '0917-123-4567',
      address: this.studentForm.address || 'Brgy. Salvacion, Busuanga, Palawan',
      photoUrl: this.studentForm.photoUrl || Templates.getDefaultAvatarSVG(),
      signatureUrl: this.studentForm.signatureUrl || Templates.getDefaultSignatureSVG(),
      idType: 'STUDENT',
      primaryColor: '#0b2545',
      secondaryColor: '#134074',
      accentColor: '#d4af37'
    };

    target.innerHTML = '';

    if (this.studentPreviewSide === 'both') {
      const container = document.createElement('div');
      container.style.display = 'flex';
      container.style.gap = '12px';
      container.style.justifyContent = 'center';
      container.style.flexWrap = 'wrap';

      const frontDom = CardRenderer.createCardDOM(studentData, 'front', 260, 412);
      const backDom = CardRenderer.createCardDOM(studentData, 'back', 260, 412);

      container.appendChild(frontDom);
      container.appendChild(backDom);
      target.appendChild(container);
    } else {
      const cardSide = this.studentPreviewSide === 'back' ? 'back' : 'front';
      const dom = CardRenderer.createCardDOM(studentData, cardSide, 280, 444);
      target.appendChild(dom);
    }
  },

  // Handle Registration Form Submission
  async handleStudentSubmit() {
    const lrn = document.getElementById('reg-lrn')?.value.trim();
    const firstName = document.getElementById('reg-first-name')?.value.trim();
    const lastName = document.getElementById('reg-last-name')?.value.trim();
    const middleName = document.getElementById('reg-middle-name')?.value.trim() || '';
    const grade = document.getElementById('reg-grade')?.value;
    const section = document.getElementById('reg-section')?.value.trim();
    const strand = document.getElementById('reg-strand')?.value.trim() || 'General Academic';
    const birthDate = document.getElementById('reg-birthdate')?.value;
    const bloodType = document.getElementById('reg-blood-type')?.value;
    const guardianName = document.getElementById('reg-guardian-name')?.value.trim();
    const guardianPhone = document.getElementById('reg-guardian-phone')?.value.trim();
    const address = document.getElementById('reg-address')?.value.trim();

    if (!lrn || lrn.length < 10) {
      App.showToast('Please enter a valid 12-digit LRN number.', 'error');
      this.goToWizardStep(1);
      return;
    }
    if (!firstName || !lastName || !section || !guardianName || !guardianPhone || !address) {
      App.showToast('Please complete all required fields (*).', 'error');
      return;
    }

    const fullName = `${firstName} ${middleName} ${lastName}`.replace(/\s+/g, ' ').trim();
    const gradeSection = `${grade} - ${section}`;
    const nextSeq = String(this.nextRefSequence()).padStart(4, '0');
    const refCode = `SNHS-REG-2026-${nextSeq}`;
    const idNumber = `SNHS-2026-${nextSeq}`;

    const newRecord = {
      id: 'reg_' + Date.now(),
      refCode: refCode,
      lrn: lrn,
      idNumber: idNumber,
      fullName: fullName,
      gradeSection: gradeSection,
      trackStrand: strand,
      emergencyContact: guardianName,
      emergencyPhone: guardianPhone,
      address: address,
      bloodType: bloodType,
      birthDate: birthDate,
      dateRegistered: new Date().toISOString().split('T')[0],
      photoUrl: this.studentForm.photoUrl || Templates.getDefaultAvatarSVG(),
      signatureUrl: this.studentForm.signatureUrl || Templates.getDefaultSignatureSVG(),
      status: 'Synced to Google Sheet'
    };

    // Save to Local Database
    this.registeredStudents.unshift(newRecord);
    this.saveDatabase();

    // Auto-append to Bulk Generator dataset
    BulkGenerator.dataset.unshift({
      ...newRecord,
      idType: 'STUDENT'
    });
    BulkGenerator.renderTable();
    BulkGenerator.renderBatchGrid();
    BulkGenerator.updateCounter();

    this.lastSubmittedRecord = newRecord;

    // Store the photo in Vercel Blob before showing the receipt, so the submit
    // button can report progress rather than the upload happening invisibly.
    // The card renders from the local data URL either way, so a failed or
    // unconfigured upload never blocks a registration.
    if (window.BlobStore && this.studentForm.photoUrl) {
      this.setSubmitBusy(true, 'Uploading photo...');
      try {
        const hostedUrl = await BlobStore.uploadPhoto(this.studentForm.photoUrl, refCode);
        if (hostedUrl) {
          newRecord.hostedPhotoUrl = hostedUrl;
          this.saveDatabase();
          App.showToast('Photo uploaded to secure storage.', 'success');
        }
      } finally {
        this.setSubmitBusy(false);
      }
    }

    this.openReceiptModal(newRecord);

    // 🚀 Send directly to Google Sheet in Cloud
    if (window.SheetsSync) {
      SheetsSync.sendStudentToSheet(newRecord);
    }
  },

  // Spinner + locked submit button while a registration is being uploaded.
  setSubmitBusy(busy, label) {
    const btn = document.getElementById('btn-submit-registration');
    if (!btn) return;

    if (busy) {
      if (this._submitBtnHtml === undefined) this._submitBtnHtml = btn.innerHTML;
      btn.disabled = true;
      btn.classList.add('is-busy');
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>' + (label || 'Working...') + '</span>';
    } else {
      btn.disabled = false;
      btn.classList.remove('is-busy');
      if (this._submitBtnHtml !== undefined) btn.innerHTML = this._submitBtnHtml;
    }
  },

  // Next reference number, derived from the highest sequence already issued
  // rather than the record count -- deleting a record used to make the next
  // registration reuse a live reference code.
  nextRefSequence() {
    let highest = 0;
    for (const rec of this.registeredStudents) {
      const m = /(\d+)\s*$/.exec(String(rec && rec.refCode || ''));
      if (m) highest = Math.max(highest, parseInt(m[1], 10) || 0);
    }
    return highest + 1;
  },

  // Open Receipt Modal showing both Front and Back cards
  openReceiptModal(record) {
    const modal = document.getElementById('modal-reg-success');
    const codeEl = document.getElementById('receipt-ref-code');
    const stage = document.getElementById('receipt-card-stage');
    if (!modal) return;

    if (codeEl) codeEl.textContent = record.refCode;

    if (stage) {
      stage.innerHTML = '';
      const frontDom = CardRenderer.createCardDOM(record, 'front', 250, 396);
      frontDom.id = 'receipt-front-card';
      const backDom = CardRenderer.createCardDOM(record, 'back', 250, 396);
      backDom.id = 'receipt-back-card';

      stage.appendChild(frontDom);
      stage.appendChild(backDom);
    }

    modal.classList.add('active');
  },

  closeReceiptModal() {
    const modal = document.getElementById('modal-reg-success');
    if (modal) modal.classList.remove('active');
  },

  // Download Front or Back of ID from receipt modal
  async downloadReceiptCardSide(side) {
    if (!App.requireLibs('html2canvas', 'saveAs')) return;
    if (!this.lastSubmittedRecord) return;
    const cardEl = document.getElementById(side === 'back' ? 'receipt-back-card' : 'receipt-front-card');
    if (!cardEl) return;

    App.showToast(`Generating ${side.toUpperCase()} ID image...`, 'info');

    try {
      const canvas = await html2canvas(cardEl, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      canvas.toBlob((blob) => {
        saveAs(blob, `${this.lastSubmittedRecord.lrn}_${this.lastSubmittedRecord.fullName.replace(/\s+/g, '_')}_${side.toUpperCase()}.png`);
        App.showToast(`${side.toUpperCase()} ID downloaded successfully!`, 'success');
      });
    } catch(e) {
      console.error(e);
      App.showToast('Failed to generate image: ' + e.message, 'error');
    }
  },

  // Download Combined Front + Back Digital ID (PNG)
  async downloadStudentDigitalID() {
    if (!App.requireLibs('html2canvas', 'saveAs')) return;
    if (!this.lastSubmittedRecord) return;
    const stage = document.getElementById('receipt-card-stage');
    if (!stage) return;

    App.showToast('Generating high-resolution Combined (Front + Back) ID...', 'info');

    try {
      const canvas = await html2canvas(stage, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#0a0f1d',
        logging: false
      });

      canvas.toBlob((blob) => {
        saveAs(blob, `${this.lastSubmittedRecord.lrn}_${this.lastSubmittedRecord.fullName.replace(/\s+/g, '_')}_FULL_ID_SET.png`);
        App.showToast('Full ID set (Front & Back) downloaded!', 'success');
      });
    } catch(e) {
      console.error(e);
      App.showToast('Failed to generate card image: ' + e.message, 'error');
    }
  },

  // =========================================================================
  // STAFF AUTHENTICATION & LOGIN MODAL
  // =========================================================================
  bindStaffAuth() {
    const btnOpenLogin = document.getElementById('btn-open-staff-login');
    const btnCloseLogin = document.getElementById('btn-close-staff-login');
    const btnCancelLogin = document.getElementById('btn-cancel-staff-login');
    const btnSubmitLogin = document.getElementById('btn-submit-staff-login');
    const btnLogout = document.getElementById('btn-staff-logout');

    if (btnOpenLogin) btnOpenLogin.addEventListener('click', () => this.openStaffLoginModal());
    if (btnCloseLogin) btnCloseLogin.addEventListener('click', () => this.closeStaffLoginModal());
    if (btnCancelLogin) btnCancelLogin.addEventListener('click', () => this.closeStaffLoginModal());

    // Submit Staff Login Form with Google Sheets credential check
    if (btnSubmitLogin) {
      btnSubmitLogin.addEventListener('click', async () => {
        const u = document.getElementById('login-username')?.value.trim();
        const p = document.getElementById('login-password')?.value;

        if (!u || !p) {
          App.showToast('Enter both your staff username and password.', 'error');
          return;
        }

        btnSubmitLogin.disabled = true;
        App.showToast('Verifying staff credentials...', 'info');

        let isAuth = false;
        try {
          isAuth = await SheetsSync.authenticateStaff(u, p);
        } finally {
          btnSubmitLogin.disabled = false;
        }

        if (isAuth) {
          const pwField = document.getElementById('login-password');
          if (pwField) pwField.value = '';
          this.setStaffLoggedIn(true);
          this.closeStaffLoginModal();
          this.switchView('staff-dashboard');
        } else {
          App.showToast('Invalid username or password.', 'error');
        }
      });
    }

    // Logout
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        this.setStaffLoggedIn(false);
        this.switchView('landing');
        App.showToast('Logged out of Staff Portal.', 'info');
      });
    }

    // Transfer All Registered to Batch Print Button
    const btnQueueAll = document.getElementById('btn-queue-all-to-batch');
    if (btnQueueAll) {
      btnQueueAll.addEventListener('click', () => {
        if (this.registeredStudents.length === 0) {
          App.showToast('No registered students to transfer.', 'error');
          return;
        }
        BulkGenerator.dataset = this.registeredStudents.map(s => ({
          ...s,
          idType: 'STUDENT'
        }));
        BulkGenerator.renderTable();
        BulkGenerator.renderBatchGrid();
        BulkGenerator.updateCounter();
        App.switchTab('bulk');
        App.showToast(`Transferred ${this.registeredStudents.length} registered students to Batch Print Queue!`, 'success');
      });
    }

    // Clear Registered DB
    const btnClearDB = document.getElementById('btn-clear-registered-db');
    if (btnClearDB) {
      btnClearDB.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all registered student submissions?')) {
          this.registeredStudents = [];
          this.saveDatabase();
          App.showToast('Registered submissions cleared.', 'info');
        }
      });
    }
  },

  openStaffLoginModal() {
    const modal = document.getElementById('modal-staff-login');
    if (modal) modal.classList.add('active');
  },

  closeStaffLoginModal() {
    const modal = document.getElementById('modal-staff-login');
    if (modal) modal.classList.remove('active');
  },

  // =========================================================================
  // STAFF REGISTERED STUDENTS DATA TABLE
  // =========================================================================
  renderRegisteredTable() {
    const tbody = document.getElementById('registered-table-body');
    if (!tbody) return;

    if (this.registeredStudents.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 2.5rem; color: var(--text-dim);">
            <i class="fa-solid fa-user-clock" style="font-size: 2rem; margin-bottom: 0.5rem; display:block;"></i>
            No student online registrations submitted yet. Students can register via the "Student Registration" portal.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.registeredStudents.map((row, index) => `
      <tr data-id="${row.id}">
        <td style="color: var(--text-dim); font-weight: bold;">${index + 1}</td>
        <td>
          <img src="${row.photoUrl}" class="tbl-photo-thumb" alt="Photo">
        </td>
        <td><strong style="font-family: var(--font-mono); color: var(--accent);">${row.lrn}</strong></td>
        <td><strong style="color:#fff;">${row.fullName}</strong><br><small style="color:var(--text-dim); font-size:0.68rem;">Ref: ${row.refCode || '-'}</small></td>
        <td>${row.gradeSection}</td>
        <td><small style="color:var(--text-muted);">${row.trackStrand}</small></td>
        <td>${row.emergencyContact}</td>
        <td>${row.emergencyPhone}</td>
        <td><span class="status-indicator ready"><i class="fa-solid fa-circle-check"></i> ${row.status || 'Active'}</span></td>
        <td>
          <div style="display: flex; gap: 4px;">
            <button class="btn btn-sm btn-primary" title="Open in Studio" onclick="Portal.loadRegisteredToStudio('${row.id}')">
              <i class="fa-solid fa-id-card"></i>
            </button>
            <button class="btn btn-sm btn-ghost" title="Delete" onclick="Portal.deleteRegisteredStudent('${row.id}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  // Load a submitted student into the Single Studio
  loadRegisteredToStudio(id) {
    const student = this.registeredStudents.find(s => s.id === id);
    if (!student) return;

    CardRenderer.state.fullName = student.fullName;
    CardRenderer.state.lrn = student.lrn;
    CardRenderer.state.idNumber = student.idNumber || 'SNHS-2026-001';
    CardRenderer.state.gradeSection = student.gradeSection;
    CardRenderer.state.trackStrand = student.trackStrand;
    CardRenderer.state.bloodType = student.bloodType;
    CardRenderer.state.birthDate = student.birthDate;
    CardRenderer.state.photoUrl = student.photoUrl;
    CardRenderer.state.signatureUrl = student.signatureUrl || Templates.getDefaultSignatureSVG();
    CardRenderer.state.emergencyContact = student.emergencyContact;
    CardRenderer.state.emergencyPhone = student.emergencyPhone;
    CardRenderer.state.address = student.address;

    App.syncStateToForm();
    CardRenderer.render();
    App.switchTab('single');
    App.showToast(`Loaded ${student.fullName} into Single Studio.`, 'info');
  },

  deleteRegisteredStudent(id) {
    this.registeredStudents = this.registeredStudents.filter(s => s.id !== id);
    this.saveDatabase();
    App.showToast('Student submission removed.', 'info');
  }
};

window.Portal = Portal;
