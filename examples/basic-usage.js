// Example: Basic usage of Mecha AI module
import { MechaAI } from '../src/module-index.js';

async function main() {
  console.log('🚀 Mecha AI Example - Basic Usage\n');
  
  // Initialize Mecha AI
  // Note: You need to set DEEPSEEK_API_KEY in your environment
  const mecha = new MechaAI({
    // apiKey: 'your-api-key-here', // Or set via DEEPSEEK_API_KEY env var
    enablePlanning: true,
    enableStreaming: false, // Disable streaming for cleaner output
  });
  
  try {
    // Example 1: Simple chat
    console.log('📝 Example 1: Simple Chat');
    console.log('Prompt: "Explain what Mecha AI can do"');
    
    const response1 = await mecha.chat("Explain what Mecha AI can do in one paragraph");
    console.log('Response:', response1);
    console.log('---\n');
    
    // Reset conversation
    mecha.reset();
    
    // Example 2: File operation (dry run)
    console.log('📝 Example 2: File Operation (Dry Run)');
    console.log('Prompt: "Create a simple hello world function in JavaScript"');
    
    const response2 = await mecha.chat(
      "Create a simple hello world function in JavaScript that takes a name parameter",
      { dryRun: true }
    );
    console.log('Response:', response2);
    
    // Preview what would have been created
    const changes = await mecha.previewChanges();
    console.log('Pending changes:', changes ? changes.size : 0);
    
    // Discard since this was a dry run
    await mecha.discardPendingChanges();
    console.log('---\n');
    
    // Example 3: Get configuration
    console.log('📝 Example 3: Configuration');
    const currentConfig = mecha.getConfig();
    console.log('Current model:', currentConfig.deepseek.model);
    console.log('Planning enabled:', currentConfig.features.enablePlanning);
    console.log('Streaming enabled:', currentConfig.features.enableStreaming);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('API key')) {
      console.log('\n💡 Tip: Set your DeepSeek API key:');
      console.log('   - Create a .env file with DEEPSEEK_API_KEY=your_key');
      console.log('   - Or pass it to the constructor: new MechaAI({ apiKey: "your-key" })');
    }
  }
}

// Run example
main().catch(console.error);