// CONFIGURATION
const SCOPES = 'https://www.googleapis.com/auth/drive.file'; 
let CLIENT_ID = localStorage.getItem('google_client_id'); // Load from storage or null

// --- ELEMENTS ---
const btnLogin = document.getElementById('btn-login');
const userInfo = document.getElementById('user-info');
const cameraInput = document.getElementById('camera-input');

// Screens
const cameraScreen = document.getElementById('camera-screen');
// Setup Screen Element (Added dynamically or assumed to be in HTML)
const setupScreen = document.getElementById('setup-screen');
const loadingScreen = document.getElementById('loading-screen');
const successScreen = document.getElementById('success-screen');

// Configuration Elements
const btnSaveConfig = document.getElementById('btn-save-config');
const clientIdInput = document.getElementById('client-id-input');

// Alert Modal
const alertModal = document.getElementById('alert-modal');
const alertTitle = document.getElementById('alert-title');
const alertMessage = document.getElementById('alert-message');
const alertBtn = document.getElementById('alert-btn');

let currentFile = null;
let tokenClient;
let accessToken = null;

// --- Configuration Logic ---
function initApp() {
    // 1. Check for Client ID in URL (for easy setup via link)
    const urlParams = new URLSearchParams(window.location.search);
    const urlClientId = urlParams.get('client_id');
    
    if (urlClientId) {
        localStorage.setItem('google_client_id', urlClientId);
        CLIENT_ID = urlClientId;
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // 2. Check if we have a Client ID
    if (!CLIENT_ID) {
        // If not configured, show setup screen
        if(setupScreen) {
             showScreen(setupScreen);
        } else {
             // Fallback if HTML not updated yet
             const id = prompt("Inserisci il Google Client ID per configurare l'app:");
             if(id) {
                 localStorage.setItem('google_client_id', id);
                 CLIENT_ID = id;
                 window.location.reload();
             }
        }
        return;
    }

    // 3. Normal Startup
    showScreen(cameraScreen);
}

// Handle Setup Save
if(btnSaveConfig) {
    btnSaveConfig.addEventListener('click', () => {
        const inputId = clientIdInput.value.trim();
        if (inputId) {
            localStorage.setItem('google_client_id', inputId);
            CLIENT_ID = inputId;
            showScreen(cameraScreen);
            // Re-init client with new ID if needed
            initClient();
        } else {
            alert("Per favore inserisci un Client ID valido.");
        }
    });
}


// --- Navigation ---
function showScreen(screenElement) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    // Show target
    screenElement.classList.add('active');
}

function showAlert(title, message) {
    if(alertTitle) alertTitle.textContent = title;
    if(alertMessage) alertMessage.textContent = message;
    if(alertModal) alertModal.classList.add('active');
}

if(alertBtn) {
    alertBtn.addEventListener('click', () => {
        alertModal.classList.remove('active');
    });
}

// --- Google Identity Services Setup ---
function initClient() {
    if (typeof google === 'undefined') return;

    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
            accessToken = tokenResponse.access_token;
            if (accessToken) {
                updateLoginUI(true);
            }
        },
    });
}

function updateLoginUI(isLoggedIn) {
    if (isLoggedIn) {
        if(btnLogin) btnLogin.style.display = 'none';
        if(userInfo) {
            userInfo.style.display = 'block';
            userInfo.innerText = "✅ Connesso a Google Drive";
        }
        // Ensure camera button is visible
        const label = cameraInput.parentElement.querySelector('label');
        if (label) label.style.display = 'inline-block';
    } else {
        if(btnLogin) btnLogin.style.display = 'inline-block';
        if(userInfo) userInfo.style.display = 'none';
    }
}

// Initialize on load
window.onload = function() {
    initApp();
    // Check if Google Identity script is loaded
    if (typeof google === 'undefined') {
        console.warn("Google Script not loaded yet.");
    }
};

if(btnLogin) {
    btnLogin.addEventListener('click', () => {
         if (!tokenClient) initClient();
         // Request token
         if (tokenClient) tokenClient.requestAccessToken();
    });
}


// --- Camera Input Handling ---
if(cameraInput) {
    cameraInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        currentFile = file;
        const imageUrl = URL.createObjectURL(file);
        
        // Show AI Processing state
        showScreen(loadingScreen);
        const loadingText = document.querySelector('#loading-screen h2');
        if(loadingText) loadingText.textContent = "🤖 Analisi foto in corso...";

        // Load image for AI check
        const img = new Image();
        img.onload = () => {
            checkImageQuality(img, imageUrl, file);
        };
        img.onerror = () => {
            showAlert("Errore", "Impossibile caricare l'immagine scattata.");
            resetApp();
        };
        img.src = imageUrl;
    });
}

// --- AI Image Quality Check (OpenCV.js) ---
function checkImageQuality(imgElement, imageUrl, file) {
    // Check if OpenCV is ready
    if (typeof cv === 'undefined' || !cv.Mat) {
        console.warn("OpenCV not loaded yet. Skipping AI check and uploading directly.");
        uploadToGoogleDrive(file, imageUrl);
        return;
    }

    try {
        // 1. Read image into OpenCV Mat
        let src = cv.imread(imgElement);
        let gray = new cv.Mat();
        
        // 2. Convert to grayscale
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
        
        // 3. Calculate Laplacian variance (Focus/Blur detection)
        let laplacian = new cv.Mat();
        cv.Laplacian(gray, laplacian, cv.CV_64F);
        
        let mean = new cv.Mat();
        let stddev = new cv.Mat();
        cv.meanStdDev(laplacian, mean, stddev);
        
        // Variance = stddev^2
        let variance = stddev.doubleAt(0, 0) * stddev.doubleAt(0, 0);
        
        // 4. Calculate Brightness (Mean of grayscale)
        let brightnessMean = new cv.Mat();
        let brightnessStddev = new cv.Mat();
        cv.meanStdDev(gray, brightnessMean, brightnessStddev);
        let brightness = brightnessMean.doubleAt(0, 0);

        console.log(`Blur Variance: ${variance.toFixed(2)} (Threshold: 50), Brightness: ${brightness.toFixed(2)} (Threshold: 40)`);

        // Clean up
        src.delete(); gray.delete(); laplacian.delete(); 
        mean.delete(); stddev.delete(); 
        brightnessMean.delete(); brightnessStddev.delete();

        // 5. DECISION LOGIC
        // Lower variance = Blurry. Lower brightness = Dark.
        // Adjust these thresholds based on testing if needed.
        const BLUR_THRESHOLD = 50; 
        const BRIGHTNESS_THRESHOLD = 40; 

        if (variance < BLUR_THRESHOLD) {
            handleCheckFailure("Foto sfocata", "La foto è poco nitida. Prova a tenerla ferma e rifarla.");
        } else if (brightness < BRIGHTNESS_THRESHOLD) {
            handleCheckFailure("Foto scura", "C'è poca luce. Prova ad accendere una luce o spostarti.");
        } else {
            // SUCCESS: Proceed to upload automatically
            uploadToGoogleDrive(file, imageUrl);
        }

    } catch (err) {
        console.error("OpenCV execution error:", err);
        // If AI fails, safeguard by allowing upload anyway to avoid blocking user.
        uploadToGoogleDrive(file, imageUrl);
    }
}

function handleCheckFailure(title, message) {
    showAlert("❌ " + title, message);
    // Return to camera screen so they can try again
    resetApp();
}

// --- Google Drive Upload ---
async function uploadToGoogleDrive(file, imageUrl) {
    if (!accessToken) {
        showAlert("Non Connesso", "Per caricare le foto devi prima accedere con Google.");
        resetApp();
        return;
    }

    // Update Loading Screen
    const loadingText = document.querySelector('#loading-screen h2');
    if(loadingText) loadingText.textContent = "☁️ Caricamento su Drive...";
    
    // Create Metadata
    const dateTime = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `Scontrino_${dateTime}.jpg`;

    const metadata = {
        name: fileName,
        mimeType: file.type
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    try {
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
            body: form
        });

        if (response.ok) {
            const data = await response.json();
            console.log("File Uploaded:", data.id);
            
            // Show Success
            showScreen(successScreen);
            
            // Auto restart after 3 seconds
            setTimeout(() => {
                resetApp();
            }, 3000);
        } else {
            throw new Error(`Google API Error: ${response.status} ${response.statusText}`);
        }

    } catch (error) {
        console.error("Upload failed", error);
        showAlert("Errore Caricamento", "Non sono riuscito a salvare la foto su Drive. Controlla la connessione.");
        resetApp(); // Reset regardless of error so user isn't stuck
    }
}

function resetApp() {
    if(cameraInput) cameraInput.value = ''; // Clear file input
    currentFile = null;
    showScreen(cameraScreen);
}
