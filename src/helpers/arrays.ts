// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const compareArrays = (a: any[], b: any[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Unique-ifies a 2D array of strings (imported namespaces list). */
export const unique2D = (rows: string[][]): string[][] => {
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const r of rows) {
    const key = r.join("\u0000"); // safe separator
    if (!seen.has(key)) {
      seen.add(key);
      out.push(r);
    }
  }
  return out;
}