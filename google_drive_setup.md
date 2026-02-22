# Google Drive Integration Setup (User-Managed Backend)

To enable users to log in with their own Google account and upload directly to their Drive, you need to create a **Google Cloud Project**.

## 1. Create a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a **New Project** (e.g., "Scontrini Papà App").
3. Click **Create** and wait for it to finish.
4. Select the project from the notification bell.

## 2. Enable Google Drive API
1. In the left menu, go to **APIs & Services > Library**.
2. Search for **"Google Drive API"**.
3. Click on it and click **Enable**.

## 3. Configure OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**.
2. Select **External** (unless you have a Google Workspace organization, then select Internal). Click **Create**.
3. Fill in the required fields:
   - **App name:** Scontrini Papà
   - **User support email:** Your email.
   - **Developer contact information:** Your email.
4. Click **Save and Continue**.
5. **Scopes:** Click **Add or Remove Scopes**.
   - Filter for "drive.file".
   - Select `.../auth/drive.file` (View and manage Google Drive files and folders that you have opened or created with this app).
   - This scope ensures the app only accesses files it created, not the user's entire Drive.
   - Click **Update** then **Save and Continue**.
6. **Test Users:** Add your dad's email address (and yours for testing).
   - *Crucial:* Since the app is in "Testing" mode (unverified), only listed users can log in.
7. Click **Save and Continue**.

## 4. Create Credentials (Client ID)
1. Go to **APIs & Services > Credentials**.
2. Click **Create Credentials** > **OAuth client ID**.
3. Application type: **Web application**.
4. Name: "Scontrini Web Client".
5. **Authorized JavaScript origins:**
   - Add: `https://<your-username>.github.io`
   - Add: `http://127.0.0.1:5500` (for local testing).
6. **Authorized redirect URIs:**
   - Add: `https://<your-username>.github.io/receipt-scanner-app/`
   - Add: `http://127.0.0.1:5500/` (for local testing).
   - *Note: These must exactly match where your app is hosted.*
7. Click **Create**.
8. **Copy the "Client ID"**. It looks like `123456789-abcdefg.apps.googleusercontent.com`.

## 5. Update the App Code
1. Open `app.js` in your text editor.
2. Find the line: `const CLIENT_ID = 'YOUR_CLIENT_ID_HERE';`
3. Paste the Client ID you just copied.
