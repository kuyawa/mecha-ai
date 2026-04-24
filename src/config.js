import dotenv from 'dotenv';
dotenv.config();

// Helper function to parse boolean environment variables
function parseBool(value, defaultValue) {
  if (value === undefined) return defaultValue;
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  return defaultValue;
}

export const config = {
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || process.env.MECHA_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL || process.env.MECHA_BASE_URL || 'https://api.deepseek.com',
    model: process.env.DEEPSEEK_MODEL || process.env.MECHA_MODEL || 'deepseek-v4-flash',
    thinkingMode: 'adaptive'
  },
  fileOps: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    excludedDirs: ['node_modules', '.backups', '.git', 'ai', 'dist', 'build', 'coverage', 'prompts', 'work'],
    maxTokensPerFile: 8000,
  },
  features: {
    enableTransactions: parseBool(process.env.MECHA_ENABLE_TRANSACTIONS, true),
    enableFuzzyMatching: parseBool(process.env.MECHA_ENABLE_FUZZY_MATCHING, true),
    enablePlanning: parseBool(process.env.MECHA_ENABLE_PLANNING, true),
    enableCaching: parseBool(process.env.MECHA_ENABLE_CACHING, true),
    enableMemory: parseBool(process.env.MECHA_ENABLE_MEMORY, true),
    enableStreaming: parseBool(process.env.MECHA_ENABLE_STREAMING, true),
    dryRun: parseBool(process.env.MECHA_DRY_RUN, false),
    autoReadFiles: parseBool(process.env.MECHA_AUTO_READ_FILES, true),
    showFileTree: parseBool(process.env.MECHA_SHOW_FILE_TREE, true),
  }
};
