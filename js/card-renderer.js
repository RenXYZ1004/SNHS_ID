/**
 * card-renderer.js
 * Core engine for real-time ID card DOM updates, QR code generation,
 * background rendering, and multi-orientation management.
 */

const CardRenderer = {
  // Current Active Card Data State
  state: {
    fullName: 'Juan M. Dela Cruz',
    idType: 'STUDENT',
    lrn: '109283746501',
    idNumber: 'SNHS-2026-001',
    gradeSection: 'Grade 12 - STEM-A',
    trackStrand: 'Academic Track - STEM',
    bloodType: 'O+',
    birthDate: '2008-05-14',
    schoolYear: 'S.Y. 2025 - 2026',
    
    photoUrl: '',
    signatureUrl: '',
    principalSigUrl: '',

    emergencyContact: 'Maria Dela Cruz',
    emergencyPhone: '0917-123-4567',
    address: 'Brgy. San Nicolas, Pasig City',

    principalName: 'DR. EMMA R. SANTOS, CESO V',
    principalTitle: 'Secondary School Principal IV',

    // Institution Branding
    countryText: 'REPUBLIC OF THE PHILIPPINES',
    deptText: 'DEPARTMENT OF EDUCATION',
    regionText: 'REGION IV-A CALABARZON',
    schoolName: 'SAN NICOLAS NATIONAL HIGH SCHOOL',
    schoolAddress: 'San Nicolas, Pasig City • School ID: 301425',
    leftLogoUrl: '',
    rightLogoUrl: '',

    // Design Tokens
    preset: 'snhs-deped',
    primaryColor: '#0b2545',
    secondaryColor: '#134074',
    accentColor: '#d4af37',
    orientation: 'portrait', // 'portrait' or 'landscape'
    showHologram: true,
    showGuilloche: true,
    showMicrotext: true
  },

  // QR Code Instance
  qrInstance: null,

  // Rendered QR bitmap size in px (CSS scales it to the card box)
  QR_SIZE: 220,

  // Initialize
  init() {
    // Read from APP_CONFIG if available
    if (window.APP_CONFIG && window.APP_CONFIG.school) {
      const sch = window.APP_CONFIG.school;
      this.state.countryText = sch.country || this.state.countryText;
      this.state.deptText = sch.department || this.state.deptText;
      this.state.regionText = sch.region || this.state.regionText;
      this.state.schoolName = sch.name || this.state.schoolName;
      this.state.schoolAddress = sch.address || this.state.schoolAddress;
      this.state.schoolYear = sch.schoolYear || this.state.schoolYear;
      if (sch.principal) {
        this.state.principalName = sch.principal.name || this.state.principalName;
        this.state.principalTitle = sch.principal.title || this.state.principalTitle;
      }
    }
    if (window.APP_CONFIG && window.APP_CONFIG.theme) {
      const th = window.APP_CONFIG.theme;
      this.state.primaryColor = th.primaryColor || this.state.primaryColor;
      this.state.secondaryColor = th.secondaryColor || this.state.secondaryColor;
      this.state.accentColor = th.accentColor || this.state.accentColor;
    }

    // Initialize default vector assets
    this.state.photoUrl = Templates.getDefaultAvatarSVG();
    this.state.signatureUrl = Templates.getDefaultSignatureSVG();
    this.state.principalSigUrl = Templates.getPrincipalSignatureSVG();
    this.state.leftLogoUrl = Templates.getDepEdLogoSVG();
    this.state.rightLogoUrl = Templates.getSchoolSealSVG(this.state.accentColor, this.state.primaryColor);

    this.applyThemeColors();
    this.render();
  },

  // Format Date of Birth helper
  formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      }
    } catch(e) {}
    return dateStr;
  },

  // Apply theme variables to CSS root
  applyThemeColors() {
    const root = document.documentElement;
    root.style.setProperty('--card-primary-color', this.state.primaryColor);
    root.style.setProperty('--card-secondary-color', this.state.secondaryColor);
    root.style.setProperty('--card-accent-gold', this.state.accentColor);
  },

  // Render Full Live Card
  render() {
    this.applyThemeColors();

    // 1. Text & Metadata updates (Front)
    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val || '';
    };

    setText('disp-country-text', this.state.countryText);
    setText('disp-dept-text', this.state.deptText);
    setText('disp-region-text', this.state.regionText);
    setText('disp-school-name', this.state.schoolName);
    setText('disp-school-address', this.state.schoolAddress);

    // Role text
    let roleTitle = 'STUDENT';
    if (this.state.idType === 'FACULTY') roleTitle = 'FACULTY / TEACHER';
    else if (this.state.idType === 'STAFF') roleTitle = 'ADMINISTRATIVE STAFF';
    else if (this.state.idType === 'VISITOR') roleTitle = 'VISITOR / GUEST';
    else if (this.state.gradeSection && (this.state.gradeSection.toLowerCase().includes('grade 11') || this.state.gradeSection.toLowerCase().includes('grade 12'))) {
      roleTitle = 'SENIOR HIGH SCHOOL STUDENT';
    } else {
      roleTitle = 'JUNIOR HIGH SCHOOL STUDENT';
    }
    setText('disp-role-text', roleTitle);

    setText('disp-student-name', (this.state.fullName || 'Student Name').toUpperCase());
    setText('disp-lrn-value', this.state.lrn || '000000000000');
    setText('disp-grade-val', this.state.gradeSection || '-');
    setText('disp-strand-val', this.state.trackStrand || '-');
    setText('disp-dob-val', this.formatDate(this.state.birthDate));
    setText('disp-idno-val', this.state.idNumber || '-');
    setText('disp-blood-val', this.state.bloodType || 'O+');
    setText('disp-sy-val', this.state.schoolYear || 'S.Y. 2025 - 2026');

    // 2. Images & Assets (Front)
    const setImg = (id, src) => {
      const el = document.getElementById(id);
      if (el && src) el.src = src;
    };

    setImg('card-logo-deped', this.state.leftLogoUrl);
    setImg('card-logo-school', this.state.rightLogoUrl);
    setImg('disp-student-photo', this.state.photoUrl);
    setImg('disp-student-sig', this.state.signatureUrl);

    // Thumbnails in control panel
    const thumbPhoto = document.getElementById('preview-photo-thumb');
    const thumbBoxPhoto = document.getElementById('photo-thumb-container');
    if (thumbPhoto && this.state.photoUrl) {
      thumbPhoto.src = this.state.photoUrl;
      thumbBoxPhoto.classList.add('has-image');
    }

    const thumbSig = document.getElementById('preview-sig-thumb');
    const thumbBoxSig = document.getElementById('sig-thumb-container');
    if (thumbSig && this.state.signatureUrl) {
      thumbSig.src = this.state.signatureUrl;
      thumbBoxSig.classList.add('has-image');
    }

    // 3. Back Card Data
    setText('disp-em-contact', this.state.emergencyContact || 'Guardian Name');
    setText('disp-em-phone', this.state.emergencyPhone || 'N/A');
    setText('disp-em-address', this.state.address || 'Address');
    setText('disp-em-dob', this.formatDate(this.state.birthDate));
    setText('disp-em-blood', this.state.bloodType || 'O+');
    setText('disp-em-lrn', this.state.lrn || '000000000000');

    setText('disp-principal-name', (this.state.principalName || 'PRINCIPAL NAME').toUpperCase());
    setText('disp-principal-title', this.state.principalTitle || 'Secondary School Principal');
    setImg('disp-principal-sig', this.state.principalSigUrl);

    // 4. Background Guilloché & Security Patterns
    this.renderBackgrounds();

    // 5. Generate QR Code
    this.renderCodes();

    // 6. Orientation Handling
    const wrapper = document.getElementById('cards-wrapper');
    if (wrapper) {
      if (this.state.orientation === 'landscape') {
        wrapper.classList.remove('orientation-portrait');
        wrapper.classList.add('orientation-landscape');
      } else {
        wrapper.classList.remove('orientation-landscape');
        wrapper.classList.add('orientation-portrait');
      }
    }
  },

  // Render Background SVG layers
  renderBackgrounds() {
    const frontBg = document.getElementById('front-bg-layer');
    const backBg = document.getElementById('back-bg-layer');

    if (this.state.showGuilloche) {
      const isLandscape = this.state.orientation === 'landscape';
      const w = isLandscape ? 514 : 324;
      const h = isLandscape ? 324 : 514;
      const svgBg = Templates.generateGuillocheSVG(this.state.primaryColor, this.state.secondaryColor, w, h);
      const bgDataUri = `url("data:image/svg+xml;utf8,${encodeURIComponent(svgBg)}")`;

      if (frontBg) frontBg.style.backgroundImage = bgDataUri;
      if (backBg) backBg.style.backgroundImage = bgDataUri;
    } else {
      if (frontBg) frontBg.style.backgroundImage = 'none';
      if (backBg) backBg.style.backgroundImage = 'none';
    }

    // Hologram toggle class
    const cardScene = document.getElementById('flip-scene');
    if (cardScene) {
      if (this.state.showHologram) {
        cardScene.classList.add('has-hologram');
      } else {
        cardScene.classList.remove('has-hologram');
      }
    }
  },

  // Render QR Code
  renderCodes() {
    const lrn = this.state.lrn || '109283746501';

    // QR Code using QRCode.js (Includes Full Important Metadata)
    const qrHolder = document.getElementById('disp-qr-container');
    if (qrHolder) {
      qrHolder.innerHTML = '';
      const qrPayload = JSON.stringify({
        id: this.state.idNumber || 'SNHS-2026',
        lrn: lrn,
        name: this.state.fullName,
        dob: this.state.birthDate,
        grade: this.state.gradeSection,
        guardian: this.state.emergencyContact,
        phone: this.state.emergencyPhone,
        blood: this.state.bloodType,
        sy: this.state.schoolYear
      });

      if (window.QRCode) {
        try {
          new QRCode(qrHolder, {
            text: qrPayload,
            width: this.QR_SIZE,
            height: this.QR_SIZE,
            colorDark: '#0f172a',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
          });
        } catch (e) {
          console.warn('QRCode render error:', e);
        }
      }
    }
  },

  // Render a custom standalone card HTML for batch / print sheet / receipt modal
  createCardDOM(data, side = 'front', width = 324, height = 514) {
    const cardDiv = document.createElement('div');
    cardDiv.className = `id-card id-card-${side} dynamic-card ${width > height ? 'orientation-landscape' : 'orientation-portrait'}`;
    cardDiv.style.width = `${width}px`;
    cardDiv.style.height = `${height}px`;
    cardDiv.style.position = 'relative';
    cardDiv.style.boxShadow = 'none';

    // Theme values
    const primary = data.primaryColor || this.state.primaryColor;
    const secondary = data.secondaryColor || this.state.secondaryColor;
    const accent = data.accentColor || this.state.accentColor;
    const bgSvg = Templates.generateGuillocheSVG(primary, secondary, width, height);
    const formattedDOB = this.formatDate(data.birthDate);

    if (side === 'front') {
      let roleTitle = 'STUDENT';
      if (data.idType === 'FACULTY') roleTitle = 'FACULTY / TEACHER';
      else if (data.gradeSection && (data.gradeSection.includes('11') || data.gradeSection.includes('12'))) roleTitle = 'SENIOR HIGH SCHOOL STUDENT';

      cardDiv.innerHTML = `
        <div class="card-bg-layer" style="background-image: url('data:image/svg+xml;utf8,${encodeURIComponent(bgSvg)}');"></div>
        <header class="card-header" style="background: linear-gradient(180deg, ${primary} 0%, ${secondary} 100%); border-bottom: 2px solid ${accent};">
          <div class="card-logo-left"><img src="${data.leftLogoUrl || this.state.leftLogoUrl}" class="header-logo"></div>
          <div class="card-school-info">
            <span class="republic-text">${data.countryText || this.state.countryText}</span>
            <span class="dept-text" style="color: ${accent};">${data.deptText || this.state.deptText}</span>
            <span class="region-text">${data.regionText || this.state.regionText}</span>
            <h2 class="school-name-text">${data.schoolName || this.state.schoolName}</h2>
            <span class="school-addr-text">${data.schoolAddress || this.state.schoolAddress}</span>
          </div>
          <div class="card-logo-right"><img src="${data.rightLogoUrl || this.state.rightLogoUrl}" class="header-logo"></div>
        </header>

        <div class="card-role-banner" style="background: ${accent};">
          <span>${roleTitle}</span>
        </div>

        <div class="card-body">
          <div class="card-photo-container">
            <div class="card-photo-frame" style="box-shadow: 0 4px 10px rgba(0,0,0,0.25), 0 0 0 1.5px ${secondary};">
              <img src="${data.photoUrl || Templates.getDefaultAvatarSVG()}">
            </div>
            <div class="card-blood-badge">
              <span class="blood-label">BLOOD</span>
              <span class="blood-val">${data.bloodType || 'O+'}</span>
            </div>
          </div>

          <div class="card-meta-container">
            <div class="student-name-box">
              <h3 class="student-name" style="color: ${primary};">${(data.fullName || 'STUDENT NAME').toUpperCase()}</h3>
              <div class="student-lrn-box">
                <span class="lrn-label">LRN:</span>
                <span class="lrn-value">${data.lrn || '000000000000'}</span>
              </div>
            </div>

            <div class="student-details-list">
              <div class="detail-row"><span class="d-label">GRADE & SEC:</span><span class="d-val">${data.gradeSection || '-'}</span></div>
              <div class="detail-row"><span class="d-label">TRACK/STRAND:</span><span class="d-val">${data.trackStrand || '-'}</span></div>
              <div class="detail-row"><span class="d-label">BIRTHDATE:</span><span class="d-val">${formattedDOB}</span></div>
              <div class="detail-row"><span class="d-label">CARD NO:</span><span class="d-val mono">${data.idNumber || 'SNHS-000'}</span></div>
            </div>

            <div class="student-signature-box">
              <div class="sig-image-wrap">
                <img src="${data.signatureUrl || Templates.getDefaultSignatureSVG()}">
              </div>
              <span class="sig-caption">Signature of Student</span>
            </div>
          </div>
        </div>

        <footer class="card-footer" style="background: ${primary}; border-top: 2px solid ${accent};">
          <div class="validity-box"><span class="sy-label" style="color:${accent};">VALIDITY:</span><span class="sy-value">${data.schoolYear || this.state.schoolYear}</span></div>
          <div class="footer-chip"><i class="fa-solid fa-microchip"></i> OFFICIAL ID</div>
        </footer>
      `;
    } else {
      // Back side
      const qrId = 'qr_' + Math.random().toString(36).substr(2, 9);

      cardDiv.innerHTML = `
        <div class="card-bg-layer" style="background-image: url('data:image/svg+xml;utf8,${encodeURIComponent(bgSvg)}');"></div>
        <div class="back-header-box">
          <div class="terms-title" style="color: ${primary};">TERMS & CONDITIONS / IMPORTANT NOTICE</div>
          <p class="terms-text">This card certifies that the bearer whose name and photo appear on this card is a bonafide student of ${data.schoolName || this.state.schoolName}. Always wear this ID while on school premises.</p>
        </div>

        <div class="back-emergency-box">
          <div class="sec-heading"><i class="fa-solid fa-phone-volume"></i> IN CASE OF EMERGENCY, NOTIFY:</div>
          <div class="em-grid">
            <div class="em-row"><span class="em-label">Guardian / Parent:</span><span class="em-val">${data.emergencyContact || 'Guardian'}</span></div>
            <div class="em-row"><span class="em-label">Contact No.:</span><span class="em-val bold highlight">${data.emergencyPhone || 'N/A'}</span></div>
            <div class="em-row"><span class="em-label">Address:</span><span class="em-val">${data.address || 'Address'}</span></div>
            <div class="em-row"><span class="em-label">Date of Birth:</span><span class="em-val">${formattedDOB}</span></div>
            <div class="em-row"><span class="em-label">Blood Type / LRN:</span><span class="em-val mono">${data.bloodType || 'O+'} • ${data.lrn || '-'}</span></div>
          </div>
        </div>

        <div class="back-principal-box">
          <div class="principal-sig-wrap"><img src="${data.principalSigUrl || this.state.principalSigUrl}"></div>
          <div class="principal-name" style="color: ${primary};">${(data.principalName || this.state.principalName).toUpperCase()}</div>
          <div class="principal-title">${data.principalTitle || this.state.principalTitle}</div>
        </div>

        <div class="back-codes-footer">
          <div class="qr-code-box">
            <div id="${qrId}" class="qr-canvas-holder"></div>
            <span class="code-note">SCAN TO VERIFY</span>
          </div>
        </div>
      `;

      // Trigger QR async after attach
      setTimeout(() => {
        try {
          const qrEl = cardDiv.querySelector(`#${qrId}`);
          if (qrEl && window.QRCode) {
            const qrPayload = JSON.stringify({
              id: data.idNumber || 'SNHS-2026',
              lrn: data.lrn,
              name: data.fullName,
              dob: data.birthDate,
              guardian: data.emergencyContact,
              phone: data.emergencyPhone
            });
            new QRCode(qrEl, {
              text: qrPayload,
              width: CardRenderer.QR_SIZE,
              height: CardRenderer.QR_SIZE,
              colorDark: '#0f172a',
              colorLight: '#ffffff',
              correctLevel: QRCode.CorrectLevel.M
            });
          }
        } catch(e) {}
      }, 30);
    }

    return cardDiv;
  }
};

window.CardRenderer = CardRenderer;
