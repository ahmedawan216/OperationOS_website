import "server-only";

/** Compare validated JSON records independently of PostgreSQL jsonb key order. */
export function canonicalRecord(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalRecord).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalRecord(child)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
