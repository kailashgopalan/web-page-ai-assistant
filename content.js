// Content script that runs on every webpage
class WebPageAssistant {
  constructor() {
    this.isOpen = false;
    this.apiKey = null;
    this.pageContent = '';
    this.chatHistory = [];
    this.darkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
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
    
    // Load theme preference
    await this.loadThemePreference();
    
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

  async loadThemePreference() {
    try {
      const result = await chrome.storage.local.get(['ai_dark_mode']);
      if (result.ai_dark_mode !== undefined) {
        this.darkMode = result.ai_dark_mode;
        document.documentElement.classList.toggle('ai-dark-mode', this.darkMode);
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    }
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
    try {
      console.log('Starting content extraction');
      
      // Create a deep clone of the document to avoid modifying the original
      const clonedDoc = document.cloneNode(true);
      
      // Remove non-content elements
      const elementsToRemove = clonedDoc.querySelectorAll('script, style, noscript, svg, iframe');
      elementsToRemove.forEach(el => el.remove());
      
      // Try multiple strategies to find the main content
      
      // Strategy 1: Look for common content containers
      let mainContent = clonedDoc.querySelector('main') || 
                        clonedDoc.querySelector('article') || 
                        clonedDoc.querySelector('[role="main"]') ||
                        clonedDoc.querySelector('.main-content') ||
                        clonedDoc.querySelector('.content') || 
                        clonedDoc.querySelector('#content');
      
      // Strategy 2: For SPAs and modern sites (like OpenAI docs)
      if (!mainContent || mainContent.textContent.trim().length < 100) {
        console.log('Using strategy 2 for content extraction');
        
        // Look for div elements with substantial content
        const divs = Array.from(clonedDoc.querySelectorAll('div'));
        const contentDivs = divs.filter(div => {
          const text = div.textContent.trim();
          return text.length > 200 && div.querySelectorAll('p, h1, h2, h3, li').length > 3;
        });
        
        // Sort by content length (descending)
        contentDivs.sort((a, b) => b.textContent.length - a.textContent.length);
        
        // Use the div with the most content
        if (contentDivs.length > 0) {
          mainContent = contentDivs[0];
        }
      }
      
      // Strategy 3: Fallback to specific element types with substantial content
      if (!mainContent || mainContent.textContent.trim().length < 100) {
        console.log('Using strategy 3 for content extraction');
        
        const contentElements = [];
        
        // Collect headings and paragraphs
        const headingsAndParagraphs = clonedDoc.querySelectorAll('h1, h2, h3, p, li, td');
        headingsAndParagraphs.forEach(el => {
          if (el.textContent.trim().length > 20) {
            contentElements.push(el.textContent.trim());
          }
        });
        
        if (contentElements.length > 0) {
          this.pageContent = contentElements.join('\n\n');
          console.log(`Extracted ${contentElements.length} content elements`);
        } else {
          // Last resort: just use body text
          this.pageContent = clonedDoc.body.textContent.trim();
          console.log('Fallback to body text');
        }
      } else {
        // Use the found main content
        this.pageContent = mainContent.textContent.trim();
        console.log(`Extracted content from ${mainContent.tagName}${mainContent.id ? '#'+mainContent.id : ''}${mainContent.className ? '.'+mainContent.className.split(' ')[0] : ''}`);
      }
      
      // Add page title and URL for context
      this.pageContent = `Page Title: ${document.title}\nURL: ${window.location.href}\n\nContent:\n${this.pageContent}`;
      
      // Limit content length to avoid token limits
      if (this.pageContent.length > 10000) {
        this.pageContent = this.pageContent.substring(0, 10000) + '... (content truncated)';
      }
      
      console.log(`Final content length: ${this.pageContent.length} characters`);
      
    } catch (error) {
      console.error('Error extracting page content:', error);
      this.pageContent = `Failed to extract content: ${error.message}. Page title: ${document.title}`;
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
            <button id="ai-reload-content" title="Reload page content">🔄</button>
            <button id="ai-theme-toggle" title="Toggle dark/light mode">🌓</button>
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
    const themeBtn = document.getElementById('ai-theme-toggle');
    const reloadBtn = document.getElementById('ai-reload-content');
    const sendBtn = document.getElementById('ai-chat-send');
    const input = document.getElementById('ai-chat-input');

    toggle.addEventListener('click', () => this.toggleChat());
    closeBtn.addEventListener('click', () => this.toggleChat());
    clearBtn.addEventListener('click', () => this.clearChatHistory());
    themeBtn.addEventListener('click', () => this.toggleTheme());
    reloadBtn.addEventListener('click', () => this.reloadContent());
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
    // Check if we have content
    if (!this.pageContent || this.pageContent.length < 50) {
      console.warn('Page content is missing or too short, extracting again');
      this.extractPageContent();
    }
    
    // Add debug info about content length
    const contentSummary = this.pageContent.length > 100 
      ? `${this.pageContent.substring(0, 100)}... (${this.pageContent.length} chars total)`
      : this.pageContent;
    console.log('Content summary:', contentSummary);
    
    const messages = [
      {
        role: 'system',
        content: `You are a helpful AI assistant that helps users understand web pages. Here is the content of the current webpage:

Title: ${document.title}
URL: ${window.location.href}
Content: ${this.pageContent}

Please answer questions about this webpage content in a helpful and concise manner. If the user asks about something not related to the page content, politely redirect them to ask about the current page.

If you don't see enough content to answer the question, explain that you might not have access to all the page content and suggest the user try refreshing the page or viewing a different section.`
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

  toggleTheme() {
    this.darkMode = !this.darkMode;
    document.documentElement.classList.toggle('ai-dark-mode', this.darkMode);
    
    // Save preference
    try {
      chrome.storage.local.set({ 'ai_dark_mode': this.darkMode });
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
    
    // Update button text
    const themeBtn = document.getElementById('ai-theme-toggle');
    themeBtn.textContent = this.darkMode ? '☀️' : '🌓';
  }

  async reloadContent() {
    try {
      // Show loading message
      const messagesContainer = document.getElementById('ai-chat-messages');
      messagesContainer.innerHTML += `
        <div class="ai-message">
          <div class="ai-message-header">
            <strong>System:</strong>
          </div>
          <div class="ai-message-content">🔄 Reloading page content...</div>
        </div>
      `;
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      
      // Extract content again
      this.extractPageContent();
      
      // Show success message
      messagesContainer.innerHTML += `
        <div class="ai-message">
          <div class="ai-message-header">
            <strong>System:</strong>
          </div>
          <div class="ai-message-content">✅ Content reloaded! Extracted ${this.pageContent.length} characters. You can now ask questions about the current page.</div>
        </div>
      `;
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      
      console.log('Content reloaded manually');
    } catch (error) {
      console.error('Error reloading content:', error);
      
      // Show error message
      const messagesContainer = document.getElementById('ai-chat-messages');
      messagesContainer.innerHTML += `
        <div class="ai-message">
          <div class="ai-message-header">
            <strong>System:</strong>
          </div>
          <div class="ai-message-content">❌ Error reloading content: ${error.message}</div>
        </div>
      `;
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
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