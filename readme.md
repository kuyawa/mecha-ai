# Mecha AI

![Mecha](mecha.jpg)

[![npm version](https://img.shields.io/npm/v/mecha-ai.svg)](https://www.npmjs.com/package/mecha-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

Mecha AI is a powerful AI coding assistant that uses DeepSeek API to help you write, refactor, and understand code. It can read, edit, create files, search codebases, and execute complex coding tasks with planning and transaction support.

## Quick Intro for Power Users

Just open terminal and then...

```bash
# start a new project
mkdir myapp
cd myapp

# use your DeepSeek API key or get one here https://platform.deepseek.com
echo 'DEEPSEEK_API_KEY=your_api_key_here' > .env

# install Mecha AI
npm install -g mecha-ai

# it can generate code in more than 100 programming languages
mecha chat -s "Create a function in node js to calculate fibonacci numbers"

# or use a prompt file, where prompt.txt is the file with instructions to follow
# it can be .md if you want, I like simplicity
mecha exec prompt.txt

# remember to ctrl-c when done
```

All of that for less than one cent!

## Features

- **AI-Powered Coding**: Uses DeepSeek API for intelligent code generation and analysis
- **File Operations**: Read, write, edit, and search files in your project
- **Tool System**: Extensible tool system for file operations and project management
- **Planning Mode**: AI creates execution plans before making changes
- **Transaction Support**: Rollback changes if something goes wrong
- **Interactive CLI**: Chat interface with commands and previews
- **Streaming Responses**: Real-time AI responses with progress indicators
- **Project Memory**: Remembers file changes and project context
- **Diff Previews**: See exactly what will change before applying

## Installation

### As a CLI tool:
```bash
npm install -g mecha-ai
```

### As a module in your project:
```bash
npm install mecha-ai
```

## Quick Start

### CLI Usage:

```bash
# Start interactive chat
mecha chat

# Single command mode
mecha chat --single "Add a new function to calculate fibonacci numbers"

# With planning mode
mecha chat --single "Refactor the authentication system" --plan

# Preview changes without applying
mecha chat --single "Fix all TypeScript errors" --dry-run

# Transaction mode (rollback on error)
mecha transaction "Update all API endpoints"

# Preview mode
mecha preview "Add documentation to all functions"

# Prompt file mode
mecha chat -s "Read prompt.txt file and follow instructions"

# Same as...
mecha exec prompt.txt
```

### Module Usage:

```javascript
import { MechaAI } from 'mecha-ai';

// Initialize with your API key
const mecha = new MechaAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  enablePlanning: true,
  enableStreaming: true
});

// Chat with the AI
const response = await mecha.chat("Create a React component for a login form");

// Reset conversation
mecha.reset();

// Preview pending changes
const changes = await mecha.previewChanges();

// Apply changes
await mecha.applyPendingChanges();
```

## Configuration

Create a `.env` file in your project:

```env
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com  # Optional
DEEPSEEK_MODEL=deepseek-chat                # Optional
```

Or configure programmatically:

```javascript
import { config } from 'mecha-ai';

// Update configuration
config.deepseek.apiKey = 'your-api-key';
config.features.enablePlanning = true;
config.features.enableStreaming = false;
```

## API Reference

### Main Classes

#### `MechaAI`
Main class for interacting with the AI assistant.

```javascript
const mecha = new MechaAI(options);
```

**Options:**
- `apiKey`: DeepSeek API key
- `baseURL`: API base URL (default: https://api.deepseek.com)
- `model`: Model to use (default: deepseek-chat)
- `enablePlanning`: Enable planning mode (default: true)
- `enableStreaming`: Enable streaming responses (default: true)
- `enableMemory`: Enable project memory (default: true)

**Methods:**
- `chat(prompt, options)`: Send a prompt to the AI
- `reset()`: Reset conversation history
- `previewChanges()`: Preview pending file changes
- `applyPendingChanges()`: Apply pending changes
- `discardPendingChanges()`: Discard pending changes
- `getConfig()`: Get current configuration
- `updateConfig(newConfig)`: Update configuration

#### `DeepSeekAssistant`
Lower-level assistant class with more control.

```javascript
import { DeepSeekAssistant } from 'mecha-ai';

const assistant = new DeepSeekAssistant();
await assistant.chat("Your prompt here");
```

### Tools Available

The AI can use these tools automatically:

- `read_file(path)`: Read file contents
- `read_multiple_files(paths)`: Read multiple files
- `create_file(path, content)`: Create new file
- `edit_file(path, original_snippet, new_snippet)`: Edit existing file
- `search_files(pattern, directory)`: Search for text patterns
- `list_files(directory)`: List files in directory
- `start_transaction()`: Start transaction
- `commit_transaction()`: Commit transaction
- `rollback_transaction()`: Rollback transaction

## Examples

### Example 1: Code Refactoring
```bash
mecha chat --single "Refactor the UserService class to use dependency injection"
```

### Example 2: File Creation
```bash
mecha chat --single "Create a new Express.js middleware for authentication"
```

### Example 3: Bug Fixing
```bash
mecha chat --single "Find and fix the memory leak in the data processing module"
```

### Example 4: Documentation
```bash
mecha chat --single "Add JSDoc comments to all functions in the utils folder"
```

## Advanced Usage

### Custom Tool Integration
```javascript
import { DeepSeekAssistant, toolDefinitions } from 'mecha-ai';

// Add custom tools
const customTools = [
  ...toolDefinitions,
  {
    type: 'function',
    function: {
      name: 'run_tests',
      description: 'Run project tests',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Test command to run' }
        },
        required: ['command']
      }
    }
  }
];

// Create assistant with custom tools
const assistant = new DeepSeekAssistant();
assistant.toolDefinitions = customTools;
```

### Programmatic File Operations
```javascript
import { fileTools } from 'mecha-ai';

// Read file
const content = await fileTools.readFile('./src/index.js');

// List files
const files = await fileTools.listFiles('./src');

// Search files
const results = await fileTools.searchFiles('function', './src');
```

## CLI Commands

### Interactive Mode Commands:
- `/exit` or `/q` - Quit the session
- `/reset` - Clear conversation history
- `/plan` - Toggle planning mode
- `/preview` - Preview pending changes
- `/apply` - Apply pending changes
- `/discard` - Discard pending changes
- `/tree` - Show file tree
- `/help` - Show help

## Development

### Building from source:
```bash
git clone https://github.com/yourusername/mecha-ai.git
cd mecha-ai
npm install
npm run build
```

### Running tests:
```bash
npm test
```

### Project structure:
```
mecha-ai/
├── src/
│   ├── assistant.js      # Main AI assistant class
│   ├── config.js         # Configuration
│   ├── cli.js           # CLI interface
│   ├── module-index.js  # Module exports
│   ├── planExecutor.js  # Planning system
│   ├── streamingHandler.js
│   └── tools/           # Tool implementations
├── dist/                # Built files
├── package.json
├── build.js            # Build script
└── readme.md
```

## Contributing

1. Fork the repository
2. Do whatever you want with the code
3. ???
4. Profit!

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- Issues: [GitHub Issues](https://github.com/kuyawa/mecha-ai/issues)

## Acknowledgments

- Built with [DeepSeek API](https://platform.deepseek.com/) for just 10 cts
- Inspired by various AI coding assistants
- Thanks to all contributors and users!

---

**Happy coding with Mecha AI!**