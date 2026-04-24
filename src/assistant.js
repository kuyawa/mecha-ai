import OpenAI from 'openai';
import { config } from './config.js';
import { toolDefinitions } from './tools/index.js';
import { fileTools } from './tools/fileTools.js';
import { ContextManager } from './tools/contextManager.js';
import { ProjectMemory } from './tools/projectMemory.js';
import { PlanExecutor } from './planExecutor.js';
import { DiffRenderer } from './tools/diffRenderer.js';
import { StreamingHandler } from './streamingHandler.js';
import chalk from 'chalk';
import ora from 'ora';

export class DeepSeekAssistant {
  constructor() {
    this.client = new OpenAI({
      apiKey: config.deepseek.apiKey,
      baseURL: config.deepseek.baseURL,
    });
    this.messages = [];
    this.toolDefinitions = toolDefinitions;
    this.config = config;
    this.contextManager = new ContextManager();
    this.memory = config.features.enableMemory ? new ProjectMemory() : null;
    this.planExecutor = config.features.enablePlanning ? new PlanExecutor(this) : null;
    this.diffRenderer = new DiffRenderer();
    this.streamingHandler = new StreamingHandler();
    this.pendingChanges = new Map();
    this.thinkingMode = config.deepseek.thinkingMode || 'adaptive'; // 'adaptive', 'enabled', 'disabled'
  }

  // Helper method to safely parse JSON with error recovery
  safeJsonParse(jsonString, defaultValue = {}) {
    if (typeof jsonString !== 'string') {
      return defaultValue;
    }
    
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      // Try to fix common JSON issues
      let fixed = jsonString.trim();
      
      // Fix 1: Add missing closing braces/brackets
      const openBraces = (fixed.match(/{/g) || []).length;
      const closeBraces = (fixed.match(/}/g) || []).length;
      const openBrackets = (fixed.match(/\[/g) || []).length;
      const closeBrackets = (fixed.match(/\]/g) || []).length;
      
      if (openBraces > closeBraces) {
        fixed += '}'.repeat(openBraces - closeBraces);
      }
      
      if (openBrackets > closeBrackets) {
        fixed += ']'.repeat(openBrackets - closeBrackets);
      }
      
      // Fix 2: Add missing quotes around property names
      if (fixed.startsWith('{')) {
        // Match property names without quotes: {property: value}
        fixed = fixed.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3');
      }
      
      // Fix 3: Handle trailing commas
      fixed = fixed.replace(/,\s*([}\]])/g, '$1');
      
      try {
        return JSON.parse(fixed);
      } catch {
        // If still fails, return defaultValue
        console.log(chalk.yellow(`   ⚠️ Could not parse JSON, using default: ${error.message}`));
        return defaultValue;
      }
    }
  }

  // NEW: Helper to preserve reasoning_content for V4 thinking mode
  preserveReasoningContent(message) {
    if (!message.reasoning_content) return message;
    
    return {
      ...message,
      reasoning_content: message.reasoning_content
    };
  }

  // NEW: Prepare messages for V4 API with proper reasoning_content handling
  prepareMessagesForV4(messages) {
    const preparedMessages = [];
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      
      // For assistant messages that had tool calls, ensure reasoning_content is preserved
      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        // Check if there's a corresponding tool response in the next message
        const nextMsg = messages[i + 1];
        if (nextMsg && nextMsg.role === 'tool') {
          // This assistant message had tool calls and there are tool responses
          // We MUST preserve reasoning_content for V4 thinking mode
          preparedMessages.push(this.preserveReasoningContent(msg));
        } else {
          // Assistant message without subsequent tool response - reasoning_content optional
          preparedMessages.push(msg);
        }
      } 
      // For regular assistant messages (no tool calls)
      else if (msg.role === 'assistant') {
        // In thinking mode, we can optionally preserve reasoning_content
        // but it's not required unless there were tool calls
        preparedMessages.push(msg);
      }
      // For user messages and tool responses - pass through as-is
      else {
        preparedMessages.push(msg);
      }
    }
    
    return preparedMessages;
  }

  async executeToolCall(toolCall, dryRun = false) {
    const { name, arguments: args } = toolCall.function;
    
    // Use safe JSON parsing with error recovery
    const parsedArgs = this.safeJsonParse(args, null);
    
    if (parsedArgs === null) {
      console.log(chalk.red(`   ❌ JSON Parse Error for tool: ${name}`));
      console.log(chalk.gray(`   Raw arguments: ${args ? args.substring(0, 200) : 'undefined'}...`));
      
      return {
        tool_call_id: toolCall.id,
        role: 'tool',
        content: `Error: Failed to parse JSON arguments for tool "${name}". Please check the arguments format.`,
      };
    }
    
    console.log(chalk.blue(`\n🔧 Executing: ${name}`));
    console.log(chalk.gray(`   Arguments: ${JSON.stringify(parsedArgs, null, 2)}`));
    
    if (dryRun && (name === 'edit_file' || name === 'create_file')) {
      return await this.trackPendingChange(name, parsedArgs);
    }
    
    try {
      let result;
      switch (name) {
        case 'read_file':
          result = await fileTools.readFile(parsedArgs.path);
          result = this.contextManager.truncateFile(result, config.fileOps.maxTokensPerFile, parsedArgs.path);
          break;
        case 'read_multiple_files':
          result = await fileTools.readMultipleFiles(parsedArgs.paths);
          result = this.contextManager.truncateMultipleFiles(result, config.fileOps.maxTokensPerFile);
          break;
        case 'create_file':
          await fileTools.createFile(parsedArgs.path, parsedArgs.content);
          result = `✅ File created: ${parsedArgs.path}`;
          if (this.memory) await this.memory.rememberFile(parsedArgs.path, 'Created');
          break;
        case 'edit_file':
          let originalContent = '';
          try { originalContent = await fileTools.readFile(parsedArgs.path); } catch(e) {}
          await fileTools.editFile(parsedArgs.path, parsedArgs.original_snippet, parsedArgs.new_snippet);
          result = `✅ File edited: ${parsedArgs.path}`;
          if (originalContent) {
            const newContent = await fileTools.readFile(parsedArgs.path);
            const diffTable = this.diffRenderer.renderDiffTable(originalContent, newContent, parsedArgs.path);
            console.log(diffTable);
          }
          if (this.memory) await this.memory.rememberFile(parsedArgs.path, 'Edited');
          break;
        case 'search_files':
          result = await fileTools.searchFiles(parsedArgs.pattern, parsedArgs.directory);
          break;
        case 'list_files':
          result = await fileTools.listFiles(parsedArgs.directory);
          if (parsedArgs.tree) {
            const tree = this.diffRenderer.renderFileTree(result);
            console.log(tree);
          }
          break;
        case 'start_transaction':
          await fileTools.startTransaction();
          result = '✅ Transaction started';
          break;
        case 'commit_transaction':
          await fileTools.commitTransaction();
          result = '✅ Transaction committed';
          break;
        case 'rollback_transaction':
          await fileTools.rollbackTransaction();
          result = '✅ Transaction rolled back';
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
      
      return {
        tool_call_id: toolCall.id,
        role: 'tool',
        content: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
      };
    } catch (error) {
      console.log(chalk.red(`   ❌ Error: ${error.message}`));
      if (error.code === 'ENOENT') {
        console.log(chalk.yellow(`   💡 Tip: File not found. Use list_files to see available files.`));
      }
      return {
        tool_call_id: toolCall.id,
        role: 'tool',
        content: `Error: ${error.message}`,
      };
    }
  }

  async trackPendingChange(name, args) {
    const changeKey = `${name}:${args.path}`;
    
    if (name === 'edit_file') {
      let originalContent = '';
      try { originalContent = await fileTools.readFile(args.path); } catch(e) {}
      
      this.pendingChanges.set(changeKey, {
        type: 'edit',
        file: args.path,
        original: originalContent,
        new: args.new_snippet,
        context: args.original_snippet
      });
      
      const preview = this.diffRenderer.renderDiffTable(
        originalContent,
        originalContent.replace(args.original_snippet, args.new_snippet),
        args.path
      );
      console.log(chalk.yellow('[DRY RUN] Would apply:'));
      console.log(preview);
    } else if (name === 'create_file') {
      this.pendingChanges.set(changeKey, {
        type: 'create',
        file: args.path,
        content: args.content
      });
      console.log(chalk.yellow(`[DRY RUN] Would create: ${args.path}`));
    }
    
    return {
      tool_call_id: `dry_run_${Date.now()}`,
      role: 'tool',
      content: `[DRY RUN] Would execute ${name} on ${args.path}`,
    };
  }

  async executeToolCallsParallel(toolCalls, dryRun = false) {
    const promises = toolCalls.map(toolCall => this.executeToolCall(toolCall, dryRun));
    return await Promise.all(promises);
  }

  async extractFileReferences(userMessage) {
    const patterns = [
      /`([^`]+\.\w+)`/g,
      /['"]?([\w\/-]+\.\w+)['"]?/g,
      /\b(src|lib|app|components)\/[\w\/-]+\.\w+\b/g
    ];
    const files = new Set();
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(userMessage)) !== null) {
        files.add(match[1]);
      }
    }
    return Array.from(files);
  }

  // UPDATED: Generate request options for V4 API
  getV4RequestOptions(messages) {
    const baseOptions = {
      model: config.deepseek.model, // Should be 'deepseek-v4-flash' or 'deepseek-v4-pro'
      messages: this.prepareMessagesForV4(messages),
      tools: this.toolDefinitions,
      tool_choice: 'auto',
    };
    
    // Add thinking mode configuration for V4
    if (this.thinkingMode === 'enabled') {
      baseOptions.thinking = { type: 'enabled' };
    } else if (this.thinkingMode === 'disabled') {
      baseOptions.thinking = { type: 'disabled' };
    } else {
      // 'adaptive' - let the API decide based on the task
      baseOptions.thinking = { type: 'adaptive' };
    }
    
    return baseOptions;
  }

  async chat(userPrompt, options = {}) {
    const { usePlanning = false, dryRun = false, autoReadFiles = true } = options;
    
    if (usePlanning && this.planExecutor && config.features.enablePlanning) {
      return await this.planExecutor.planThenExecute(userPrompt);
    }
    
    console.log(chalk.green(`\n💬 User: ${userPrompt}`));
    
    if (autoReadFiles) {
      const mentionedFiles = await this.extractFileReferences(userPrompt);
      if (mentionedFiles.length > 0) {
        console.log(chalk.blue(`📁 Detected: ${mentionedFiles.join(', ')}`));
        for (const file of mentionedFiles) {
          try {
            const content = await fileTools.readFile(file);
            this.messages.push({
              role: 'user',
              content: `[Context] ${file}:\n\`\`\`\n${this.contextManager.truncateFile(content, 4000, file)}\n\`\`\``
            });
          } catch(e) {}
        }
      }
    }
    
    this.messages.push({ role: 'user', content: userPrompt });
    
    let iteration = 0;
    const maxIterations = 15;
    
    if (config.features.enableStreaming) {
      return await this.chatWithStreaming(options);
    }
    
    const spinner = ora('Thinking...').start();
    
    while (iteration < maxIterations) {
      iteration++;
      spinner.text = `Thinking... (iteration ${iteration})`;
      
      if (this.contextManager.isOverLimit(this.messages)) {
        spinner.warn('Summarizing...');
        this.messages = this.contextManager.summarizeOldMessages(this.messages);
        spinner.start();
      }
      
      // UPDATED: Use V4 request options
      const request = this.getV4RequestOptions(this.messages)
      const response = await this.client.chat.completions.create(request);
      
      const message = response.choices[0].message;
      
      // UPDATED: Store reasoning_content if present (critical for V4 thinking mode)
      const assistantMessage = {
        role: 'assistant',
        content: message.content,
        tool_calls: message.tool_calls
      };
      
      // Preserve reasoning_content for V4
      if (message.reasoning_content) {
        assistantMessage.reasoning_content = message.reasoning_content;
        console.log(chalk.gray(`   💭 Reasoning: ${message.reasoning_content.substring(0, 100)}...`));
      }
      
      this.messages.push(assistantMessage);
      
      if (message.tool_calls && message.tool_calls.length > 0) {
        spinner.stop();
        console.log(chalk.blue(`\n🔨 Executing ${message.tool_calls.length} tool calls...`));
        
        // Validate tool calls before execution
        const validToolCalls = [];
        for (const toolCall of message.tool_calls) {
          if (toolCall.function && toolCall.function.arguments) {
            // Quick validation: check if arguments look like JSON
            const args = toolCall.function.arguments.trim();
            if (args.startsWith('{') || args.startsWith('[')) {
              validToolCalls.push(toolCall);
            } else {
              console.log(chalk.yellow(`   ⚠️ Skipping tool call with invalid arguments: ${args.substring(0, 100)}...`));
            }
          }
        }
        
        if (validToolCalls.length > 0) {
          const toolResults = await this.executeToolCallsParallel(validToolCalls, dryRun);
          this.messages.push(...toolResults);
        } else {
          console.log(chalk.yellow('   ⚠️ No valid tool calls to execute'));
        }
        spinner.start();
        continue;
      }
      
      spinner.succeed('Done!');
      console.log(chalk.green(`\n✅ ${message.content}`));
      return message.content;
    }
    
    spinner.fail('Max iterations');
    throw new Error('Max iterations reached');
  }

  // UPDATED: Streaming for V4 with reasoning_content handling
  async chatWithStreaming(options = {}) {
    const { dryRun = false } = options;
    
    let iteration = 0;
    const maxIterations = 1000;
    
    while (iteration < maxIterations) {
      iteration++;
      console.log(chalk.yellow(`\n🔄 Iteration ${iteration}\n`));
      
      this.streamingHandler.clear();
      
      // UPDATED: Use V4 request options with streaming
      const stream = await this.client.chat.completions.create({
        ...this.getV4RequestOptions(this.messages),
        stream: true,
      });
      
      let fullMessage = { 
        role: 'assistant', 
        content: '', 
        tool_calls: [],
        reasoning_content: '' // NEW: for V4 thinking mode
      };
      
      for await (const chunk of stream) {
        this.streamingHandler.handleStreamChunk(chunk);
        
        if (chunk.choices[0]?.delta?.content) {
          fullMessage.content += chunk.choices[0].delta.content;
        }
        
        // NEW: Capture reasoning_content from V4 streaming
        if (chunk.choices[0]?.delta?.reasoning_content) {
          fullMessage.reasoning_content += chunk.choices[0].delta.reasoning_content;
        }
        
        if (chunk.choices[0]?.delta?.tool_calls) {
          for (const toolCall of chunk.choices[0].delta.tool_calls) {
            const index = toolCall.index;
            if (!fullMessage.tool_calls[index]) {
              fullMessage.tool_calls[index] = {
                id: toolCall.id,
                type: 'function',
                function: { name: '', arguments: '' }
              };
            }
            if (toolCall.function?.name) {
              fullMessage.tool_calls[index].function.name = toolCall.function.name;
            }
            if (toolCall.function?.arguments) {
              fullMessage.tool_calls[index].function.arguments += toolCall.function.arguments;
            }
          }
        }
      }
      
      this.streamingHandler.flush();
      
      // Remove empty reasoning_content if not present
      if (!fullMessage.reasoning_content) {
        delete fullMessage.reasoning_content;
      } else {
        console.log(chalk.gray(`   💭 Reasoning: ${fullMessage.reasoning_content.substring(0, 100)}...`));
      }
      
      // Remove tool_calls array if empty
      if (fullMessage.tool_calls.length === 0) {
        delete fullMessage.tool_calls;
      }
      
      this.messages.push(fullMessage);
      
      if (fullMessage.tool_calls && fullMessage.tool_calls.length > 0) {
        console.log(chalk.blue(`\n🔨 Executing ${fullMessage.tool_calls.length} tool calls...`));
        
        // Validate tool calls before execution
        const validToolCalls = [];
        for (const toolCall of fullMessage.tool_calls) {
          if (toolCall.function && toolCall.function.arguments) {
            // Quick validation: check if arguments look like JSON
            const args = toolCall.function.arguments.trim();
            if (args.startsWith('{') || args.startsWith('[')) {
              validToolCalls.push(toolCall);
            } else {
              console.log(chalk.yellow(`   ⚠️ Skipping tool call with invalid arguments: ${args.substring(0, 100)}...`));
            }
          }
        }
        
        if (validToolCalls.length > 0) {
          const toolResults = await this.executeToolCallsParallel(validToolCalls, dryRun);
          this.messages.push(...toolResults);
        } else {
          console.log(chalk.yellow('   ⚠️ No valid tool calls to execute'));
        }
        continue;
      }
      
      console.log(chalk.green('\n✅ Done!'));
      return fullMessage.content;
    }
    
    throw new Error('Max iterations reached');
  }

  async previewChanges() {
    if (this.pendingChanges.size === 0) {
      console.log(chalk.yellow('No pending changes'));
      return;
    }
    
    const changes = [];
    for (const [_, change] of this.pendingChanges) {
      changes.push({
        file: change.file,
        status: change.type,
        additions: change.type === 'edit' ? 1 : (change.type === 'create' ? change.content.split('\n').length : 0),
        summary: change.type === 'edit' ? 'Content modification' : 'New file'
      });
    }
    
    console.log(this.diffRenderer.renderMultipleDiffs(changes));
    return this.pendingChanges;
  }

  async applyPendingChanges() {
    if (this.pendingChanges.size === 0) {
      console.log(chalk.yellow('No pending changes'));
      return;
    }
    
    console.log(chalk.green('Applying changes...'));
    for (const [_, change] of this.pendingChanges) {
      if (change.type === 'edit') {
        await fileTools.editFile(change.file, change.context, change.new);
      } else if (change.type === 'create') {
        await fileTools.createFile(change.file, change.content);
      }
    }
    this.pendingChanges.clear();
    console.log(chalk.green('✅ All changes applied'));
  }

  async discardPendingChanges() {
    this.pendingChanges.clear();
    console.log(chalk.yellow('Changes discarded'));
  }

  // This method ensures tool calls are properly handled
  validateToolCallResponse(messages) {
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
    
    if (lastAssistantMsg && lastAssistantMsg.tool_calls && lastAssistantMsg.tool_calls.length > 0) {
      const toolCallIds = lastAssistantMsg.tool_calls.map(tc => tc.id);
      const toolResponses = messages.filter(m => m.role === 'tool');
      const missingIds = toolCallIds.filter(id => !toolResponses.some(tr => tr.tool_call_id === id));
      
      if (missingIds.length > 0) {
        console.log(chalk.yellow(`⚠️ Missing tool responses for: ${missingIds.join(', ')}`));
        // Add placeholder responses
        for (const missingId of missingIds) {
          messages.push({
            role: 'tool',
            tool_call_id: missingId,
            content: 'Error: Tool response missing'
          });
        }
      }
    }
    
    return messages;
  }

  reset() {
    this.messages = [];
    this.pendingChanges.clear();
    this.streamingHandler.clear();
    console.log(chalk.yellow('\n🔄 Reset'));
  }
}