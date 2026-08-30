/**
 * templates.js
 * High-fidelity SVG assets, Guilloché anti-counterfeiting patterns,
 * vector seals (DepEd, Bagong Pilipinas, School Torch), and theme presets.
 */

const Templates = {
  // Theme Presets
  presets: {
    'snhs-deped': {
      name: 'DepEd / SNHS Official',
      primary: '#0b2545',
      secondary: '#134074',
      accent: '#d4af37',
      bgType: 'guilloche-blue',
      schoolName: 'Salvacion National High School',
      schoolAddress: 'San Salvacion, Busuanga • School ID: 301734',
      deptText: 'DEPARTMENT OF EDUCATION',
      regionText: 'REGION IV-B Mimaropa'
    },
    'emerald-poly': {
      name: 'Emerald Polytechnic',
      primary: '#064e3b',
      secondary: '#047857',
      accent: '#10b981',
      bgType: 'guilloche-emerald',
      schoolName: 'SALVACION POLYTECHNIC INSTITUTE',
      schoolAddress: 'Academic Zone, Busuanga • Inst ID: 408891',
      deptText: 'COMMISSION ON HIGHER EDUCATION',
      regionText: 'NATIONAL CAPITAL REGION'
    },
    'crimson-univ': {
      name: 'Crimson University',
      primary: '#7f1d1d',
      secondary: '#b91c1c',
      accent: '#f59e0b',
      bgType: 'guilloche-crimson',
      schoolName: 'SALVACION STATE UNIVERSITY',
      schoolAddress: 'Main Campus, Rizal District • Org ID: 501239',
      deptText: 'STATE UNIVERSITIES & COLLEGES',
      regionText: 'DIVISION OF PALAWAN'
    },
    'royal-violet': {
      name: 'Royal Science High',
      primary: '#3b0764',
      secondary: '#6b21a8',
      accent: '#a855f7',
      bgType: 'guilloche-violet',
      schoolName: 'SALVACION SCIENCE HIGH SCHOOL',
      schoolAddress: 'Special Science Complex • School ID: 301499',
      deptText: 'DEPARTMENT OF SCIENCE & TECH',
      regionText: 'REGION IV-B Mimaropa'
    },
    'cyber-dark': {
      name: 'Tech & ICT Modern',
      primary: '#0f172a',
      secondary: '#1e293b',
      accent: '#38bdf8',
      bgType: 'guilloche-dark',
      schoolName: 'SALVACION INSTITUTE OF TECHNOLOGY',
      schoolAddress: 'Tech Corridor, Busuanga • School ID: 902144',
      deptText: 'TECHNICAL EDUCATION & SKILLS AUTH.',
      regionText: 'TESDA ACCREDITED'
    },
    'clean-minimal': {
      name: 'Clean Minimalist',
      primary: '#1e293b',
      secondary: '#334155',
      accent: '#2563eb',
      bgType: 'guilloche-minimal',
      schoolName: 'SALVACION ACADEMY',
      schoolAddress: 'Palawan, Philippines • ID: 104822',
      deptText: 'DEPARTMENT OF EDUCATION',
      regionText: 'DIVISION OF PALAWAN'
    }
  },

  // Generates High-Resolution Dynamic Guilloché Anti-Counterfeit Vector Background
  generateGuillocheSVG(primaryColor = '#0b2545', secondaryColor = '#134074', width = 350, height = 550) {
    let wavesFront = '';
    let wavesBack = '';
    const numLines = 24;

    // Generate mathematical trigonometric spirograph waves
    for (let i = 0; i < numLines; i++) {
      const step = i * (height / numLines);
      const amp1 = 16 + Math.sin(i * 0.4) * 8;
      const amp2 = 22 + Math.cos(i * 0.5) * 10;
      const opacity = (0.04 + (i % 3) * 0.025).toFixed(3);
      
      wavesFront += `<path d="M 0 ${step} Q ${width * 0.25} ${step + amp1} ${width * 0.5} ${step - amp2} T ${width} ${step}" fill="none" stroke="${primaryColor}" stroke-width="0.75" stroke-opacity="${opacity}" />`;
      wavesBack += `<path d="M 0 ${step} Q ${width * 0.35} ${step - amp2} ${width * 0.7} ${step + amp1} T ${width} ${step}" fill="none" stroke="${secondaryColor}" stroke-width="0.75" stroke-opacity="${opacity}" />`;
    }

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="50%" stop-color="#f8fafc" />
            <stop offset="100%" stop-color="#edf2f7" />
          </linearGradient>
          <pattern id="microdots" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.5" fill="${primaryColor}" fill-opacity="0.06" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#bgGrad)" />
        <rect width="100%" height="100%" fill="url(#microdots)" />
        <g id="guilloche-lines">
          ${wavesFront}
          ${wavesBack}
        </g>
        <!-- Center Security Medallion Watermark -->
        <circle cx="${width / 2}" cy="${height / 2 + 30}" r="${width * 0.35}" fill="none" stroke="${primaryColor}" stroke-width="1" stroke-dasharray="3,3" stroke-opacity="0.08" />
        <circle cx="${width / 2}" cy="${height / 2 + 30}" r="${width * 0.28}" fill="none" stroke="${secondaryColor}" stroke-width="0.5" stroke-opacity="0.06" />
      </svg>
    `;
  },

  // Official DepEd Philippines Logo (Clean Vector SVG Data URI)
  getDepEdLogoSVG() {
    return `data:image/svg+xml;utf8,` + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <circle cx="50" cy="50" r="48" fill="#ffffff" stroke="#0038a8" stroke-width="3"/>
        <circle cx="50" cy="50" r="44" fill="#0038a8"/>
        <circle cx="50" cy="50" r="42" fill="#ffffff"/>
        <!-- Inner Red/Blue Division -->
        <path d="M 50 10 A 40 40 0 0 1 50 90 Z" fill="#0038a8"/>
        <path d="M 50 10 A 40 40 0 0 0 50 90 Z" fill="#ce1126"/>
        <!-- Sun & Torch Center -->
        <circle cx="50" cy="50" r="20" fill="#fdb515" stroke="#ffffff" stroke-width="2"/>
        <path d="M 45 42 L 55 42 L 50 25 Z" fill="#ffffff"/>
        <!-- Open Book at Base -->
        <path d="M 32 68 Q 50 60 68 68 L 68 76 Q 50 68 32 76 Z" fill="#ffffff" stroke="#0038a8" stroke-width="1.5"/>
        <text x="50" y="54" font-family="Arial, sans-serif" font-weight="bold" font-size="7" text-anchor="middle" fill="#0038a8">DepEd</text>
      </svg>
    `);
  },

  // School Torch & Academic Crest Seal (Clean Vector SVG Data URI)
  getSchoolSealSVG(accentColor = '#d4af37', primaryColor = '#0b2545') {
    return `data:image/svg+xml;utf8,` + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <!-- Outer Gold Ring -->
        <circle cx="50" cy="50" r="48" fill="#ffffff" stroke="${accentColor}" stroke-width="3.5"/>
        <circle cx="50" cy="50" r="43" fill="${primaryColor}" stroke="${accentColor}" stroke-width="1"/>
        <circle cx="50" cy="50" r="33" fill="#ffffff"/>
        
        <!-- Stars around Ring -->
        <polygon points="50,11 52,15 56,15 53,18 54,22 50,19 46,22 47,18 44,15 48,15" fill="${accentColor}" />
        <polygon points="20,40 22,44 26,44 23,47 24,51 20,48 16,51 17,47 14,44 18,44" fill="${accentColor}" />
        <polygon points="80,40 82,44 86,44 83,47 84,51 80,48 76,51 77,47 74,44 78,44" fill="${accentColor}" />

        <!-- Academic Torch of Knowledge -->
        <!-- Flame -->
        <path d="M 50 24 C 46 30 42 36 50 44 C 58 36 54 30 50 24 Z" fill="#ea580c"/>
        <path d="M 50 28 C 48 32 46 36 50 42 C 54 36 52 32 50 28 Z" fill="#facc15"/>
        <!-- Torch Handle -->
        <path d="M 46 44 L 54 44 L 52 60 L 48 60 Z" fill="${accentColor}" stroke="#78350f" stroke-width="0.5"/>
        
        <!-- Laurel Leaves / Wreath -->
        <path d="M 32 64 C 30 50 36 38 42 35 C 38 42 37 54 40 64 Z" fill="#16a34a"/>
        <path d="M 68 64 C 70 50 64 38 58 35 C 62 42 63 54 60 64 Z" fill="#16a34a"/>
        
        <!-- Open Book -->
        <path d="M 34 62 Q 50 56 66 62 L 66 70 Q 50 64 34 70 Z" fill="#ffffff" stroke="${primaryColor}" stroke-width="1.5"/>
        <line x1="50" y1="58" x2="50" y2="69" stroke="${primaryColor}" stroke-width="1"/>
        
        <!-- Motto Ribbon at Bottom -->
        <path d="M 24 78 L 76 78 L 72 85 L 28 85 Z" fill="${accentColor}"/>
        <text x="50" y="83" font-family="Arial, sans-serif" font-weight="900" font-size="5" text-anchor="middle" fill="#000000">EXCELLENCE</text>
      </svg>
    `);
  },

  // Default Vector Signature Asset
  getDefaultSignatureSVG(color = '#1e3a8a') {
    return `data:image/svg+xml;utf8,` + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" width="200" height="60">
        <path d="M 20 40 Q 40 10 55 35 T 85 20 Q 110 5 125 42 T 150 15 Q 170 30 185 25" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M 40 45 Q 90 48 165 42" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" />
        <path d="M 60 25 Q 70 50 75 42" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" />
      </svg>
    `);
  },

  // Default Principal Authority Signature Asset
  getPrincipalSignatureSVG(color = '#0b2545') {
    return `data:image/svg+xml;utf8,` + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" width="200" height="60">
        <path d="M 25 35 C 40 10 60 15 50 45 C 45 55 70 20 90 28 C 110 35 130 10 145 35 C 160 50 175 25 185 20" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M 35 50 L 175 46" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" />
      </svg>
    `);
  },

  // Realistic Clean Placeholder Student Avatar
  getDefaultAvatarSVG() {
    return `data:image/svg+xml;utf8,` + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="200" height="240">
        <defs>
          <linearGradient id="avatarBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f1f5f9"/>
            <stop offset="100%" stop-color="#cbd5e1"/>
          </linearGradient>
        </defs>
        <rect width="200" height="240" fill="url(#avatarBg)"/>
        <!-- Head -->
        <circle cx="100" cy="85" r="45" fill="#f87171" opacity="0.85"/>
        <path d="M 65 80 Q 100 45 135 80 Q 100 70 65 80 Z" fill="#1e293b"/> <!-- Hair -->
        <!-- Neck -->
        <rect x="88" y="125" width="24" height="25" fill="#ef4444" opacity="0.7"/>
        <!-- Collar & Uniform Body -->
        <path d="M 30 240 L 40 160 Q 100 135 160 160 L 170 240 Z" fill="#1e3a8a"/>
        <polygon points="100,150 82,185 100,205 118,185" fill="#ffffff"/>
        <!-- School Tie -->
        <polygon points="96,170 104,170 106,230 100,238 94,230" fill="#dc2626"/>
      </svg>
    `);
  },

  // Random Portrait Avatars generator (Diverse mock portraits)
  getRandomSampleAvatar(gender = 'm', index = 1) {
    // Return SVG illustrations formatted with school uniforms
    const hairColors = ['#18181b', '#27272a', '#3f3f46', '#1e293b'];
    const skinTones = ['#fbcfe8', '#fed7aa', '#fde68a', '#fbcfe8', '#e2e8f0'];
    const hair = hairColors[index % hairColors.length];
    const skin = skinTones[index % skinTones.length];
    
    return `data:image/svg+xml;utf8,` + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="200" height="240">
        <rect width="200" height="240" fill="#f8fafc"/>
        <circle cx="100" cy="88" r="42" fill="${skin}"/>
        <!-- Hair style -->
        ${gender === 'f' 
          ? `<path d="M 52 90 Q 50 35 100 35 Q 150 35 148 90 Q 155 140 145 150 Q 135 80 100 65 Q 65 80 55 150 Z" fill="${hair}"/>` 
          : `<path d="M 58 85 Q 60 45 100 45 Q 140 45 142 85 Q 100 70 58 85 Z" fill="${hair}"/>`
        }
        <!-- Eyes & Smile -->
        <circle cx="86" cy="88" r="3.5" fill="#1e293b"/>
        <circle cx="114" cy="88" r="3.5" fill="#1e293b"/>
        <path d="M 92 105 Q 100 112 108 105" fill="none" stroke="#1e293b" stroke-width="2" stroke-linecap="round"/>
        <!-- Student Uniform -->
        <path d="M 30 240 L 42 165 Q 100 140 158 165 L 170 240 Z" fill="#0b2545"/>
        <polygon points="100,150 80,185 100,210 120,185" fill="#ffffff"/>
        <polygon points="95,170 105,170 107,240 93,240" fill="#d97706"/>
      </svg>
    `);
  }
};

window.Templates = Templates;
