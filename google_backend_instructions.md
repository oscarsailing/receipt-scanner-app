# Google Apps Script Setup Guide

To enable "invisible" uploading to Google Drive without requiring the user to log in, we will use a **Google Apps Script** deployed as a Web App.

## 1. Create the Script
1. Go to [script.google.com](https://script.google.com/) and click **"New Project"**.
2. Name the project **"Receipt Scanner Backend"**.
3. Delete any code in the `Code.gs` file and paste the following:

```javascript
/* 
  RECEIPT SCANNER BACKEND
  Handles POST requests with base64 image data and saves to Google Drive.
*/

// CONFIGURATION
const FOLDER_NAME = "Scontrini Papà"; // Name of the folder to save receipts in

function doPost(e) {
  try {
    // 1. Parse the incoming JSON data
    const data = JSON.parse(e.postData.contents);
    const base64Image = data.image; // Expecting "data:image/jpeg;base64,..."
    const filename = data.filename || `Scontrino_${new Date().toISOString()}.jpg`;
    
    // 2. Decode the Base64 string
    // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
    const encodedImage = base64Image.split(',')[1];
    const decodedImage = Utilities.base64Decode(encodedImage);
    const blob = Utilities.newBlob(decodedImage, "image/jpeg", filename);
    
    // 3. Get or Create the Folder
    const folder = getFolderByName(FOLDER_NAME);
    
    // 4. Create the File
    const file = folder.createFile(blob);
    
    // 5. Return Success Response
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Receipt uploaded successfully",
      fileId: file.getId(),
      url: file.getUrl()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    // Return Error Response
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Helper function to find or create the folder
function getFolderByName(name) {
  const folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return DriveApp.createFolder(name);
  }
}
```

## 2. Deploy the Web App
1. Click the blue **"Deploy"** button (top right) > **"New deployment"**.
2. Click the gear icon next to "Select type" and choose **"Web app"**.
3. Fill in the details:
   - **Description:** "Receipt Scanner API"
   - **Execute as:** **"Me"** (This is crucial! It means the script uses YOUR storage/quota).
   - **Who has access:** **"Anyone"** (This allows the app to send data without the user logging in).
4. Click **"Deploy"**.
5. You will be asked to **Authorize** the script. Click "Review permissions", select your account, and allow access to Drive.
6. **COPY the "Web App URL"** generated at the end. It looks like `https://script.google.com/macros/s/.../exec`.

**Deployment ID**
AKfycbzS6YO0t-NkYCjCsfthYT7jpyT2BM3UsYpsfjbWRzCRttF6xB0L6il2IpymRiGuN3VV

**URL**
https://script.google.com/macros/s/AKfycbzS6YO0t-NkYCjCsfthYT7jpyT2BM3UsYpsfjbWRzCRttF6xB0L6il2IpymRiGuN3VV/exec

## 3. Connect to the App
1. Open `app.js` in your text editor.
2. Find the line: `const GOOGLE_SCRIPT_URL = 'YOUR_WEB_APP_URL_HERE';`
3. Replace `'YOUR_WEB_APP_URL_HERE'` with the URL you just copied.
