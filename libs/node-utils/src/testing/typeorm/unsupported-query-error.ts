/**
 * Thrown when a query uses something the in-memory repository does not support,
 * e.g. a `Raw()` operator, a relation in `where` or `order`, or `null` as a condition value.
 * Available as `MemoryRepository.UnsupportedQueryError`.
 */
export class UnsupportedQueryError extends Error {
  override readonly name = 'UnsupportedQueryError';
}
