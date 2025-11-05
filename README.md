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
```json
{
  "manifest_version": 3,
  "name": "PII Masker",
  "version": "1.1",
  "description": "Toggle on/off PII masking on webpages",
  "permissions": [
    "activeTab",
    "scripting",
    "storage",
    "tabs"
  ],
  "action": {
    "default_popup": "popup.html"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "host_permissions": [
    "<all_urls>",
    "http://127.0.0.1:5000/*"
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

### File 2: `popup.html`
```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>PII Masker</title>
    <link rel="stylesheet" href="popup.css">
  </head>
  <body>
    <button id="toggleBtn" class="off">OFF</button>
    <script src="popup.js"></script>
  </body>
</html>
```

### File 3: `popup.css`
```css
body {
  margin: 0;
  padding: 10px;
  font-family: sans-serif;
  width: 120px;
}

button {
  width: 100%;
  padding: 8px 0;
  font-size: 14px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.on {
  background: #e63946;
  color: #fff;
}

.off {
  background: #ddd;
  color: #333;
}
```

### File 4: `popup.js`
```javascript
// popup.js
const btn = document.getElementById("toggleBtn");

function updateUI(enabled) {
  btn.textContent = enabled ? "ON" : "OFF";
  btn.className = enabled ? "on" : "off";
}

// Load initial state
chrome.storage.local.get("maskingEnabled", (data) => {
  const enabled = !!data.maskingEnabled;
  updateUI(enabled);
});

btn.addEventListener("click", async () => {
  try {
    // Get current state
    const data = await chrome.storage.local.get("maskingEnabled");
    const newState = !data.maskingEnabled;
    
    // Save new state
    await chrome.storage.local.set({ maskingEnabled: newState });
    updateUI(newState);

    console.log("Toggling masking to:", newState);

    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      console.error("No active tab found");
      return;
    }

    console.log("Sending message to tab:", tab.id);

    // Try to send message to content script
    chrome.tabs.sendMessage(
      tab.id, 
      { action: "toggleMasking", enabled: newState }, 
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error sending message:", chrome.runtime.lastError.message);
          
          // If content script not loaded, inject it
          if (chrome.runtime.lastError.message.includes("Could not establish connection")) {
            console.log("Content script not found, injecting...");
            
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            }, () => {
              if (chrome.runtime.lastError) {
                console.error("Failed to inject script:", chrome.runtime.lastError);
              } else {
                console.log("Script injected, retrying message...");
                // Wait a bit then retry
                setTimeout(() => {
                  chrome.tabs.sendMessage(
                    tab.id,
                    { action: "toggleMasking", enabled: newState },
                    (resp) => {
                      console.log("Retry response:", resp);
                    }
                  );
                }, 100);
              }
            });
          }
        } else {
          console.log("Response from content script:", response);
        }
      }
    );
  } catch (err) {
    console.error("Error in toggle handler:", err);
  }
});
```

### File 5: `content.js`
```javascript
// content.js
console.log("PII Masker content script loaded");

let observer = null;
let maskingEnabled = false;
let processingNodes = new WeakSet(); // Prevent re-processing same nodes

async function maskTextWithServer(text) {
  try {
    const res = await fetch("http://127.0.0.1:5000/mask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    
    if (!res.ok) {
      console.error("Server returned error:", res.status);
      return text;
    }
    
    const data = await res.json();
    return data.masked;
  } catch (e) {
    console.error("Server error:", e);
    return text;
  }
}

async function processTextNode(node) {
  if (!node || !node.nodeValue) return;
  if (processingNodes.has(node)) return; // Already processed
  
  const original = node.nodeValue.trim();
  if (!original) return;
  
  processingNodes.add(node);
  
  try {
    const masked = await maskTextWithServer(original);
    if (masked !== original) {
      console.log("Masked text:", original, "->", masked);
      node.nodeValue = masked;
    }
  } catch (e) {
    console.error("Error processing text node:", e);
  }
}

async function walkAndMask(root) {
  if (!root) return;
  
  const walker = document.createTreeWalker(
    root, 
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip script and style tags
        const parent = node.parentElement;
        if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    },
    false
  );
  
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) {
    nodes.push(node);
  }
  
  console.log(`Found ${nodes.length} text nodes to process`);
  
  // Process nodes in batches to avoid overwhelming the server
  for (const textNode of nodes) {
    if (!maskingEnabled) break; // Stop if masking was disabled
    await processTextNode(textNode);
  }
  
  console.log("Finished masking pass");
}

function startObserver() {
  if (observer) return;
  
  observer = new MutationObserver(async (mutations) => {
    if (!maskingEnabled) return;
    
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          await processTextNode(node);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          await walkAndMask(node);
        }
      }
    }
  });
  
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
  
  console.log("PII Masking observer started");
}

function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
    console.log("PII Masking observer stopped");
  }
}

async function enableMasking() {
  maskingEnabled = true;
  processingNodes = new WeakSet(); // Reset processed nodes
  
  console.log("Starting to mask page...");
  await walkAndMask(document.body);
  startObserver();
  console.log("Masking enabled and observer started");
}

function disableMasking() {
  maskingEnabled = false;
  stopObserver();
  console.log("Masking disabled");
}

// Respond to messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("Message received:", msg);
  
  if (msg && msg.action === "toggleMasking") {
    const enabled = !!msg.enabled;
    console.log("toggleMasking received, enabled:", enabled);

    if (enabled) {
      enableMasking().then(() => {
        sendResponse({ status: "started" });
      }).catch(err => {
        console.error("Error enabling masking:", err);
        sendResponse({ status: "error", message: err.message });
      });
      return true; // Indicates async response
    } else {
      disableMasking();
      sendResponse({ status: "stopped" });
      return false;
    }
  }
});

// Auto-start based on stored setting when content script loads
// Wait for DOM to be fully ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeMasking);
} else {
  initializeMasking();
}

function initializeMasking() {
  chrome.storage.local.get("maskingEnabled", (data) => {
    if (data.maskingEnabled) {
      console.log("Auto-starting masking from storage");
      enableMasking();
    }
  });
}
```

### File 6: `main.py`
```python
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine
from flask import Flask, request, jsonify
from flask_cors import CORS

analyzer = AnalyzerEngine()
anonymizer = AnonymizerEngine()

app = Flask(__name__)
CORS(app)  # allows browser extension to call it from localhost

def mask_pii(text):
    """Analyze and anonymize PII in the given text."""
    results = analyzer.analyze(text=text, language='en')
    
    # Log what was found
    if results:
        print(f"Found PII: {[r.entity_type for r in results]}")
    
    anonymized = anonymizer.anonymize(text=text, analyzer_results=results).text
    return anonymized

@app.route("/mask", methods=["POST"])
def mask():
    """API endpoint to mask PII in text."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
        
        text = data.get("text", "")
        
        if not text or not text.strip():
            return jsonify({"masked": text})
        
        masked = mask_pii(text)
        print(f"Original: {text[:50]}... -> Masked: {masked[:50]}...")
        
        return jsonify({"masked": masked})
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"})

if __name__ == "__main__":
    print("Starting PII Masking Server on port 5000...")
    app.run(host='127.0.0.1', port=5000, debug=True)
```

---

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
