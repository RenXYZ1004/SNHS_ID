/**
 * bulk-generator.js
 * Batch ID Generator: CSV/Excel Parser, Data Table Manager,
 * Batch Thumbnail Previews, and Bulk ZIP Packaging.
 */

const BulkGenerator = {
  // Array of student records in batch
  dataset: [],

  // Initialize
  init() {
    this.bindEvents();
  },

  // Event Listeners for Bulk Operations
  bindEvents() {
    const fileInput = document.getElementById('bulk-file-input');
    const selectBtn = document.getElementById('btn-select-bulk-file');
    const dropzone = document.getElementById('bulk-dropzone');
    const sampleBtn = document.getElementById('btn-download-sample-csv');
    const mockBtn = document.getElementById('btn-generate-random-batch');
    const clearBtn = document.getElementById('btn-clear-batch');
    const addRowBtn = document.getElementById('btn-add-empty-row');
    const renderAllBtn = document.getElementById('btn-render-all-batch');
    const zipBtn = document.getElementById('btn-download-all-zip');

    if (selectBtn && fileInput) {
      selectBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }

    if (dropzone) {
      ['dragenter', 'dragover'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('dragover');
        });
      });

      dropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) this.processUploadedFile(files[0]);
      });
    }

    if (sampleBtn) sampleBtn.addEventListener('click', () => this.downloadSampleCSV());
    if (mockBtn) mockBtn.addEventListener('click', () => this.loadMockStudents());
    if (clearBtn) clearBtn.addEventListener('click', () => this.clearBatch());
    if (addRowBtn) addRowBtn.addEventListener('click', () => this.addEmptyRow());
    if (renderAllBtn) renderAllBtn.addEventListener('click', () => this.renderBatchGrid());
    if (zipBtn) zipBtn.addEventListener('click', () => this.exportBatchZip());
  },

  // Process File Selection
  handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      this.processUploadedFile(file);
      e.target.value = ''; // Reset input
    }
  },

  // Parse CSV or Excel File
  processUploadedFile(file) {
    const fileName = file.name.toLowerCase();
    App.showToast(`Reading ${file.name}...`, 'info');

    if (fileName.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        this.parseCSVText(text);
      };
      reader.readAsText(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        this.loadParsedJSON(json);
      };
      reader.readAsArrayBuffer(file);
    } else {
      App.showToast('Please upload a valid CSV or Excel (.xlsx) file.', 'error');
    }
  },

  // Parse CSV Plain Text
  parseCSVText(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length <= 1) {
      App.showToast('CSV file is empty or missing headers.', 'error');
      return;
    }

    const headers = this.parseCSVLine(lines[0]);
    const records = [];

    for (let i = 1; i < lines.length; i++) {
      const vals = this.parseCSVLine(lines[i]);
      if (vals.length === 0) continue;
      const obj = {};
      headers.forEach((h, idx) => {
        const cleanHeader = h.trim().replace(/^["']|["']$/g, '');
        obj[cleanHeader] = vals[idx] !== undefined ? vals[idx].trim().replace(/^["']|["']$/g, '') : '';
      });
      records.push(obj);
    }

    this.loadParsedJSON(records);
  },

  // Parse Single CSV Line with quotes support
  parseCSVLine(line) {
    const result = [];
    let insideQuotes = false;
    let current = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  },

  // Map and Load parsed JSON into Dataset
  loadParsedJSON(data) {
    if (!Array.isArray(data) || data.length === 0) {
      App.showToast('No records found in the uploaded file.', 'error');
      return;
    }

    const mapped = data.map((item, index) => {
      const gender = (index % 2 === 0) ? 'm' : 'f';
      return {
        id: 'rec_' + Date.now() + '_' + index,
        lrn: item.LRN || item.lrn || item['Student ID'] || item['LRN Number'] || `10928374650${index + 1}`,
        fullName: item.FullName || item.fullname || item.Name || item['Full Name'] || item['Student Name'] || `Student ${index + 1}`,
        gradeSection: item.GradeSection || item.gradesection || item['Grade & Section'] || item.Grade || 'Grade 12 - STEM-A',
        trackStrand: item.TrackStrand || item.trackstrand || item['Track & Strand'] || item.Strand || 'Academic Track - STEM',
        emergencyContact: item.EmergencyContact || item.emergencycontact || item['Guardian Name'] || item['Parent / Guardian'] || 'Maria Santos',
        emergencyPhone: item.EmergencyPhone || item.emergencyphone || item['Emergency Contact'] || item['Contact Number'] || '0917-000-0000',
        address: item.Address || item.address || item['Home Address'] || 'Pasig City, Metro Manila',
        bloodType: item.BloodType || item.bloodtype || item['Blood Type'] || 'O+',
        birthDate: item.BirthDate || item.birthdate || item.DOB || '2008-05-14',
        idNumber: item.IDNumber || item.idnumber || item['Card ID'] || `SNHS-2026-${String(index + 1).padStart(3, '0')}`,
        idType: item.Role || 'STUDENT',
        photoUrl: item.PhotoUrl || Templates.getRandomSampleAvatar(gender, index),
        signatureUrl: Templates.getDefaultSignatureSVG()
      };
    });

    this.dataset = this.dataset.concat(mapped);
    this.renderTable();
    this.renderBatchGrid();
    this.updateCounter();
    App.showToast(`Successfully loaded ${mapped.length} records into batch!`, 'success');
  },

  // Load 8 Mock Students for instant demo
  loadMockStudents() {
    const mockNames = [
      { name: 'Juan M. Dela Cruz', lrn: '109283746501', grade: 'Grade 12 - STEM-A', strand: 'Academic Track - STEM', gender: 'm', blood: 'O+' },
      { name: 'Angelica R. Santos', lrn: '109283746502', grade: 'Grade 12 - ABM-B', strand: 'Academic Track - ABM', gender: 'f', blood: 'A+' },
      { name: 'Mark Anthony D. Reyes', lrn: '109283746503', grade: 'Grade 11 - HUMSS-1', strand: 'Academic Track - HUMSS', gender: 'm', blood: 'B+' },
      { name: 'Sophia Beatriz G. Tan', lrn: '109283746504', grade: 'Grade 11 - TVL-ICT', strand: 'TVL Track - ICT Animation', gender: 'f', blood: 'AB+' },
      { name: 'Christian Paul L. Ramos', lrn: '109283746505', grade: 'Grade 12 - GAS-A', strand: 'General Academic Strand', gender: 'm', blood: 'O-' },
      { name: 'Kaye Andrea M. Villanueva', lrn: '109283746506', grade: 'Grade 11 - STEM-B', strand: 'Academic Track - STEM', gender: 'f', blood: 'O+' },
      { name: 'Joshua David E. Garcia', lrn: '109283746507', grade: 'Grade 12 - TVL-HE', strand: 'TVL Track - Home Economics', gender: 'm', blood: 'A-' },
      { name: 'Princess Mae C. Castro', lrn: '109283746508', grade: 'Grade 11 - ABM-A', strand: 'Academic Track - ABM', gender: 'f', blood: 'B-' }
    ];

    const mapped = mockNames.map((s, idx) => ({
      id: 'mock_' + Date.now() + '_' + idx,
      lrn: s.lrn,
      fullName: s.name,
      gradeSection: s.grade,
      trackStrand: s.strand,
      emergencyContact: 'Parent of ' + s.name.split(' ')[0],
      emergencyPhone: `0917-888-000${idx + 1}`,
      address: 'Brgy. San Nicolas, Pasig City',
      bloodType: s.blood,
      birthDate: '2008-08-15',
      idNumber: `SNHS-2026-${String(idx + 1).padStart(3, '0')}`,
      idType: 'STUDENT',
      photoUrl: Templates.getRandomSampleAvatar(s.gender, idx),
      signatureUrl: Templates.getDefaultSignatureSVG()
    }));

    this.dataset = mapped;
    this.renderTable();
    this.renderBatchGrid();
    this.updateCounter();
    App.showToast('Loaded 8 mock students with photos & QR codes!', 'success');
  },

  // Add Empty Row
  addEmptyRow() {
    const idx = this.dataset.length + 1;
    const newRecord = {
      id: 'row_' + Date.now(),
      lrn: `1092837465${String(idx).padStart(2, '0')}`,
      fullName: `New Student ${idx}`,
      gradeSection: 'Grade 11 - STEM',
      trackStrand: 'Academic Track',
      emergencyContact: 'Guardian Name',
      emergencyPhone: '0917-000-0000',
      address: 'Pasig City',
      bloodType: 'O+',
      birthDate: '2008-01-01',
      idNumber: `SNHS-2026-${String(idx).padStart(3, '0')}`,
      idType: 'STUDENT',
      photoUrl: Templates.getRandomSampleAvatar('m', idx),
      signatureUrl: Templates.getDefaultSignatureSVG()
    };

    this.dataset.push(newRecord);
    this.renderTable();
    this.updateCounter();
    App.showToast('Added new student row.', 'info');
  },

  // Delete Single Record
  deleteRecord(id) {
    this.dataset = this.dataset.filter(r => r.id !== id);
    this.renderTable();
    this.renderBatchGrid();
    this.updateCounter();
  },

  // Clear Batch
  clearBatch() {
    this.dataset = [];
    this.renderTable();
    this.renderBatchGrid();
    this.updateCounter();
    App.showToast('Batch cleared.', 'info');
  },

  // Update Global Counter
  updateCounter() {
    const badge = document.getElementById('bulk-counter');
    const recordCountText = document.getElementById('table-record-count');
    const count = this.dataset.length;

    if (badge) badge.textContent = count;
    if (recordCountText) recordCountText.textContent = `${count} Records Loaded`;
  },

  // Render HTML Data Table
  renderTable() {
    const tbody = document.getElementById('batch-table-body');
    if (!tbody) return;

    if (this.dataset.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 2.5rem; color: var(--text-dim);">
            <i class="fa-solid fa-inbox" style="font-size: 2rem; margin-bottom: 0.5rem; display:block;"></i>
            No records in batch. Upload a CSV/Excel file or click "Load 8 Mock Students" to start.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.dataset.map((row, index) => `
      <tr data-id="${row.id}">
        <td style="color: var(--text-dim); font-weight: bold;">${index + 1}</td>
        <td>
          <img src="${row.photoUrl}" class="tbl-photo-thumb" alt="Avatar">
        </td>
        <td>
          <input type="text" class="table-input" data-field="lrn" value="${row.lrn}">
        </td>
        <td>
          <input type="text" class="table-input" style="font-weight: 600;" data-field="fullName" value="${row.fullName}">
        </td>
        <td>
          <input type="text" class="table-input" data-field="gradeSection" value="${row.gradeSection}">
        </td>
        <td>
          <input type="text" class="table-input" data-field="trackStrand" value="${row.trackStrand}">
        </td>
        <td>
          <input type="text" class="table-input" data-field="emergencyContact" value="${row.emergencyContact}">
        </td>
        <td>
          <input type="text" class="table-input" data-field="emergencyPhone" value="${row.emergencyPhone}">
        </td>
        <td>
          <input type="text" class="table-input" style="width: 45px;" data-field="bloodType" value="${row.bloodType}">
        </td>
        <td>
          <div style="display: flex; gap: 4px;">
            <button class="btn btn-sm btn-outline" title="Load into Single Generator" onclick="BulkGenerator.loadIntoSingle('${row.id}')">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn btn-sm btn-ghost" title="Delete" onclick="BulkGenerator.deleteRecord('${row.id}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    // Bind inline input change listeners
    tbody.querySelectorAll('.table-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const tr = e.target.closest('tr');
        const id = tr.dataset.id;
        const field = e.target.dataset.field;
        const record = this.dataset.find(r => r.id === id);
        if (record) {
          record[field] = e.target.value;
          this.renderBatchGrid();
        }
      });
    });
  },

  // Load a batch record into the Single Generator View
  loadIntoSingle(id) {
    const record = this.dataset.find(r => r.id === id);
    if (!record) return;

    CardRenderer.state.fullName = record.fullName;
    CardRenderer.state.lrn = record.lrn;
    CardRenderer.state.idNumber = record.idNumber || 'SNHS-2026-001';
    CardRenderer.state.gradeSection = record.gradeSection;
    CardRenderer.state.trackStrand = record.trackStrand;
    CardRenderer.state.bloodType = record.bloodType;
    CardRenderer.state.birthDate = record.birthDate;
    CardRenderer.state.photoUrl = record.photoUrl;
    CardRenderer.state.emergencyContact = record.emergencyContact;
    CardRenderer.state.emergencyPhone = record.emergencyPhone;
    CardRenderer.state.address = record.address;

    // Sync input form
    App.syncStateToForm();
    CardRenderer.render();

    // Switch to single tab
    App.switchTab('single');
    App.showToast(`Loaded ${record.fullName} into Single Generator.`, 'info');
  },

  // Render thumbnail cards preview grid
  renderBatchGrid() {
    const grid = document.getElementById('batch-cards-grid');
    if (!grid) return;

    if (this.dataset.length === 0) {
      grid.innerHTML = '<p style="color: var(--text-dim); grid-column: 1/-1;">Batch card previews will appear here once records are loaded.</p>';
      return;
    }

    grid.innerHTML = this.dataset.map(row => `
      <div class="batch-card-item" onclick="BulkGenerator.loadIntoSingle('${row.id}')">
        <img src="${row.photoUrl}" class="batch-thumb-img" alt="Student Photo">
        <div class="batch-info">
          <h4>${row.fullName}</h4>
          <span class="lrn-tag">LRN: ${row.lrn}</span>
          <p>${row.gradeSection}</p>
          <p style="font-size: 0.7rem; color: var(--text-dim);">${row.trackStrand}</p>
        </div>
      </div>
    `).join('');
  },

  // Download Sample CSV Template
  downloadSampleCSV() {
    const csvContent = `LRN,FullName,GradeSection,TrackStrand,EmergencyContact,EmergencyPhone,Address,BloodType,BirthDate,IDNumber
109283746501,Juan M. Dela Cruz,Grade 12 - STEM-A,Academic Track - STEM,Maria Dela Cruz,0917-123-4567,"Brgy. San Nicolas, Pasig City",O+,2008-05-14,SNHS-2026-001
109283746502,Angelica R. Santos,Grade 12 - ABM-B,Academic Track - ABM,Roberto Santos,0918-234-5678,"Brgy. Kapasigan, Pasig City",A+,2008-08-22,SNHS-2026-002
109283746503,Mark Anthony D. Reyes,Grade 11 - HUMSS-1,Academic Track - HUMSS,Elena Reyes,0920-345-6789,"Brgy. Bagong Ilog, Pasig City",B+,2009-01-30,SNHS-2026-003`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'snhs_students_template.csv');
    App.showToast('Downloaded sample CSV template.', 'success');
  },

  // Export All batch records as ZIP of PNGs
  async exportBatchZip() {
    if (this.dataset.length === 0) {
      App.showToast('No records to export! Load students first.', 'error');
      return;
    }

    App.showToast(`Rendering ${this.dataset.length * 2} ID card sides into ZIP... Please wait.`, 'info');

    try {
      const zip = new JSZip();
      const folderFront = zip.folder('Front_Cards');
      const folderBack = zip.folder('Back_Cards');

      // Create hidden off-screen render sandbox
      const sandbox = document.createElement('div');
      sandbox.style.position = 'fixed';
      sandbox.style.top = '-9999px';
      sandbox.style.left = '-9999px';
      sandbox.style.width = '324px';
      sandbox.style.height = '514px';
      document.body.appendChild(sandbox);

      for (let i = 0; i < this.dataset.length; i++) {
        const student = this.dataset[i];
        const cleanName = student.fullName.replace(/[^a-zA-Z0-9]/g, '_');
        const lrn = student.lrn || `student_${i+1}`;

        // 1. Render Front Side
        sandbox.innerHTML = '';
        const frontDom = CardRenderer.createCardDOM(student, 'front', 324, 514);
        sandbox.appendChild(frontDom);

        // Allow microtask repaint
        await new Promise(r => setTimeout(r, 60));

        const canvasFront = await html2canvas(frontDom, {
          scale: 2, // High resolution for crystal clear print
          useCORS: true,
          logging: false
        });
        const blobFront = await new Promise(res => canvasFront.toBlob(res, 'image/png'));
        folderFront.file(`${lrn}_${cleanName}_FRONT.png`, blobFront);

        // 2. Render Back Side
        sandbox.innerHTML = '';
        const backDom = CardRenderer.createCardDOM(student, 'back', 324, 514);
        sandbox.appendChild(backDom);

        await new Promise(r => setTimeout(r, 80));

        const canvasBack = await html2canvas(backDom, {
          scale: 2,
          useCORS: true,
          logging: false
        });
        const blobBack = await new Promise(res => canvasBack.toBlob(res, 'image/png'));
        folderBack.file(`${lrn}_${cleanName}_BACK.png`, blobBack);
      }

      document.body.removeChild(sandbox);

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `SNHS_ID_Cards_Batch_${Date.now()}.zip`);
      App.showToast('Batch ID ZIP generated and downloaded successfully!', 'success');
    } catch (err) {
      console.error('Batch ZIP error:', err);
      App.showToast('Error generating batch ZIP: ' + err.message, 'error');
    }
  }
};

window.BulkGenerator = BulkGenerator;
