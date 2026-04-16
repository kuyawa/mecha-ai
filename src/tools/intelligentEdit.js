import fs from 'fs/promises';
import { diff_match_patch } from 'diff-match-patch';
import chalk from 'chalk';

export class IntelligentEdit {
  constructor() {
    this.dmp = new diff_match_patch();
  }

  async editFile(filePath, originalSnippet, newSnippet, options = {}) {
    const { fuzzy = true, multiple = 'error' } = options;
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Find exact matches
    const matches = [];
    let searchPos = 0;
    while (true) {
      const match = content.indexOf(originalSnippet, searchPos);
      if (match === -1) break;
      matches.push({ index: match, length: originalSnippet.length });
      searchPos = match + 1;
    }
    
    // Handle multiple matches
    if (matches.length > 1) {
      if (multiple === 'error') {
        throw new Error(`Multiple matches (${matches.length}) found. Please be more specific.`);
      } else if (multiple === 'first') {
        console.log(chalk.yellow(`   ⚠️ Multiple matches (${matches.length}), using first`));
        return this.applyEdit(content, matches[0].index, originalSnippet, newSnippet, filePath);
      } else if (multiple === 'all') {
        let newContent = content;
        for (const match of matches.reverse()) {
          newContent = this.applyEdit(newContent, match.index, originalSnippet, newSnippet);
        }
        await fs.writeFile(filePath, newContent, 'utf-8');
        return newContent;
      }
    }
    
    // Single exact match
    if (matches.length === 1) {
      return this.applyEdit(content, matches[0].index, originalSnippet, newSnippet, filePath);
    }
    
    // Fuzzy matching
    if (fuzzy) {
      const fuzzyMatch = this.findFuzzyMatch(content, originalSnippet);
      if (fuzzyMatch) {
        console.log(chalk.yellow(`   🔍 Fuzzy match found`));
        const patch = this.dmp.patch_make(originalSnippet, newSnippet);
        const [result, results] = this.dmp.patch_apply(patch, content);
        if (results.every(r => r === true)) {
          await fs.writeFile(filePath, result, 'utf-8');
          return result;
        }
      }
    }
    
    throw new Error(`No match found for snippet in ${filePath}`);
  }

  applyEdit(content, startIndex, oldSnippet, newSnippet, filePath) {
    const newContent = content.slice(0, startIndex) + newSnippet + content.slice(startIndex + oldSnippet.length);
    fs.writeFile(filePath, newContent, 'utf-8');
    return newContent;
  }

  findFuzzyMatch(content, snippet, threshold = 0.7) {
    const lines = content.split('\n');
    const snippetLines = snippet.split('\n');
    
    for (let i = 0; i <= lines.length - snippetLines.length; i++) {
      let matches = 0;
      for (let j = 0; j < snippetLines.length; j++) {
        const similarity = this.stringSimilarity(lines[i + j], snippetLines[j]);
        if (similarity > threshold) matches++;
      }
      if (matches / snippetLines.length > threshold) return true;
    }
    return null;
  }

  stringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = a[j-1] === b[i-1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i-1][j] + 1,
          matrix[i][j-1] + 1,
          matrix[i-1][j-1] + cost
        );
      }
    }
    return matrix[b.length][a.length];
  }

  async dryRun(filePath, originalSnippet, newSnippet) {
    const content = await fs.readFile(filePath, 'utf-8');
    const matches = [];
    let searchPos = 0;
    while (true) {
      const match = content.indexOf(originalSnippet, searchPos);
      if (match === -1) break;
      matches.push(match);
      searchPos = match + 1;
    }
    if (matches.length === 0) {
      console.log(chalk.yellow(`   ⚠️ No matches in ${path.basename(filePath)}`));
      return false;
    }
    console.log(chalk.blue(`   📍 ${matches.length} match(es) in ${path.basename(filePath)}`));
    return true;
  }
}