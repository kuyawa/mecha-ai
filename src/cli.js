#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import readline from 'readline';
import { DeepSeekAssistant } from './assistant.js';
import { fileTools } from './tools/fileTools.js';
import { config } from './config.js';
import { PlanExecutor } from './planExecutor.js';
import packinfo from '../package.json' with { type: 'json' };

const program = new Command();

program
  .name('mecha')
  .description('Mecha AI - AI coding assistant')
  .version(packinfo.version);

program
  .command('exec')
  .description('Read prompt file and follow instructions')
  .argument('<filename>', 'File name to read, include folder and extension')
  .option('-p, --plan', 'Use planning mode', false)
  .option('--dry-run', 'Preview changes without applying', false)
  .option('--no-streaming', 'Disable streaming', false)
  .action(async (filename, options) => {

    const prompt = `Read file ${filename} and follow instructions`;
    const assistant = new DeepSeekAssistant();

    if (options.noStreaming) {
      config.features.enableStreaming = false;
    }

    if (options.dryRun) {
      config.features.dryRun = true;
      console.log(chalk.yellow('⚠️  DRY RUN MODE\n'));
      const planExec = new PlanExecutor(assistant);
      await planExec.planThenExecute(prompt, { 
        dryRun: true, 
        autoApprove: false 
      });
    } else {
      await assistant.chat(prompt, {
        usePlanning: options.plan,
        dryRun: options.dryRun
      });
    }
  });

program
  .command('chat')
  .description('Start interactive chat session')
  .option('-s, --single <prompt>', 'Single prompt mode')
  .option('-p, --plan', 'Use planning mode', false)
  .option('--dry-run', 'Preview changes without applying', false)
  .option('--no-streaming', 'Disable streaming', false)
  .action(async (options) => {
    if (options.dryRun) {
      config.features.dryRun = true;
      console.log(chalk.yellow('⚠️  DRY RUN MODE\n'));
    }
    
    if (options.noStreaming) {
      config.features.enableStreaming = false;
    }
    
    const assistant = new DeepSeekAssistant();
    
    if (options.single) {
      // Single prompt mode
      if (options.dryRun) {
        // Use plan executor with dry run for better preview
        const planExec = new PlanExecutor(assistant);
        await planExec.planThenExecute(options.single, { 
          dryRun: true, 
          autoApprove: false 
        });
      } else {
        await assistant.chat(options.single, {
          usePlanning: options.plan,
          dryRun: options.dryRun
        });
      }
    } else {
      console.log(chalk.cyan('\n🤖 Mecha AI v'+packinfo.version));
      console.log(chalk.gray('\nCommands: /exit, /reset, /plan, /preview, /apply, /tree, /help\n'));
      
      let usePlanning = options.plan;
      
      // Fix for character repetition issue
      // Set raw mode to false and handle terminal properly
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.green('> '),
        terminal: false,
        historySize: 100
      });

      // Handle SIGINT properly
      rl.on('SIGINT', () => {
        console.log(chalk.yellow('\n\nGoodbye! 👋'));
        rl.close();
        process.exit(0);
      });

      rl.prompt();
      
      rl.on('line', async (input) => {
        const trimmed = input.trim().toLowerCase();
        
        if (trimmed === '/exit' || trimmed === '/q') {
          console.log(chalk.yellow('Goodbye! 👋'));
          rl.close();
          return;
        }
        
        if (trimmed === '/reset') {
          assistant.reset();
          console.log(chalk.green('Reset'));
          rl.prompt();
          return;
        }
        
        if (trimmed === '/plan') {
          usePlanning = !usePlanning;
          console.log(chalk.yellow(`Planning: ${usePlanning ? 'ON' : 'OFF'}`));
          rl.prompt();
          return;
        }
        
        if (trimmed === '/preview') {
          await assistant.previewChanges();
          rl.prompt();
          return;
        }
        
        if (trimmed === '/apply') {
          await assistant.applyPendingChanges();
          rl.prompt();
          return;
        }
        
        if (trimmed === '/discard') {
          await assistant.discardPendingChanges();
          rl.prompt();
          return;
        }
        
        if (trimmed === '/tree') {
          const folder = process.cwd();
          const files = await fileTools.listFiles(folder);
          const { DiffRenderer } = await import('./tools/diffRenderer.js');
          const renderer = new DiffRenderer();
          console.log(renderer.renderFileTree(files));
          rl.prompt();
          return;
        }
        
        if (trimmed === '/help') {
          console.log(chalk.cyan('\nCommands:'));
          console.log(chalk.gray('  /exit     - Quit'));
          console.log(chalk.gray('  /reset    - Clear conversation'));
          console.log(chalk.gray('  /plan     - Toggle planning mode'));
          console.log(chalk.gray('  /preview  - Preview pending changes'));
          console.log(chalk.gray('  /apply    - Apply pending changes'));
          console.log(chalk.gray('  /discard  - Discard pending changes'));
          console.log(chalk.gray('  /tree     - Show file tree'));
          console.log(chalk.gray('  /help     - This help\n'));
          rl.prompt();
          return;
        }
        
        try {
          await assistant.chat(input, {
            usePlanning: usePlanning,
            dryRun: options.dryRun
          });
        } catch (error) {
          console.error(chalk.red(`\n❌ ${error.message}`));
        }
        
        rl.prompt();
      });
    }
  });

program
  .command('transaction')
  .description('Run with transaction support')
  .argument('<prompt>', 'The prompt to execute')
  .option('--dry-run', 'Preview only', false)
  .action(async (prompt, options) => {
    const assistant = new DeepSeekAssistant();
    console.log(chalk.cyan('🔒 Transaction mode\n'));
    
    try {
      if (!options.dryRun) await fileTools.startTransaction();
      await assistant.chat(`[TRANSACTION] ${prompt}`, { dryRun: options.dryRun });
      if (!options.dryRun) {
        await fileTools.commitTransaction();
        console.log(chalk.green('\n✅ Committed'));
      }
    } catch (error) {
      console.error(chalk.red(`\n❌ ${error.message}`));
      if (!options.dryRun) {
        await fileTools.rollbackTransaction();
        console.log(chalk.yellow('🔄 Rolled back'));
      }
    }
  });

program
  .command('preview')
  .description('Preview changes without applying')
  .argument('<prompt>', 'The prompt to preview')
  .action(async (prompt) => {
    const assistant = new DeepSeekAssistant();
    console.log(chalk.yellow('🔍 PREVIEW MODE\n'));
    
    // Force dry run mode
    config.features.dryRun = true;
    config.features.enableStreaming = false; // Disable streaming for cleaner preview
    
    // Use planning with auto-preview
    const planExec = new PlanExecutor(assistant);
    await planExec.planThenExecute(prompt, { 
      dryRun: true,      // Don't make changes
      autoApprove: false  // Show plan but don't ask to execute
    });
  });

program.parse();