import { EXPORT_CONDITION_ORDER, findExportsOrderViolations, orderConditions } from './export-conditions';

describe('export-conditions', () => {
  describe('EXPORT_CONDITION_ORDER', () => {
    it('puts types first, default last and import/require before node', () => {
      const order = [...EXPORT_CONDITION_ORDER];
      expect(order[0]).toBe('types');
      expect(order[order.length - 1]).toBe('default');
      expect(order.indexOf('import')).toBeLessThan(order.indexOf('node'));
      expect(order.indexOf('require')).toBeLessThan(order.indexOf('node'));
    });
  });

  describe('orderConditions', () => {
    it('sorts alphabetical input into spec order', () => {
      expect(orderConditions(['default', 'import', 'node', 'require', 'types'])).toEqual([
        'types',
        'import',
        'require',
        'node',
        'default',
      ]);
    });

    it('drops duplicates and keeps only requested conditions', () => {
      expect(orderConditions(['default', 'types', 'types'])).toEqual(['types', 'default']);
    });
  });

  describe('findExportsOrderViolations', () => {
    it('accepts the canonical order, including nested types', () => {
      expect(
        findExportsOrderViolations({
          '.': {
            types: { import: './index.d.ts', require: './index.d.cts' },
            import: './index.js',
            require: './index.cjs',
            node: './index.cjs',
            default: './index.js',
          },
          './package.json': './package.json',
        }),
      ).toEqual([]);
    });

    it('rejects the alphabetical order published in rx-utils@1.6.0', () => {
      const errors = findExportsOrderViolations({
        '.': {
          default: './index.cjs',
          import: './index.js',
          node: './index.cjs',
          require: './index.cjs',
          types: './index.d.ts',
        },
      });
      expect(errors.join('\n')).toMatch(/"types" must be the first/);
      expect(errors.join('\n')).toMatch(/"default" must be the last/);
      expect(errors.join('\n')).toMatch(/"require" must come before "node"/);
    });

    it('rejects node ahead of import', () => {
      const errors = findExportsOrderViolations({
        './foo': { types: './foo.d.ts', node: './foo.cjs', import: './foo.js', default: './foo.js' },
      });
      expect(errors).toEqual([expect.stringMatching(/exports\["\.\/foo"\]: "import" must come before "node"/)]);
    });

    it('rejects JS entries without types', () => {
      expect(findExportsOrderViolations({ '.': { import: './a.js', default: './a.js' } })).toHaveLength(1);
    });

    it('validates a bare conditions object (no subpaths)', () => {
      expect(findExportsOrderViolations({ default: './a.js', types: './a.d.ts' })).toHaveLength(2);
    });

    it('ignores string and missing exports', () => {
      expect(findExportsOrderViolations('./index.js')).toEqual([]);
      expect(findExportsOrderViolations(undefined)).toEqual([]);
    });
  });
});
