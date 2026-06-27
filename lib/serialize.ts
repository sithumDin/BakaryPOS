// Recursively rename Prisma's 'id' → '_id' so the frontend stays compatible.
export function serialize(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (data instanceof Date) return data.toISOString();
  if (Array.isArray(data)) return data.map(serialize);
  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      result[key === 'id' ? '_id' : key] = serialize(value);
    }
    return result;
  }
  return data;
}
