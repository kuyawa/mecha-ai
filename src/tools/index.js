export const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a single file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file to read' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_multiple_files',
      description: 'Read multiple files at once',
      parameters: {
        type: 'object',
        properties: {
          paths: { type: 'array', items: { type: 'string' }, description: 'Array of file paths' },
        },
        required: ['paths'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_file',
      description: 'Create a new file with content',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path for the new file' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Edit an existing file by replacing a snippet',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file' },
          original_snippet: { type: 'string', description: 'Code to replace' },
          new_snippet: { type: 'string', description: 'New code to insert' },
        },
        required: ['path', 'original_snippet', 'new_snippet'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Search for a pattern across all files',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Text pattern to search for' },
          directory: { type: 'string', description: 'Directory to search in' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List all files in the project',
      parameters: {
        type: 'object',
        properties: {
          directory: { type: 'string', description: 'Directory to list' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'start_transaction',
      description: 'Start a transaction. All subsequent file edits can be rolled back.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'commit_transaction',
      description: 'Commit the current transaction. Changes become permanent.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rollback_transaction',
      description: 'Rollback the current transaction. Undo all changes.',
      parameters: { type: 'object', properties: {} },
    },
  },
];