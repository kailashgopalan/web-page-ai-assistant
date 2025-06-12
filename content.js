// Content script that runs on every webpage
class WebPageAssistant {
  constructor() {
    this.isOpen = false;
    this.apiKey = null;
    this.pageContent = '';
    this.chatHistory = [];
    this.init();
  }

  async init() {
    // Get API key from config file
    this.apiKey = window.AI_ASSISTANT_CONFIG?.OPENAI_API_KEY;
    
    // Debug logging
    console.log('Config loaded:', window.AI_ASSISTANT_CONFIG);
    console.log('API Key length:', this.apiKey ? this.apiKey.length : 'undefined');
    console.log('API Key starts with sk-:', this.apiKey ? this.apiKey.startsWith('sk-') : false);
    
    if (!this.apiKey || this.apiKey === 'your_openai_api_key_here') {
      console.error('Please set your OpenAI API key in config.js');
      this.apiKey = null;
    }
    
    // Load chat history from storage
    await this.loadChatHistory();
    
    // Extract page content
    this.extractPageContent();
    
    // Create and inject the chat widget
    this.createChatWidget();
    
    // Add event listeners
    this.addEventListeners();
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'openChat') {
        this.openChat();
      }
    });
  }

  async loadChatHistory() {
    try {
      // Create a unique key for this page based on URL
      const pageKey = `chat_history_${window.location.href}`;
      const result = await chrome.storage.local.get([pageKey]);
      
      if (result[pageKey]) {
        this.chatHistory = result[pageKey];
        console.log('Loaded chat history:', this.chatHistory.length, 'messages');
      } else {
        this.chatHistory = [];
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      this.chatHistory = [];
    }
  }

  async saveChatHistory() {
    try {
      // Create a unique key for this page based on URL
      const pageKey = `chat_history_${window.location.href}`;
      await chrome.storage.local.set({ [pageKey]: this.chatHistory });
      console.log('Saved chat history:', this.chatHistory.length, 'messages');
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  }

  extractPageContent() {
    // Remove script and style elements
    const clonedDoc = document.cloneNode(true);
    const scripts = clonedDoc.querySelectorAll('script, style, nav, header, footer');
    scripts.forEach(el => el.remove());
    
    // Get main content
    const mainContent = clonedDoc.querySelector('main') || 
                       clonedDoc.querySelector('article') || 
                       clonedDoc.querySelector('.content') || 
                       clonedDoc.querySelector('#content') || 
                       clonedDoc.body;
    
    this.pageContent = mainContent ? mainContent.textContent.trim() : document.body.textContent.trim();
    
    // Limit content length to avoid token limits
    if (this.pageContent.length > 8000) {
      this.pageContent = this.pageContent.substring(0, 8000) + '...';
    }
  }

  createChatWidget() {
    // Create the main container
    this.widget = document.createElement('div');
    this.widget.id = 'ai-assistant-widget';
    this.widget.innerHTML = `
      <div id="ai-chat-toggle">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12C2 13.54 2.36 14.99 3.01 16.28L2 22L7.72 20.99C9.01 21.64 10.46 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C10.74 20 9.54 19.75 8.46 19.3L8 19.11L4.91 19.91L5.71 16.82L5.52 16.36C5.07 15.28 4.82 14.08 4.82 12.82C4.82 7.58 8.58 3.82 13.82 3.82C16.39 3.82 18.77 4.84 20.54 6.61C22.31 8.38 23.33 10.76 23.33 13.33C23.33 18.57 19.57 22.33 14.33 22.33H12V20Z" fill="white"/>
        </svg>
      </div>
      <div id="ai-chat-container" class="hidden">
        <div id="ai-chat-header">
          <h3>AI Page Assistant</h3>
          <div id="ai-chat-controls">
            <button id="ai-clear-chat" title="Clear conversation">🗑️</button>
            <button id="ai-chat-close">&times;</button>
          </div>
        </div>
        <div id="ai-chat-messages"></div>
        <div id="ai-chat-input-container">
          <input type="text" id="ai-chat-input" placeholder="Ask me anything about this page..." />
          <button id="ai-chat-send">Send</button>
        </div>
        <div id="ai-quick-questions">
          <div class="quick-question-category">
            <span class="category-label">Quick Actions:</span>
            <div class="quick-buttons">
              <button class="quick-btn" data-question="Summarize this page in 3 key points">📝 Summarize</button>
              <button class="quick-btn" data-question="What are the main topics discussed here?">🎯 Main Topics</button>
              <button class="quick-btn" data-question="Explain this in simple terms">💡 Simplify</button>
              <button class="quick-btn" data-question="What are the key takeaways?">⭐ Key Points</button>
              <button class="quick-btn" data-question="What's the latest information or updates mentioned?">🆕 Latest Info</button>
              <button class="quick-btn" data-question="Are there any important facts or statistics?">📊 Facts & Stats</button>
            </div>
          </div>
        </div>
        <div id="ai-setup-container" class="hidden">
          <p>API key not configured. Please set your OpenAI API key in config.js</p>
          <p>Edit config.js and replace 'your_openai_api_key_here' with your actual API key.</p>
        </div>
      </div>
    `;
    
    document.body.appendChild(this.widget);
  }

  addEventListeners() {
    const toggle = document.getElementById('ai-chat-toggle');
    const closeBtn = document.getElementById('ai-chat-close');
    const clearBtn = document.getElementById('ai-clear-chat');
    const sendBtn = document.getElementById('ai-chat-send');
    const input = document.getElementById('ai-chat-input');

    toggle.addEventListener('click', () => this.toggleChat());
    closeBtn.addEventListener('click', () => this.toggleChat());
    clearBtn.addEventListener('click', () => this.clearChatHistory());
    sendBtn.addEventListener('click', () => this.sendMessage());
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });

    // Add event listeners for quick question buttons
    const quickButtons = document.querySelectorAll('.quick-btn');
    quickButtons.forEach(button => {
      button.addEventListener('click', () => {
        const question = button.getAttribute('data-question');
        this.sendQuickQuestion(question);
      });
    });
  }

  toggleChat() {
    const container = document.getElementById('ai-chat-container');
    const setupContainer = document.getElementById('ai-setup-container');
    
    this.isOpen = !this.isOpen;
    
    if (this.isOpen) {
      container.classList.remove('hidden');
      if (!this.apiKey) {
        setupContainer.classList.remove('hidden');
      } else {
        this.showWelcomeMessage();
      }
    } else {
      container.classList.add('hidden');
    }
  }

  showWelcomeMessage() {
    const messagesContainer = document.getElementById('ai-chat-messages');
    const quickQuestionsContainer = document.getElementById('ai-quick-questions');
    
    // If we have chat history, restore it
    if (this.chatHistory.length > 0) {
      messagesContainer.innerHTML = '';
      
      // Display all previous messages
      this.chatHistory.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = msg.role === 'user' ? 'user-message' : 'ai-message';
        
        const formattedMessage = msg.role === 'assistant' ? this.formatMessage(msg.content) : msg.content;
        
        if (msg.role === 'user') {
          messageDiv.innerHTML = `<strong>You:</strong> ${formattedMessage}`;
        } else {
          messageDiv.innerHTML = `
            <div class="ai-message-header">
              <strong>AI Assistant:</strong>
              <button class="copy-btn" title="Copy response">📋</button>
            </div>
            <div class="ai-message-content">${formattedMessage}</div>
          `;
          
          // Add copy functionality
          const copyBtn = messageDiv.querySelector('.copy-btn');
          copyBtn.addEventListener('click', () => this.copyToClipboard(msg.content, copyBtn));
        }
        
        messagesContainer.appendChild(messageDiv);
      });
      
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      
      // Hide quick questions if we have chat history
      quickQuestionsContainer.style.display = 'none';
    } else {
      // Show welcome message for new conversations
      messagesContainer.innerHTML = `
        <div class="ai-message">
          <div class="ai-message-header">
            <strong>AI Assistant:</strong>
          </div>
          <div class="ai-message-content">Hi! I'm here to help you understand this webpage. I've analyzed the content and I'm ready to answer your questions. What would you like to know?</div>
        </div>
      `;
      
      // Show quick questions for new conversations
      quickQuestionsContainer.style.display = 'block';
    }
  }

  async sendMessage() {
    const input = document.getElementById('ai-chat-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    if (!this.apiKey) {
      this.addMessageToChat('assistant', 'Please configure your API key in config.js first.');
      return;
    }
    
    // Add user message to chat
    this.addMessageToChat('user', message);
    input.value = '';
    
    // Show typing indicator
    this.showTypingIndicator();
    
    try {
      const response = await this.callOpenAI(message);
      this.hideTypingIndicator();
      this.addMessageToChat('assistant', response);
    } catch (error) {
      this.hideTypingIndicator();
      console.error('OpenAI API Error Details:', error);
      
      // More detailed error message
      let errorMessage = 'Sorry, I encountered an error. ';
      if (error.message.includes('401')) {
        errorMessage += 'Invalid API key. Please check your API key in config.js.';
      } else if (error.message.includes('403')) {
        errorMessage += 'Access denied. Please verify your API key in config.js.';
      } else if (error.message.includes('429')) {
        errorMessage += 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (error.message.includes('500')) {
        errorMessage += 'OpenAI server error. Please try again later.';
      } else {
        errorMessage += `Error: ${error.message}`;
      }
      
      this.addMessageToChat('assistant', errorMessage);
    }
  }

  async sendQuickQuestion(question) {
    // Hide quick questions when a conversation starts
    const quickQuestionsContainer = document.getElementById('ai-quick-questions');
    if (this.chatHistory.length === 0) {
      quickQuestionsContainer.style.display = 'none';
    }

    // Add user message to chat
    this.addMessageToChat('user', question);
    
    // Show typing indicator
    this.showTypingIndicator();
    
    try {
      const response = await this.callOpenAI(question);
      this.hideTypingIndicator();
      this.addMessageToChat('assistant', response);
    } catch (error) {
      this.hideTypingIndicator();
      console.error('OpenAI API Error Details:', error);
      
      // More detailed error message
      let errorMessage = 'Sorry, I encountered an error. ';
      if (error.message.includes('401')) {
        errorMessage += 'Invalid API key. Please check your API key in config.js.';
      } else if (error.message.includes('403')) {
        errorMessage += 'Access denied. Please verify your API key in config.js.';
      } else if (error.message.includes('429')) {
        errorMessage += 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (error.message.includes('500')) {
        errorMessage += 'OpenAI server error. Please try again later.';
      } else {
        errorMessage += `Error: ${error.message}`;
      }
      
      this.addMessageToChat('assistant', errorMessage);
    }
  }

  addMessageToChat(sender, message) {
    const messagesContainer = document.getElementById('ai-chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = sender === 'user' ? 'user-message' : 'ai-message';
    
    // Format the message content
    const formattedMessage = sender === 'assistant' ? this.formatMessage(message) : message;
    
    if (sender === 'user') {
      messageDiv.innerHTML = `<strong>You:</strong> ${formattedMessage}`;
    } else {
      messageDiv.innerHTML = `
        <div class="ai-message-header">
          <strong>AI Assistant:</strong>
          <button class="copy-btn" title="Copy response">📋</button>
        </div>
        <div class="ai-message-content">${formattedMessage}</div>
      `;
      
      // Add copy functionality
      const copyBtn = messageDiv.querySelector('.copy-btn');
      copyBtn.addEventListener('click', () => this.copyToClipboard(message, copyBtn));
    }
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Store in chat history
    this.chatHistory.push({ role: sender, content: message });
    
    // Save to persistent storage
    this.saveChatHistory();
  }

  formatMessage(message) {
    // Convert markdown-style formatting to HTML
    let formatted = message
      // Bold text: **text** or __text__
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      
      // Italic text: *text* or _text_
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      
      // Code blocks: ```code```
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      
      // Inline code: `code`
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      
      // Line breaks
      .replace(/\n/g, '<br>')
      
      // Lists: - item or * item
      .replace(/^[\-\*]\s+(.+)$/gm, '<li>$1</li>')
      
      // Numbers lists: 1. item
      .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
    
    // Wrap consecutive <li> elements in <ul>
    formatted = formatted.replace(/(<li>.*<\/li>)/gs, (match) => {
      if (!match.includes('<ul>')) {
        return '<ul>' + match + '</ul>';
      }
      return match;
    });
    
    return formatted;
  }

  async copyToClipboard(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      
      // Visual feedback
      const originalText = button.innerHTML;
      button.innerHTML = '✅';
      button.style.background = '#4caf50';
      
      setTimeout(() => {
        button.innerHTML = originalText;
        button.style.background = '';
      }, 2000);
      
    } catch (err) {
      console.error('Failed to copy text: ', err);
      
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      // Visual feedback
      const originalText = button.innerHTML;
      button.innerHTML = '✅';
      button.style.background = '#4caf50';
      
      setTimeout(() => {
        button.innerHTML = originalText;
        button.style.background = '';
      }, 2000);
    }
  }

  showTypingIndicator() {
    const messagesContainer = document.getElementById('ai-chat-messages');
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typing-indicator';
    typingDiv.className = 'ai-message';
    typingDiv.innerHTML = '<strong>AI Assistant:</strong> <span class="typing-dots">Thinking...</span>';
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  hideTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  async callOpenAI(userMessage) {
    const messages = [
      {
        role: 'system',
        content: `You are a helpful AI assistant that helps users understand web pages. Here is the content of the current webpage:

Title: ${document.title}
URL: ${window.location.href}
Content: ${this.pageContent}

Please answer questions about this webpage content in a helpful and concise manner. If the user asks about something not related to the page content, politely redirect them to ask about the current page.`
      },
      ...this.chatHistory.slice(-10), // Keep last 10 messages for context
      {
        role: 'user',
        content: userMessage
      }
    ];

    // Use GPT-4o for more powerful responses
    const models = ['gpt-4o'];
    
    // Get base URL from config, fallback to OpenAI if not specified
    const baseUrl = window.AI_ASSISTANT_CONFIG?.BASE_URL || 'https://api.openai.com';
    const apiEndpoint = `${baseUrl}/v1/chat/completions`;
    
    for (const model of models) {
      try {
        console.log(`Making API call with model: ${model}`);
        console.log('API Endpoint:', apiEndpoint);
        console.log('API Key being used:', this.apiKey ? `${this.apiKey.substring(0, 7)}...${this.apiKey.substring(this.apiKey.length - 4)}` : 'undefined');
        
        const requestBody = {
          model: model,
          messages: messages,
          max_tokens: 500,
          temperature: 0.7
        };
        
        console.log('Request body:', requestBody);
        
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify(requestBody)
        });

        console.log(`API Response Status for ${model}:`, response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`API Error Response for ${model}:`, errorData);
          
          // More specific error handling
          if (response.status === 401) {
            throw new Error(`HTTP error! status: ${response.status}, message: Invalid API key - please verify your key in config.js`);
          } else if (response.status === 403) {
            throw new Error(`HTTP error! status: ${response.status}, message: Access denied - check API key permissions`);
          } else {
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error?.message || 'Unknown error'}`);
          }
        }

        const data = await response.json();
        console.log(`API Response Success with ${model}:`, data);
        
        return data.choices[0].message.content;
        
      } catch (error) {
        console.error(`Error with ${model}:`, error);
        // If this is the last model to try, throw the error
        if (model === models[models.length - 1]) {
          throw error;
        }
        console.log(`Failed with ${model}, trying next model...`);
      }
    }
  }

  openChat() {
    if (!this.isOpen) {
      this.toggleChat();
    }
  }

  async clearChatHistory() {
    try {
      // Clear from memory
      this.chatHistory = [];
      
      // Clear from storage
      const pageKey = `chat_history_${window.location.href}`;
      await chrome.storage.local.remove([pageKey]);
      
      // Clear the UI and show welcome message
      const messagesContainer = document.getElementById('ai-chat-messages');
      messagesContainer.innerHTML = `
        <div class="ai-message">
          <strong>AI Assistant:</strong> Hi! I'm here to help you understand this webpage. I've analyzed the content and I'm ready to answer your questions. What would you like to know?
        </div>
      `;
      
      // Show quick questions again
      const quickQuestionsContainer = document.getElementById('ai-quick-questions');
      quickQuestionsContainer.style.display = 'block';
      
      console.log('Chat history cleared');
    } catch (error) {
      console.error('Error clearing chat history:', error);
    }
  }
}

// Initialize the assistant when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new WebPageAssistant();
  });
} else {
  new WebPageAssistant();
} 