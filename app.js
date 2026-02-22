document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    // REPLACE THIS URL with your deployed Google Apps Script Web App URL
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzS6YO0t-NkYCjCsfthYT7jpyT2BM3UsYpsfjbWRzCRttF6xB0L6il2IpymRiGuN3VV/exec'; 

    // Elements
    const cameraInput = document.getElementById('camera-input');
    const previewImage = document.getElementById('preview-image');
    
    // Screens
    const cameraScreen = document.getElementById('camera-screen');
    const reviewScreen = document.getElementById('review-screen');
    const loadingScreen = document.getElementById('loading-screen');
    const successScreen = document.getElementById('success-screen');
    
    // Buttons
    const btnRetake = document.getElementById('btn-retake');
    const btnSend = document.getElementById('btn-send');
    
    // Alert Modal
    const alertModal = document.getElementById('alert-modal');
    const alertTitle = document.getElementById('alert-title');
    const alertMessage = document.getElementById('alert-message');
    const alertBtn = document.getElementById('alert-btn');

    let currentFile = null;

    // --- Navigation ---
    function showScreen(screenElement) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        screenElement.classList.add('active');
    }

    function showAlert(title, message) {
        alertTitle.textContent = title;
        alertMessage.textContent = message;
        alertModal.classList.add('active');
    }

    alertBtn.addEventListener('click', () => {
        alertModal.classList.remove('active');
    });

    // --- Camera Input Handling ---
    cameraInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        currentFile = file;
        const imageUrl = URL.createObjectURL(file);
        
        // Show loading while analyzing
        showScreen(loadingScreen);
        document.querySelector('#loading-screen h2').textContent = "Analisi foto...";

        // Load image for AI check
        const img = new Image();
        img.onload = () => {
            checkImageQuality(img, imageUrl);
        };
        img.src = imageUrl;
    });

    // --- AI Image Quality Check (OpenCV.js) ---
    function checkImageQuality(imgElement, imageUrl) {
        // Wait for OpenCV to be ready
        if (typeof cv === 'undefined' || !cv.Mat) {
            console.warn("OpenCV not loaded yet, skipping blur check.");
            proceedToReview(imageUrl);
            return;
        }

        try {
            // 1. Read image into OpenCV Mat
            let src = cv.imread(imgElement);
            let gray = new cv.Mat();
            
            // 2. Convert to grayscale
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
            
            // 3. Calculate Laplacian variance (Blur detection)
            let laplacian = new cv.Mat();
            cv.Laplacian(gray, laplacian, cv.CV_64F, 1, 1, 0, cv.BORDER_DEFAULT);
            
            let mean = new cv.Mat();
            let stddev = new cv.Mat();
            cv.meanStdDev(laplacian, mean, stddev);
            
            // Variance is standard deviation squared
            let variance = stddev.doubleAt(0, 0) * stddev.doubleAt(0, 0);
            
            // 4. Calculate Brightness (Mean of grayscale)
            let brightnessMean = new cv.Mat();
            let brightnessStddev = new cv.Mat();
            cv.meanStdDev(gray, brightnessMean, brightnessStddev);
            let brightness = brightnessMean.doubleAt(0, 0);

            console.log(`Blur Variance: ${variance.toFixed(2)}, Brightness: ${brightness.toFixed(2)}`);

            // Cleanup memory
            src.delete(); gray.delete(); laplacian.delete(); mean.delete(); stddev.delete(); brightnessMean.delete(); brightnessStddev.delete();

            // Thresholds (Adjust these based on testing)
            const BLUR_THRESHOLD = 50; // Lower is blurrier
            const DARK_THRESHOLD = 40; // Lower is darker (0-255)

            if (variance < BLUR_THRESHOLD || brightness < DARK_THRESHOLD) {
                // Image is bad
                showAlert("Attenzione", "La foto è un po' sfocata o scura. Riprova per favore!");
                cameraInput.value = ''; // Reset input
                showScreen(cameraScreen);
            } else {
                // Image is good
                proceedToReview(imageUrl);
            }

        } catch (err) {
            console.error("Error during image analysis:", err);
            // Fallback to review if analysis fails
            proceedToReview(imageUrl);
        }
    }

    function proceedToReview(imageUrl) {
        previewImage.src = imageUrl;
        showScreen(reviewScreen);
    }

    // --- Review Actions ---
    btnRetake.addEventListener('click', () => {
        cameraInput.value = '';
        currentFile = null;
        showScreen(cameraScreen);
    });

    btnSend.addEventListener('click', () => {
        if (!currentFile) return;
        uploadToGoogleDrive(currentFile);
    });

    // --- Google Drive Upload ---
    async function uploadToGoogleDrive(file) {
        showScreen(loadingScreen);
        const spinner = document.querySelector('#loading-screen h2');
        spinner.textContent = "Invio in corso...";

        if (GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE') {
            showAlert("Errore di Configurazione", "Manca l'URL di Google Apps Script. Controlla le istruzioni.");
            showScreen(cameraScreen);
            return;
        }

        try {
            // 1. Convert File to Base64
            const base64Data = await toBase64(file);
            const filename = `Scontrino_${new Date().toISOString().replace(/:/g, '-')}.jpg`;

            // 2. Prepare Payload
            const payload = {
                image: base64Data,
                filename: filename,
                mimeType: file.type
            };

            // 3. Send POST Request to Google Apps Script
            // Note: mode: 'no-cors' is often needed for GAS Web Apps if not handling cors headers perfectly, 
            // but 'no-cors' makes response opaque. Better to use standard fetch if script returns JSON correctly.
            // If CORS issues persist, use JSONP or a proxy, but for personal use, standard POST usually works 
            // if the script is deployed as "Me" and access is "Anyone".
            
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            // Handle potential CORS opaque response or real JSON
            if (response.ok || response.type === 'opaque') {
                // Success!
                showScreen(successScreen);
                setTimeout(() => {
                    resetApp();
                }, 3000);
            } else {
                throw new Error("Errore durante l'invio al server.");
            }

        } catch (error) {
            console.error("Upload Error:", error);
            showAlert("Errore di Invio", "Ops, sembra che non ci sia internet. L'abbiamo salvato e riproveremo più tardi.");
            // Ideally, save to localStorage here for retry later
            showScreen(reviewScreen);
        }
    }

    function resetApp() {
        cameraInput.value = '';
        currentFile = null;
        showScreen(cameraScreen);
    }

    // Helper: Convert File to Base64
    function toBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }
});