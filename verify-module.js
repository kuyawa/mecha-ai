// Verify the module structure
import fs from 'fs/promises';
import path from 'path';

async function verifyModule() {
  console.log('🔍 Verifying Mecha AI Module Structure\n');
  
  const checks = [];
  
  // Check 1: package.json
  try {
    const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
    checks.push({
      name: 'package.json',
      status: pkg.name === 'mecha-ai' && pkg.main === 'dist/index.js',
      details: `Name: ${pkg.name}, Main: ${pkg.main}`
    });
  } catch (error) {
    checks.push({
      name: 'package.json',
      status: false,
      details: `Error: ${error.message}`
    });
  }
  
  // Check 2: Source files exist
  const sourceFiles = [
    'src/module-index.js',
    'src/cli.js',
    'src/assistant.js',
    'src/config.js',
    'src/tools/index.js'
  ];
  
  for (const file of sourceFiles) {
    try {
      await fs.access(file);
      checks.push({
        name: file,
        status: true,
        details: 'Exists'
      });
    } catch {
      checks.push({
        name: file,
        status: false,
        details: 'Missing'
      });
    }
  }
  
  // Check 3: Build script
  try {
    await fs.access('build.js');
    const buildContent = await fs.readFile('build.js', 'utf8');
    checks.push({
      name: 'build.js',
      status: buildContent.includes('build') && buildContent.includes('dist'),
      details: 'Build script exists'
    });
  } catch {
    checks.push({
      name: 'build.js',
      status: false,
      details: 'Missing'
    });
  }
  
  // Check 4: Documentation
  const docsFiles = ['readme.md', 'LICENSE', '.env.example'];
  for (const file of docsFiles) {
    try {
      await fs.access(file);
      checks.push({
        name: file,
        status: true,
        details: 'Exists'
      });
    } catch {
      checks.push({
        name: file,
        status: false,
        details: 'Missing'
      });
    }
  }
  
  // Display results
  console.log('📋 Verification Results:');
  console.log('='.repeat(50));
  
  let passed = 0;
  let failed = 0;
  
  for (const check of checks) {
    const icon = check.status ? '✅' : '❌';
    console.log(`${icon} ${check.name}`);
    console.log(`   ${check.details}`);
    if (!check.status) console.log(`   ⚠️ Needs attention`);
    console.log();
    
    if (check.status) passed++;
    else failed++;
  }
  
  console.log('='.repeat(50));
  console.log(`📊 Summary: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('\n🎉 All checks passed! The module is properly structured.');
    console.log('\n💡 Next steps:');
    console.log('   1. Run: node build.js');
    console.log('   2. Test: node dist/cli.js chat --single "Test"');
    console.log('   3. Publish: npm publish');
  } else {
    console.log('\n⚠️ Some checks failed. Please fix the issues above.');
    process.exit(1);
  }
}

verifyModule().catch(console.error);