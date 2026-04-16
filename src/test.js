import { MechaAI } from './module-index.js';
import chalk from 'chalk';

async function test() {
  console.log(chalk.cyan('\n🧪 Testing Mecha AI Module\n'));
  
  try {
    // Test module initialization
    const mecha = new MechaAI({
      enablePlanning: false,
      enableStreaming: false,
    });
    
    console.log(chalk.green('✅ MechaAI module initialized'));
    console.log(chalk.blue(`📦 Version: 1.0.0`));
    console.log(chalk.blue(`🤖 Model: ${mecha.getConfig().deepseek.model}`));
    console.log(chalk.blue(`📁 Features: ${Object.keys(mecha.getConfig().features).join(', ')}`));
    
    console.log(chalk.yellow('\n💡 Usage Examples:'));
    console.log(chalk.gray('   CLI: mecha chat --single "Hello"'));
    console.log(chalk.gray('   Module: import { MechaAI } from "mecha-ai"'));
    console.log(chalk.gray('   Build: npm run build'));
    console.log(chalk.gray('   Test: npm test'));
    
    console.log(chalk.green('\n✅ Module test passed!'));
    
  } catch (error) {
    console.error(chalk.red(`❌ Test failed: ${error.message}`));
    if (error.message.includes('API key')) {
      console.log(chalk.yellow('\n💡 Set your API key:'));
      console.log(chalk.gray('   Create .env file with DEEPSEEK_API_KEY=your_key'));
    }
    process.exit(1);
  }
  
  process.exit(0);
}

test().catch(console.error);
