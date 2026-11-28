export interface GzipBudgetExecutorSchema {
  /**
   * The built application's output directory, holding index.html
   * (relative to the workspace root)
   */
  outputPath: string;

  /**
   * The page whose scripts, stylesheets and modulepreloads make the initial bundle
   *
   * Default: index.html
   */
  index?: string;

  /**
   * Fails above this gzipped initial size, e.g. "250kB" (Angular budget syntax: b, kB, MB)
   */
  maximumError: string;

  /**
   * Warns above this gzipped initial size
   */
  maximumWarning?: string;

  /**
   * gzip level, 1–9
   *
   * Default: 6, a typical server setting
   */
  level?: number;
}
