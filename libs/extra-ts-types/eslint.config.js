const baseConfig = require('../../eslint.config.js');

module.exports = [
  ...baseConfig,
  {
    // `docs-app/` is a separate Nx project (the osw docs remote) and is not part of this library's lint
    ignores: ['docs-app/**'],
  },
];
