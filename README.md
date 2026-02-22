# Receipt Scanner PWA (Scontrini Papà)

A minimalist Progressive Web App (PWA) designed for capturing receipts and uploading them directly to a specific Google Drive folder. Built with a focus on extreme simplicity and accessibility for non-technical users.

## Features

*   **Zero Learning Curve:** One giant button to take a photo.
*   **Invisible Backend:** Authenticates via a Google Apps Script Web App (no user login required).
*   **AI Quality Check:** Uses OpenCV.js locally in the browser to detect blurry or dark images before uploading.
*   **Native Feel:** Designed with a macOS/iOS aesthetic and works as a standalone app when added to the easy Home Screen.
*   **Automated Workflow:**
    1.  Snap photo.
    2.  AI checks quality (auto-rejects bad photos).
    3.  User confirms ("Va Bene").
    4.  Uploads to "Scontrini Papà" folder in Google Drive.

## Setup Instructions

### 1. Google Drive Backend
To enable the "invisible" upload feature, you must deploy the Google Apps Script.
See [google_backend_instructions.md](google_backend_instructions.md) for the step-by-step guide.

Once deployed, update the `GOOGLE_SCRIPT_URL` in `app.js`.

### 2. Local Development
1.  Clone this repository.
2.  Open `index.html` in your browser (preferably Safari on iOS for camera testing).
3.  For a full PWA experience, serve the directory over HTTPS (e.g., using `http-server` or VS Code Live Server).

### 3. Deployment (GitHub Pages)
This app is designed to be hosted entirely on GitHub Pages.

1.  Push this code to your GitHub repository.
2.  Go to **Settings** > **Pages**.
3.  Select the `main` branch as the source.
4.  Click **Save**.
5.  Your app will be live at `https://<your-username>.github.io/receipt-scanner-app/`.

### 4. Installation on iPhone
1.  Open the GitHub Pages URL in **Safari** on the iPhone.
2.  Tap the **Share** button (box with arrow).
3.  Scroll down and tap **"Add to Home Screen"**.
4.  The app will appear as a native app icon on the home screen.

## Tech Stack
*   **Frontend:** HTML5, CSS3, Vanilla JavaScript
*   **AI:** OpenCV.js (for blur/brightness detection)
*   **Backend:** Google Apps Script (Drive API)
*   **Platform:** Web (PWA)

## Credits
Based on the "Receipt Scanner" PRD.
