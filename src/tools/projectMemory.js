import fs from 'fs/promises';
import path from 'path';

export class ProjectMemory {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.memoryFile = path.join(projectRoot, '.memory.json');
    this.data = null;
    this.load();
  }

  load() {
    try {
      const content = fs.readFileSync(this.memoryFile, 'utf-8');
      this.data = JSON.parse(content);
    } catch {
      this.data = {
        architecture: {},
        decisions: [],
        patterns: {},
        fileSummaries: {},
        lastUpdated: new Date().toISOString()
      };
    }
  }

  async save() {
    this.data.lastUpdated = new Date().toISOString();
    await fs.writeFile(this.memoryFile, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  async rememberFile(filePath, summary) {
    const relativePath = path.relative(this.projectRoot, filePath);
    this.data.fileSummaries[relativePath] = {
      summary,
      lastAnalyzed: new Date().toISOString(),
      dependencies: await this.extractImports(filePath)
    };
    await this.save();
  }

  async extractImports(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const imports = [];
      const importRegex = /import\s+.*\s+from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\)/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const imp = match[1] || match[2];
        imports.push(imp);
      }
      return imports;
    } catch {
      return [];
    }
  }

  async getRelevantContext(currentFile) {
    const relativePath = path.relative(this.projectRoot, currentFile);
    const relevant = [];
    
    if (this.data.fileSummaries[relativePath]) {
      relevant.push({
        type: 'current',
        content: this.data.fileSummaries[relativePath]
      });
    }
    
    return relevant;
  }

  async rememberArchitecture(description) {
    this.data.architecture = { description, lastUpdated: new Date().toISOString() };
    await this.save();
  }

  async rememberDecision(decision) {
    this.data.decisions.push({ decision, timestamp: new Date().toISOString() });
    if (this.data.decisions.length > 20) {
      this.data.decisions = this.data.decisions.slice(-20);
    }
    await this.save();
  }

  getMemorySummary() {
    return {
      filesTracked: Object.keys(this.data.fileSummaries).length,
      decisions: this.data.decisions.length,
      lastUpdated: this.data.lastUpdated
    };
  }
}