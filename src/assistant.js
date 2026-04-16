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
  }

  async executeToolCall(toolCall, dryRun = false) {
    const { name, arguments: args } = toolCall.function;
    const parsedArgs = JSON.parse(args);
    
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
      
      const response = await this.client.chat.completions.create({
        model: config.deepseek.model,
        messages: this.messages,
        tools: this.toolDefinitions,
        tool_choice: 'auto',
      });
      
      const message = response.choices[0].message;
      this.messages.push(message);
      
      if (message.tool_calls && message.tool_calls.length > 0) {
        spinner.stop();
        console.log(chalk.blue(`\n🔨 Executing ${message.tool_calls.length} tool calls...`));
        const toolResults = await this.executeToolCallsParallel(message.tool_calls, dryRun);
        this.messages.push(...toolResults);
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

  async chatWithStreaming(options = {}) {
    const { dryRun = false } = options;
    
    let iteration = 0;
    //const maxIterations = 15; <<<<<< cambiar a 1000
    const maxIterations = 1000;
    
    while (iteration < maxIterations) {
      iteration++;
      console.log(chalk.yellow(`\n🔄 Iteration ${iteration}\n`));
      
      this.streamingHandler.clear();
      
      const stream = await this.client.chat.completions.create({
        model: config.deepseek.model,
        messages: this.messages,
        tools: this.toolDefinitions,
        tool_choice: 'auto',
        stream: true,
      });
      
      let fullMessage = { role: 'assistant', content: '', tool_calls: [] };
      
      for await (const chunk of stream) {
        this.streamingHandler.handleStreamChunk(chunk);
        
        if (chunk.choices[0]?.delta?.content) {
          fullMessage.content += chunk.choices[0].delta.content;
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
      this.messages.push(fullMessage);
      
      if (fullMessage.tool_calls && fullMessage.tool_calls.length > 0) {
        console.log(chalk.blue(`\n🔨 Executing ${fullMessage.tool_calls.length} tool calls...`));
        const toolResults = await this.executeToolCallsParallel(fullMessage.tool_calls, dryRun);
        this.messages.push(...toolResults);
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