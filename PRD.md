# Product Requirements Document (PRD): Scontrini Papà

**Last Updated:** 22 February 2026
**Status:** In Development — Active

---

## 1. Overview
**Product Name:** Scontrini Papà
**Objective:** A simple, robust Progressive Web App (PWA) that allows a user to take a photo of a physical receipt. A local AI model checks the image quality; if acceptable it is automatically uploaded to that user's personal Google Drive. Zero technical knowledge required to use.
**Deployment:** GitHub Pages (HTTPS), accessible via browser on iOS Safari and installable as a PWA.
**Target Device:** iPhone 6, iOS 12.x Safari (maximum OS version available on that device).

---

## 2. Target Audience
Designed for a single non-technical user (dad). The **primary design constraint is zero learning curve**:
- All text must be in plain Italian.
- Buttons must be oversized and labelled clearly.
- No settings menus, no complex flows, no jargon.

---

## 3. Design System & UI/UX
* **Aesthetic:** macOS / OS X inspired — clean, minimal, trustworthy.
* **Visuals:** Drop shadows, rounded corners, frosted glass overlays, neutral palette (white, light grey, system blue/green/red). Should feel like a stripped-down native Apple utility.
* **Accessibility:** Extra large tap targets, high contrast, large readable font sizes.

---

## 4. Key Features & Requirements

### 4.1. First-Run Setup Wizard ✅ Implemented
* **Feature:** On first launch the app detects that no Google Client ID is stored and shows a one-time setup screen.
* **Requirements:**
  * Screen title: "Configurazione".
  * Text field: user pastes their Google Cloud OAuth 2.0 Client ID.
  * "Salva e Inizia" button saves the ID to `localStorage` and transitions to the camera screen.
  * **Magic URL:** App accepts `?client_id=<ID>` query parameter on launch. If present, it is automatically saved to `localStorage` and the URL is cleaned. This allows the developer to send a pre-configured link so the user never needs to type anything.
  * Once saved, the setup screen never appears again on that device.

### 4.2. Ultra-Simple Camera Interface ✅ Implemented
* **Feature:** A camera screen with a single prominent action button.
* **Requirements:**
  * One massive "📷 Scatta Foto" button (styled as a primary macOS button).
  * Uses `<input type="file" accept="image/*" capture="environment">` to invoke the native iOS camera.
  * "🔐 Accedi con Google" button visible when not yet authenticated; hidden once login is successful.
  * Connected status shown as "✅ Connesso a Google Drive" beneath the button.

### 4.3. AI-Driven Automated Quality Check ✅ Implemented
* **Feature:** Immediately after capture, a local AI model assesses the image. No manual review step exists.
* **Requirements:**
  * Loading text shown: "🤖 Analisi foto in corso..."
  * **Engine:** OpenCV.js (loaded async from CDN `https://docs.opencv.org/4.8.0/opencv.js`), runs fully in-browser.
  * **Blur check:** Laplacian variance — threshold `50`. Below = blurry.
  * **Brightness check:** Greyscale mean — threshold `40`. Below = too dark.
  * **If Bad (blur):** Alert shown — "❌ Foto sfocata — La foto è poco nitida. Prova a tenerla ferma e rifarla." App resets to camera.
  * **If Bad (dark):** Alert shown — "❌ Foto scura — C'è poca luce. Prova ad accendere una luce o spostarti." App resets to camera.
  * **If Good:** Upload begins automatically — no user action required.
  * **OpenCV fallback:** If OpenCV fails to load or throws an error, the app skips the AI check and uploads directly (no silent failure).

### 4.4. Automatic Google Drive Upload ✅ Implemented
* **Feature:** Validated images are uploaded to the user's Google Drive automatically.
* **Requirements:**
  * **Authentication:** Google Identity Services (OAuth 2.0 / `google.accounts.oauth2.initTokenClient`). The user logs in once with "Accedi con Google" per session; the `access_token` is held in memory.
  * **Upload API:** Google Drive API v3 multipart upload (`/upload/drive/v3/files?uploadType=multipart`).
  * **File Naming:** `Scontrino_<ISO-timestamp>.jpg` (e.g. `Scontrino_2026-02-22T14-30-00-000Z.jpg`).
  * **Upload Destination:** Currently uploads to the root of the user's Drive. ⚠️ **GAP — see Section 9.**
  * **Loading text during upload:** "☁️ Caricamento su Drive..."
  * **On Success:** "✅ Fatto! Scontrino Inviato." screen shown for 3 seconds, then auto-resets to camera.
  * **On Error:** Alert shown — "Errore Caricamento — Non sono riuscito a salvare la foto su Drive. Controlla la connessione." App resets to camera.
  * **Token expiry:** ⚠️ **GAP — see Section 9.** Access tokens expire after ~1 hour with no auto-refresh.

### 4.5. Plain Italian Status & Error Handling ✅ Implemented
* All user-facing text is in Italian.
* macOS-style modal alert for errors (title + description + "OK" button).
* Loading screen with macOS-style CSS spinner.
* Success screen with oversized ✅ icon.

---

## 5. Current User Flow

```
App Launch
    │
    ├── [First time only] → Setup Screen → Enter Client ID → Save
    │
    ▼
Camera Screen
    │
    ├── [Not logged in] → Tap "Accedi con Google" → Google OAuth popup → Logged in
    │
    └── [Logged in] → Tap "Scatta Foto" → Native iOS Camera
                            │
                            ▼
                    Loading: "🤖 Analisi foto..."
                            │
                    ┌───────┴───────┐
                    │               │
                [Bad Photo]     [Good Photo]
                    │               │
               Alert + Reset    Loading: "☁️ Caricamento..."
                                    │
                            ┌───────┴───────┐
                            │               │
                         [Error]        [Success]
                            │               │
                       Alert + Reset   Success Screen
                                           │
                                    Auto-reset after 3s
```

---

## 6. Technical Specifications

| Property | Value |
|---|---|
| Platform | Progressive Web App (PWA) |
| Language | Italian (all UI text) |
| Hosting | GitHub Pages (HTTPS) |
| Frontend Stack | HTML5, CSS3, Vanilla JavaScript (ES6+) |
| AI Engine | OpenCV.js 4.8.0 (CDN, async loaded, client-side) |
| Authentication | Google Identity Services (OAuth 2.0 Client-Side Token Flow) |
| Upload API | Google Drive API v3 (multipart upload) |
| Client ID Storage | `localStorage` (persists per device/browser) |
| Minimum Target | iOS 12.0, Safari (iPhone 6) |
| PWA Manifest | `manifest.json` with name, icons, display mode |

---

## 7. Repository Structure

```
receipt-scanner-app/
├── index.html         # App shell + all screens
├── app.js             # All logic: setup, auth, AI check, upload
├── styles.css         # macOS-inspired styling
├── manifest.json      # PWA manifest
├── icon-192.png       # App icon (required for PWA install)
├── PRD.md             # This document
├── google_drive_setup.md  # Google Cloud setup instructions
└── README.md
```

---

## 8. Deployment
The app is deployed via **GitHub Pages** from the `main` branch.

**To redeploy after changes:**
1. Commit and push changes to `main`.
2. GitHub Actions automatically rebuilds Pages (usually within 60 seconds).
3. Visit `https://<username>.github.io/<repo>/` to confirm.

**To configure for a new device (Magic URL):**
```
https://<username>.github.io/<repo>/?client_id=<YOUR_GOOGLE_CLIENT_ID>
```
Open this link on the target device once. The ID is saved to `localStorage` permanently.

---

## 9. Known Gaps & Open Issues

| # | Gap | Impact | Priority |
|---|---|---|---|
| G-1 | **Upload destination is Drive root**, not a dedicated "Scontrini Papà" folder. Receipts are hard to find. | Medium | High |
| G-2 | **OAuth token expires after ~1 hour** with no auto-refresh. User gets "Non Connesso" error mid-session with no clear prompt to re-login. | High | High |
| G-3 | **No offline queuing.** If the user has no internet, the receipt is lost — no retry mechanism. | Medium | Medium |
| G-4 | **OpenCV.js CDN dependency.** If the CDN is slow or unavailable, the AI check is skipped silently (upload proceeds but no quality gate). | Low | Low |
| G-5 | **No app icon (`icon-192.png`) confirmed in repo.** PWA install on iOS may show a blank icon. | Low | Medium |

---

## 10. Out of Scope (Future Enhancements)
* OCR to extract vendor name, date, or total amount from the receipt.
* Multi-page / multi-shot receipt scanning.
* Image cropping and perspective correction (document-scanner style UI).
* Offline queue (save locally when offline, auto-upload when reconnected).
* Push notifications to confirm uploads succeeded.
* Admin view to browse uploaded receipts from within the app.
