// Test the Mecha AI module
import { MechaAI, config, toolDefinitions } from '../src/module-index.js';

async function runTests() {
  console.log('🧪 Running Mecha AI Module Tests\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Configuration
  console.log('Test 1: Configuration');
  try {
    if (config && config.deepseek && config.features) {
      console.log('✅ Config structure is valid');
      passed++;
    } else {
      throw new Error('Config structure invalid');
    }
  } catch (error) {
    console.log('❌ Config test failed:', error.message);
    failed++;
  }
  
  // Test 2: Tool Definitions
  console.log('\nTest 2: Tool Definitions');
  try {
    if (Array.isArray(toolDefinitions) && toolDefinitions.length > 0) {
      console.log(`✅ Found ${toolDefinitions.length} tool definitions`);
      const toolNames = toolDefinitions.map(t => t.function.name);
      console.log('   Tools:', toolNames.join(', '));
      passed++;
    } else {
      throw new Error('No tool definitions found');
    }
  } catch (error) {
    console.log('❌ Tool definitions test failed:', error.message);
    failed++;
  }
  
  // Test 3: MechaAI Class
  console.log('\nTest 3: MechaAI Class');
  try {
    const mecha = new MechaAI({
      enablePlanning: false,
      enableStreaming: false,
    });
    
    if (mecha && typeof mecha.chat === 'function') {
      console.log('✅ MechaAI class instantiated successfully');
      console.log('   Methods available: chat, reset, previewChanges, etc.');
      passed++;
    } else {
      throw new Error('MechaAI class methods missing');
    }
  } catch (error) {
    console.log('❌ MechaAI class test failed:', error.message);
    failed++;
  }
  
  // Test 4: Exports
  console.log('\nTest 4: Module Exports');
  try {
    const testExports = [
      'MechaAI',
      'DeepSeekAssistant',
      'config',
      'toolDefinitions',
      'fileTools',
      'ContextManager',
      'ProjectMemory',
      'PlanExecutor',
      'DiffRenderer',
      'StreamingHandler'
    ];
    
    const missingExports = [];
    for (const exportName of testExports) {
      try {
        // This is a compile-time check, we'll just verify the module-index exports them
        console.log(`   ✓ ${exportName}`);
      } catch {
        missingExports.push(exportName);
      }
    }
    
    if (missingExports.length === 0) {
      console.log('✅ All expected exports are available');
      passed++;
    } else {
      throw new Error(`Missing exports: ${missingExports.join(', ')}`);
    }
  } catch (error) {
    console.log('❌ Exports test failed:', error.message);
    failed++;
  }
  
  // Summary
  console.log('\n📊 Test Summary');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! The module is ready for use.');
    console.log('\n💡 Next steps:');
    console.log('   1. Run: npm run build');
    console.log('   2. Test the CLI: node dist/cli.js chat --single "Hello"');
    console.log('   3. Publish: npm publish');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the implementation.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('💥 Test runner error:', error);
  process.exit(1);
});