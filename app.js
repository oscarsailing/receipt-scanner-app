// =============================================================================
// SCONTRINI PAPÀ — app.js
// Developer: set your Google Cloud OAuth 2.0 Client ID below.
// The user (dad) never needs to touch this file.
// =============================================================================

// ── DEVELOPER CONFIG ─────────────────────────────────────────────────────────
const CLIENT_ID   = localStorage.getItem('google_client_id') || '103872449955-maa3ttpalvbp2nqnuqmspm4v5f30o1at.apps.googleusercontent.com';
const SCOPES      = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = 'Scontrini Papà';
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

// Chat
const chatFab     = document.getElementById('chat-fab');
const chatPanel   = document.getElementById('chat-panel');
const chatCloseBtn= document.getElementById('chat-close-btn');
const chatMessages= document.getElementById('chat-messages');
const chatChips   = document.getElementById('chat-chips');
const chatInput   = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');

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

// Chat state machine
let chatState = 'IDLE'; // IDLE | CONFIRM_SEND
let pendingEmailReceipts = [];

// Accountant email (set via ?accountant= URL param)
let accountantEmail = localStorage.getItem('accountant_email') || '';

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

    // Allow setting accountant email via ?accountant= param
    if (params.get('accountant')) {
        accountantEmail = params.get('accountant');
        localStorage.setItem('accountant_email', accountantEmail);
        window.history.replaceState({}, document.title, window.location.pathname);
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
        showCameraUI();
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
function showCameraUI() {
    loginSection.style.display = 'none';
    cameraSection.style.display = 'flex';
    if (chatFab) chatFab.style.display = 'flex';
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
    updateDriveLink();
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
        addToHistory({ thumbDataUrl: thumb, name: fileName, ts: Date.now(), driveFileId: data.id, sent: false, sentTs: null });

        // Show success screen
        successPreview.src = imageUrl;
        successFilename.textContent = fileName;
        showScreen(successScreen);

        // Auto-return after 3s
        setTimeout(() => resetApp(), 3000);

    } catch (err) {
        console.error('[Upload] Error:', err);

        if (err.message === 'NO_TOKEN') {
            // Token missing — send user through login again
            startGoogleLogin(); return;
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
    updateDriveLink();
    uploadHistory.forEach((entry, idx) => {
        const item = document.createElement('div');
        item.className = 'thumbnail-item';
        item.setAttribute('role', 'listitem');
        item.title = entry.name;

        const img = document.createElement('img');
        img.src = entry.thumbDataUrl;
        img.alt = entry.name;

        const badge = document.createElement('div');
        badge.className = 'thumbnail-check';
        badge.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><use href="#icon-check-circle"/></svg>';

        item.appendChild(img);
        item.appendChild(badge);

        if (entry.sent) {
            const sentBadge = document.createElement('div');
            sentBadge.className = 'thumbnail-sent';
            sentBadge.textContent = 'SPEDITO';
            item.appendChild(sentBadge);
        }

        item.addEventListener('click', () => openReceiptViewer(idx));
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
// CHAT ASSISTANT (scripted, no external AI)
// =============================================================================
function openChat() {
    if (!chatPanel) return;
    chatMessages.innerHTML = '';
    chatState = 'IDLE';
    pendingEmailReceipts = [];
    chatChips.style.display = 'flex';
    appendChatMsg('bot', 'Ciao! Posso aiutarti a inviare gli scontrini al commercialista o a controllare quanti ne hai salvati.');
    chatPanel.classList.add('active');
    chatInput.focus();
}

function closeChat() {
    if (chatPanel) chatPanel.classList.remove('active');
    chatState = 'IDLE';
}

function appendChatMsg(role, text) {
    const row = document.createElement('div');
    row.className = 'chat-msg chat-msg--' + role;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.textContent = text;
    row.appendChild(bubble);
    chatMessages.appendChild(row);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function handleChatSend() {
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';
    chatChips.style.display = 'none';
    appendChatMsg('user', text);
    processUserMessage(text);
}

function processUserMessage(text) {
    if (chatState === 'CONFIRM_SEND') {
        const t = text.toLowerCase();
        if (t.includes('si') || t.includes('ok') || t.includes('manda') || t.includes('invia') || t === 's') {
            executeSendToAccountant();
        } else {
            chatState = 'IDLE';
            appendChatMsg('bot', 'Ok, annullato. Posso aiutarti con altro?');
            chatChips.style.display = 'flex';
        }
        return;
    }
    const intent = detectIntent(text);
    if (intent === 'email')       initiateSendToAccountant();
    else if (intent === 'count')  showReceiptCount();
    else                          appendChatMsg('bot', 'Non ho capito. Prova a dire "manda email al commercialista" oppure "quanti scontrini ho".');
}

function detectIntent(text) {
    const t = text.toLowerCase();
    const emailWords = ['email', 'commercialista', 'manda', 'invia', 'spedisci', 'mandare', 'inviare'];
    const countWords = ['quanti', 'conta', 'numero', 'scontrini'];
    if (emailWords.some(w => t.includes(w))) return 'email';
    if (countWords.some(w => t.includes(w))) return 'count';
    return 'unknown';
}

function showReceiptCount() {
    const total = uploadHistory.length;
    const unsent = uploadHistory.filter(e => !e.sent).length;
    const sent   = total - unsent;
    appendChatMsg('bot', 'Hai ' + total + ' scontrini salvati: ' + unsent + ' da inviare, ' + sent + ' gia inviati.');
    chatChips.style.display = 'flex';
}

function getLastMonthUnsent() {
    const now = new Date();
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    return uploadHistory.filter(e => !e.sent && e.ts >= firstOfLastMonth && e.ts < firstOfThisMonth);
}

function initiateSendToAccountant() {
    if (!accountantEmail) {
        appendChatMsg('bot', 'Non ho l\'email del commercialista. Chiedi a chi gestisce l\'app di impostare ?accountant=email@esempio.it nell\'URL.');
        return;
    }
    pendingEmailReceipts = getLastMonthUnsent();
    if (pendingEmailReceipts.length === 0) {
        appendChatMsg('bot', 'Non ho trovato scontrini del mese scorso da inviare. Sono stati gia tutti spediti!');
        chatChips.style.display = 'flex';
        return;
    }
    const names = pendingEmailReceipts.map(e => e.name).join(', ');
    appendChatMsg('bot', 'Ho trovato ' + pendingEmailReceipts.length + ' scontrini del mese scorso: ' + names + '.\n\nVuoi che prepari l\'email per ' + accountantEmail + '? (Rispondi Si o No)');
    chatState = 'CONFIRM_SEND';
}

function executeSendToAccountant() {
    chatState = 'IDLE';
    const now = new Date();
    const monthName = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        .toLocaleString('it-IT', { month: 'long', year: 'numeric' });

    const subject = 'Scontrini ' + monthName;
    const lines = pendingEmailReceipts.map(e => {
        const d = new Date(e.ts).toLocaleDateString('it-IT');
        const link = e.driveFileId ? 'https://drive.google.com/file/d/' + e.driveFileId + '/view' : '(link non disponibile)';
        return '- ' + e.name + ' (' + d + '): ' + link;
    });
    const body = 'Ciao,\n\nti invio i link agli scontrini di ' + monthName + ' salvati su Google Drive:\n\n' + lines.join('\n') + '\n\nA presto!';

    const mailto = 'mailto:' + encodeURIComponent(accountantEmail) +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);
    window.location.href = mailto;

    // Mark receipts as sent
    pendingEmailReceipts.forEach(e => {
        const match = uploadHistory.find(h => h.ts === e.ts && h.name === e.name);
        if (match) { match.sent = true; match.sentTs = Date.now(); }
    });
    localStorage.setItem('upload_history', JSON.stringify(uploadHistory));
    renderHistory();

    appendChatMsg('bot', 'Email aperta! Ho segnato ' + pendingEmailReceipts.length + ' scontrini come "Spediti".');
    chatChips.style.display = 'flex';
    pendingEmailReceipts = [];
}

// Wire chat UI
if (chatFab)      chatFab.addEventListener('click', openChat);
if (chatCloseBtn) chatCloseBtn.addEventListener('click', closeChat);
if (chatSendBtn)  chatSendBtn.addEventListener('click', handleChatSend);
if (chatInput) {
    chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleChatSend(); });
}
if (chatPanel) {
    chatPanel.addEventListener('click', (e) => { if (e.target === chatPanel) closeChat(); });
}
document.querySelectorAll('.chat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        const intent = chip.dataset.intent;
        chatChips.style.display = 'none';
        if (intent === 'email')       initiateSendToAccountant();
        else if (intent === 'count')  showReceiptCount();
    });
});
