import fs from 'fs/promises';
import crypto from 'crypto';

export class FileCache {
  constructor(ttl = 60000) {
    this.cache = new Map();
    this.ttl = ttl;
  }

  getFileHash(content) {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  async getOrRead(filePath, forceRefresh = false) {
    const cached = this.cache.get(filePath);
    const now = Date.now();
    
    if (!forceRefresh && cached && (now - cached.timestamp) < this.ttl) {
      return cached.content;
    }
    
    const content = await fs.readFile(filePath, 'utf-8');
    const hash = this.getFileHash(content);
    
    if (cached && cached.hash === hash) {
      cached.timestamp = now;
      this.cache.set(filePath, cached);
      return cached.content;
    }
    
    this.cache.set(filePath, { content, hash, timestamp: now });
    return content;
  }

  invalidate(filePath) {
    this.cache.delete(filePath);
  }

  invalidatePattern(pattern) {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  clear() {
    this.cache.clear();
  }

  getStats() {
    return { size: this.cache.size, keys: Array.from(this.cache.keys()) };
  }
}