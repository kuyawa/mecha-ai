// Simple script to run the build
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runBuild() {
  console.log('🚀 Running build...\n');
  
  try {
    // Run the build script
    const { stdout, stderr } = await execAsync('node build.js');
    
    if (stdout) console.log(stdout);
    if (stderr) console.error('Build errors:', stderr);
    
    console.log('\n✅ Build completed!');
    console.log('\n📦 Your npm module is ready:');
    console.log('   - Main entry: dist/index.js');
    console.log('   - CLI: dist/cli.js');
    console.log('   - Package: dist/package.json');
    console.log('\n🔧 To test locally:');
    console.log('   npm link');
    console.log('   mecha chat --single "Hello"');
    console.log('\n📤 To publish:');
    console.log('   npm publish');
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    if (error.stderr) console.error('Error details:', error.stderr);
  }
}

runBuild();