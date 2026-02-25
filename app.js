// =============================================================================
// SCONTRINI PAPÀ — app.js
// Developer: set your Google Cloud OAuth 2.0 Client ID below.
// The user (dad) never needs to touch this file.
// =============================================================================

// ── DEVELOPER CONFIG ─────────────────────────────────────────────────────────
const CLIENT_ID   = localStorage.getItem('google_client_id') || '103872449955-maa3ttpalvbp2nqnuqmspm4v5f30o1at.apps.googleusercontent.com';
const SCOPES      = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = 'Scontrini Papà';
const MESI_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const USERS = [
    { id: 'papa',    label: 'I miei scontrini',  short: 'Papà',    suffix: 'Papà'    },
    { id: 'tiziana', label: 'Scontrini Tiziana',  short: 'Tiziana', suffix: 'Tiziana' },
];
const MAX_HISTORY = 40; // max thumbnails stored in localStorage
// Redirect URI must match exactly what is registered in Google Cloud Console
const REDIRECT_URI = 'https://oscarsailing.github.io/receipt-scanner-app/';

// ── DOM REFS ─────────────────────────────────────────────────────────────────
const btnLogin          = document.getElementById('btn-login');
const loginSection      = document.getElementById('login-section');
const cameraSection     = document.getElementById('camera-section');
const cameraInput       = document.getElementById('camera-input');

const cameraScreen      = document.getElementById('camera-screen');
const loadingScreen     = document.getElementById('loading-screen');
const successScreen     = document.getElementById('success-screen');

const loadingText       = document.getElementById('loading-text');
const loadingPreview    = document.getElementById('loading-preview');
const loadingPreviewWrap= document.getElementById('loading-preview-wrap');

const successPreview    = document.getElementById('success-preview');
const successFilename   = document.getElementById('success-filename');

const uploadCounter     = document.getElementById('upload-counter');
const counterText       = document.getElementById('counter-text');

const thumbnailStrip    = document.getElementById('thumbnail-strip');
const thumbnailList     = document.getElementById('thumbnail-list');
const btnOpenDrive      = document.getElementById('btn-open-drive');

const offlineBanner     = document.getElementById('offline-banner');
const offlineText       = document.getElementById('offline-text');

const alertModal        = document.getElementById('alert-modal');
const alertTitleEl      = document.getElementById('alert-title');
const alertMessageEl    = document.getElementById('alert-message');
const alertBtn          = document.getElementById('alert-btn');
const alertBtnOverride  = document.getElementById('alert-btn-override');

// Receipt viewer
const receiptModal          = document.getElementById('receipt-modal');
const receiptViewerImg      = document.getElementById('receipt-viewer-img');
const receiptViewerName     = document.getElementById('receipt-viewer-name');
const receiptCloseBtn       = document.getElementById('receipt-close-btn');
const receiptDeleteBtn      = document.getElementById('receipt-delete-btn');
const receiptConfirmBtn     = document.getElementById('receipt-confirm-btn');
const receiptCancelDeleteBtn= document.getElementById('receipt-canceldelete-btn');
const receiptActionsNormal  = document.getElementById('receipt-actions-normal');
const receiptActionsConfirm = document.getElementById('receipt-actions-confirm');

// Screen refs
const selectScreen      = document.getElementById('select-screen');
const userContextBar    = document.getElementById('user-context-bar');
const userContextLabel  = document.getElementById('user-context-label');
const btnBackToSelect   = document.getElementById('btn-back-to-select');
const userCountPapa     = document.getElementById('user-count-papa');
const userCountTiziana  = document.getElementById('user-count-tiziana');
const successFolderEl   = document.getElementById('success-folder');

// Chat
const chatFab     = document.getElementById('chat-fab');

// ── STATE ─────────────────────────────────────────────────────────────────────
let accessToken   = null;
let tokenExpiry   = 0;       // epoch ms when token expires
let driveFolderId = localStorage.getItem('drive_folder_id') || null;

// Offline queue: array of { dataUrl, mimeType, timestamp }
let offlineQueue  = JSON.parse(localStorage.getItem('offline_queue') || '[]');

// Upload history: array of { thumbDataUrl, name, ts, driveFileId, sent, sentTs }
let uploadHistory = JSON.parse(localStorage.getItem('upload_history') || '[]');

// Receipt viewer state
let viewingIndex = -1;

// Active user context (set when tapping a user card)
let activeUser = null; // one of USERS items

// =============================================================================
// NAVIGATION
// =============================================================================
function showScreen(screenEl) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screenEl.classList.add('active');
}

function showAlert(title, message, overrideLabel) {
    alertTitleEl.textContent = title;
    alertMessageEl.textContent = message;
    if (overrideLabel && alertBtnOverride) {
        alertBtnOverride.textContent = overrideLabel;
        alertBtnOverride.style.display = 'flex';
    } else if (alertBtnOverride) {
        alertBtnOverride.style.display = 'none';
        alertBtnOverride._overrideFn = null;
    }
    alertModal.classList.add('active');
}

alertBtn.addEventListener('click', () => alertModal.classList.remove('active'));
if (alertBtnOverride) {
    alertBtnOverride.addEventListener('click', () => {
        alertModal.classList.remove('active');
        if (alertBtnOverride._overrideFn) alertBtnOverride._overrideFn();
    });
}

// Show quality warning with optional override to upload anyway
function showQualityWarning(title, message, file, imageUrl) {
    if (alertBtnOverride) alertBtnOverride._overrideFn = () => routeUpload(file, imageUrl);
    showAlert(title, message, 'Invia lo stesso');
    resetApp();
}

// =============================================================================
// INIT
// =============================================================================
window.addEventListener('load', () => {
    // Allow developer to set Client ID via URL param (magic link)
    const params = new URLSearchParams(window.location.search);
    if (params.get('client_id')) {
        localStorage.setItem('google_client_id', params.get('client_id'));
        window.history.replaceState({}, document.title, window.location.pathname);
        window.location.reload();
        return;
    }

    // ── G-2: Parse OAuth token from URL hash (returned after redirect login) ──
    // Google returns: #access_token=TOKEN&expires_in=3600&...
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
        const hashParams = new URLSearchParams(hash.substring(1));
        const token = hashParams.get('access_token');
        const expiresIn = parseInt(hashParams.get('expires_in') || '3600', 10);
        if (token) {
            accessToken = token;
            tokenExpiry = Date.now() + (expiresIn - 300) * 1000;
            // Clean the token from the URL so it's not visible or bookmarked
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    renderHistory();
    updateCounterUI();
    updateQueueBadge();
    updateDriveLink();

    // Show correct UI state
    if (accessToken) {
        showSelectScreen();
        if (offlineQueue.length > 0) flushOfflineQueue();
    }

    // Offline / online listeners (G-3)
    window.addEventListener('online',  onNetworkOnline);
    window.addEventListener('offline', () => updateQueueBadge());
});

// Build Google OAuth URL and redirect the whole page to it.
// Works on iOS Safari in PWA/standalone mode. No popups needed.
function startGoogleLogin() {
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id',     CLIENT_ID);
    authUrl.searchParams.set('redirect_uri',  REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'token');
    authUrl.searchParams.set('scope',         SCOPES);
    authUrl.searchParams.set('prompt',        'select_account');
    window.location.href = authUrl.toString();
}

btnLogin.addEventListener('click', startGoogleLogin);

// =============================================================================
// UI STATE HELPERS
// =============================================================================
function showSelectScreen() {
    loginSection.style.display = 'none';
    cameraSection.style.display = 'none';
    if (userContextBar) userContextBar.style.display = 'none';
    if (chatFab) chatFab.style.display = 'flex';
    updateUserCardCounts();
    showScreen(selectScreen);
}

function selectUser(userId) {
    activeUser = USERS.find(function(u) { return u.id === userId; }) || USERS[0];
    if (userContextLabel) userContextLabel.textContent = activeUser.label;
    if (userContextBar) userContextBar.style.display = 'flex';
    cameraSection.style.display = 'flex';
    showScreen(cameraScreen);
}

if (btnBackToSelect) btnBackToSelect.addEventListener('click', function() {
    activeUser = null;
    showSelectScreen();
});

document.querySelectorAll('.user-card').forEach(function(card) {
    card.addEventListener('click', function() { selectUser(card.dataset.user); });
});

function updateCounterUI() {
    const count = uploadHistory.length;
    if (count > 0) {
        counterText.textContent = count;
        uploadCounter.style.display = 'flex';
    } else {
        uploadCounter.style.display = 'none';
    }
}

function updateQueueBadge() {
    if (offlineQueue.length > 0 && !navigator.onLine) {
        offlineText.textContent = 'Offline — ' + offlineQueue.length + ' foto in coda';
        offlineBanner.style.display = 'flex';
    } else if (offlineQueue.length > 0 && navigator.onLine) {
        offlineText.textContent = offlineQueue.length + ' foto in coda da inviare…';
        offlineBanner.style.display = 'flex';
    } else {
        offlineBanner.style.display = 'none';
    }
}

function updateDriveLink() {
    if (!btnOpenDrive) return;
    if (driveFolderId) {
        btnOpenDrive.href = `https://drive.google.com/drive/folders/${driveFolderId}`;
        btnOpenDrive.style.display = 'flex';
    } else {
        btnOpenDrive.style.display = 'none';
    }
}

// =============================================================================
// CAMERA INPUT → AI CHECK
// =============================================================================
cameraInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const imageUrl = URL.createObjectURL(file);

    // Show loading screen with photo preview immediately
    loadingPreview.src = imageUrl;
    loadingPreviewWrap.style.display = 'block';
    setLoadingText('🤖 Analisi qualità foto...');
    showScreen(loadingScreen);

    // Load image element for OpenCV
    const img = new Image();
    img.onload  = () => checkImageQuality(img, imageUrl, file);
    img.onerror = () => { showAlert('Errore', 'Impossibile leggere l\'immagine.'); resetApp(); };
    img.src = imageUrl;
});

function setLoadingText(msg) {
    if (loadingText) loadingText.textContent = msg;
}

// =============================================================================
// CANVAS: IMAGE QUALITY CHECK (no external library)
// =============================================================================
function checkImageQuality(imgEl, imageUrl, file) {
    try {
        const W = 120, H = 120;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgEl, 0, 0, W, H);
        const { data } = ctx.getImageData(0, 0, W, H);
        const total = W * H;

        // Brightness: average luma
        let luma = 0;
        for (let i = 0; i < data.length; i += 4) {
            luma += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        luma /= total;

        // Sharpness: Laplacian variance on luma channel
        const gray = new Float32Array(total);
        for (let i = 0; i < total; i++) gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];

        let lap = 0, lapSq = 0;
        for (let y = 1; y < H - 1; y++) {
            for (let x = 1; x < W - 1; x++) {
                const c = gray[y * W + x];
                const v = Math.abs(-c * 4 + gray[(y-1)*W+x] + gray[(y+1)*W+x] + gray[y*W+(x-1)] + gray[y*W+(x+1)]);
                lap += v; lapSq += v * v;
            }
        }
        const n = (W - 2) * (H - 2);
        const mean = lap / n;
        const variance = lapSq / n - mean * mean;

        console.log('[QA] luma=' + luma.toFixed(1) + ' variance=' + variance.toFixed(1));

        const BLUR_THRESH       = 20;   // lower than OpenCV because we use abs-lap not std²
        const DARK_THRESH       = 25;
        const OVEREXPOSED_THRESH= 248;

        if (luma < DARK_THRESH) {
            showQualityWarning('Foto scura', "C'è poca luce. Avvicinati a una fonte luminosa e riprova.", file, imageUrl);
        } else if (luma > OVEREXPOSED_THRESH) {
            showQualityWarning('Foto sovraesposta', 'Troppa luce diretta. Sposta lo scontrino in ombra e riprova.', file, imageUrl);
        } else if (variance < BLUR_THRESH) {
            showQualityWarning('Foto sfocata', 'La foto è poco nitida. Tieni fermo il telefono e riprova.', file, imageUrl);
        } else {
            routeUpload(file, imageUrl);
        }
    } catch (err) {
        console.error('[QA] Canvas error:', err);
        routeUpload(file, imageUrl); // fail-safe
    }
}

// =============================================================================
// G-3: OFFLINE QUEUE ROUTER
// =============================================================================
async function routeUpload(file, imageUrl) {
    if (!navigator.onLine) {
        // Queue for later
        setLoadingText('Offline — foto salvata in coda');
        const dataUrl = await fileToDataUrl(file);
        offlineQueue.push({ dataUrl: dataUrl, mimeType: file.type, timestamp: Date.now(), userId: activeUser ? activeUser.id : 'papa' });
        saveQueue();
        updateQueueBadge();
        setTimeout(function() {
            showAlert('Offline', 'Nessuna connessione. La foto è stata salvata (' + offlineQueue.length + ' in coda). Verrà inviata appena torni online.');
            resetApp();
        }, 800);
        return;
    }
    await uploadToGoogleDrive(file, imageUrl);
}

function onNetworkOnline() {
    updateQueueBadge();
    if (offlineQueue.length > 0 && accessToken) {
        flushOfflineQueue();
    }
}

async function flushOfflineQueue() {
    // Process one at a time to avoid rate limiting
    while (offlineQueue.length > 0) {
        const item = offlineQueue[0];
        // Restore user context for this queued item
        if (item.userId) activeUser = USERS.find(function(u) { return u.id === item.userId; }) || USERS[0];
        try {
            setLoadingText('\u2601\ufe0f Invio foto in coda (' + offlineQueue.length + ' rimaste)\u2026');
            showScreen(loadingScreen);
            loadingPreviewWrap.style.display = 'block';
            loadingPreview.src = item.dataUrl;

            const file = dataUrlToFile(item.dataUrl, item.mimeType, item.timestamp);
            await uploadToGoogleDrive(file, item.dataUrl, { fromQueue: true });

            offlineQueue.shift(); // remove successfully uploaded item
            saveQueue();
            updateQueueBadge();
        } catch (err) {
            console.error('[Queue] Flush error:', err);
            break; // stop if one fails (will retry on next online event)
        }
    }
    if (offlineQueue.length === 0) {
        showSelectScreen();
    }
}

function saveQueue() {
    // Cap queue at 30 items to avoid filling storage
    if (offlineQueue.length > 30) offlineQueue = offlineQueue.slice(-30);
    localStorage.setItem('offline_queue', JSON.stringify(offlineQueue));
}

// ── G-2: TOKEN EXPIRY CHECK ──────────────────────────────────────────────────
// With redirect flow, token refresh means sending the user through login again.
// We use prompt=none to attempt a silent re-auth first (no UI if session active).
async function ensureValidToken() {
    if (!accessToken) throw new Error('NO_TOKEN');
    if (Date.now() > tokenExpiry) {
        console.log('[Auth] Token expired — attempting silent refresh');
        // Try silent re-auth: if Google session is still active, this returns
        // immediately with a new token without showing any UI.
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id',     CLIENT_ID);
        authUrl.searchParams.set('redirect_uri',  REDIRECT_URI);
        authUrl.searchParams.set('response_type', 'token');
        authUrl.searchParams.set('scope',         SCOPES);
        authUrl.searchParams.set('prompt',        'none');
        window.location.href = authUrl.toString();
        // Execution stops here; page will reload with new token in hash
        await new Promise(() => {}); // never resolves — redirect is in progress
    }
}

// =============================================================================
// MONTH HELPERS
// =============================================================================
function getMonthKey(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    return y + '-' + m;
}

function getMonthFolderName(userSuffix, d) {
    return MESI_IT[d.getMonth()] + ' ' + d.getFullYear() + ' \u2013 ' + userSuffix;
}

// =============================================================================
// G-1: FIND OR CREATE "SCONTRINI PAPÀ" ROOT FOLDER
// =============================================================================
async function getOrCreateFolder() {
    if (driveFolderId) return driveFolderId;

    const q = 'name%3D%27' + encodeURIComponent(FOLDER_NAME) + '%27%20and%20mimeType%3D%27application%2Fvnd.google-apps.folder%27%20and%20trashed%3Dfalse';
    const searchRes = await fetch(
        'https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id%2Cname)',
        { headers: { Authorization: 'Bearer ' + accessToken } }
    );
    if (!searchRes.ok) throw new Error('Folder search failed: ' + searchRes.status);
    const searchData = await searchRes.json();

    if (searchData.files && searchData.files.length > 0) {
        driveFolderId = searchData.files[0].id;
    } else {
        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
        });
        if (!createRes.ok) throw new Error('Folder creation failed: ' + createRes.status);
        const createData = await createRes.json();
        driveFolderId = createData.id;
    }

    localStorage.setItem('drive_folder_id', driveFolderId);
    updateDriveLink();
    return driveFolderId;
}

// =============================================================================
// PER-USER PER-MONTH SUBFOLDER
// =============================================================================
async function getOrCreateMonthlyFolder(userId, userSuffix) {
    var now = new Date();
    var monthKey = getMonthKey(now);
    var cacheKey = 'folder_' + userId + '_' + monthKey;
    var cached = localStorage.getItem(cacheKey);
    if (cached) return cached;

    var rootId = await getOrCreateFolder();
    var folderName = getMonthFolderName(userSuffix, now);

    // Search inside root folder
    var qParts = [
        "name='" + folderName.replace(/'/g, "\\'") + "'",
        "'" + rootId + "' in parents",
        "mimeType='application/vnd.google-apps.folder'",
        'trashed=false'
    ];
    var searchRes = await fetch(
        'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(qParts.join(' and ')) + '&fields=files(id,name)',
        { headers: { Authorization: 'Bearer ' + accessToken } }
    );
    if (!searchRes.ok) throw new Error('Monthly folder search failed: ' + searchRes.status);
    var sd = await searchRes.json();

    var folderId;
    if (sd.files && sd.files.length > 0) {
        folderId = sd.files[0].id;
    } else {
        var createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [rootId] }),
        });
        if (!createRes.ok) throw new Error('Monthly folder creation failed: ' + createRes.status);
        var cd = await createRes.json();
        folderId = cd.id;
    }

    localStorage.setItem(cacheKey, folderId);
    console.log('[Drive] Monthly folder: ' + folderName + ' id=' + folderId);
    return folderId;
}



// =============================================================================
// UPLOAD
// =============================================================================
async function uploadToGoogleDrive(file, imageUrl, opts) {
    opts = opts || {};
    var user = activeUser || USERS[0];
    setLoadingText('\u2601\ufe0f Caricamento su Drive\u2026');

    try {
        await ensureValidToken();
        var folderId = await getOrCreateMonthlyFolder(user.id, user.suffix);

        var dateStr  = new Date().toISOString().replace(/[:.]/g, '-');
        var fileName = 'Scontrino_' + dateStr + '.jpg';

        var metadata = {
            name: fileName,
            mimeType: file.type || 'image/jpeg',
            parents: [folderId],
        };

        var form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        var response = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {
                method: 'POST',
                headers: new Headers({ Authorization: 'Bearer ' + accessToken }),
                body: form,
            }
        );

        if (!response.ok) {
            var errBody = await response.text();
            throw new Error('Drive API ' + response.status + ': ' + errBody);
        }

        var data = await response.json();
        console.log('[Upload] Success, file ID:', data.id, 'folder:', folderId);

        // Persist to history
        var thumb = await makeThumb(imageUrl);
        var now = new Date();
        addToHistory({
            thumbDataUrl: thumb,
            name: fileName,
            ts: now.getTime(),
            driveFileId: data.id,
            driveFolderId: folderId,
            userName: user.short,
            userId: user.id,
            monthKey: getMonthKey(now),
            sent: false,
            sentTs: null
        });

        // Show success screen
        successPreview.src = imageUrl;
        successFilename.textContent = fileName;
        if (successFolderEl) {
            successFolderEl.textContent = getMonthFolderName(user.suffix, now) + ' su Drive';
        }
        showScreen(successScreen);

        // Auto-return after 3s
        setTimeout(function() { resetApp(); }, 3000);

    } catch (err) {
        console.error('[Upload] Error:', err);
        if (err.message === 'NO_TOKEN') {
            startGoogleLogin(); return;
        } else {
            showAlert('Errore invio', 'Non riesco a salvare su Drive. Controlla la connessione e riprova.');
        }
        if (!opts.fromQueue) resetApp();
        throw err;
    }
}


// =============================================================================
// HISTORY / THUMBNAILS
// =============================================================================
function addToHistory(entry) {
    uploadHistory.unshift(entry); // newest first
    if (uploadHistory.length > MAX_HISTORY) uploadHistory = uploadHistory.slice(0, MAX_HISTORY);
    localStorage.setItem('upload_history', JSON.stringify(uploadHistory));
    updateCounterUI();
    renderHistory();
    updateUserCardCounts();
}

function renderHistory() {
    thumbnailList.innerHTML = '';
    if (uploadHistory.length === 0) {
        thumbnailStrip.style.display = 'none';
        return;
    }
    thumbnailStrip.style.display = 'block';
    updateDriveLink();
    uploadHistory.forEach(function(entry, idx) {
        var item = document.createElement('div');
        item.className = 'thumbnail-item';
        item.setAttribute('role', 'listitem');
        item.title = entry.name;

        var img = document.createElement('img');
        img.src = entry.thumbDataUrl;
        img.alt = entry.name;
        item.appendChild(img);

        if (entry.userName) {
            var userBadge = document.createElement('div');
            userBadge.className = 'thumbnail-user';
            userBadge.textContent = entry.userName;
            item.appendChild(userBadge);
        }

        var checkBadge = document.createElement('div');
        checkBadge.className = 'thumbnail-check';
        checkBadge.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><use href="#icon-check-circle"/></svg>';
        item.appendChild(checkBadge);

        if (entry.sent) {
            var sentBadge = document.createElement('div');
            sentBadge.className = 'thumbnail-sent';
            sentBadge.textContent = 'SPEDITO';
            item.appendChild(sentBadge);
        }

        item.addEventListener('click', function() { openReceiptViewer(idx); });
        thumbnailList.appendChild(item);
    });
}

function updateUserCardCounts() {
    var now = new Date();
    var thisMonthKey = getMonthKey(now);
    USERS.forEach(function(user) {
        var count = uploadHistory.filter(function(e) {
            return e.userId === user.id && e.monthKey === thisMonthKey;
        }).length;
        var el = document.getElementById('user-count-' + user.id);
        if (el) el.textContent = count > 0 ? count + ' questo mese' : '0 questo mese';
    });
}

// Generate a small thumbnail (120×120 canvas) from an image URL
function makeThumb(imageUrl) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width  = 120;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            // Cover crop
            const size = Math.min(img.width, img.height);
            const sx = (img.width  - size) / 2;
            const sy = (img.height - size) / 2;
            ctx.drawImage(img, sx, sy, size, size, 0, 0, 120, 120);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = () => resolve('');
        img.src = imageUrl;
    });
}

// =============================================================================
// UTILITIES
// =============================================================================
function resetApp() {
    cameraInput.value = '';
    loadingPreviewWrap.style.display = 'none';
    loadingPreview.src = '';
    activeUser = null;
    if (accessToken) {
        showSelectScreen();
    } else {
        loginSection.style.display = 'flex';
        cameraSection.style.display = 'none';
        showScreen(cameraScreen);
    }
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function dataUrlToFile(dataUrl, mimeType, timestamp) {
    const arr = dataUrl.split(',');
    const bstr = atob(arr[1]);
    const u8arr = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
    const name = 'Scontrino_queued_' + timestamp + '.jpg';
    return new File([u8arr], name, { type: mimeType || 'image/jpeg' });
}

// =============================================================================
// RECEIPT VIEWER
// =============================================================================
function openReceiptViewer(idx) {
    if (!receiptModal) return;
    viewingIndex = idx;
    const entry = uploadHistory[idx];
    if (!entry) return;
    receiptViewerImg.src = entry.thumbDataUrl;
    receiptViewerName.textContent = entry.name;
    receiptActionsNormal.style.display = 'flex';
    receiptActionsConfirm.style.display = 'none';
    receiptModal.classList.add('active');
}

function closeReceiptViewer() {
    if (receiptModal) receiptModal.classList.remove('active');
    viewingIndex = -1;
}

function confirmDeleteReceipt() {
    const entry = uploadHistory[viewingIndex];
    if (!entry) { closeReceiptViewer(); return; }
    receiptActionsNormal.style.display = 'none';
    receiptActionsConfirm.style.display = 'flex';
}

async function executeDeleteReceipt() {
    const entry = uploadHistory[viewingIndex];
    if (!entry) { closeReceiptViewer(); return; }

    // Delete from Drive if we have an ID and a valid token
    if (entry.driveFileId && accessToken) {
        try {
            await fetch('https://www.googleapis.com/drive/v3/files/' + entry.driveFileId, {
                method: 'DELETE',
                headers: { Authorization: 'Bearer ' + accessToken }
            });
        } catch (err) {
            console.warn('[Delete] Drive delete failed:', err);
        }
    }

    // Remove from local history
    uploadHistory.splice(viewingIndex, 1);
    localStorage.setItem('upload_history', JSON.stringify(uploadHistory));
    updateCounterUI();
    renderHistory();
    closeReceiptViewer();
}

// Wire receipt viewer buttons
if (receiptCloseBtn)       receiptCloseBtn.addEventListener('click', closeReceiptViewer);
if (receiptDeleteBtn)      receiptDeleteBtn.addEventListener('click', confirmDeleteReceipt);
if (receiptConfirmBtn)     receiptConfirmBtn.addEventListener('click', executeDeleteReceipt);
if (receiptCancelDeleteBtn)receiptCancelDeleteBtn.addEventListener('click', () => {
    receiptActionsNormal.style.display = 'flex';
    receiptActionsConfirm.style.display = 'none';
});
if (receiptModal) receiptModal.addEventListener('click', (e) => {
    if (e.target === receiptModal) closeReceiptViewer();
});

// =============================================================================
// ACCOUNTANT BUTTON — bundle-and-share email flow
// =============================================================================

// Step 1: tally unsent receipts and ask for confirmation
function sendToAccountantFlow() {
    var unsentPapa = uploadHistory.filter(function(e) { return e.userId === 'papa' && !e.sent && e.driveFileId; });
    var unsentTiz  = uploadHistory.filter(function(e) { return e.userId === 'tiziana' && !e.sent && e.driveFileId; });

    if (unsentPapa.length === 0 && unsentTiz.length === 0) {
        showAlert('Niente da inviare', 'Non ci sono nuovi scontrini da inviare. Tutti gi\u00e0 spediti!');
        return;
    }

    var parts = [];
    if (unsentPapa.length > 0) parts.push(unsentPapa.length + ' scontrini di Pap\u00e0');
    if (unsentTiz.length > 0)  parts.push(unsentTiz.length + ' scontrini di Tiziana');

    if (alertBtnOverride) {
        alertBtnOverride._overrideFn = function() { executeSendToAccountant(unsentPapa, unsentTiz); };
    }
    showAlert(
        'Invia al commercialista',
        parts.join(' e ') + ' non ancora inviati. Creo le cartelle condivise e preparo l\'email?',
        'Prepara email'
    );
}

// Step 2: create bundle folders → share → open mailto
async function executeSendToAccountant(unsentPapa, unsentTiz) {
    // Show the loading screen (no image preview needed)
    loadingPreviewWrap.style.display = 'none';
    loadingPreview.src = '';
    showScreen(loadingScreen);

    try {
        await ensureValidToken();

        var now = new Date();
        var dateLabel = now.getDate() + ' ' + MESI_IT[now.getMonth()].toLowerCase() + ' ' + now.getFullYear();

        var papaShareLink = null;
        var tizShareLink  = null;

        if (unsentPapa.length > 0) {
            setLoadingText('\ud83d\udcc1 Creo cartella Pap\u00e0\u2026');
            var papaId = await createBundleFolder('Pap\u00e0', dateLabel, unsentPapa);
            await makeShareable(papaId);
            papaShareLink = 'https://drive.google.com/drive/folders/' + papaId + '?usp=sharing';
        }
        if (unsentTiz.length > 0) {
            setLoadingText('\ud83d\udcc1 Creo cartella Tiziana\u2026');
            var tizId = await createBundleFolder('Tiziana', dateLabel, unsentTiz);
            await makeShareable(tizId);
            tizShareLink = 'https://drive.google.com/drive/folders/' + tizId + '?usp=sharing';
        }

        // Natural-language subject
        var monthName = MESI_IT[now.getMonth()] + ' ' + now.getFullYear();
        var totalCount = unsentPapa.length + unsentTiz.length;
        var subject = 'Scontrini ' + monthName + ' \u2013 Pap\u00e0 e Tiziana';

        // Natural-language body
        var bodyParts = [
            'Ciao,\n\nti mando gli scontrini di ' +
            MESI_IT[now.getMonth()].toLowerCase() + ' ' + now.getFullYear() +
            ' (' + totalCount + ' scontrino' + (totalCount !== 1 ? 'i' : '') + ' in totale).\n'
        ];
        if (papaShareLink) {
            bodyParts.push(
                '\ud83d\udcc1 I miei scontrini (' + unsentPapa.length + '):\n' + papaShareLink + '\n'
            );
        }
        if (tizShareLink) {
            bodyParts.push(
                '\ud83d\udcc1 Scontrini Tiziana (' + unsentTiz.length + '):\n' + tizShareLink + '\n'
            );
        }
        bodyParts.push('\nClicca i link per aprire le cartelle su Drive.\n\nA presto!');

        var body   = bodyParts.join('\n');
        var mailto = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);

        // Mark as sent
        var sentTs = Date.now();
        unsentPapa.concat(unsentTiz).forEach(function(e) { e.sent = true; e.sentTs = sentTs; });
        localStorage.setItem('upload_history', JSON.stringify(uploadHistory));
        renderHistory();

        // Return to select screen, then open Mail
        showSelectScreen();
        window.location.href = mailto;

    } catch (err) {
        console.error('[Accountant]', err);
        showSelectScreen();
        showAlert('Errore', 'Non riesco a creare le cartelle. Controlla la connessione e riprova.');
    }
}

// Create a bundle folder under the root and copy receipts into it
async function createBundleFolder(userSuffix, dateLabel, receipts) {
    var rootId     = await getOrCreateFolder();
    var folderName = 'Scontrini ' + userSuffix + ' \u2013 ' + dateLabel;

    var createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method:  'POST',
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [rootId] })
    });
    if (!createRes.ok) throw new Error('Bundle folder creation failed: ' + createRes.status);
    var folderData = await createRes.json();
    var bundleId   = folderData.id;

    for (var i = 0; i < receipts.length; i++) {
        setLoadingText('\ud83d\udcc4 Copio ' + userSuffix + '\u2026 ' + (i + 1) + '/' + receipts.length);
        var copyRes = await fetch(
            'https://www.googleapis.com/drive/v3/files/' + receipts[i].driveFileId + '/copy',
            {
                method:  'POST',
                headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
                body:    JSON.stringify({ parents: [bundleId] })
            }
        );
        if (!copyRes.ok) {
            console.warn('[Bundle] Could not copy file', receipts[i].driveFileId, copyRes.status);
        }
    }

    return bundleId;
}

// Grant "anyone with the link" read access to a Drive file/folder
async function makeShareable(fileId) {
    var permRes = await fetch(
        'https://www.googleapis.com/drive/v3/files/' + fileId + '/permissions',
        {
            method:  'POST',
            headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
            body:    JSON.stringify({ role: 'reader', type: 'anyone' })
        }
    );
    if (!permRes.ok) {
        console.warn('[Share] Could not make shareable:', permRes.status);
        // Non-fatal: link still works for signed-in owner
    }
}

if (chatFab) chatFab.addEventListener('click', sendToAccountantFlow);

