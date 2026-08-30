/**
 * ============================================================================
 * SNHS ID STUDIO - GOOGLE APPS SCRIPT BACKEND WEB APP
 * ============================================================================
 * 
 * INSTRUCTIONS:
 * 1. Open your Google Sheet (create one at https://sheets.new).
 * 2. In Google Sheets, click "Extensions" > "Apps Script".
 * 3. Delete any default code in the editor, then paste this ENTIRE file.
 * 4. Click the "Save" icon (or press Ctrl+S).
 * 5. Click "Deploy" (top right button) > "New deployment".
 * 6. Under "Select type", click the gear icon and select "Web app".
 * 7. Set the following configuration:
 *      - Description: "SNHS ID Studio API"
 *      - Execute as: "Me (your email)"
 *      - Who has access: "Anyone"   <-- (CRITICAL: must be "Anyone")
 * 8. Click "Deploy", authorize access with your Google account, and copy
 *    the generated "Web app URL" (ends with /exec).
 * 9. Paste that URL into "js/config.js" or the Studio Settings tab!
 * ============================================================================
 */

// Name of the sheets in your Google Spreadsheet
var REGISTRATIONS_SHEET_NAME = "Student_Registrations";
var STAFF_SHEET_NAME = "Staff_Accounts";

/**
 * Shared secret. Set it in the editor under Project Settings ->
 * Script Properties, as API_KEY, and use the same value for SHEETS_API_KEY in
 * the website's environment. Do NOT put the value in this file: it is committed
 * to the repository.
 *
 * While no API_KEY is set the script stays open, exactly as before, so adding
 * this code cannot break a live site. The moment you set one, only callers that
 * present it -- i.e. the site's own api/sheets.js -- are answered, and the
 * /exec URL on its own stops being enough to read student records.
 */
function requiredKey() {
  try {
    return PropertiesService.getScriptProperties().getProperty("API_KEY") || "";
  } catch (err) {
    return "";
  }
}

function keyAccepted(supplied) {
  var expected = requiredKey();
  if (!expected) return true;
  return String(supplied || "") === expected;
}

function deniedResponse() {
  return jsonResponse({
    status: "error",
    authorized: false,
    message: "This endpoint requires a valid API key."
  });
}

/**
 * Handle GET requests:
 * 1. action=getStudents -> Retrieves all student submissions.
 * 2. action=authStaff   -> Authenticates staff credentials against Staff_Accounts.
 * 3. action=test        -> Connection test.
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "test";
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // "test" stays open so the deployment can be pinged; everything that touches
  // student data or credentials requires the key once one is configured.
  if (action !== "test" && !keyAccepted(e && e.parameter && e.parameter.key)) {
    return deniedResponse();
  }

  // 1. Fetch all student submissions
  if (action === "getStudents") {
    var sheet = getOrCreateRegistrationsSheet(ss);
    var data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return jsonResponse({ status: "success", count: 0, students: [] });
    }
    
    var headers = data[0];
    var students = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var studentObj = {};
      for (var j = 0; j < headers.length; j++) {
        studentObj[headers[j]] = row[j];
      }
      students.push(studentObj);
    }
    
    return jsonResponse({ status: "success", count: students.length, students: students });
  }

  // 2. Authenticate Staff credentials
  if (action === "authStaff") {
    return authenticateStaff(ss, e.parameter.username, e.parameter.password);
  }

  // 2b. Diagnostics -- reports WHICH spreadsheet this script is bound to and
  // what the Staff_Accounts tab actually contains. Passwords are never
  // returned, only usernames, so this is safe to call from a browser.
  if (action === "diagnose") {
    var tabs = ss.getSheets().map(function (sh) { return sh.getName(); });
    var staff = ss.getSheetByName(STAFF_SHEET_NAME);
    var staffRows = staff ? staff.getDataRange().getValues() : [];
    var usernames = [];
    for (var q = 1; q < staffRows.length; q++) {
      if (staffRows[q][0]) usernames.push(String(staffRows[q][0]).trim());
    }
    return jsonResponse({
      status: "success",
      // Whether the script can actually see its API_KEY Script Property. If
      // this is false the endpoint is still open to anyone, whatever the
      // Script Properties screen appears to show -- usually the property was
      // typed but "Save script properties" was never clicked.
      keyRequired: !!requiredKey(),
      spreadsheetName: ss.getName(),
      spreadsheetId: ss.getId(),
      spreadsheetUrl: ss.getUrl(),
      tabs: tabs,
      staffTabExists: !!staff,
      staffDataRows: Math.max(0, staffRows.length - 1),
      staffUsernames: usernames,
      emergencyLoginActive: staffRows.length <= 1
    });
  }

  // 3. Test ping
  return jsonResponse({
    status: "success",
    message: "SNHS ID Studio Google Apps Script Backend is ACTIVE and connected!",
    timestamp: new Date().toISOString()
  });
}

/**
 * Handle POST requests:
 * action=registerStudent -> Appends a new student record to Student_Registrations.
 */
function doPost(e) {
  try {
    var rawData = e.postData ? e.postData.contents : null;
    if (!rawData) {
      return jsonResponse({ status: "error", message: "No payload received" });
    }

    var contents = JSON.parse(rawData);
    var action = contents.action || "registerStudent";

    if (!keyAccepted(contents.key)) {
      return deniedResponse();
    }

    var ssPost = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "authStaff") {
      return authenticateStaff(ssPost, contents.username, contents.password);
    }
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "registerStudent") {
      var sheet = getOrCreateRegistrationsSheet(ss);
      var s = contents.student || {};

      var timestamp = new Date();
      var formattedDate = Utilities.formatDate(timestamp, Session.getScriptTimeZone() || "Asia/Manila", "yyyy-MM-dd HH:mm:ss");

      // Append row with escaped strings so numbers don't lose leading zeros
      sheet.appendRow([
        formattedDate,
        s.refCode || "",
        "'" + (s.lrn || ""),
        s.fullName || "",
        s.gradeSection || "",
        s.trackStrand || "",
        s.emergencyContact || "",
        "'" + (s.emergencyPhone || ""),
        s.address || "",
        s.bloodType || "O+",
        s.birthDate || "",
        s.photoUrl || "",
        s.status || "Registered Online"
      ]);

      return jsonResponse({
        status: "success",
        message: "Student successfully saved to Google Sheet!",
        refCode: s.refCode,
        lrn: s.lrn
      });
    }

    return jsonResponse({ status: "error", message: "Unknown action: " + action });

  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

/**
 * Helper to get or create the Student_Registrations sheet with formatted headers
 */
function getOrCreateRegistrationsSheet(ss) {
  var sheet = ss.getSheetByName(REGISTRATIONS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(REGISTRATIONS_SHEET_NAME);
    
    // Set headers
    sheet.appendRow([
      "Timestamp", "RefCode", "LRN", "FullName", "GradeSection", 
      "TrackStrand", "EmergencyContact", "EmergencyPhone", "Address", 
      "BloodType", "BirthDate", "PhotoURL", "Status"
    ]);

    // Format headers with DepEd Navy Blue & Gold Accent
    var headerRange = sheet.getRange(1, 1, 1, 13);
    headerRange.setFontWeight("bold")
               .setBackground("#0b2545")
               .setFontColor("#ffffff")
               .setHorizontalAlignment("center");
               
    sheet.setFrozenRows(1);
    try { sheet.autoResizeColumns(1, 12); } catch(e) {}
  }
  return sheet;
}

/**
 * Checks a username and password against the Staff_Accounts tab.
 * Shared by doGet and doPost -- the website sends this as a POST so the
 * password stays out of URLs, proxy logs and execution history.
 */
function authenticateStaff(ss, username, password) {
  var user = String(username || "").trim();
  var pass = String(password || "").trim();

  var staffSheet = getOrCreateStaffSheet(ss);
  var staffData = staffSheet.getDataRange().getValues();

  // Bootstrap login, only while the tab holds nothing but headers. Adding a
  // real row disables it. Change this password in the sheet immediately.
  if (staffData.length <= 1) {
    if (user === "admin" && pass === "snhs2026") {
      return jsonResponse({ status: "success", authorized: true, role: "Administrator", name: "School Registrar" });
    }
  }

  for (var k = 1; k < staffData.length; k++) {
    var rowUser = String(staffData[k][0] || "").trim();
    var rowPass = String(staffData[k][1] || "").trim();
    var rowRole = String(staffData[k][2] || "Staff").trim();
    var rowName = String(staffData[k][3] || rowUser).trim();

    if (rowUser.toLowerCase() === user.toLowerCase() && rowPass === pass) {
      return jsonResponse({ status: "success", authorized: true, role: rowRole, name: rowName });
    }
  }

  return jsonResponse({ status: "error", authorized: false, message: "Invalid username or password." });
}

/**
 * Helper to get or create the Staff_Accounts sheet
 */
function getOrCreateStaffSheet(ss) {
  var sheet = ss.getSheetByName(STAFF_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(STAFF_SHEET_NAME);
    
    // Set headers
    sheet.appendRow(["Username", "Password", "Role", "FullName"]);
    
    // Seed default admin account
    sheet.appendRow(["admin", "snhs2026", "Administrator", "School Registrar"]);
    sheet.appendRow(["faculty", "faculty2026", "Teacher", "Faculty Evaluator"]);

    // Format headers
    var headerRange = sheet.getRange(1, 1, 1, 4);
    headerRange.setFontWeight("bold")
               .setBackground("#134074")
               .setFontColor("#ffffff")
               .setHorizontalAlignment("center");

    sheet.setFrozenRows(1);
    try { sheet.autoResizeColumns(1, 4); } catch(e) {}
  }
  return sheet;
}

/**
 * Helper to return a JSON Output with proper MIME type for web clients
 */
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
