/**
 * config.js
 * Central Configuration File for SNHS Automated ID Generator & Online Portal.
 * 
 * You can customize your Google Sheet integration, staff login credentials,
 * school branding, and future API keys in this single file.
 */

const APP_CONFIG = {
  // =========================================================================
  // 1. GOOGLE SHEETS CLOUD INTEGRATION
  // =========================================================================
  googleSheets: {
    // Paste your deployed Google Apps Script Web App URL here
    // Example: "https://script.google.com/macros/s/AKfycbx.../exec"
    webhookUrl: "https://script.google.com/macros/s/AKfycbzh0W6WK7-wVAhXr6ImDC5yCX6HFoT0KWylJDuQDVkUyhI__u-lyo_URxbMOJPh6RBs0A/exec",

    // (Optional) Direct link to your Google Sheet for quick staff reference
    sheetUrl: "https://docs.google.com/spreadsheets/d/17ye97lIW2Fpgj9YptdNAJd8fiMIxpMr73ktlbCjg61A/edit?gid=0#gid=0",

    // Auto-sync every student self-registration directly to Google Sheets
    autoSyncOnRegister: true,

    // Timeout for cloud requests (in milliseconds)
    requestTimeoutMs: 10000
  },

  // =========================================================================
  // 2. STAFF & ADMINISTRATOR CREDENTIALS
  // =========================================================================
  // You can define authorized staff logins here or sync them from your Google Sheet.
  staffCredentials: [
    {
      username: "admin",
      password: "snhs2026",
      role: "Super Admin / Registrar",
      name: "Office of the Registrar"
    },
    {
      username: "faculty",
      password: "faculty2026",
      role: "Faculty Staff",
      name: "Faculty Evaluator"
    },
    {
      username: "principal",
      password: "principal2026",
      role: "School Head",
      name: "Dr. Emma R. Santos, CESO V"
    }
  ],

  // =========================================================================
  // 3. SCHOOL & INSTITUTION BRANDING DEFAULTS
  // =========================================================================
  school: {
    country: "REPUBLIC OF THE PHILIPPINES",
    department: "DEPARTMENT OF EDUCATION",
    region: "REGION IV-B Mimaropa",
    division: "SCHOOLS DIVISION OF PASIG CITY",
    name: "Salvacion National High School",
    address: "San Salvacion, Busuanga • School ID: 301734",
    schoolYear: "S.Y. 2025 - 2026",
    
    // Principal Details (Printed on Back of ID)
    principal: {
      name: "DR. EMMA R. SANTOS, CESO V",
      title: "Secondary School Principal IV"
    },

    // Terms and Notice printed on Back of ID
    terms: "This card certifies that the bearer whose name, photo, and details appear hereon is a bonafide student of Salvacion National High School. Always wear this ID while on school premises. In case of emergency or loss, please contact the guardian or report immediately to the Office of the Principal."
  },

  // =========================================================================
  // 4. DEFAULT CARD THEME COLORS
  // =========================================================================
  theme: {
    primaryColor: "#0b2545",    // Dark Navy
    secondaryColor: "#134074",  // Deep Royal Blue
    accentColor: "#d4af37",     // Rich Metallic Gold
    guillochePattern: true,     // Enable security wave pattern
    hologramEffect: true        // Enable holographic sheen
  },

  // =========================================================================
  // 5. FUTURE EXTENSIONS / API KEYS
  // =========================================================================
  extensions: {
    smsNotificationApiKey: "",  // e.g., Twilio / Semaphore SMS for student alert
    cloudStorageBucket: "",     // e.g., Firebase / AWS S3 for photo assets
    enableStudentSelfPrint: true
  }
};

// Make accessible globally
window.APP_CONFIG = APP_CONFIG;
