// Example: Advanced usage of Mecha AI module
import { MechaAI, fileTools } from '../src/module-index.js';

async function advancedExample() {
  console.log('🚀 Mecha AI Example - Advanced Usage\n');
  
  // Initialize with custom configuration
  const mecha = new MechaAI({
    enablePlanning: true,
    enableStreaming: false,
    enableMemory: true,
  });
  
  try {
    // Example 1: Programmatic file operations
    console.log('📝 Example 1: Programmatic File Operations\n');
    
    // Create a test file
    await fileTools.createFile('./test-example.js', 
      '// Test file created by Mecha AI example\n' +
      'function greet(name) {\n' +
      '  return `Hello, ${name}!`;\n' +
      '}\n' +
      '\n' +
      'module.exports = { greet };\n'
    );
    console.log('✅ Created test file: ./test-example.js');
    
    // Read the file
    const content = await fileTools.readFile('./test-example.js');
    console.log('📖 File content (first 100 chars):', content.substring(0, 100) + '...');
    
    // List files
    const files = await fileTools.listFiles('.');
    console.log(`📁 Found ${files.length} files in current directory`);
    
    console.log('---\n');
    
    // Example 2: Using the assistant directly
    console.log('📝 Example 2: Direct Assistant Usage\n');
    
    // Ask AI to analyze the file
    const response = await mecha.chat(
      "Analyze the test-example.js file and suggest improvements",
      { autoReadFiles: true }
    );
    console.log('AI Analysis:', response);
    
    console.log('---\n');
    
    // Example 3: Transaction support
    console.log('📝 Example 3: Transaction Support\n');
    
    console.log('Starting transaction...');
    await fileTools.startTransaction();
    
    try {
      // Make some changes
      await fileTools.editFile(
        './test-example.js',
        'function greet(name) {',
        'function greet(name = "World") {'
      );
      console.log('✅ Modified function to have default parameter');
      
      // Add a new function
      await fileTools.editFile(
        './test-example.js',
        'module.exports = { greet };',
        'function farewell(name) {\n' +
        '  return `Goodbye, ${name}!`;\n' +
        '}\n' +
        '\n' +
        'module.exports = { greet, farewell };'
      );
      console.log('✅ Added farewell function');
      
      // Commit the transaction
      await fileTools.commitTransaction();
      console.log('✅ Transaction committed successfully');
      
    } catch (error) {
      console.error('❌ Error during transaction:', error.message);
      await fileTools.rollbackTransaction();
      console.log('🔄 Transaction rolled back');
    }
    
    console.log('---\n');
    
    // Example 4: Search functionality
    console.log('📝 Example 4: Search Functionality\n');
    
    const searchResults = await fileTools.searchFiles('function', '.');
    console.log(`🔍 Found ${searchResults.length} files containing "function"`);
    
    if (searchResults.length > 0) {
      console.log('First result:', searchResults[0]);
    }
    
    console.log('---\n');
    
    // Clean up
    console.log('🧹 Cleaning up test files...');
    // Note: In a real scenario, you might want to delete the test file
    // For now, we'll just note that it exists
    console.log('Test file remains at: ./test-example.js');
    console.log('You can delete it manually if needed.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Try to rollback any transaction
    try {
      await fileTools.rollbackTransaction();
      console.log('🔄 Rolled back any pending transaction');
    } catch {
      // Ignore rollback errors
    }
  }
}

// Run advanced example
advancedExample().catch(console.error);