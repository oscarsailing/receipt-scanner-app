// =============================================================================
// SCONTRINI PAPÀ — app.js
// Developer: set your Google Cloud OAuth 2.0 Client ID below.
// The user (dad) never needs to touch this file.
// =============================================================================

// ── DEVELOPER CONFIG ─────────────────────────────────────────────────────────
const CLIENT_ID   = localStorage.getItem('google_client_id') || 'YOUR_CLIENT_ID_HERE';
const SCOPES      = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = 'Scontrini Papà';
const MAX_HISTORY = 20; // max thumbnails stored in localStorage

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

const offlineBanner     = document.getElementById('offline-banner');
const offlineText       = document.getElementById('offline-text');

const alertModal        = document.getElementById('alert-modal');
const alertTitleEl      = document.getElementById('alert-title');
const alertMessageEl    = document.getElementById('alert-message');
const alertBtn          = document.getElementById('alert-btn');

// ── STATE ─────────────────────────────────────────────────────────────────────
let tokenClient   = null;
let accessToken   = null;
let tokenExpiry   = 0;       // epoch ms when token expires
let driveFolderId = localStorage.getItem('drive_folder_id') || null;

// Offline queue: array of { dataUrl, mimeType, timestamp }
let offlineQueue  = JSON.parse(localStorage.getItem('offline_queue') || '[]');

// Upload history: array of { thumbDataUrl, name, ts }
let uploadHistory = JSON.parse(localStorage.getItem('upload_history') || '[]');

// =============================================================================
// NAVIGATION
// =============================================================================
function showScreen(screenEl) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screenEl.classList.add('active');
}

function showAlert(title, message) {
    alertTitleEl.textContent = title;
    alertMessageEl.textContent = message;
    alertModal.classList.add('active');
}

alertBtn.addEventListener('click', () => alertModal.classList.remove('active'));

// =============================================================================
// INIT
// =============================================================================
window.addEventListener('load', () => {
    // Allow developer to set Client ID via URL param (magic link)
    const params = new URLSearchParams(window.location.search);
    if (params.get('client_id')) {
        localStorage.setItem('google_client_id', params.get('client_id'));
        window.history.replaceState({}, document.title, window.location.pathname);
        window.location.reload(); // reload so CLIENT_ID picks it up
        return;
    }

    renderHistory();
    updateCounterUI();
    updateQueueBadge();

    // Try to init Google client (it may not be loaded yet if async)
    tryInitClient();

    // Offline / online listeners (G-3)
    window.addEventListener('online',  onNetworkOnline);
    window.addEventListener('offline', () => updateQueueBadge());
});

function tryInitClient() {
    if (typeof google !== 'undefined' && google.accounts) {
        initClient();
    } else {
        // SDK hasn't loaded yet — retry in 500ms
        setTimeout(tryInitClient, 500);
    }
}

function initClient() {
    if (!CLIENT_ID || CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
        console.warn('[Scontrini] No Google Client ID configured. Set it via ?client_id= URL param.');
        return;
    }
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: onTokenReceived,
    });
}

function onTokenReceived(tokenResponse) {
    if (tokenResponse.error) {
        showAlert('Errore Login', 'Non è stato possibile accedere con Google. Riprova.');
        return;
    }
    accessToken = tokenResponse.access_token;
    // expires_in is in seconds; subtract 5 min as a safety buffer
    tokenExpiry = Date.now() + (tokenResponse.expires_in - 300) * 1000;

    showCameraUI();
    // If there are queued photos waiting, attempt to flush them now
    if (offlineQueue.length > 0) flushOfflineQueue();
}

btnLogin.addEventListener('click', () => {
    if (!tokenClient) {
        // SDK still loading or no Client ID
        showAlert('Configurazione', 'Il sistema sta ancora caricando. Riprova tra un momento.');
        tryInitClient();
        return;
    }
    tokenClient.requestAccessToken({ prompt: '' });
});

// =============================================================================
// UI STATE HELPERS
// =============================================================================
function showCameraUI() {
    loginSection.style.display = 'none';
    cameraSection.style.display = 'flex';
}

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
        offlineText.textContent = `Offline — ${offlineQueue.length} foto in coda`;
        offlineBanner.style.display = 'flex';
    } else if (offlineQueue.length > 0 && navigator.onLine) {
        offlineText.textContent = `${offlineQueue.length} foto in coda da inviare…`;
        offlineBanner.style.display = 'flex';
    } else {
        offlineBanner.style.display = 'none';
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
// G-AI: IMAGE QUALITY CHECK (OpenCV.js)
// =============================================================================
function checkImageQuality(imgEl, imageUrl, file) {
    if (typeof cv === 'undefined' || !cv.Mat) {
        console.warn('[AI] OpenCV not ready — skipping quality check, uploading directly.');
        routeUpload(file, imageUrl);
        return;
    }

    try {
        const src = cv.imread(imgEl);
        const gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

        // Blur: Laplacian variance
        const lap = new cv.Mat();
        cv.Laplacian(gray, lap, cv.CV_64F);
        const mean = new cv.Mat(), std = new cv.Mat();
        cv.meanStdDev(lap, mean, std);
        const variance = std.doubleAt(0, 0) ** 2;

        // Brightness: grayscale mean
        const bMean = new cv.Mat(), bStd = new cv.Mat();
        cv.meanStdDev(gray, bMean, bStd);
        const brightness = bMean.doubleAt(0, 0);

        // Cleanup
        [src, gray, lap, mean, std, bMean, bStd].forEach(m => m.delete());

        console.log(`[AI] Variance=${variance.toFixed(1)} Brightness=${brightness.toFixed(1)}`);

        const BLUR_THRESHOLD       = 50;
        const BRIGHTNESS_THRESHOLD = 40;

        if (variance < BLUR_THRESHOLD) {
            showAlert('Foto sfocata', 'La foto è poco nitida. Tieni fermo il telefono e riprova.');
            resetApp();
        } else if (brightness < BRIGHTNESS_THRESHOLD) {
            showAlert('Foto scura', 'C\'è poca luce. Avvicinati a una fonte luminosa e riprova.');
            resetApp();
        } else {
            routeUpload(file, imageUrl);
        }
    } catch (err) {
        console.error('[AI] OpenCV error:', err);
        // Fail-safe: upload anyway rather than blocking the user
        routeUpload(file, imageUrl);
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
        offlineQueue.push({ dataUrl, mimeType: file.type, timestamp: Date.now() });
        saveQueue();
        updateQueueBadge();
        setTimeout(() => {
            showAlert('Offline', `Nessuna connessione. La foto è stata salvata (${offlineQueue.length} in coda). Verrà inviata appena torni online.`);
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
        try {
            setLoadingText(`☁️ Invio foto in coda (${offlineQueue.length} rimaste)…`);
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
        showScreen(cameraScreen);
    }
}

function saveQueue() {
    // Cap queue at 30 items to avoid filling storage
    if (offlineQueue.length > 30) offlineQueue = offlineQueue.slice(-30);
    localStorage.setItem('offline_queue', JSON.stringify(offlineQueue));
}

// =============================================================================
// G-2: TOKEN EXPIRY REFRESH
// =============================================================================
async function ensureValidToken() {
    if (!accessToken) throw new Error('NO_TOKEN');
    // If token expires in less than 5 min, request a fresh one first
    if (Date.now() > tokenExpiry) {
        console.log('[Auth] Token expired — requesting refresh');
        await new Promise((resolve, reject) => {
            const originalCallback = tokenClient.callback;
            tokenClient.callback = (res) => {
                tokenClient.callback = originalCallback;
                if (res.error) { reject(new Error(res.error)); return; }
                accessToken  = res.access_token;
                tokenExpiry  = Date.now() + (res.expires_in - 300) * 1000;
                resolve();
            };
            tokenClient.requestAccessToken({ prompt: '' });
        });
    }
}

// =============================================================================
// G-1: FIND OR CREATE "SCONTRINI PAPÀ" FOLDER
// =============================================================================
async function getOrCreateFolder() {
    // Use cached folder ID if available
    if (driveFolderId) return driveFolderId;

    // Search for existing folder
    const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name%3D'${encodeURIComponent(FOLDER_NAME)}'%20and%20mimeType%3D'application%2Fvnd.google-apps.folder'%20and%20trashed%3Dfalse&fields=files(id%2Cname)`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!searchRes.ok) throw new Error('Folder search failed: ' + searchRes.status);
    const searchData = await searchRes.json();

    if (searchData.files && searchData.files.length > 0) {
        driveFolderId = searchData.files[0].id;
    } else {
        // Create the folder
        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: FOLDER_NAME,
                mimeType: 'application/vnd.google-apps.folder',
            }),
        });
        if (!createRes.ok) throw new Error('Folder creation failed: ' + createRes.status);
        const createData = await createRes.json();
        driveFolderId = createData.id;
    }

    localStorage.setItem('drive_folder_id', driveFolderId);
    return driveFolderId;
}

// =============================================================================
// UPLOAD
// =============================================================================
async function uploadToGoogleDrive(file, imageUrl, opts = {}) {
    setLoadingText('☁️ Caricamento su Drive…');

    try {
        await ensureValidToken();           // G-2: refresh if needed
        const folderId = await getOrCreateFolder(); // G-1: find/create folder

        const dateStr  = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `Scontrino_${dateStr}.jpg`;

        const metadata = {
            name: fileName,
            mimeType: file.type || 'image/jpeg',
            parents: [folderId],            // G-1: upload into folder
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const response = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {
                method: 'POST',
                headers: new Headers({ Authorization: 'Bearer ' + accessToken }),
                body: form,
            }
        );

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Drive API ${response.status}: ${errBody}`);
        }

        const data = await response.json();
        console.log('[Upload] Success, file ID:', data.id);

        // Persist to history
        const thumb = await makeThumb(imageUrl);
        addToHistory({ thumbDataUrl: thumb, name: fileName, ts: Date.now() });

        // Show success screen
        successPreview.src = imageUrl;
        successFilename.textContent = fileName;
        showScreen(successScreen);

        // Auto-return after 3s
        setTimeout(() => resetApp(), 3000);

    } catch (err) {
        console.error('[Upload] Error:', err);

        if (err.message === 'NO_TOKEN') {
            showAlert('Sessione scaduta', 'Tocca "Accedi con Google" per riconnetterti.');
            showCameraLoggedOutUI();
        } else {
            showAlert('Errore invio', 'Non riesco a salvare su Drive. Controlla la connessione e riprova.');
        }

        if (!opts.fromQueue) resetApp();
        throw err; // re-throw so queue flush can detect failure
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
}

function renderHistory() {
    thumbnailList.innerHTML = '';
    if (uploadHistory.length === 0) {
        thumbnailStrip.style.display = 'none';
        return;
    }
    thumbnailStrip.style.display = 'block';
    uploadHistory.forEach(entry => {
        const item = document.createElement('div');
        item.className = 'thumbnail-item';
        item.setAttribute('role', 'listitem');
        item.title = entry.name;

        const img = document.createElement('img');
        img.src = entry.thumbDataUrl;
        img.alt = entry.name;

        const badge = document.createElement('div');
        badge.className = 'thumbnail-check';
        badge.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><use href="#icon-check-circle"/></svg>`;

        item.appendChild(img);
        item.appendChild(badge);
        thumbnailList.appendChild(item);
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
    showScreen(cameraScreen);
}

function showCameraLoggedOutUI() {
    loginSection.style.display = 'flex';
    cameraSection.style.display = 'none';
    showScreen(cameraScreen);
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
    const name = `Scontrino_queued_${timestamp}.jpg`;
    return new File([u8arr], name, { type: mimeType || 'image/jpeg' });
}
