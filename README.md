# PII Masker Extension - Complete Setup Guide

## Prerequisites

- **Python 3.7+** installed
- **Google Chrome** or **Microsoft Edge** browser
- **Text editor** (VS Code, Notepad++, or any code editor)

---

## Step 1: Create Project Folder

1. Create a new folder on your Desktop called `PII-Masker`
2. Open this folder in your file explorer

---

## Step 2: Create All Required Files

Create these 6 files in your `PII-Masker` folder:

### File 1: `manifest.json`

### File 2: `popup.html`


### File 3: `popup.css`


### File 4: `popup.js`


### File 5: `content.js`

### File 6: `main.py`



## Step 3: Install Python Dependencies

1. **Open Command Prompt or Terminal**
2. **Navigate to your project folder:**
   ```bash
   cd Desktop\PII-Masker
   ```

3. **Install required Python packages:**
   ```bash
   pip install presidio-analyzer presidio-anonymizer flask flask-cors spacy
   or
   pip install -r requirements.txt
   ```

4. **Download the English language model for spaCy:**
   ```bash
   python -m spacy download en_core_web_lg
   ```

   > **Note:** This may take a few minutes to download (~500MB)

---

## Step 4: Test the Python Server

1. **Start the server:**
   ```bash
   python main.py
   ```

2. **You should see:**
   ```
   Starting PII Masking Server on port 5000...
   * Running on http://127.0.0.1:5000
   ```

3. **Test it's working:**
   - Open your browser
   - Go to: `http://127.0.0.1:5000/health`
   - You should see: `{"status":"ok"}`

4. **Keep this terminal window open!** The server needs to run while using the extension.

---

## Step 5: Load Extension in Chrome

1. **Open Chrome**
2. **Go to:** `chrome://extensions/`
3. **Enable "Developer mode"** (toggle in top-right corner)
4. **Click "Load unpacked"** button
5. **Select your `PII-Masker` folder**
6. **The extension should now appear** in your extensions list

### Grant Permissions:
1. **Click "Details"** on your extension
2. **Scroll to "Site access"**
3. **Select "On all sites"**

---

## Step 6: Test the Extension

1. **Open a test webpage** (e.g., `https://example.com`)
2. **Open the test page with PII content:**
   - Create a simple HTML file or use a site with text
   - Example text to test: "My email is john@example.com and my phone is 555-123-4567"

3. **Click the extension icon** in your toolbar
4. **Click the toggle button** to turn it **ON** (should turn red)
5. **Open DevTools** (F12) → Console tab
6. **Look for logs:**
   - "PII Masker content script loaded"
   - "Starting to mask page..."
   - "Found X text nodes to process"
   - "Masked text: ..." (showing before/after)

---

## Step 7: Verify It's Working

If working correctly, you should see:

✅ **In the webpage console:**
```
PII Masker content script loaded
Starting to mask page...
Found 25 text nodes to process
Masked text: john@example.com -> <EMAIL_ADDRESS>
Masked text: 555-123-4567 -> <PHONE_NUMBER>
```

✅ **In the Python server terminal:**
```
Found PII: ['EMAIL_ADDRESS', 'PHONE_NUMBER']
Original: My email is john@example.com... -> Masked: My email is <EMAIL_ADDRESS>...
```

✅ **On the webpage:**
- Emails should show as `<EMAIL_ADDRESS>`
- Phone numbers should show as `<PHONE_NUMBER>`
- Names should show as `<PERSON>`

---

## Troubleshooting

### Problem: "Extension cannot read data"
**Solution:** Go to `chrome://extensions/` → Details → Site access → Select "On all sites"

### Problem: "Server error" in console
**Solution:** Make sure Python server is running (`python main.py`)

### Problem: Nothing is being masked
**Solution:** 
1. Check console for errors (F12)
2. Verify server is running at `http://127.0.0.1:5000/health`
3. Make sure toggle is ON (red button)

### Problem: Icons missing error
**Solution:** Icons are optional - the manifest.json provided doesn't require them

---

## Project Structure

Your final folder should look like this:

```
PII-Masker/
├── manifest.json      (Extension configuration)
├── popup.html         (Extension popup UI)
├── popup.css          (Popup styling)
├── popup.js           (Popup logic)
├── content.js         (Page masking logic)
└── main.py           (Python Flask server)
```

---

## Usage

1. **Start the Python server** (keep terminal open):
   ```bash
   python main.py
   ```

2. **Browse any website**

3. **Click the extension icon** and toggle **ON**

4. **Watch PII get masked in real-time!**

---

## What Gets Masked?

The Presidio library detects and masks:
- 📧 Email addresses
- 📞 Phone numbers
- 👤 Person names
- 💳 Credit card numbers
- 🏥 Medical license numbers
- 🆔 Social security numbers
- 📍 Locations
- 🏢 Organizations
- And more!

---

## Notes

- **Server must be running** for the extension to work
- **Extension only works on regular websites**, not on `chrome://` pages
- **Performance:** Large pages may take a few seconds to process
- **Privacy:** All processing happens locally on your computer
