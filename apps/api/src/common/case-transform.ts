/**
 * Transform snake_case keys to camelCase for API responses.
 * Postgres returns snake_case but our shared types use camelCase.
 */

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function transformKeys(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(transformKeys);
  }
  
  if (typeof obj === 'object') {
    const transformed: any = {};
    for (const [key, value] of Object.entries(obj)) {
      transformed[toCamelCase(key)] = transformKeys(value);
    }
    return transformed;
  }
  
  return obj;
}

export function toCamelCaseResponse<T>(data: T): T {
  return transformKeys(data);
}

export function toCamelCaseResponseArray<T>(data: T[]): T[] {
  return data.map(transformKeys);
}