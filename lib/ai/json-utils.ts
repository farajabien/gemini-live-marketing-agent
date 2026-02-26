/**
 * Sanitizes a string that is expected to be JSON.
 * LLMs often include unescaped control characters (like newlines) within string values.
 */
export function sanitizeJson(str: string): string {
  if (!str) return str;
  
  let sanitized = str
    // 1. Remove control characters (except \n, \r, \t which we escape)
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, (match) => {
      if (match === '\n') return '\\n';
      if (match === '\r') return '\\r';
      if (match === '\t') return '\\t';
      return '';
    })
    // 2. Remove single-line comments // ...
    .replace(/\/\/.*/g, '')
    // 3. Remove multi-line comments /* ... */
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // 4. Remove trailing commas before ] or }
    .replace(/,\s*([\]\}])/g, '$1');
    
  return sanitized;
}
