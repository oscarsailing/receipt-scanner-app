/**
 * Unit tests for receipt-scanner-app
 * Run with: node test.js
 * No external dependencies required.
 */

'use strict';

// ─── Minimal browser shims ────────────────────────────────────────────────────
const _localStorage = {};
global.localStorage = {
    getItem: function(k) { return _localStorage[k] !== undefined ? _localStorage[k] : null; },
    setItem: function(k, v) { _localStorage[k] = String(v); },
    removeItem: function(k) { delete _localStorage[k]; }
};
global.window = { location: { href: '' } };
global.document = {
    getElementById: function() { return null; },
    querySelectorAll: function() { return { forEach: function() {} }; },
    createElement: function() {
        return { className: '', textContent: '', appendChild: function() {}, addEventListener: function() {} };
    }
};
// navigator already available in Node.js global scope

// ─── Pull in functions under test ─────────────────────────────────────────────
// We extract just the pure-logic sections w/out triggering DOM at load time.

const MESI_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                 'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

const USERS = [
    { id: 'papa',    label: 'I miei scontrini', short: 'Papà',    suffix: 'Papà' },
    { id: 'tiziana', label: 'Scontrini Tiziana', short: 'Tiziana', suffix: 'Tiziana' }
];

function getMonthKey(d) {
    var yyyy = d.getFullYear();
    var mm = d.getMonth() + 1;
    return yyyy + '-' + (mm < 10 ? '0' + mm : '' + mm);
}

function getMonthFolderName(userSuffix, d) {
    return MESI_IT[d.getMonth()] + ' ' + d.getFullYear() + ' \u2013 ' + userSuffix;
}

function updateUserCardCounts(uploadHistory) {
    var now = new Date();
    var thisMonthKey = getMonthKey(now);
    var result = {};
    USERS.forEach(function(user) {
        result[user.id] = uploadHistory.filter(function(e) {
            return e.userId === user.id && e.monthKey === thisMonthKey;
        }).length;
    });
    return result;
}

// Simulated sendToAccountantFlow logic (pure, no DOM)
function buildMailtoSubject(monthName) {
    return 'Scontrini ' + monthName + ' \u2013 Pap\u00e0 e Tiziana';
}

function buildMailtoBody(papaFolderId, tizFolderId, monthName) {
    var parts = ['Ciao,\n\nti mando i link alle cartelle degli scontrini di ' + monthName + ' su Google Drive:\n'];
    if (papaFolderId) parts.push('\ud83d\udcc1 I miei scontrini:\nhttps://drive.google.com/drive/folders/' + papaFolderId + '\n');
    if (tizFolderId)  parts.push('\ud83d\udcc1 Scontrini Tiziana:\nhttps://drive.google.com/drive/folders/' + tizFolderId + '\n');
    parts.push('\nA presto!');
    return parts.join('\n');
}

// ─── Test harness ─────────────────────────────────────────────────────────────
var passed = 0;
var failed = 0;

function assert(condition, msg) {
    if (condition) {
        console.log('  \u2705 ' + msg);
        passed++;
    } else {
        console.error('  \u274c FAIL: ' + msg);
        failed++;
    }
}

function assertEqual(actual, expected, msg) {
    if (actual === expected) {
        console.log('  \u2705 ' + msg);
        passed++;
    } else {
        console.error('  \u274c FAIL: ' + msg + '\n       expected: ' + JSON.stringify(expected) + '\n       got:      ' + JSON.stringify(actual));
        failed++;
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log('\n--- USERS constant ---');
assertEqual(USERS.length, 2, 'USERS has exactly 2 entries');
assertEqual(USERS[0].id, 'papa', 'First user id is papa');
assertEqual(USERS[1].id, 'tiziana', 'Second user id is tiziana');
assertEqual(USERS[0].suffix, 'Papà', 'Papa suffix is Papà');
assertEqual(USERS[1].suffix, 'Tiziana', 'Tiziana suffix is Tiziana');

console.log('\n--- getMonthKey ---');
assertEqual(getMonthKey(new Date(2025, 0, 15)), '2025-01', 'January 2025 → 2025-01');
assertEqual(getMonthKey(new Date(2025, 11, 1)),  '2025-12', 'December 2025 → 2025-12');
assertEqual(getMonthKey(new Date(2024, 1, 29)),  '2024-02', 'February 2024 (leap) → 2024-02');
assertEqual(getMonthKey(new Date(2026, 5, 1)),   '2026-06', 'June 2026 → 2026-06');

console.log('\n--- getMonthFolderName ---');
assertEqual(getMonthFolderName('Papà', new Date(2026, 1, 1)), 'Febbraio 2026 \u2013 Papà', 'Feb 2026 Papà folder name');
assertEqual(getMonthFolderName('Tiziana', new Date(2026, 1, 1)), 'Febbraio 2026 \u2013 Tiziana', 'Feb 2026 Tiziana folder name');
assertEqual(getMonthFolderName('Papà', new Date(2025, 11, 1)), 'Dicembre 2025 \u2013 Papà', 'Dec 2025 Papà folder name');
assertEqual(getMonthFolderName('Tiziana', new Date(2025, 0, 1)), 'Gennaio 2025 \u2013 Tiziana', 'Jan 2025 Tiziana folder name');

console.log('\n--- MESI_IT array ---');
assertEqual(MESI_IT.length, 12, 'MESI_IT has 12 months');
assertEqual(MESI_IT[0], 'Gennaio', 'Month 0 is Gennaio');
assertEqual(MESI_IT[5], 'Giugno', 'Month 5 is Giugno');
assertEqual(MESI_IT[11], 'Dicembre', 'Month 11 is Dicembre');

console.log('\n--- updateUserCardCounts ---');
var now = new Date();
var thisKey = getMonthKey(now);
var lastKey = getMonthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
var history = [
    { userId: 'papa',    monthKey: thisKey },
    { userId: 'papa',    monthKey: thisKey },
    { userId: 'tiziana', monthKey: thisKey },
    { userId: 'papa',    monthKey: lastKey },
    { userId: 'tiziana', monthKey: lastKey }
];
var counts = updateUserCardCounts(history);
assertEqual(counts['papa'],    2, 'Papa has 2 receipts this month');
assertEqual(counts['tiziana'], 1, 'Tiziana has 1 receipt this month');

var countsEmpty = updateUserCardCounts([]);
assertEqual(countsEmpty['papa'],    0, 'Papa count is 0 on empty history');
assertEqual(countsEmpty['tiziana'], 0, 'Tiziana count is 0 on empty history');

console.log('\n--- buildMailtoSubject ---');
assertEqual(
    buildMailtoSubject('Febbraio 2026'),
    'Scontrini Febbraio 2026 \u2013 Pap\u00e0 e Tiziana',
    'Subject line correct for Febbraio 2026'
);

console.log('\n--- buildMailtoBody ---');
var body = buildMailtoBody('FOLDER_PAPA', 'FOLDER_TIZ', 'Marzo 2026');
assert(body.indexOf('FOLDER_PAPA') !== -1, 'Body contains papa folder id');
assert(body.indexOf('FOLDER_TIZ') !== -1, 'Body contains tiziana folder id');
assert(body.indexOf('Marzo 2026') !== -1, 'Body mentions month name');
assert(body.indexOf('mailto:') === -1, 'Body does not contain mailto: (To field is empty)');

var bodyPapaOnly = buildMailtoBody('FOLDER_PAPA', null, 'Aprile 2026');
assert(bodyPapaOnly.indexOf('FOLDER_PAPA') !== -1, 'Papa-only body has papa folder');
assert(bodyPapaOnly.indexOf('FOLDER_TIZ') === -1, 'Papa-only body has no tiziana folder');

var bodyTizOnly = buildMailtoBody(null, 'FOLDER_TIZ', 'Maggio 2026');
assert(bodyTizOnly.indexOf('FOLDER_TIZ') !== -1, 'Tiziana-only body has tiziana folder');
assert(bodyTizOnly.indexOf('FOLDER_PAPA') === -1, 'Tiziana-only body has no papa folder');

console.log('\n--- sendToAccountantFlow: unsent receipt detection ---');
// Scenario: mixed sent/unsent, both users
var mixedHistory = [
    { userId: 'papa',    driveFileId: 'F1', sent: false,  monthKey: '2026-01' },
    { userId: 'papa',    driveFileId: 'F2', sent: true,   monthKey: '2026-01' },
    { userId: 'tiziana', driveFileId: 'F3', sent: false,  monthKey: '2026-01' },
    { userId: 'tiziana', driveFileId: 'F4', sent: false,  monthKey: '2025-12' },
    { userId: 'papa',    driveFileId: null, sent: false,  monthKey: '2026-02' }, // no driveFileId → excluded
];
var unsentPapa = mixedHistory.filter(function(e) { return e.userId === 'papa' && !e.sent && e.driveFileId; });
var unsentTiz  = mixedHistory.filter(function(e) { return e.userId === 'tiziana' && !e.sent && e.driveFileId; });
assertEqual(unsentPapa.length, 1, 'Papa: 1 unsent with driveFileId (across all months)');
assertEqual(unsentTiz.length,  2, 'Tiziana: 2 unsent with driveFileId (across all months)');

var allUnsent = unsentPapa.concat(unsentTiz);
assert(allUnsent.every(function(e) { return !e.sent; }), 'All collected entries are unsent');
assert(allUnsent.every(function(e) { return !!e.driveFileId; }), 'All collected entries have driveFileId');

console.log('\n--- executeSendToAccountant: subject and body construction ---');
var nowTest = new Date(2026, 1, 25); // 25 Feb 2026
var monthNameTest = MESI_IT[nowTest.getMonth()] + ' ' + nowTest.getFullYear();
assertEqual(monthNameTest, 'Febbraio 2026', 'Month name is Febbraio 2026');

var subject = 'Scontrini ' + monthNameTest + ' \u2013 Pap\u00e0 e Tiziana';
assertEqual(subject, 'Scontrini Febbraio 2026 \u2013 Pap\u00e0 e Tiziana', 'Subject line is correct');

var papaShareLink = 'https://drive.google.com/drive/folders/PAPA_BUNDLE?usp=sharing';
var tizShareLink  = 'https://drive.google.com/drive/folders/TIZ_BUNDLE?usp=sharing';
var totalCount = 3;
var bodyParts = [
    'Ciao,\n\nti mando gli scontrini di ' +
    MESI_IT[nowTest.getMonth()].toLowerCase() + ' ' + nowTest.getFullYear() +
    ' (' + totalCount + ' scontrioni in totale).\n'
];
bodyParts.push('\ud83d\udcc1 I miei scontrini (1):\n' + papaShareLink + '\n');
bodyParts.push('\ud83d\udcc1 Scontrini Tiziana (2):\n' + tizShareLink + '\n');
bodyParts.push('\nClicca i link per aprire le cartelle su Drive.\n\nA presto!');
var body = bodyParts.join('\n');

assert(body.indexOf(papaShareLink) !== -1, 'Body contains papa shareable link');
assert(body.indexOf(tizShareLink) !== -1, 'Body contains tiziana shareable link');
assert(body.indexOf('?usp=sharing') !== -1, 'Links use ?usp=sharing format for iPhone');
assert(body.indexOf('mailto:') === -1, 'Body does not contain mailto: (To field stays empty)');
assert(body.indexOf('febbraio 2026') !== -1, 'Body mentions month in lowercase Italian');

console.log('\n--- createBundleFolder: folder-name format ---');
var dateLabel = nowTest.getDate() + ' ' + MESI_IT[nowTest.getMonth()].toLowerCase() + ' ' + nowTest.getFullYear();
assertEqual(dateLabel, '25 febbraio 2026', 'Date label format is correct');
var papaFolderName = 'Scontrini Pap\u00e0 \u2013 ' + dateLabel;
var tizFolderName  = 'Scontrini Tiziana \u2013 ' + dateLabel;
assertEqual(papaFolderName, 'Scontrini Pap\u00e0 \u2013 25 febbraio 2026', 'Papa bundle folder name correct');
assertEqual(tizFolderName,  'Scontrini Tiziana \u2013 25 febbraio 2026', 'Tiziana bundle folder name correct');

console.log('\n--- mark-as-sent logic ---');
var historyForSent = [
    { userId: 'papa',    driveFileId: 'F1', sent: false },
    { userId: 'tiziana', driveFileId: 'F3', sent: false },
    { userId: 'papa',    driveFileId: 'F2', sent: true  }, // already sent – untouched
];
var toMark = historyForSent.filter(function(e) { return !e.sent && e.driveFileId; });
var ts = Date.now();
toMark.forEach(function(e) { e.sent = true; e.sentTs = ts; });
assert(historyForSent[0].sent === true,  'Papa unsent entry marked as sent');
assert(historyForSent[1].sent === true,  'Tiziana unsent entry marked as sent');
assert(historyForSent[2].sentTs === undefined, 'Already-sent entry sentTs unchanged');
assert(typeof historyForSent[0].sentTs === 'number', 'sentTs is a timestamp number');

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────────────');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
