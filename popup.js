// Popup script for managing settings
document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKey');
  const saveKeyButton = document.getElementById('saveKey');
  const statusDiv = document.getElementById('status');
  
  // Load existing API key
  const result = await chrome.storage.sync.get(['openaiApiKey']);
  if (result.openaiApiKey) {
    apiKeyInput.value = result.openaiApiKey;
    showStatus('API key loaded', 'success');
  }
  
  // Save API key
  saveKeyButton.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      showStatus('Please enter an API key', 'error');
      return;
    }
    
    if (!apiKey.startsWith('sk-')) {
      showStatus('Invalid API key format', 'error');
      return;
    }
    
    try {
      await chrome.storage.sync.set({ openaiApiKey: apiKey });
      showStatus('API key saved successfully!', 'success');
    } catch (error) {
      showStatus('Error saving API key', 'error');
    }
  });
  
  // Handle Enter key
  apiKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveKeyButton.click();
    }
  });
  
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    
    if (type === 'success') {
      setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = '';
      }, 3000);
    }
  }
}); 