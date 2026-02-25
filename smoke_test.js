/**
 * smoke_test.js — structural integrity checks for receipt-scanner-app
 * Run with: node smoke_test.js
 * Verifies that HTML ids, JS functions, CSS classes, and wiring are consistent.
 */

'use strict';

var fs   = require('fs');
var path = require('path');

var ROOT       = __dirname;
var htmlSrc    = fs.readFileSync(path.join(ROOT, 'index.html'),  'utf8');
var jsSrc      = fs.readFileSync(path.join(ROOT, 'app.js'),      'utf8');
var cssSrc     = fs.readFileSync(path.join(ROOT, 'styles.css'),  'utf8');

// ─── Harness ──────────────────────────────────────────────────────────────────
var passed = 0;
var failed = 0;

function ok(cond, msg) {
    if (cond) { console.log('  \u2705 ' + msg); passed++; }
    else       { console.error('  \u274c FAIL: ' + msg); failed++; }
}


// ─── 1. HTML — all app.js getElementById calls resolve ─────────────────────
console.log('\n\u2500\u2500\u2500 DOM ID cross-check (app.js \u2192 index.html) \u2500\u2500\u2500');

// Extract every id used in getElementById() inside app.js
var jsIdRe = /getElementById\(['"]([^'"]+)['"]\)/g;
var jsIds  = new Set();
var m;
while ((m = jsIdRe.exec(jsSrc)) !== null) jsIds.add(m[1]);

// Extract every id="…" declared in the HTML
var htmlIdRe = /\bid=['"]([\w-]+)['"]/g;
var htmlIds  = new Set();
while ((m = htmlIdRe.exec(htmlSrc)) !== null) htmlIds.add(m[1]);

jsIds.forEach(function(id) {
    ok(htmlIds.has(id), 'id="' + id + '" exists in HTML');
});


// ─── 2. HTML — required screens present ──────────────────────────────────────
console.log('\n\u2500\u2500\u2500 Required screens \u2500\u2500\u2500');
['select-screen', 'camera-screen', 'loading-screen', 'success-screen'].forEach(function(id) {
    ok(htmlIds.has(id), 'Screen id="' + id + '" declared');
    ok(htmlSrc.indexOf('class="screen') !== -1, 'At least one .screen class exists');
});


// ─── 3. HTML — user cards present and correct data-user attributes ───────────
console.log('\n\u2500\u2500\u2500 User cards \u2500\u2500\u2500');
ok(htmlSrc.indexOf('data-user="papa"')    !== -1, 'User card data-user="papa" present');
ok(htmlSrc.indexOf('data-user="tiziana"') !== -1, 'User card data-user="tiziana" present');
ok(htmlIds.has('user-count-papa'),      'id="user-count-papa" present');
ok(htmlIds.has('user-count-tiziana'),   'id="user-count-tiziana" present');


// ─── 4. HTML — accountant FAB wired ─────────────────────────────────────────
console.log('\n\u2500\u2500\u2500 Accountant FAB \u2500\u2500\u2500');
ok(htmlIds.has('chat-fab'),             'id="chat-fab" in HTML');
ok(jsSrc.indexOf('chatFab') !== -1,     'chatFab referenced in app.js');
ok(jsSrc.indexOf("getElementById('chat-fab')") !== -1, 'chatFab retrieved via getElementById');
ok(jsSrc.indexOf('sendToAccountantFlow') !== -1, 'sendToAccountantFlow function defined');
ok(jsSrc.indexOf("chatFab.addEventListener('click', sendToAccountantFlow)") !== -1 ||
   jsSrc.indexOf('chatFab.addEventListener(\'click\', sendToAccountantFlow)') !== -1,
   'chatFab click listener wired to sendToAccountantFlow');


// ─── 5. JS — key functions defined ───────────────────────────────────────────
console.log('\n\u2500\u2500\u2500 Key function definitions \u2500\u2500\u2500');
var requiredFns = [
    'showScreen',
    'showSelectScreen',
    'selectUser',
    'showAlert',
    'updateCounterUI',
    'updateUserCardCounts',
    'renderHistory',
    'addToHistory',
    'routeUpload',
    'uploadToGoogleDrive',
    'getOrCreateFolder',
    'getOrCreateMonthlyFolder',
    'getMonthKey',
    'getMonthFolderName',
    'ensureValidToken',
    'flushOfflineQueue',
    'sendToAccountantFlow',
    'executeSendToAccountant',
    'createBundleFolder',
    'makeShareable',
    'makeThumb',
    'resetApp',
    'openReceiptViewer',
    'closeReceiptViewer',
    'executeDeleteReceipt',
    'updateDriveLink',
];
requiredFns.forEach(function(fn) {
    var defined = new RegExp('function ' + fn + '\\b').test(jsSrc) ||
                  new RegExp('async function ' + fn + '\\b').test(jsSrc);
    ok(defined, 'function ' + fn + '() defined');
});


// ─── 6. JS — key constants defined ───────────────────────────────────────────
console.log('\n\u2500\u2500\u2500 Key constants \u2500\u2500\u2500');
['CLIENT_ID', 'SCOPES', 'FOLDER_NAME', 'MESI_IT', 'USERS', 'MAX_HISTORY', 'REDIRECT_URI'].forEach(function(c) {
    ok(jsSrc.indexOf('const ' + c) !== -1 || jsSrc.indexOf('var ' + c) !== -1,
       'Constant ' + c + ' declared');
});
ok(/USERS\s*=\s*\[/.test(jsSrc),      'USERS is an array');
ok(/MESI_IT\s*=\s*\[/.test(jsSrc),    'MESI_IT is an array');


// ─── 7. JS — USERS has exactly 2 entries: papa and tiziana ───────────────────
console.log('\n\u2500\u2500\u2500 USERS structure \u2500\u2500\u2500');
ok(jsSrc.indexOf("id: 'papa'")    !== -1 || jsSrc.indexOf("id:'papa'")    !== -1, "USERS entry id='papa'");
ok(jsSrc.indexOf("id: 'tiziana'") !== -1 || jsSrc.indexOf("id:'tiziana'") !== -1, "USERS entry id='tiziana'");
ok(jsSrc.indexOf("suffix: 'Pap") !== -1, "USERS papa has suffix");
ok(jsSrc.indexOf("suffix: 'Tiziana'") !== -1, "USERS tiziana has suffix");


// ─── 8. JS — bundle flow calls Drive Copy API ────────────────────────────────
console.log('\n\u2500\u2500\u2500 Bundle-and-share flow \u2500\u2500\u2500');
ok(jsSrc.indexOf('/copy') !== -1,
   'createBundleFolder uses Drive /copy endpoint');
ok(jsSrc.indexOf('/permissions') !== -1,
   'makeShareable calls Drive /permissions endpoint');
ok(jsSrc.indexOf('"type": "anyone"') !== -1 || jsSrc.indexOf("'type': 'anyone'") !== -1 ||
   jsSrc.indexOf('type: \'anyone\'') !== -1,
   'makeShareable sets type: anyone');
ok(jsSrc.indexOf('role: \'reader\'') !== -1 || jsSrc.indexOf('"role": "reader"') !== -1,
   'makeShareable sets role: reader');
ok(jsSrc.indexOf('?usp=sharing') !== -1,
   'executeSendToAccountant appends ?usp=sharing to share links');
ok(/unsentPapa\.length\s*===\s*0\s*&&\s*unsentTiz\.length\s*===\s*0/.test(jsSrc) ||
   jsSrc.indexOf('unsentPapa.length === 0 && unsentTiz.length === 0') !== -1,
   'sendToAccountantFlow guards on empty unsent list');
ok(jsSrc.indexOf('e.sent') !== -1 && jsSrc.indexOf('!e.sent') !== -1,
   'Sent-flag logic present (e.sent / !e.sent)');
ok(jsSrc.indexOf('e.driveFileId') !== -1,
   'Bundle filter checks e.driveFileId');


// ─── 9. JS — mailto has empty To field ───────────────────────────────────────
console.log('\n\u2500\u2500\u2500 Email: empty To field \u2500\u2500\u2500');
// Should be "mailto:?subject=" not "mailto:<email>?subject="
var mailtoMatches = jsSrc.match(/['"`]mailto:[^'"` ]+/g) || [];
mailtoMatches.forEach(function(s) {
    ok(s.indexOf('mailto:?') !== -1 || s === "'mailto:?'",
       'mailto has no hardcoded To address: ' + s.substring(0, 60));
});
ok(mailtoMatches.length > 0, 'At least one mailto: in app.js');


// ─── 10. CSS — required component classes defined ───────────────────────────
console.log('\n\u2500\u2500\u2500 CSS class definitions \u2500\u2500\u2500');
var requiredClasses = [
    '.screen',
    '.select-main',
    '.user-cards',
    '.user-card',
    '.user-card-label',
    '.user-card-sub',
    '.user-context-bar',
    '.btn-back',
    '.thumbnail-user',
    '.thumbnail-item',
    '.thumbnail-check',
    '.thumbnail-sent',
    '.chat-fab',
    '.modal-overlay',
    '.alert-card',
    '.loading-text',
    '.success-title',
];
requiredClasses.forEach(function(cls) {
    ok(cssSrc.indexOf(cls) !== -1, 'CSS class ' + cls + ' defined in styles.css');
});


// ─── 11. JS — no forbidden old patterns ─────────────────────────────────────
console.log('\n\u2500\u2500\u2500 Regression: old patterns removed \u2500\u2500\u2500');
ok(jsSrc.indexOf('accountantEmail') === -1,
   'accountantEmail variable removed (replaced by per-user flow)');
ok(jsSrc.indexOf('getLastMonthUnsent') === -1,
   'Old getLastMonthUnsent helper removed');
ok(!/showCameraLoggedOutUI/.test(jsSrc),
   'showCameraLoggedOutUI removed (merged into resetApp)');


// ─── 12. HTML — alert override button wired ─────────────────────────────────
console.log('\n\u2500\u2500\u2500 Alert modal override button \u2500\u2500\u2500');
ok(htmlIds.has('alert-btn-override'), 'id="alert-btn-override" in HTML');
ok(jsSrc.indexOf('alertBtnOverride._overrideFn') !== -1, 'alertBtnOverride._overrideFn set in sendToAccountantFlow');


// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
console.log('Smoke test results: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
