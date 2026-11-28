import { PromiseExecutor, logger } from '@nx/devkit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { initialFiles } from './initial-files';
import { GzipBudgetExecutorSchema } from './schema';
import { formatSize, parseSize } from './size';

/**
 * Measures the gzipped initial bundle of a built web app and fails above `maximumError`.
 *
 * Angular's `budgets` measure raw sizes; what a browser downloads is compressed, so a
 * gzipped budget ("250 KB gzipped initial") needs its own check.
 */
const runExecutor: PromiseExecutor<GzipBudgetExecutorSchema> = async (
  { outputPath, index = 'index.html', maximumError, maximumWarning, level = 6 },
  context,
) => {
  const dir = join(context.root, outputPath);
  const files = initialFiles(readFileSync(join(dir, index), 'utf8')).map(file => ({
    file,
    size: gzipSync(readFileSync(join(dir, file)), { level }).length,
  }));
  const total = files.reduce((sum, f) => sum + f.size, 0);
  const error = parseSize(maximumError);
  const warning = maximumWarning ? parseSize(maximumWarning) : Infinity;

  files.forEach(({ file, size }) => logger.info(`  ${file.padEnd(40)} ${formatSize(size)}`));
  logger.info(`initial (gzip level ${level}): ${formatSize(total)} of ${formatSize(error)}`);

  if (total > error) {
    logger.error(`over the initial budget by ${formatSize(total - error)}`);
  } else if (total > warning) {
    logger.warn(`over the warning budget by ${formatSize(total - warning)}`);
  }

  return { success: total <= error };
};

export default runExecutor;
