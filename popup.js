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