import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { config } from '../config.js';
import { IntelligentEdit } from './intelligentEdit.js';
import { TransactionManager } from './transactionManager.js';
import { FileCache } from './fileCache.js';

const intelligentEdit = new IntelligentEdit();
let transactionManager = null;
let fileCache = null;

function getTransactionManager() {
  if (!transactionManager && config.features.enableTransactions) {
    transactionManager = new TransactionManager();
  }
  return transactionManager;
}

function getFileCache() {
  if (!fileCache && config.features.enableCaching) {
    fileCache = new FileCache();
  }
  return fileCache;
}

export const fileTools = {
  async readFile(filePath) {
    const resolved = path.resolve(filePath);
    const cache = getFileCache();
    if (cache && config.features.enableCaching) {
      return await cache.getOrRead(resolved);
    }
    const stat = await fs.stat(resolved);
    if (stat.size > config.fileOps.maxFileSize) {
      throw new Error(`File too large: ${stat.size} bytes (max ${config.fileOps.maxFileSize})`);
    }
    return await fs.readFile(resolved, 'utf-8');
  },

  async readMultipleFiles(filePaths) {
    const results = {};
    for (const filePath of filePaths) {
      try {
        results[filePath] = await this.readFile(filePath);
      } catch (error) {
        results[filePath] = `Error: ${error.message}`;
      }
    }
    return results;
  },

  async createFile(filePath, content) {
    const resolved = path.resolve(filePath);
    const dir = path.dirname(resolved);
    await fs.mkdir(dir, { recursive: true });
    
    const tm = getTransactionManager();
    if (tm && tm.activeTransaction) {
      await tm.backup(resolved);
    }
    
    await fs.writeFile(resolved, content, 'utf-8');
    
    const cache = getFileCache();
    if (cache) cache.invalidate(resolved);
  },

  async editFile(filePath, originalSnippet, newSnippet) {
    const resolved = path.resolve(filePath);
    
    const tm = getTransactionManager();
    if (tm && tm.activeTransaction) {
      await tm.backup(resolved);
    }
    
    const result = await intelligentEdit.editFile(resolved, originalSnippet, newSnippet, {
      fuzzy: config.features.enableFuzzyMatching,
      multiple: 'error'
    });
    
    const cache = getFileCache();
    if (cache) cache.invalidate(resolved);
    
    return result;
  },

  async createMultipleFiles(files) {
    const tm = getTransactionManager();
    if (tm && tm.activeTransaction) {
      for (const file of files) {
        await tm.backup(path.resolve(file.path));
      }
    }
    for (const file of files) {
      await this.createFile(file.path, file.content);
    }
  },

  async searchFiles(pattern, directory = '.') {
    const ignore = config.fileOps.excludedDirs.map(dir => `**/${dir}/**`);
    const files = await glob(`${directory}/**/*.{js,jsx,ts,tsx,html,css,json,md,py,rb,go}`, {
      ignore,
      absolute: true,
    });
    
    const results = [];
    for (const file of files) {
      try {
        const content = await this.readFile(file);
        if (content.includes(pattern)) {
          results.push({
            path: file,
            matches: this.findMatches(content, pattern),
          });
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }
    return results;
  },

  findMatches(content, pattern) {
    const lines = content.split('\n');
    const matches = [];
    lines.forEach((line, index) => {
      if (line.includes(pattern)) {
        matches.push({ line: index + 1, text: line.trim().slice(0, 80) });
      }
    });
    return matches.slice(0, 5);
  },

  async listFiles(directory = '.') {
    const ignore = config.fileOps.excludedDirs.map(dir => `**/${dir}/**`);
    const files = await glob(`${directory}/**/*`, {
      ignore,
      nodir: true,
      absolute: true,
    });
    return files;
  },

  async startTransaction() {
    const tm = getTransactionManager();
    if (tm) await tm.startTransaction();
  },

  async commitTransaction() {
    const tm = getTransactionManager();
    if (tm && tm.activeTransaction) await tm.commit();
  },

  async rollbackTransaction() {
    const tm = getTransactionManager();
    if (tm && tm.activeTransaction) await tm.rollback();
  },

  clearCache() {
    const cache = getFileCache();
    if (cache) cache.clear();
  },

  getCacheStats() {
    const cache = getFileCache();
    return cache ? cache.getStats() : { size: 0 };
  }
};