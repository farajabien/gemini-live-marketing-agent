/**
 * Sanitizes a string that is expected to be JSON.
 * LLMs often include unescaped control characters or markdown formatting.
 */
export function sanitizeJson(str: string): string {
  if (!str) return str;
  
  let sanitized = str
    // 1. Remove markdown code blocks if present
    .replace(/^```json\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  // 2. Quote-aware sanitization: Escape control characters (like newlines)
  // ONLY if they are inside a double-quoted string.
  // Structural newlines outside of strings are permitted by JSON.parse.
  
  let result = "";
  let inString = false;
  let escaped = false;
  
  for (let i = 0; i < sanitized.length; i++) {
    const char = sanitized[i];
    
    if (char === '"' && !escaped) {
      inString = !inString;
      result += char;
    } else if (inString) {
      if (escaped) {
        result += char;
        escaped = false;
      } else if (char === '\\') {
        result += char;
        escaped = true;
      } else if (char === '\n') {
        result += "\\n";
      } else if (char === '\r') {
        result += "\\r";
      } else if (char === '\t') {
        result += "\\t";
      } else if (char.charCodeAt(0) < 32) {
        // Other control characters: discard or escape
        // Most common are \n, \r, \t. Others we just omit for safety.
      } else {
        result += char;
      }
    } else {
      // Outside string: structural content
      // We keep everything that isn't a comment (handled below)
      result += char;
      escaped = false;
    }
  }

  // 3. Remove comments (now safe since we processed strings)
  sanitized = result
    .replace(/\/\/.*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  // 4. Remove trailing commas
  sanitized = sanitized.replace(/,\s*([\]\}])/g, '$1');
    
  return sanitized;
}


