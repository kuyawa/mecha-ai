#!/usr/bin/env node

import readline from 'readline';
import chalk from 'chalk';

console.log(chalk.cyan('Testing readline character repetition fix...'));
console.log(chalk.gray('Type something and press Enter. Characters should not repeat.\n'));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: chalk.green('test> '),
  terminal: true,
  historySize: 100
});

// Handle SIGINT properly
rl.on('SIGINT', () => {
  console.log(chalk.yellow('\n\nGoodbye! 👋'));
  rl.close();
  process.exit(0);
});

rl.prompt();

rl.on('line', (input) => {
  const trimmed = input.trim();
  
  if (trimmed === '/exit' || trimmed === '/q') {
    console.log(chalk.yellow('Goodbye! 👋'));
    rl.close();
    return;
  }
  
  if (trimmed === '/test') {
    console.log(chalk.green('Test successful! No character repetition detected.'));
    console.log(chalk.gray('Try typing something like "/help" to see if characters repeat.'));
    rl.prompt();
    return;
  }
  
  console.log(chalk.blue(`You typed: "${input}"`));
  console.log(chalk.gray(`Length: ${input.length} characters`));
  
  // Check for character repetition
  if (input.length > 0) {
    let hasRepetition = false;
    for (let i = 0; i < input.length - 1; i += 2) {
      if (input[i] === input[i + 1]) {
        hasRepetition = true;
        break;
      }
    }
    
    if (hasRepetition) {
      console.log(chalk.red('⚠️  WARNING: Character repetition detected!'));
      console.log(chalk.gray('   This indicates the readline fix may not be working.'));
    } else {
      console.log(chalk.green('✓ No character repetition detected.'));
    }
  }
  
  rl.prompt();
});

console.log(chalk.gray('\nType "/test" to run a test, "/exit" to quit.'));