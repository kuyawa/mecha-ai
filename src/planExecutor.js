import chalk from 'chalk';
import readline from 'readline';

export class PlanExecutor {
  constructor(assistant) {
    this.assistant = assistant;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });
  }

  askUser(question) {
    return new Promise((resolve) => {
      this.rl.question(chalk.cyan(question), (answer) => {
        resolve(answer.toLowerCase().trim());
      });
    });
  }

  // NEW: Prepare messages for V4 API with reasoning_content preservation
  preparePlanningMessages(messages) {
    const preparedMessages = [];
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      
      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        // This assistant message had tool calls - PRESERVE reasoning_content for V4
        const preservedMsg = { ...msg };
        if (msg.reasoning_content) {
          preservedMsg.reasoning_content = msg.reasoning_content;
        }
        preparedMessages.push(preservedMsg);
      } 
      else if (msg.role === 'assistant') {
        // Regular assistant message - pass as-is
        preparedMessages.push(msg);
      }
      else {
        preparedMessages.push(msg);
      }
    }
    
    return preparedMessages;
  }

  async planThenExecute(userPrompt, options = {}) {
    const { autoApprove = false, dryRun = false } = options;
    
    if (!dryRun) {
      console.log(chalk.yellow('\n📋 PLANNING PHASE'));
      console.log(chalk.gray('   Using DeepSeek V4 for analysis...\n'));
    }
    
    // UPDATED: V4 planning with proper thinking mode configuration
    const planningMessages = [
      { 
        role: 'system', 
        content: `You are a planning AI using DeepSeek V4. Create a detailed plan based on the user's request.
        
IMPORTANT: Do NOT request any tool calls. Just analyze and provide a text plan.

Format your response as:

## Analysis
[What you understand about the request]

## Files to Modify
- file1.js: [what needs to change]
- file2.js: [what needs to change]

## Step-by-Step Plan
1. [First action]
2. [Second action]

## Expected Outcome
[What the result will be]

Be specific about file paths and exact changes needed.`
      },
      { role: 'user', content: userPrompt }
    ];
    
    try {
      if (!dryRun) console.log(chalk.gray('💭 Analyzing...\n'));
      
      // UPDATED: Use V4 model with thinking mode enabled for better planning
      const planResponse = await this.assistant.client.chat.completions.create({
        model: 'deepseek-v4-pro', // UPDATED: V4 model with better reasoning for planning
        messages: this.preparePlanningMessages(planningMessages),
        temperature: 0.7,
        // Enable thinking mode for better plan quality
        thinking: { type: 'enabled' }
      });
      
      const planMessage = planResponse.choices[0].message;
      const planContent = planMessage.content;
      
      // NEW: Display reasoning_content if available (helps debug planning quality)
      if (planMessage.reasoning_content) {
        console.log(chalk.gray(`\n💭 Planning reasoning:\n${planMessage.reasoning_content.substring(0, 200)}...\n`));
      }
      
      // Display the plan
      console.log(chalk.white(planContent));
      console.log(chalk.gray('\n' + '='.repeat(60)));
      
      // Handle different modes
      if (dryRun) {
        console.log(chalk.yellow('\n🔍 PREVIEW MODE - Simulating what would change'));
        console.log(chalk.gray('   Based on the plan above, here are the expected changes:\n'));
        
        // Parse the plan to extract file changes
        const changes = this.extractChangesFromPlan(planContent);
        if (changes.length > 0) {
          console.log(chalk.cyan('Expected Changes:'));
          for (const change of changes) {
            console.log(chalk.yellow(`  📝 ${change.file}`));
            console.log(chalk.gray(`     ${change.description}`));
          }
        } else {
          console.log(chalk.gray('  No specific file changes detected in plan'));
        }
        
        console.log(chalk.yellow('\n💡 To apply these changes, run:'));
        console.log(chalk.gray(`   npm start chat -- --single "${userPrompt}"`));
        console.log(chalk.gray(`   Or use transaction mode: npm start transaction "${userPrompt}"\n`));
        
        return { applied: false, preview: true };
      }
      
      if (autoApprove) {
        console.log(chalk.green('\n⚙️ AUTO-APPROVING PLAN...\n'));
        return await this.executePlan(userPrompt, planContent);
      }
      
      // Interactive mode - ask user
      const choice = await this.askUser('\nExecute this plan? (y/n/preview): ');
      
      if (choice === 'n') {
        console.log(chalk.yellow('❌ Plan rejected. No changes were made.'));
        return { applied: false, reason: 'rejected' };
      }
      
      if (choice === 'preview') {
        console.log(chalk.yellow('\n🔍 Running preview with actual tool calls...\n'));
        
        // Use the main assistant with dry run
        await this.assistant.chat(userPrompt, { 
          dryRun: true, 
          usePlanning: false,
          autoReadFiles: true
        });
        
        await this.assistant.previewChanges();
        
        const applyChoice = await this.askUser('\nApply these changes now? (y/n): ');
        if (applyChoice === 'y') {
          // Clear pending changes and run for real
          await this.assistant.discardPendingChanges();
          return await this.executePlan(userPrompt, planContent);
        }
        return { applied: false, reason: 'previewed but not applied' };
      }
      
      // User said 'y' - execute
      console.log(chalk.green('\n⚙️ EXECUTING PLAN\n'));
      return await this.executePlan(userPrompt, planContent);
      
    } catch (error) {
      console.error(chalk.red(`\n❌ Planning failed: ${error.message}`));
      console.error(chalk.gray(`   Tip: Try running directly without planning mode: npm start chat -- --single "${userPrompt}"`));
      
      // NEW: Provide helpful error message for V4-specific issues
      if (error.message.includes('reasoning_content')) {
        console.error(chalk.yellow(`\n   💡 V4 Tip: This error relates to reasoning_content handling.`));
        console.error(chalk.gray(`      Try setting thinkingMode: 'disabled' in your config for planning phase.`));
      }
      
      throw error;
    }
  }

  extractChangesFromPlan(planContent) {
    const changes = [];
    const lines = planContent.split('\n');
    let inFilesSection = false;
    
    for (const line of lines) {
      if (line.includes('## Files to Modify')) {
        inFilesSection = true;
        continue;
      }
      if (inFilesSection && line.startsWith('##')) {
        break;
      }
      if (inFilesSection && line.trim().startsWith('-')) {
        const match = line.match(/-\s*([^:]+):\s*(.+)/);
        if (match) {
          changes.push({
            file: match[1].trim(),
            description: match[2].trim()
          });
        }
      }
    }
    
    return changes;
  }

  async executePlan(userPrompt, planContent) {
    const executionPrompt = `Execute this plan exactly. User's request: "${userPrompt}"
    
Plan to execute:
${planContent}

Proceed step by step. Use the available tools (read_file, edit_file, create_file, search_files) to implement the changes.`;
    
    // UPDATED: Add execution message with proper context for V4
    const executionMessage = { 
      role: 'user', 
      content: executionPrompt 
    };
    
    this.assistant.messages.push(executionMessage);
    
    // UPDATED: Execute with V4-aware chat method
    // The assistant's chat method already handles V4 reasoning_content preservation
    const result = await this.assistant.chat(executionPrompt, { 
      usePlanning: false,
      // Ensure V4 thinking mode is respected
      thinkingMode: this.assistant.thinkingMode || 'adaptive'
    });
    
    console.log(chalk.green('\n✅ Plan executed successfully!'));
    return { applied: true, result };
  }

  // NEW: Utility to check if plan involves multiple files requiring coordination
  async analyzePlanComplexity(planContent) {
    const changes = this.extractChangesFromPlan(planContent);
    
    if (changes.length > 3) {
      console.log(chalk.yellow(`\n⚠️ Complex plan detected: ${changes.length} files to modify`));
      console.log(chalk.gray('   Using V4 Pro model for better coordination...'));
      return 'complex';
    }
    
    return 'simple';
  }

  // NEW: Alternative planning with thinking disabled for faster, simpler tasks
  async quickPlan(userPrompt, options = {}) {
    const { autoApprove = false } = options;
    
    console.log(chalk.yellow('\n⚡ QUICK PLAN MODE (no deep reasoning)'));
    
    const planningMessages = [
      { 
        role: 'system', 
        content: `Create a quick, direct plan. No tool calls. Be brief but specific.` 
      },
      { role: 'user', content: userPrompt }
    ];
    
    try {
      // UPDATED: Use flash model with thinking disabled for speed
      const planResponse = await this.assistant.client.chat.completions.create({
        model: 'deepseek-v4-flash', // Faster, cheaper model for quick planning
        messages: this.preparePlanningMessages(planningMessages),
        temperature: 0.5,
        thinking: { type: 'disabled' } // Disable thinking for faster response
      });
      
      const planContent = planResponse.choices[0].message.content;
      console.log(chalk.white(planContent));
      
      if (autoApprove) {
        return await this.executePlan(userPrompt, planContent);
      }
      
      const choice = await this.askUser('\nExecute this plan? (y/n): ');
      if (choice === 'y') {
        return await this.executePlan(userPrompt, planContent);
      }
      
      console.log(chalk.yellow('❌ Plan rejected.'));
      return { applied: false, reason: 'rejected' };
      
    } catch (error) {
      console.error(chalk.red(`\n❌ Quick planning failed: ${error.message}`));
      throw error;
    }
  }
}