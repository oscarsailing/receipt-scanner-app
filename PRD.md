# Product Requirements Document (PRD): Receipt Scanner App

## 1. Overview
**Product Name:** Receipt Scanner (Working Title)
**Objective:** To build a simple, efficient Progressive Web Application (PWA) that allows users to capture images of physical receipts and automatically upload them to a designated Google Drive folder.
**Target Device:** iPhone 6 (Must support iOS 12.x Safari, which is the maximum iOS version supported by iPhone 6).

## 2. Target Audience
Specifically designed for a non-digitally savvy user (the creator's father). The primary goal is **zero learning curve**. The interface must be foolproof, featuring massive buttons, high contrast, plain Italian instructions, and no hidden menus or complex settings.

## 3. Design System & UI/UX
* **Aesthetic:** macOS (OS X) inspired design system.
* **Principles:** Simple, minimal, and highly legible.
* **Visuals:** Use classic macOS visual cues—subtle drop shadows, rounded corners, frosted glass (blur) effects for overlays, and a clean, neutral color palette (whites, light grays, and system blue/green/red for primary actions). The UI should feel like a native, stripped-down Apple utility.

## 4. Key Features & Requirements

### 4.1. Ultra-Simple Camera Interface
* **Feature:** A full-screen camera view that opens immediately upon app launch.
* **Requirements:**
  * One massive, highly visible "Scatta Foto" (Take Photo) button styled like a classic macOS primary button.
  * Utilizes HTML5 `<input type="file" accept="image/*" capture="environment">` to directly open the native iOS camera.
  * Auto-focus and auto-flash are handled natively by the iOS camera app.

### 4.2. AI-Assisted Image Review
* **Feature:** A simple binary choice after taking a photo, augmented by a lightweight on-device AI check.
* **Requirements:**
  * **Quality Check:** Implement a lightweight, fully local in-browser AI model (e.g., TensorFlow.js or a simple OpenCV.js blur detection algorithm) to check if the image is too blurry or too dark *before* showing the review screen. *Note: Must be extremely lightweight to run in Safari on an iPhone 6 (1GB RAM).*
  * **Auto-Feedback:** If the image is poor quality, automatically show a friendly prompt in a macOS-style alert dialog: "La foto è un po' sfocata o scura. Riprova per favore!" (The photo is a bit blurry or dark. Please try again!) with a single "Riprova" (Try Again) button.
  * **Manual Review:** If the AI passes the image, show the captured photo clearly.
  * Two giant buttons: "Va Bene (Invia)" (Looks Good - Send) in Green and "Riprova" (Try Again) in Red, utilizing macOS button styling.
  * No editing, cropping, or filtering options.

### 4.3. Invisible Google Drive Integration
* **Feature:** Background uploading that requires zero user management.
* **Requirements:**
  * **Authentication:** Zero user authentication required. The app will communicate with a secure backend (e.g., Google Apps Script deployed as a Web App) that has pre-authorized access to the specific Google Drive folder.
  * **Folder Management:** Hardcoded to upload to a specific "Scontrini Papà" (Dad's Receipts) folder via the backend script. No folder selection UI for the user.
  * **Upload Mechanism:** Automatic background upload (via `fetch` or `XMLHttpRequest`) upon tapping "Va Bene (Invia)".
  * **File Naming:** Automatic timestamp naming (e.g., `Scontrino_YYYY-MM-DD_HH-MM-SS.jpg`) handled by the backend.

### 4.4. Plain Italian Status & Error Handling
* **Feature:** Clear, non-technical feedback in Italian.
* **Requirements:**
  * Show a simple "Invio in corso..." (Sending...) screen with a large macOS-style spinner (spinning beach ball or classic progress wheel).
  * Show a giant "Fatto! Scontrino Inviato." (Success! Receipt Sent.) screen with a checkmark, which automatically returns to the camera after 3 seconds.
  * **Error Handling:** If it fails, show a macOS-style alert dialog: "Ops, sembra che non ci sia internet. L'abbiamo salvato e riproveremo più tardi." (Uh oh, the internet might be disconnected. We saved it and will try again later.) (Implement basic offline queuing so he doesn't lose receipts if he has no signal).

## 5. User Flow
1. **Launch:** User opens the app and immediately sees the camera.
2. **Capture:** User taps the giant "Scatta Foto" button.
3. **AI Check:** The app quickly analyzes the photo for blurriness or darkness.
   * **If Bad:** App shows "La foto è un po' sfocata o scura. Riprova per favore!" and user taps "Riprova" (goes back to step 1).
   * **If Good:** App proceeds to Review.
4. **Review:** User taps the giant green "Va Bene (Invia)" button.
5. **Processing:** App shows "Invio in corso...".
6. **Confirmation:** App shows "Fatto!" and goes back to step 1.
*(Note: Authentication is handled entirely out-of-band by the developer during initial setup).*

## 6. Technical Specifications
* **Platform:** Progressive Web App (PWA) optimized for iOS Safari.
* **App Language:** Italian (UI and all user-facing text).
* **Frontend Stack:** HTML5, CSS3 (macOS styling), Vanilla JavaScript.
* **Backend Stack:** Google Apps Script (deployed as a Web App) to handle secure, server-side uploading to Google Drive without requiring client-side OAuth.
* **Minimum Deployment Target:** iOS 12.0 Safari (Crucial for iPhone 6 compatibility).
* **Third-Party APIs/Libraries:**
  * OpenCV.js or TensorFlow.js (for lightweight, fully local in-browser image quality analysis).
* **Required Device Permissions:**
  * Camera access (requested natively by Safari when using `<input type="file" capture>`).

## 7. Out of Scope (Future Enhancements)
* OCR (Optical Character Recognition) to extract text/amounts from the receipt.
* Offline queuing (saving receipts locally when offline and uploading them automatically when the connection is restored).
* Multi-page receipt scanning.
* Image cropping and perspective correction (document scanning UI).

## 8. Milestones
* **Phase 1:** UI/UX Design & Project Setup.
* **Phase 2:** Camera implementation and image capture flow.
* **Phase 3:** Google OAuth integration and Drive API setup.
* **Phase 4:** Upload functionality and error handling.
* **Phase 5:** Testing on physical iPhone 6 (iOS 12) and bug fixing.
* **Phase 6:** App Store submission.
