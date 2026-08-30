/**
 * app.js
 * Main Controller for SNHS ID Studio.
 * Handles tab navigation, form two-way sync, 3D card flipping, webcam capture,
 * cropper integration, digital signature pad, and toast alerts.
 */

const App = {
  // Zoom level state
  currentZoom: 1.0,

  // Webcam stream reference
  webcamStream: null,

  // Cropper instance
  cropper: null,

  // Signature Pad state
  sigDrawing: false,
  sigContext: null,

  // App Initialization
  init() {
    this.bindNavigation();
    this.bindFormInputs();
    this.bindStageControls();
    this.bindMediaControls();
    this.bindSettingsControls();
    this.initSignaturePad();

    // Initialize sub-modules
    CardRenderer.init();
    Portal.init();
    BulkGenerator.init();
    ExportEngine.init();

    // Load initial mock batch data in background so the print sheet & bulk tabs aren't empty
    BulkGenerator.loadMockStudents();

    this.showToast('Welcome to SNHS ID & Registration Portal', 'info');
  },

  // Toast Notification Dispatcher
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  // Navigation Tabs Switcher
  bindNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        this.switchTab(targetTab);
      });
    });
  },

  switchTab(tabId) {
    document.querySelectorAll('.nav-tab').forEach(t => {
      const isActive = t.dataset.tab === tabId;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `content-${tabId}`);
    });

    if (tabId === 'print') {
      ExportEngine.updatePrintSheet();
    } else if (tabId === 'registered') {
      Portal.renderRegisteredTable();
    }
  },

  // Two-way synchronization between Inputs and CardRenderer.state
  bindFormInputs() {
    const map = [
      { id: 'input-full-name', key: 'fullName' },
      { id: 'input-id-type', key: 'idType' },
      { id: 'input-lrn', key: 'lrn' },
      { id: 'input-id-number', key: 'idNumber' },
      { id: 'input-grade-section', key: 'gradeSection' },
      { id: 'input-track-strand', key: 'trackStrand' },
      { id: 'input-blood-type', key: 'bloodType' },
      { id: 'input-birthdate', key: 'birthDate' },
      { id: 'input-school-year', key: 'schoolYear' },
      { id: 'input-emergency-contact', key: 'emergencyContact' },
      { id: 'input-emergency-phone', key: 'emergencyPhone' },
      { id: 'input-address', key: 'address' },
      { id: 'input-principal-name', key: 'principalName' },
      { id: 'input-principal-title', key: 'principalTitle' },
      { id: 'input-terms-title', key: 'termsTitle' },
      { id: 'input-terms-text', key: 'termsText' }
    ];

    map.forEach(item => {
      const el = document.getElementById(item.id);
      if (el) {
        el.addEventListener('input', () => {
          CardRenderer.state[item.key] = el.value;
          CardRenderer.render();
        });
        el.addEventListener('change', () => {
          CardRenderer.state[item.key] = el.value;
          CardRenderer.render();
        });
      }
    });

    // Quick Sample Generator Button
    const sampleBtn = document.getElementById('btn-quick-sample');
    if (sampleBtn) {
      sampleBtn.addEventListener('click', () => this.populateRandomSample());
    }

    // Reset Form Button
    const resetBtn = document.getElementById('btn-reset-form');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetForm());
    }

    // Add to Batch Queue Button
    const addBatchBtn = document.getElementById('btn-add-to-batch');
    if (addBatchBtn) {
      addBatchBtn.addEventListener('click', () => {
        const item = { ...CardRenderer.state, id: 'batch_' + Date.now() };
        BulkGenerator.dataset.push(item);
        BulkGenerator.renderTable();
        BulkGenerator.renderBatchGrid();
        BulkGenerator.updateCounter();
        this.showToast(`Added ${item.fullName} to Batch Queue!`, 'success');
      });
    }
  },

  // Populate Single Form with Random Realistic Sample
  populateRandomSample() {
    const samples = [
      { name: 'Gabriel Ian C. Mendoza', lrn: '109283746509', grade: 'Grade 12 - STEM-A', strand: 'Academic Track - STEM', gender: 'm', blood: 'O+' },
      { name: 'Clarisse Joy V. Domingo', lrn: '109283746510', grade: 'Grade 12 - HUMSS-2', strand: 'Academic Track - HUMSS', gender: 'f', blood: 'A+' },
      { name: 'John Patrick M. Alcantara', lrn: '109283746511', grade: 'Grade 11 - TVL-ICT', strand: 'TVL Track - Programming', gender: 'm', blood: 'B+' },
      { name: 'Bea Patricia S. Navarro', lrn: '109283746512', grade: 'Grade 11 - ABM-A', strand: 'Academic Track - ABM', gender: 'f', blood: 'AB+' }
    ];

    const pick = samples[Math.floor(Math.random() * samples.length)];
    CardRenderer.state.fullName = pick.name;
    CardRenderer.state.lrn = pick.lrn;
    CardRenderer.state.gradeSection = pick.grade;
    CardRenderer.state.trackStrand = pick.strand;
    CardRenderer.state.bloodType = pick.blood;
    CardRenderer.state.idNumber = `SNHS-2026-${Math.floor(100 + Math.random() * 900)}`;
    CardRenderer.state.emergencyContact = 'Parent of ' + pick.name.split(' ')[0];
    CardRenderer.state.emergencyPhone = '0917-' + Math.floor(100 + Math.random() * 900) + '-' + Math.floor(1000 + Math.random() * 9000);
    CardRenderer.state.photoUrl = Templates.getRandomSampleAvatar(pick.gender, Math.floor(Math.random() * 10));

    this.syncStateToForm();
    CardRenderer.render();
    this.showToast(`Generated sample record for ${pick.name}`, 'info');
  },

  // Sync state values back to HTML form inputs
  syncStateToForm() {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    setVal('input-full-name', CardRenderer.state.fullName);
    setVal('input-id-type', CardRenderer.state.idType);
    setVal('input-lrn', CardRenderer.state.lrn);
    setVal('input-id-number', CardRenderer.state.idNumber);
    setVal('input-grade-section', CardRenderer.state.gradeSection);
    setVal('input-track-strand', CardRenderer.state.trackStrand);
    setVal('input-blood-type', CardRenderer.state.bloodType);
    setVal('input-birthdate', CardRenderer.state.birthDate);
    setVal('input-school-year', CardRenderer.state.schoolYear);
    setVal('input-emergency-contact', CardRenderer.state.emergencyContact);
    setVal('input-emergency-phone', CardRenderer.state.emergencyPhone);
    setVal('input-address', CardRenderer.state.address);
    setVal('input-principal-name', CardRenderer.state.principalName);
    setVal('input-principal-title', CardRenderer.state.principalTitle);
  },

  // Reset Form
  resetForm() {
    CardRenderer.state.fullName = '';
    CardRenderer.state.lrn = '';
    CardRenderer.state.idNumber = '';
    CardRenderer.state.gradeSection = '';
    CardRenderer.state.trackStrand = '';
    CardRenderer.state.emergencyContact = '';
    CardRenderer.state.emergencyPhone = '';
    CardRenderer.state.address = '';
    CardRenderer.state.photoUrl = Templates.getDefaultAvatarSVG();
    this.syncStateToForm();
    CardRenderer.render();
    this.showToast('Form inputs cleared.', 'info');
  },

  // Preview Stage Controls (Flip 3D, Zoom, Views, Orientations)
  bindStageControls() {
    const flipBtn = document.getElementById('btn-flip-3d');
    const innerCard = document.getElementById('flip-card-inner');
    const btnFront = document.getElementById('btn-view-front');
    const btnBack = document.getElementById('btn-view-back');
    const btnBoth = document.getElementById('btn-view-both');
    const cardsWrapper = document.getElementById('cards-wrapper');

    // 3D Flip Card
    if (flipBtn && innerCard) {
      flipBtn.addEventListener('click', () => {
        innerCard.classList.toggle('is-flipped');
        const isFlipped = innerCard.classList.contains('is-flipped');
        btnFront.classList.toggle('active', !isFlipped);
        btnBack.classList.toggle('active', isFlipped);
      });
    }

    // View buttons
    if (btnFront && innerCard) {
      btnFront.addEventListener('click', () => {
        cardsWrapper.classList.remove('view-both');
        innerCard.classList.remove('is-flipped');
        btnFront.classList.add('active');
        btnBack.classList.remove('active');
        btnBoth.classList.remove('active');
      });
    }

    if (btnBack && innerCard) {
      btnBack.addEventListener('click', () => {
        cardsWrapper.classList.remove('view-both');
        innerCard.classList.add('is-flipped');
        btnBack.classList.add('active');
        btnFront.classList.remove('active');
        btnBoth.classList.remove('active');
      });
    }

    // Side-by-Side Dual View
    if (btnBoth && cardsWrapper) {
      btnBoth.addEventListener('click', () => {
        btnBoth.classList.add('active');
        btnFront.classList.remove('active');
        btnBack.classList.remove('active');
        this.showToast('Switch to Export or Print tab for full dual sheet rendering!', 'info');
      });
    }

    // Orientation Switches
    const btnPortrait = document.getElementById('btn-orient-portrait');
    const btnLandscape = document.getElementById('btn-orient-landscape');

    if (btnPortrait && btnLandscape) {
      btnPortrait.addEventListener('click', () => {
        CardRenderer.state.orientation = 'portrait';
        btnPortrait.classList.add('active');
        btnLandscape.classList.remove('active');
        CardRenderer.render();
      });

      btnLandscape.addEventListener('click', () => {
        CardRenderer.state.orientation = 'landscape';
        btnLandscape.classList.add('active');
        btnPortrait.classList.remove('active');
        CardRenderer.render();
      });
    }

    // Zoom Controls
    const zoomIn = document.getElementById('btn-zoom-in');
    const zoomOut = document.getElementById('btn-zoom-out');
    const zoomText = document.getElementById('zoom-level-text');

    if (zoomIn && zoomOut && cardsWrapper) {
      zoomIn.addEventListener('click', () => {
        if (this.currentZoom < 1.6) {
          this.currentZoom += 0.1;
          cardsWrapper.style.setProperty('--zoom', this.currentZoom);
          zoomText.textContent = `${Math.round(this.currentZoom * 100)}%`;
        }
      });

      zoomOut.addEventListener('click', () => {
        if (this.currentZoom > 0.6) {
          this.currentZoom -= 0.1;
          cardsWrapper.style.setProperty('--zoom', this.currentZoom);
          zoomText.textContent = `${Math.round(this.currentZoom * 100)}%`;
        }
      });
    }

    // Hologram Toggle
    const holoBtn = document.getElementById('btn-toggle-hologram');
    if (holoBtn) {
      holoBtn.addEventListener('click', () => {
        CardRenderer.state.showHologram = !CardRenderer.state.showHologram;
        CardRenderer.renderBackgrounds();
        this.showToast(`Holographic overlay ${CardRenderer.state.showHologram ? 'enabled' : 'disabled'}.`, 'info');
      });
    }
  },

  // Media (Photo & Signature) Modals & Uploads
  bindMediaControls() {
    const uploadBtn = document.getElementById('btn-trigger-upload');
    const fileInput = document.getElementById('input-photo-file');
    const webcamBtn = document.getElementById('btn-trigger-webcam');
    const diceBtn = document.getElementById('btn-random-avatar');

    // Photo File Upload
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => this.openCropperModal(ev.target.result);
          reader.readAsDataURL(file);
          e.target.value = '';
        }
      });
    }

    // Random Avatar
    if (diceBtn) {
      diceBtn.addEventListener('click', () => {
        CardRenderer.state.photoUrl = Templates.getRandomSampleAvatar(Math.random() > 0.5 ? 'm' : 'f', Math.floor(Math.random() * 10));
        CardRenderer.render();
        this.showToast('Applied sample student avatar.', 'info');
      });
    }

    // Live Webcam Modal
    if (webcamBtn) {
      webcamBtn.addEventListener('click', () => this.openWebcamModal());
    }

    const closeWebcamBtn = document.getElementById('btn-close-webcam');
    const cancelWebcamBtn = document.getElementById('btn-cancel-webcam');
    const snapWebcamBtn = document.getElementById('btn-snap-webcam');

    if (closeWebcamBtn) closeWebcamBtn.addEventListener('click', () => this.closeWebcamModal());
    if (cancelWebcamBtn) cancelWebcamBtn.addEventListener('click', () => this.closeWebcamModal());
    if (snapWebcamBtn) snapWebcamBtn.addEventListener('click', () => this.snapWebcamPhoto());

    // Cropper Modal Buttons
    const closeCropBtn = document.getElementById('btn-close-crop');
    const cancelCropBtn = document.getElementById('btn-cancel-crop');
    const applyCropBtn = document.getElementById('btn-apply-crop');
    const rotateLeft = document.getElementById('btn-crop-rotate-left');
    const rotateRight = document.getElementById('btn-crop-rotate-right');

    if (closeCropBtn) closeCropBtn.addEventListener('click', () => this.closeCropperModal());
    if (cancelCropBtn) cancelCropBtn.addEventListener('click', () => this.closeCropperModal());
    if (applyCropBtn) applyCropBtn.addEventListener('click', () => this.applyCroppedImage());
    if (rotateLeft) rotateLeft.addEventListener('click', () => this.cropper && this.cropper.rotate(-90));
    if (rotateRight) rotateRight.addEventListener('click', () => this.cropper && this.cropper.rotate(90));

    // Signature Pad
    const drawSigBtn = document.getElementById('btn-draw-sig');
    const uploadSigBtn = document.getElementById('btn-upload-sig');
    const sigFileInput = document.getElementById('input-sig-file');
    const clearSigBtn = document.getElementById('btn-clear-sig');

    if (drawSigBtn) drawSigBtn.addEventListener('click', () => this.openSigModal());
    if (uploadSigBtn && sigFileInput) {
      uploadSigBtn.addEventListener('click', () => sigFileInput.click());
      sigFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            CardRenderer.state.signatureUrl = ev.target.result;
            CardRenderer.render();
            this.showToast('Signature updated.', 'success');
          };
          reader.readAsDataURL(file);
          e.target.value = '';
        }
      });
    }

    if (clearSigBtn) {
      clearSigBtn.addEventListener('click', () => {
        CardRenderer.state.signatureUrl = Templates.getDefaultSignatureSVG();
        CardRenderer.render();
        this.showToast('Signature reset.', 'info');
      });
    }
  },

  // Open & Close Webcam Modal
  async openWebcamModal() {
    const modal = document.getElementById('webcam-modal');
    const video = document.getElementById('webcam-video');
    if (!modal || !video) return;

    modal.classList.add('active');

    try {
      this.webcamStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      });
      video.srcObject = this.webcamStream;
    } catch (err) {
      console.warn('Webcam access error:', err);
      this.showToast('Unable to access webcam: ' + err.message, 'error');
      this.closeWebcamModal();
    }
  },

  closeWebcamModal() {
    const modal = document.getElementById('webcam-modal');
    if (modal) modal.classList.remove('active');

    if (this.webcamStream) {
      this.webcamStream.getTracks().forEach(track => track.stop());
      this.webcamStream = null;
    }
  },

  snapWebcamPhoto() {
    const video = document.getElementById('webcam-video');
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    this.closeWebcamModal();
    this.openCropperModal(dataUrl);
  },

  // Open & Close Cropper Modal
  openCropperModal(imgSrc) {
    const modal = document.getElementById('crop-modal');
    const targetImg = document.getElementById('cropper-target-img');
    if (!modal || !targetImg) return;

    targetImg.src = imgSrc;
    modal.classList.add('active');

    if (this.cropper) {
      this.cropper.destroy();
    }

    if (window.Cropper) {
      this.cropper = new Cropper(targetImg, {
        aspectRatio: 126 / 148, // Standard 2x2 / Passport photo ratio
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 0.85,
        restore: false,
        guides: true,
        center: true,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true
      });
    }
  },

  closeCropperModal() {
    const modal = document.getElementById('crop-modal');
    if (modal) modal.classList.remove('active');
    if (this.cropper) {
      this.cropper.destroy();
      this.cropper = null;
    }
  },

  applyCroppedImage() {
    if (!this.cropper) return;
    const canvas = this.cropper.getCroppedCanvas({
      width: 400,
      height: 470,
      imageSmoothingQuality: 'high'
    });

    CardRenderer.state.photoUrl = canvas.toDataURL('image/jpeg', 0.95);
    CardRenderer.render();
    this.closeCropperModal();
    this.showToast('ID Photo cropped and applied.', 'success');
  },

  // Signature Pad Drawer Modal
  initSignaturePad() {
    const canvas = document.getElementById('sig-canvas');
    if (!canvas) return;
    this.sigContext = canvas.getContext('2d');

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
      };
    };

    const startDraw = (e) => {
      e.preventDefault();
      this.sigDrawing = true;
      const pos = getPos(e);
      this.sigContext.beginPath();
      this.sigContext.moveTo(pos.x, pos.y);
      this.sigContext.lineWidth = 3;
      this.sigContext.lineCap = 'round';
      this.sigContext.lineJoin = 'round';
      this.sigContext.strokeStyle = '#0b2545';
    };

    const draw = (e) => {
      if (!this.sigDrawing) return;
      e.preventDefault();
      const pos = getPos(e);
      this.sigContext.lineTo(pos.x, pos.y);
      this.sigContext.stroke();
    };

    const stopDraw = () => {
      this.sigDrawing = false;
    };

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);

    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDraw);

    // Modal buttons
    const closeBtn = document.getElementById('btn-close-sig');
    const cancelBtn = document.getElementById('btn-cancel-sig-pad');
    const clearBtn = document.getElementById('btn-clear-sig-pad');
    const saveBtn = document.getElementById('btn-save-sig-pad');

    if (closeBtn) closeBtn.addEventListener('click', () => this.closeSigModal());
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeSigModal());
    if (clearBtn) clearBtn.addEventListener('click', () => this.clearSigCanvas());
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        CardRenderer.state.signatureUrl = canvas.toDataURL('image/png');
        CardRenderer.render();
        this.closeSigModal();
        this.showToast('Signature saved.', 'success');
      });
    }
  },

  openSigModal() {
    const modal = document.getElementById('sig-modal');
    if (modal) {
      modal.classList.add('active');
      this.clearSigCanvas();
    }
  },

  closeSigModal() {
    const modal = document.getElementById('sig-modal');
    if (modal) modal.classList.remove('active');
  },

  clearSigCanvas() {
    const canvas = document.getElementById('sig-canvas');
    if (canvas && this.sigContext) {
      this.sigContext.clearRect(0, 0, canvas.width, canvas.height);
    }
  },

  // Design & Branding Settings Panel
  bindSettingsControls() {
    // Theme Presets
    const presets = document.querySelectorAll('.preset-pill');
    presets.forEach(p => {
      p.addEventListener('click', () => {
        presets.forEach(item => item.classList.remove('active'));
        p.classList.add('active');

        const presetKey = p.dataset.preset;
        const config = Templates.presets[presetKey];
        if (config) {
          CardRenderer.state.preset = presetKey;
          CardRenderer.state.primaryColor = config.primary;
          CardRenderer.state.secondaryColor = config.secondary;
          CardRenderer.state.accentColor = config.accent;
          CardRenderer.state.schoolName = config.schoolName;
          CardRenderer.state.schoolAddress = config.schoolAddress;
          CardRenderer.state.deptText = config.deptText;
          CardRenderer.state.regionText = config.regionText;

          // Sync pickers
          document.getElementById('color-primary').value = config.primary;
          document.getElementById('hex-primary').textContent = config.primary;
          document.getElementById('color-secondary').value = config.secondary;
          document.getElementById('hex-secondary').textContent = config.secondary;
          document.getElementById('color-accent').value = config.accent;
          document.getElementById('hex-accent').textContent = config.accent;

          // Sync inputs in settings
          document.getElementById('set-school-name').value = config.schoolName;
          document.getElementById('set-school-address').value = config.schoolAddress;
          document.getElementById('set-dept-text').value = config.deptText;
          document.getElementById('set-region-text').value = config.regionText;

          CardRenderer.render();
          this.showToast(`Applied preset: ${config.name}`, 'info');
        }
      });
    });

    // Custom Color Pickers
    const primaryPicker = document.getElementById('color-primary');
    const secondaryPicker = document.getElementById('color-secondary');
    const accentPicker = document.getElementById('color-accent');

    if (primaryPicker) {
      primaryPicker.addEventListener('input', (e) => {
        CardRenderer.state.primaryColor = e.target.value;
        document.getElementById('hex-primary').textContent = e.target.value;
        CardRenderer.render();
      });
    }

    if (secondaryPicker) {
      secondaryPicker.addEventListener('input', (e) => {
        CardRenderer.state.secondaryColor = e.target.value;
        document.getElementById('hex-secondary').textContent = e.target.value;
        CardRenderer.render();
      });
    }

    if (accentPicker) {
      accentPicker.addEventListener('input', (e) => {
        CardRenderer.state.accentColor = e.target.value;
        document.getElementById('hex-accent').textContent = e.target.value;
        CardRenderer.render();
      });
    }

    // Institution Branding Text Inputs
    const setCountry = document.getElementById('set-country-text');
    const setDept = document.getElementById('set-dept-text');
    const setRegion = document.getElementById('set-region-text');
    const setSchool = document.getElementById('set-school-name');
    const setAddr = document.getElementById('set-school-address');

    if (setCountry) setCountry.addEventListener('input', (e) => { CardRenderer.state.countryText = e.target.value; CardRenderer.render(); });
    if (setDept) setDept.addEventListener('input', (e) => { CardRenderer.state.deptText = e.target.value; CardRenderer.render(); });
    if (setRegion) setRegion.addEventListener('input', (e) => { CardRenderer.state.regionText = e.target.value; CardRenderer.render(); });
    if (setSchool) setSchool.addEventListener('input', (e) => { CardRenderer.state.schoolName = e.target.value; CardRenderer.render(); });
    if (setAddr) setAddr.addEventListener('input', (e) => { CardRenderer.state.schoolAddress = e.target.value; CardRenderer.render(); });

    // Logo Uploaders
    const btnLogoLeft = document.getElementById('btn-upload-logo-left');
    const fileLogoLeft = document.getElementById('file-logo-left');
    const imgLogoLeft = document.getElementById('img-logo-left-preview');

    if (btnLogoLeft && fileLogoLeft) {
      btnLogoLeft.addEventListener('click', () => fileLogoLeft.click());
      fileLogoLeft.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            CardRenderer.state.leftLogoUrl = ev.target.result;
            if (imgLogoLeft) imgLogoLeft.src = ev.target.result;
            CardRenderer.render();
          };
          reader.readAsDataURL(file);
        }
      });
    }

    const btnLogoRight = document.getElementById('btn-upload-logo-right');
    const fileLogoRight = document.getElementById('file-logo-right');
    const imgLogoRight = document.getElementById('img-logo-right-preview');

    if (btnLogoRight && fileLogoRight) {
      btnLogoRight.addEventListener('click', () => fileLogoRight.click());
      fileLogoRight.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            CardRenderer.state.rightLogoUrl = ev.target.result;
            if (imgLogoRight) imgLogoRight.src = ev.target.result;
            CardRenderer.render();
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Security Pattern Toggles
    const toggleGuilloche = document.getElementById('toggle-guilloche');
    if (toggleGuilloche) {
      toggleGuilloche.addEventListener('change', (e) => {
        CardRenderer.state.showGuilloche = e.target.checked;
        CardRenderer.renderBackgrounds();
      });
    }

    const toggleHolo = document.getElementById('toggle-hologram-fx');
    if (toggleHolo) {
      toggleHolo.addEventListener('change', (e) => {
        CardRenderer.state.showHologram = e.target.checked;
        CardRenderer.renderBackgrounds();
      });
    }
  }
};

// Start application once DOM is fully loaded
window.addEventListener('DOMContentLoaded', () => App.init());
