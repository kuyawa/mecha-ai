import { encoding_for_model } from 'tiktoken';

export class ContextManager {
  constructor(maxTokens = 100000) {
    this.encoder = encoding_for_model('gpt-4');
    this.maxTokens = maxTokens;
    this.reservedTokens = 4000;
  }

  countTokens(text) {
    if (!text) return 0;
    try {
      return this.encoder.encode(text).length;
    } catch (error) {
      return Math.ceil(text.length / 4);
    }
  }

  truncateFile(content, maxTokens = 8000, filePath = 'unknown') {
    const tokens = this.countTokens(content);
    if (tokens <= maxTokens) return content;

    const lines = content.split('\n');
    const totalLines = lines.length;
    const keepFirstPercent = 0.6;
    const keepLastPercent = 0.3;
    const keepFirst = Math.floor(totalLines * keepFirstPercent);
    const keepLast = Math.floor(totalLines * keepLastPercent);
    
    const truncated = [
      ...lines.slice(0, keepFirst),
      `\n// ⚠️ ${totalLines - keepFirst - keepLast} lines truncated (${tokens - maxTokens} tokens saved) ⚠️\n`,
      ...lines.slice(-keepLast)
    ].join('\n');
    
    return truncated;
  }

  truncateMultipleFiles(files, maxTokensPerFile = 8000) {
    const results = {};
    for (const [path, content] of Object.entries(files)) {
      results[path] = this.truncateFile(content, maxTokensPerFile, path);
    }
    return results;
  }

  estimateTotalTokens(messages) {
    let total = 0;
    for (const msg of messages) {
      total += this.countTokens(JSON.stringify(msg));
    }
    return total;
  }

  isOverLimit(messages) {
    return this.estimateTotalTokens(messages) > (this.maxTokens - this.reservedTokens);
  }

  summarizeOldMessages(messages, keepLast = 10) {
    if (messages.length <= keepLast) return messages;
    const summary = {
      role: 'system',
      content: `[Previous conversation summarized: ${messages.length - keepLast} messages compressed]`
    };
    return [summary, ...messages.slice(-keepLast)];
  }
}