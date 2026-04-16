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

  async planThenExecute(userPrompt, options = {}) {
    const { autoApprove = false, dryRun = false } = options;
    
    if (!dryRun) {
      console.log(chalk.yellow('\n📋 PLANNING PHASE'));
      console.log(chalk.gray('   Using DeepThink for analysis...\n'));
    }
    
    // SIMPLER APPROACH: Don't use tools in planning phase
    // Just let DeepThink reason without file operations
    const planningMessages = [
      { 
        role: 'system', 
        content: `You are a planning AI. Create a detailed plan based on the user's request.
        
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
      
      // Use deepseek-reasoner without tools
      const planResponse = await this.assistant.client.chat.completions.create({
        model: 'deepseek-reasoner',
        messages: planningMessages,
        temperature: 0.7,
      });
      
      const planContent = planResponse.choices[0].message.content;
      
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
    
    this.assistant.messages.push({ role: 'user', content: executionPrompt });
    const result = await this.assistant.chat(executionPrompt, { usePlanning: false });
    
    console.log(chalk.green('\n✅ Plan executed successfully!'));
    return { applied: true, result };
  }
}