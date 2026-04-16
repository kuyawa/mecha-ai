// Mecha AI - Main module exports
export { DeepSeekAssistant } from './assistant.js';
export { config } from './config.js';
export { toolDefinitions } from './tools/index.js';
export { fileTools } from './tools/fileTools.js';
export { ContextManager } from './tools/contextManager.js';
export { ProjectMemory } from './tools/projectMemory.js';
export { PlanExecutor } from './planExecutor.js';
export { DiffRenderer } from './tools/diffRenderer.js';
export { StreamingHandler } from './streamingHandler.js';

// Main class for easy usage
export class MechaAI {
  constructor(options = {}) {
    this.assistant = new DeepSeekAssistant();
    
    // Override config if provided
    if (options.apiKey) {
      this.assistant.config.deepseek.apiKey = options.apiKey;
    }
    if (options.baseURL) {
      this.assistant.config.deepseek.baseURL = options.baseURL;
    }
    if (options.model) {
      this.assistant.config.deepseek.model = options.model;
    }
    
    // Feature options
    if (options.enablePlanning !== undefined) {
      this.assistant.config.features.enablePlanning = options.enablePlanning;
    }
    if (options.enableStreaming !== undefined) {
      this.assistant.config.features.enableStreaming = options.enableStreaming;
    }
    if (options.enableMemory !== undefined) {
      this.assistant.config.features.enableMemory = options.enableMemory;
    }
  }

  /**
   * Chat with the AI assistant
   * @param {string} prompt - The user prompt
   * @param {object} options - Chat options
   * @returns {Promise<string>} - The AI response
   */
  async chat(prompt, options = {}) {
    return await this.assistant.chat(prompt, options);
  }

  /**
   * Reset the conversation
   */
  reset() {
    this.assistant.reset();
  }

  /**
   * Preview pending changes
   * @returns {Promise<Map>} - Map of pending changes
   */
  async previewChanges() {
    return await this.assistant.previewChanges();
  }

  /**
   * Apply pending changes
   */
  async applyPendingChanges() {
    await this.assistant.applyPendingChanges();
  }

  /**
   * Discard pending changes
   */
  async discardPendingChanges() {
    await this.assistant.discardPendingChanges();
  }

  /**
   * Get the current configuration
   * @returns {object} - Configuration object
   */
  getConfig() {
    return { ...this.assistant.config };
  }

  /**
   * Update configuration
   * @param {object} newConfig - New configuration values
   */
  updateConfig(newConfig) {
    if (newConfig.deepseek) {
      Object.assign(this.assistant.config.deepseek, newConfig.deepseek);
    }
    if (newConfig.features) {
      Object.assign(this.assistant.config.features, newConfig.features);
    }
    if (newConfig.fileOps) {
      Object.assign(this.assistant.config.fileOps, newConfig.fileOps);
    }
  }
}

// Default export for convenience
export default MechaAI;