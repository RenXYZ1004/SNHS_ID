# 🪪 SNHS ID STUDIO - Automatic Web-Based ID Generator

A full-featured, automated ID Card Generator and Batch Issuance Studio built for schools, colleges, and organizations. Designed to generate high-resolution, PVC-standard (CR80) student and employee cards with 3D live previews, real-time QR and barcode generation, webcam capture, batch CSV/Excel processing, and multi-card A4 print sheets.

---

## 🌟 Key Portals & Features

### 1. 🏠 Main Menu / School Portal
- Welcoming landing menu for **San Nicolas National High School**.
- Clear navigation between the **Student Self-Registration Portal** and the **Staff ID Studio**.
- Real-time registered student counter and system status.

### 2. 📝 Student Self-Registration Portal
- Full online registration form for students:
  - 12-Digit DepEd LRN, Full Name, Grade Level & Section, Academic Track / TVL Strand.
  - Birth date, blood type, and emergency contacts.
  - **Live Webcam or Upload Photo** with 2x2 passport crop tool.
  - **Digital Signature Pad** to draw and attach signatures directly.
- **Live Real-Time ID Card Preview** that updates dynamically as the student types!
- **Instant Digital ID Receipt**: Submitting creates a unique reference number (`SNHS-REG-2026-XXXX`) and allows downloading the official digital ID card PNG.
- Automatically saves to the local database and forwards to the staff issuance queue.

### 3. 🔐 Staff & Faculty Login Portal
- Protected staff workstation with quick credential login:
  - **Demo Login**: Username: `admin` | Password: `snhs2026` (or 1-click Demo Login button).
- Unlocks the **Staff ID Studio Workbench**:
  - **Registered Students Queue**: Review all submitted online registrations, approve them, or open in the studio with 1 click.
  - **Single Generator**: 3D interactive flip card editor with QR/Barcode generation.
  - **Batch CSV/Excel Generator**: Bulk card generation and ZIP downloads.
  - **A4 Multi-Card Print Sheets**: 8 or 10 cards per A4 page with crop marks for laminating and PVC trays.
  - **Design & Branding Customizer**: Custom colors, school seals, and presets.

### 3. 📸 Photo & Signature Suite
- **Live Webcam Capture**: Built-in camera capture with facial alignment oval guide.
- **Smart Photo Cropper**: Aspect-ratio locked 2×2 / passport framing with rotation and zoom.
- **AI Sample Avatar Generator**: One-click generation of realistic diverse student avatars.
- **Digital Signature Pad**: Draw with stylus/finger/mouse or upload custom transparent PNG signatures.

### 4. 👥 Batch / Bulk Generation (CSV & Excel)
- Drag-and-drop `.csv`, `.xlsx`, or `.xls` spreadsheet importer.
- Instant batch table with inline cell editing and search.
- **One-Click Batch ZIP Export**: Automatically renders both Front and Back of every single card in the dataset and downloads them in a single zipped archive.
- Included sample CSV template (`sample_students.csv`).

### 5. 🖨️ A4 Multi-Card Print Sheet Layout
- Multi-up print layout (8 or 10 cards per A4 sheet) arranged with precision margins.
- **Duplex Fold / Grid layout**: Fronts and Backs paired side-by-side for laminating or PVC tray printing.
- Hairline crop marks and cutting guides for guillotine paper cutters.
- High-resolution A4 PDF export and direct browser print (`Ctrl+P` / `Cmd+P`).

### 6. 🎨 Design & Branding Customization
- Authentic Presets: *DepEd / SNHS Official (Navy & Gold)*, *Emerald Polytechnic*, *Crimson University*, *Royal Science High*, *Tech & ICT Modern*, *Clean Minimalist*.
- Custom color pickers for Primary, Secondary, and Accent tones.
- Institution branding overrides (School Name, Address, Republic / Ministry headers).
- Custom seal and emblem uploaders (Left DepEd Logo & Right School Seal).

---

## 🚀 How to Run & Deploy

### ☁️ Deploy to Vercel (Instant 1-Click)

#### Option A: Via GitHub / Vercel Dashboard
1. Push this project to a GitHub repository.
2. Go to [vercel.com](https://vercel.com/) and click **"Add New Project"**.
3. Import your repository (Vercel automatically detects the static configuration with [`vercel.json`](file:///c:/Users/Administrator/Desktop/SNHS_ID_Gen/vercel.json)).
4. Click **Deploy**. Your app will be live on a `*.vercel.app` domain with free SSL!

#### Option B: Via Vercel CLI
Run the following in your terminal:
```bash
npx vercel
```
To deploy directly to production:
```bash
npx vercel --prod
```

---

### 💻 Running Locally

#### Option 1: Direct in Browser
Simply double-click [`index.html`](file:///c:/Users/Administrator/Desktop/SNHS_ID_Gen/index.html) to open directly in any modern web browser.

#### Option 2: Using Node.js Local Server
In this folder, run:
```bash
npm start
```
Then open your browser and navigate to:
```
http://127.0.0.1:8080/
```

---

## 📂 Project Structure

```
SNHS_ID_Gen/
├── index.html               # Main application layout & UI
├── server.js                # Lightweight local HTTP server
├── package.json             # NPM package manifest
├── sample_students.csv      # Sample batch dataset for quick import
├── README.md                # Documentation & User Guide
├── css/
│   └── style.css            # Design system, 3D flip card, and print styles
└── js/
    ├── templates.js         # Guilloché generator, SVG seals, and theme presets
    ├── card-renderer.js     # Real-time card DOM, QR & Barcode generator
    ├── bulk-generator.js    # Batch spreadsheet parser & ZIP export
    ├── export-engine.js     # High-DPI PNG/PDF rasterizer & A4 sheet engine
    └── app.js               # Main application controller & modal manager
```
