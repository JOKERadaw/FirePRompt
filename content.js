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