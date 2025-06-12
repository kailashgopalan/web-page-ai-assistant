// Background service worker for the Chrome extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Web Page AI Assistant installed');
  
  // Create context menu item with error handling
  try {
    chrome.contextMenus.create({
      id: 'askAI',
      title: 'Ask AI about this page',
      contexts: ['page']
    });
  } catch (error) {
    console.log('Context menu creation failed:', error);
  }
});

// Handle messages from content script if needed
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageContent') {
    // This could be used for additional page analysis if needed
    sendResponse({ success: true });
  }
});

// Handle context menu clicks with error handling
if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'askAI') {
      // Send message to content script to open chat
      chrome.tabs.sendMessage(tab.id, { action: 'openChat' });
    }
  });
} 