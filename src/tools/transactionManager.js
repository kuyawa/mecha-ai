import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

export class TransactionManager {
  constructor(projectRoot = process.cwd()) {
    this.backups = new Map();
    this.projectRoot = projectRoot;
    this.activeTransaction = false;
    this.backupDir = path.join(projectRoot, '.backups');
  }

  async startTransaction() {
    if (this.activeTransaction) {
      throw new Error('Transaction already in progress');
    }
    this.activeTransaction = true;
    this.backups.clear();
    await fs.mkdir(this.backupDir, { recursive: true });
    console.log(chalk.cyan('📝 Transaction started'));
  }

  async backup(filePath) {
    if (!this.activeTransaction) return;
    const absolutePath = path.resolve(filePath);
    try {
      const content = await fs.readFile(absolutePath, 'utf-8');
      const backupPath = path.join(this.backupDir, Buffer.from(absolutePath).toString('base64'));
      await fs.writeFile(backupPath, content, 'utf-8');
      this.backups.set(absolutePath, { backupPath, exists: true });
    } catch (error) {
      this.backups.set(absolutePath, { backupPath: null, exists: false });
    }
  }

  async commit() {
    if (!this.activeTransaction) throw new Error('No active transaction');
    for (const [_, { backupPath }] of this.backups) {
      if (backupPath) await fs.unlink(backupPath).catch(() => {});
    }
    this.backups.clear();
    this.activeTransaction = false;
    console.log(chalk.green('✅ Transaction committed'));
  }

  async rollback() {
    if (!this.activeTransaction) throw new Error('No active transaction');
    console.log(chalk.yellow('⏪ Rolling back changes...'));
    for (const [filePath, { backupPath, exists }] of this.backups) {
      if (exists && backupPath) {
        const backupContent = await fs.readFile(backupPath, 'utf-8');
        await fs.writeFile(filePath, backupContent, 'utf-8');
        await fs.unlink(backupPath);
        console.log(chalk.gray(`   Restored: ${path.basename(filePath)}`));
      } else if (!exists) {
        await fs.unlink(filePath).catch(() => {});
        console.log(chalk.gray(`   Deleted: ${path.basename(filePath)}`));
      }
    }
    this.backups.clear();
    this.activeTransaction = false;
    console.log(chalk.green('✅ Rollback complete'));
  }

  async withTransaction(fn) {
    await this.startTransaction();
    try {
      const result = await fn();
      await this.commit();
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }
}