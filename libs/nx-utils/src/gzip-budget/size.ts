const UNITS: Record<string, number> = { b: 1, kB: 1000, MB: 1000 * 1000 };

/**
 * Parses a size in Angular's budget syntax ("250kB", "1.5MB", "800b") into bytes
 */
export function parseSize(size: string): number {
  const match = /^(\d+(?:\.\d+)?)\s*(b|kB|MB)$/.exec(size.trim());

  if (!match) {
    throw new Error(`"${size}" is not a size like 250kB (units: b, kB, MB)`);
  }

  return Number(match[1]) * UNITS[match[2]];
}

/**
 * Formats bytes as kB with one decimal
 */
export function formatSize(bytes: number): string {
  return `${(bytes / 1000).toFixed(1)} kB`;
}
