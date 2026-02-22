# Product Requirements Document (PRD): Scontrini Papà

**Last Updated:** 22 February 2026  
**Status:** In Development — Active

---

## 1. Overview
**Product Name:** Scontrini Papà  
**Objective:** A simple, robust Progressive Web App (PWA) that allows a user to take a photo of a physical receipt. A local AI check assesses image quality; if acceptable the image is automatically uploaded to a dedicated Google Drive folder organised by user and month. The app also handles sending a summary email to the accountant.  
**Deployment:** GitHub Pages (HTTPS), accessible via browser on iOS Safari and installable as a PWA.  
**Target Device:** iPhone 6, iOS 12.x Safari (maximum OS version available on that device).

---

## 2. Target Audience
Designed for a single non-technical user: **dad**. He uses the app to scan receipts for **two people** — himself and his wife **Tiziana**. The **primary design constraint is zero learning curve**:
- All text must be in plain Italian.
- Buttons must be oversized and labelled clearly.
- No settings menus, no complex flows, no jargon.
- The distinction between the two users must be obvious at a glance — dad should never accidentally file a receipt under the wrong person.

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
* **Feature:** Immediately after capture, a local quality check assesses the image. No manual review step exists.
* **Requirements:**
  * Loading text shown: "🤖 Analisi qualità foto..."
  * **Engine:** Pure Canvas API — runs fully in-browser with no external dependencies.
  * **Blur check:** Laplacian variance on a 120×120 downscale — threshold `20`. Below = blurry.
  * **Brightness check:** Luma (weighted RGB) mean — `< 25` = too dark, `> 248` = overexposed.
  * **If Bad:** Alert shown with specific reason. App resets to camera.
  * **Override:** A secondary "Invia lo stesso" button appears in the alert, allowing dad to upload anyway if the quality warning is wrong.
  * **Fail-safe:** If Canvas throws an error the app skips the check and uploads directly (no silent blocking).

### 4.4. Automatic Google Drive Upload ✅ Implemented
* **Feature:** Validated images are uploaded to the user's Google Drive automatically, inside a folder named after the active user and the current month.
* **Requirements:**
  * **Authentication:** OAuth 2.0 implicit / redirect flow (full-page redirect, no popups — required for iOS PWA). Token parsed from URL hash on return.
  * **Upload API:** Google Drive API v3 multipart upload (`/upload/drive/v3/files?uploadType=multipart`).
  * **File Naming:** `Scontrino_<ISO-timestamp>.jpg`.
  * **Upload Destination:** Top-level folder `Scontrini Papà`, then a per-user-per-month subfolder — see Section 4.6.
  * **`driveFileId` stored** on each history entry, used for delete and email link generation.
  * **Loading text during upload:** "☁️ Caricamento su Drive..."
  * **On Success:** "✅ Fatto! Scontrino Inviato." screen shown for 3 seconds, then auto-resets to user-selection screen.
  * **On Error:** Alert shown. App resets.
  * **Token expiry:** Silent redirect-based refresh using `prompt=none` if token has expired.

### 4.5. Plain Italian Status & Error Handling ✅ Implemented
* All user-facing text is in Italian.
* macOS-style modal alert for errors (title + description + "OK" button).
* Secondary "Invia lo stesso" override button in quality-warning alerts.
* Loading screen with macOS-style CSS spinner.
* Success screen with oversized ✅ icon.

---

### 4.6. Multi-User Section Selection 🔲 To Implement
* **Feature:** Before scanning, dad selects *whose* receipt he is about to photograph. Two permanent sections are shown on the home screen.
* **Requirements:**
  * The home/camera screen shows **two tappable cards** as the primary UI, replacing the single "Scatta Foto" button:
    * **"I miei scontrini"** — dad's own receipts.
    * **"Scontrini Tiziana"** — receipts for mum (Tiziana).
  * Each card shows: the section name, a small receipt-count badge (total receipts scanned this month), and a large camera/scan icon.
  * Tapping a card sets the **active user context** for the current scan session (stored in memory, not persisted).
  * After selecting a user, the app transitions to a single-user camera screen that clearly shows whose section is active (e.g. header: "Scontrini Tiziana ✦ Scatta foto").
  * A back/cancel button returns to the section-selection screen without scanning.
  * After a successful upload the app returns to the **section-selection screen** (not straight back to either section), so dad can consciously choose next time.
  * The active user context is also shown on the loading and success screens so dad always knows which folder he is uploading into.

### 4.7. Monthly Drive Folder per User 🔲 To Implement
* **Feature:** Each user gets their own folder hierarchy in Google Drive, automatically organised by month.
* **Requirements:**
  * **Root folder:** `Scontrini Papà` (already created by the app).
  * **Per-user + per-month subfolder** inside the root, named: `{NomeMese} {Anno} – {NomeUtente}` (e.g. `Febbraio 2026 – Tiziana`, `Febbraio 2026 – Papà`).
    * Month names must be in Italian and title-cased.
    * The folder is created automatically on first upload of the month if it doesn't already exist.
    * Re-used across all uploads within the same calendar month for the same user.
  * The `driveFileId` of the monthly folder is **cached in `localStorage`** (key: `folder_{userName}_{YYYY-MM}`) so the app does not need to search Drive on every upload.
  * Each history entry stores: `{ ..., driveFileId, driveFolderId, userName, sent, sentTs }`.
  * The thumbnail strip is filtered/grouped by user section when visible.

### 4.8. Accountant Email Generator 🔲 To Update
* **Feature:** A floating "Commercialista" pill button (shown after login) prepares a complete, pre-filled email for the accountant with links to both users' receipts folders for the previous month.
* **Requirements:**
  * Button label: "✉ Commercialista". Visible only after login. Fixed bottom-right.
  * On tap, the app resolves the **previous calendar month's Drive folder** for each user:
    * Dad's folder: e.g. `Gennaio 2026 – Papà`
    * Tiziana's folder: e.g. `Gennaio 2026 – Tiziana`
  * Shows a confirmation alert: *"Trovati N scontrini per Papà e M per Tiziana di [mese]. Preparo l'email?"* with an **"Prepara email"** button and an **"Annulla"** to cancel.
  * On confirm, opens `mailto:` with:
    * **To:** *(empty — dad fills in the accountant's address himself)*
    * **Subject:** `Scontrini [NomeMese] [Anno] – Papà e Tiziana`
    * **Body:** structured Italian text, e.g.:
      ```
      Ciao,

      ti mando i link agli scontrini di [NomeMese] [Anno] su Google Drive:

      📁 I miei scontrini:
      https://drive.google.com/drive/folders/<folderIdPapa>

      📁 Scontrini Tiziana:
      https://drive.google.com/drive/folders/<folderIdTiziana>

      A presto!
      ```
  * After the `mailto:` is opened, all receipts from those two folders are marked `sent: true` in `localStorage` and the "SPEDITO" badge appears on their thumbnails.
  * If a folder for one user has no receipts for that month, that section is omitted from the email body gracefully.
  * If no `accountantEmail` is stored (previously set via `?accountant=`), the To field is simply left empty (this is now the default intended behaviour — no config needed).

---

## 5. User Flows

### 5.1. Current Flow (single-user, implemented)

```
App Launch
    │
    ├── [No token] → Login Screen → Tap "Accedi con Google" → OAuth redirect → Return with token
    │
    ▼
Camera Screen
    │
    └── Tap "Scatta Foto" → Native iOS Camera
                    │
                    ▼
            Loading: "🤖 Analisi qualità foto..."
                    │
            ┌───────┴───────┐
            │               │
        [Bad Photo]     [Good Photo]
            │               │
       Alert+Override   Loading: "☁️ Caricamento..."
            │               │
     [Invia lo stesso] ┌────┴────┐
            └──────────┘  │       │
                      [Error]  [Success]
                         │        │
                    Alert+Reset  Success Screen
                                     │
                              Auto-reset after 3s
```

### 5.2. Target Flow (multi-user — Sections 4.6–4.8, to implement)

```
App Launch
    │
    ├── [No token] → Login Screen → OAuth redirect → Return with token
    │
    ▼
Section-Selection Screen              [✉ Commercialista button always visible]
    │
    ├── Tap "I miei scontrini" ──────────┐
    └── Tap "Scontrini Tiziana" ──────┐  │
                                      │  │
                                      ▼  ▼
                   Camera Screen (header shows active user)
                                      │
                              Tap "Scatta Foto" → Native iOS Camera
                                      │
                            ┌─────────┴─────────┐
                            │                   │
                        [Bad Photo]         [Good Photo]
                            │                   │
                       Alert+Override    Upload to {Month} – {User} folder on Drive
                                               │
                                        Success Screen (shows user + folder)
                                               │
                                   ← Back to Section-Selection

    [Commercialista button tapped]
        │
        ▼
    Confirmation alert:
    "N scontrini Papà + M scontrini Tiziana di [mese scorso]. Preparo email?"
        │
        ├── "Annulla" → dismiss
        └── "Prepara email" → mailto: opens
                               To: (empty — dad fills in)
                               Subject: "Scontrini [Mese] [Anno] – Papà e Tiziana"
                               Body: folder links for both users
                               │
                    Receipts marked "SPEDITO" in local history
```

---

## 6. Technical Specifications

| Property | Value |
|---|---|
| Platform | Progressive Web App (PWA) |
| Language | Italian (all UI text) |
| Hosting | GitHub Pages (HTTPS) |
| Frontend Stack | HTML5, CSS3, Vanilla JavaScript (ES6+) |
| Quality Check Engine | Pure Canvas API (client-side, no CDN dependency) |
| Authentication | OAuth 2.0 implicit redirect flow (no popups — iOS PWA compatible) |
| Upload API | Google Drive API v3 (multipart upload) |
| Drive Folder Structure | `Scontrini Papà / {NomeMese YYYY} – {NomeUtente}` |
| localStorage keys | `google_client_id`, `drive_folder_id`, `upload_history`, `offline_queue`, `folder_{user}_{YYYY-MM}` |
| Minimum Target | iOS 12.0, Safari (iPhone 6) |
| PWA Manifest | `manifest.json` with name, icons, `start_url`, display mode |
| Users | 2 fixed: "Papà" (dad) and "Tiziana" (mum) |

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

| # | Gap | Status | Impact | Priority |
|---|---|---|---|---|
| G-1 | Upload destination was Drive root. | ✅ Resolved — uploads now go into `Scontrini Papà` folder | — | — |
| G-2 | OAuth token expiry no auto-refresh. | ✅ Resolved — silent redirect refresh via `prompt=none` | — | — |
| G-3 | No offline queuing. | ✅ Resolved — offline queue implemented with auto-flush on reconnect | — | — |
| G-4 | OpenCV.js CDN dependency. | ✅ Resolved — replaced with pure Canvas quality check, no CDN | — | — |
| G-5 | No app icon in repo. | ✅ Resolved — `icon-192.png` and `icon-512.png` present | — | — |
| G-6 | **Multi-user section selection not implemented.** App treats all receipts as a single undifferentiated stream. | 🔲 Open | High | **Highest** |
| G-7 | **Drive folder not organised by user or month.** All receipts go into one flat folder. | 🔲 Open | High | **Highest** |
| G-8 | **Accountant email uses hardcoded To field** (set via `?accountant=` param). New requirement: To field must be **empty** so dad fills it in himself. | 🔲 Open | Medium | High |
| G-9 | **Thumbnail strip not filtered by user.** No way to see only Tiziana’s or only dad’s recent receipts. | 🔲 Open | Low | Medium |

---

## 10. Out of Scope (Future Enhancements)
* OCR to extract vendor name, date, or total amount from the receipt.
* Multi-page / multi-shot receipt scanning.
* Image cropping and perspective correction (document-scanner style UI).
* Push notifications to confirm uploads succeeded.
* Admin view to browse uploaded receipts from within the app.
* More than two users (the two users — Papà and Tiziana — are fixed and hardcoded).
