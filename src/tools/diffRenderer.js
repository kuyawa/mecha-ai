import Table from 'cli-table3';
import chalk from 'chalk';
import { diff_match_patch } from 'diff-match-patch';

export class DiffRenderer {
  constructor() {
    this.dmp = new diff_match_patch();
  }

  renderDiffTable(oldContent, newContent, filePath) {
    const diffs = this.dmp.diff_main(oldContent, newContent);
    this.dmp.diff_cleanupSemantic(diffs);
    
    const changes = { additions: 0, deletions: 0 };
    for (const [type, text] of diffs) {
      const lines = text.split('\n').length - 1;
      if (type === 1) changes.additions += lines;
      else if (type === -1) changes.deletions += lines;
    }
    
    const preview = this.generateDiffPreview(diffs, 5);
    const fileName = filePath.split('/').pop();
    
    return `${chalk.cyan(fileName)}: ${chalk.green(`+${changes.additions}`)} ${chalk.red(`-${changes.deletions}`)}\n${preview}`;
  }

  generateDiffPreview(diffs, maxLines = 5) {
    const lines = [];
    let added = 0, removed = 0;
    
    for (const [type, text] of diffs) {
      const textLines = text.split('\n');
      for (const line of textLines) {
        if (line.length === 0) continue;
        if (type === 1 && added < maxLines) {
          lines.push(chalk.green(`+ ${line.slice(0, 60)}`));
          added++;
        } else if (type === -1 && removed < maxLines) {
          lines.push(chalk.red(`- ${line.slice(0, 60)}`));
          removed++;
        }
        if (added >= maxLines && removed >= maxLines) break;
      }
      if (added >= maxLines && removed >= maxLines) break;
    }
    
    if (lines.length === 0) return chalk.gray('  (no visible changes)');
    return lines.join('\n');
  }

  renderMultipleDiffs(changes) {
    const table = new Table({
      head: [chalk.cyan('File'), chalk.cyan('Status'), chalk.cyan('Changes')],
      colWidths: [30, 15, 55],
      style: { head: [], border: [] }
    });
    
    for (const change of changes) {
      const statusIcon = change.status === 'created' ? '✨' : (change.status === 'modified' ? '📝' : '🗑️');
      const statusColor = change.status === 'created' ? chalk.green : (change.status === 'modified' ? chalk.yellow : chalk.red);
      table.push([
        chalk.cyan(change.file.split('/').pop()),
        statusColor(`${statusIcon} ${change.status}`),
        chalk.gray(change.summary || `${change.additions || 0} additions, ${change.deletions || 0} deletions`)
      ]);
    }
    
    return table.toString();
  }

  renderFileTree(files, maxDepth = 3) {
    const tree = {};
    
    for (const file of files) {
      const parts = file.split('/').filter(p => p);
      let current = tree;
      for (let i = 0; i < Math.min(parts.length, maxDepth); i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = i === parts.length - 1 ? null : {};
        }
        if (current[part] !== null) {
          current = current[part];
        }
      }
    }
    
    const renderNode = (node, prefix = '') => {
      let result = '';
      const keys = Object.keys(node).sort();
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const isLast = i === keys.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        const childPrefix = isLast ? '    ' : '│   ';
        
        if (node[key] === null) {
          result += `${prefix}${connector}${chalk.green(key)}\n`;
        } else {
          result += `${prefix}${connector}${chalk.blue(key)}/\n`;
          result += renderNode(node[key], prefix + childPrefix);
        }
      }
      return result;
    };
    
    return `📁 Project Structure:\n${renderNode(tree)}`;
  }
}