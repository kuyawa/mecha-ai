import chalk from 'chalk';

export class StreamingHandler {
  constructor() {
    this.reasoningBuffer = '';
    this.contentBuffer = '';
    this.toolCalls = new Map();
    this.currentReasoningLine = '';
    this.currentContentLine = '';
  }

  handleStreamChunk(chunk) {
    const delta = chunk.choices[0]?.delta;
    if (!delta) return null;
    
    if (delta.reasoning_content) {
      for (const char of delta.reasoning_content) {
        if (char === '\n') {
          console.log(chalk.gray('💭 ' + this.currentReasoningLine));
          this.reasoningBuffer += this.currentReasoningLine + '\n';
          this.currentReasoningLine = '';
        } else {
          this.currentReasoningLine += char;
        }
      }
    }
    
    if (delta.content) {
      for (const char of delta.content) {
        if (char === '\n') {
          if (this.currentContentLine) {
            console.log(chalk.green('🤖 ' + this.currentContentLine));
            this.contentBuffer += this.currentContentLine + '\n';
            this.currentContentLine = '';
          }
        } else {
          this.currentContentLine += char;
        }
      }
    }
    
    return {
      reasoning: this.reasoningBuffer,
      content: this.contentBuffer,
      toolCalls: Array.from(this.toolCalls.values())
    };
  }

  flush() {
    if (this.currentReasoningLine) {
      console.log(chalk.gray('💭 ' + this.currentReasoningLine));
    }
    if (this.currentContentLine) {
      console.log(chalk.green('🤖 ' + this.currentContentLine));
    }
    this.currentReasoningLine = '';
    this.currentContentLine = '';
  }

  clear() {
    this.reasoningBuffer = '';
    this.contentBuffer = '';
    this.toolCalls.clear();
    this.currentReasoningLine = '';
    this.currentContentLine = '';
  }
}