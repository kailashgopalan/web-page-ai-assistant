// Configuration file for the Chrome extension
// Copy this file to config.js and replace 'your_openai_api_key_here' with your actual OpenAI API key
const CONFIG = {
  OPENAI_API_KEY: 'your_openai_api_key_here',
  BASE_URL: 'https://api.openai.com' // Change this if using a custom endpoint like LiteLLM proxy
};

// Make config available globally
window.AI_ASSISTANT_CONFIG = CONFIG; 