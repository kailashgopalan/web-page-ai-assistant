# Web Page AI Assistant Chrome Extension

A Chrome extension that adds an AI-powered chatbot to every webpage, allowing you to ask questions and learn more about the content using OpenAI's API.

## Features

- 🤖 **AI-Powered Chat**: Ask questions about any webpage content
- 🎯 **Context-Aware**: The AI understands the current page content
- 💬 **Floating Chat Widget**: Non-intrusive design that works on all websites
- 🔒 **Secure**: API key stored in local config file
- 🎨 **Modern UI**: Beautiful, responsive chat interface
- ⚡ **Fast**: Lightweight and optimized for performance

## Installation

1. **Download or Clone** this repository to your local machine
2. **Configure API Key**:
   - Copy `config.example.js` to `config.js`
   - Edit `config.js` and replace `'your_openai_api_key_here'` with your actual OpenAI API key
3. **Open Chrome** and navigate to `chrome://extensions/`
4. **Enable Developer Mode** by toggling the switch in the top right corner
5. **Click "Load unpacked"** and select the folder containing the extension files
6. The extension should now appear in your extensions list

## Setup

### Get an OpenAI API Key

1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create an account or sign in
3. Generate a new API key (starts with `sk-`)

### Configure the Extension

1. **Copy the config file**:
   ```bash
   cp config.example.js config.js
   ```

2. **Edit config.js**:
   ```javascript
   const CONFIG = {
     OPENAI_API_KEY: 'sk-your-actual-api-key-here'
   };
   ```

3. **Refresh the extension** in Chrome extensions page

## Usage

1. **Visit any webpage** you want to learn about
2. **Look for the floating chat button** in the bottom-right corner
3. **Click the chat button** to open the AI assistant
4. **Ask questions** about the page content, such as:
   - "What is this article about?"
   - "Summarize the main points"
   - "Explain this concept in simple terms"
   - "What are the key takeaways?"
   - "How does this relate to [topic]?"

## Example Questions

- **Summarization**: "Can you summarize this article in 3 bullet points?"
- **Explanation**: "Explain the technical concepts mentioned here"
- **Analysis**: "What's the main argument being made?"
- **Context**: "What background knowledge do I need to understand this?"
- **Comparison**: "How does this compare to [related topic]?"

## File Structure

```
web-page-ai-assistant/
├── manifest.json          # Extension configuration
├── config.example.js      # Example configuration file
├── config.js             # Your API key configuration (create from example)
├── content.js             # Main content script
├── styles.css             # Chat widget styles
├── background.js          # Background service worker
├── popup.html             # Extension popup interface
├── popup.js               # Popup functionality
├── .env                   # Environment variables (optional)
├── .gitignore            # Git ignore file
└── README.md             # This file
```

## Technical Details

### How It Works

1. **Content Extraction**: The extension extracts text content from the current webpage
2. **Context Building**: It creates a context-aware prompt with the page content
3. **AI Processing**: Sends user questions along with page context to OpenAI's API
4. **Response Display**: Shows AI responses in a beautiful chat interface

### Privacy & Security

- **Local Configuration**: API keys are stored in local config files
- **No Data Collection**: The extension doesn't collect or store your conversations
- **Direct API Calls**: Communications go directly to OpenAI's API
- **Content Filtering**: Only text content is extracted, no sensitive data

### Permissions

- `activeTab`: Access current tab content
- `storage`: Store extension settings
- `scripting`: Inject chat widget into pages
- `contextMenus`: Add right-click menu option
- `host_permissions`: Work on all websites

## Customization

### Modify the Chat Widget

Edit `styles.css` to customize:
- Colors and themes
- Widget size and position
- Animation effects
- Typography

### Adjust AI Behavior

Edit `content.js` to modify:
- System prompts
- Response length limits
- Context extraction logic
- Chat history management

### Change OpenAI Model

In `content.js`, modify the `callOpenAI` function to use different models:
```javascript
const models = ['gpt-4']; // Instead of ['gpt-3.5-turbo']
```

## Troubleshooting

### Common Issues

1. **Chat button not appearing**:
   - Refresh the page
   - Check if the extension is enabled
   - Look for JavaScript errors in console

2. **API key not working**:
   - Verify the key starts with `sk-`
   - Check your OpenAI account has credits
   - Ensure the key is correctly set in `config.js`

3. **"API key not configured" message**:
   - Make sure you've created `config.js` from `config.example.js`
   - Verify your API key is properly set in the config file
   - Refresh the extension after making changes

4. **No response from AI**:
   - Check your internet connection
   - Verify API key is valid
   - Look for error messages in browser console

### Debug Mode

Open Chrome DevTools (F12) and check the Console tab for error messages.

## Development

### Local Development

1. Make changes to the extension files
2. Go to `chrome://extensions/`
3. Click the refresh button on your extension
4. Test on various websites

### Adding Features

- **New UI Elements**: Modify `content.js` and `styles.css`
- **Additional APIs**: Update `background.js` and permissions
- **Enhanced Context**: Improve content extraction in `extractPageContent()`

## Security Notes

- **Never commit** your `config.js` file with real API keys
- The `.gitignore` file prevents accidental commits
- Keep your API key secure and don't share it publicly

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Support

If you encounter issues or have questions:
1. Check the troubleshooting section
2. Look for similar issues in the repository
3. Create a new issue with detailed information

## Changelog

### Version 1.0
- Initial release
- Basic chat functionality
- OpenAI integration
- Modern UI design
- Context-aware responses
- Config file-based API key management 