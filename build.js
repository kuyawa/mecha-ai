#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function copyFile(source, target) {
  try {
    await fs.mkdir(path.dirname(target), { recursive: true });
    const content = await fs.readFile(source, 'utf8');
    await fs.writeFile(target, content);
    console.log(`✓ Copied: ${source} -> ${target}`);
  } catch (error) {
    console.error(`✗ Error copying ${source}:`, error.message);
  }
}

async function build() {
  console.log('🚀 Building Mecha AI module...\n');
  
  // Create dist directory
  await fs.mkdir('dist', { recursive: true });
  await fs.mkdir('dist/tools', { recursive: true });
  
  // List of files to copy
  const filesToCopy = [
    // Main files
    { src: 'src/module-index.js', dest: 'dist/index.js' },
    { src: 'src/cli.js', dest: 'dist/cli.js' },
    { src: 'src/assistant.js', dest: 'dist/assistant.js' },
    { src: 'src/config.js', dest: 'dist/config.js' },
    { src: 'src/planExecutor.js', dest: 'dist/planExecutor.js' },
    { src: 'src/streamingHandler.js', dest: 'dist/streamingHandler.js' },
    
    // Tools
    { src: 'src/tools/index.js', dest: 'dist/tools/index.js' },
    { src: 'src/tools/fileTools.js', dest: 'dist/tools/fileTools.js' },
    { src: 'src/tools/contextManager.js', dest: 'dist/tools/contextManager.js' },
    { src: 'src/tools/projectMemory.js', dest: 'dist/tools/projectMemory.js' },
    { src: 'src/tools/intelligentEdit.js', dest: 'dist/tools/intelligentEdit.js' },
    { src: 'src/tools/fileCache.js', dest: 'dist/tools/fileCache.js' },
    { src: 'src/tools/diffRenderer.js', dest: 'dist/tools/diffRenderer.js' },
    { src: 'src/tools/transactionManager.js', dest: 'dist/tools/transactionManager.js' },
  ];
  
  // Copy all files
  for (const file of filesToCopy) {
    await copyFile(file.src, file.dest);
  }
  
  // Make CLI executable
  try {
    await fs.chmod('dist/cli.js', 0o755);
    console.log('✓ Made CLI executable');
  } catch (error) {
    console.error('✗ Error making CLI executable:', error.message);
  }
  
  // Create package.json for dist
  let packageJson;
  try {
    const packageJsonContent = await fs.readFile('package.json', 'utf8');
    packageJson = JSON.parse(packageJsonContent);
  } catch (error) {
    console.error(`✗ Error parsing package.json: ${error.message}`);
    process.exit(1);
  }
  const distPackageJson = {
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    type: packageJson.type,
    main: packageJson.main,
    exports: packageJson.exports,
    bin: packageJson.bin,
    keywords: packageJson.keywords,
    author: packageJson.author,
    license: packageJson.license,
    dependencies: packageJson.dependencies,
    engines: packageJson.engines,
    repository: packageJson.repository,
    bugs: packageJson.bugs,
    homepage: packageJson.homepage
  };
  
  await fs.writeFile('dist/package.json', JSON.stringify(distPackageJson, null, 2));
  console.log('✓ Created dist/package.json');
  
  // Copy README if exists
  try {
    await fs.copyFile('readme.md', 'dist/readme.md');
    console.log('✓ Copied README.md');
  } catch {
    console.log('ℹ️ No README.md found');
  }
  
  // Copy .env.example if exists
  try {
    await fs.copyFile('.env.example', 'dist/.env.example');
    console.log('✓ Copied .env.example');
  } catch {
    console.log('ℹ️ No .env.example found');
  }
  
  console.log('\n✅ Build completed successfully!');
  console.log('\n📦 Package ready for distribution:');
  console.log('   - Main module: dist/index.js');
  console.log('   - CLI: dist/cli.js');
  console.log('   - Run: npm run build');
  console.log('   - Then: npm publish');
}

// Run build
if (import.meta.url === `file://${process.argv[1]}`) {
  build().catch(console.error);
}

// Export for programmatic use
export { build };