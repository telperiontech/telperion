/* eslint-disable */
export default {
  displayName: 'js-utils',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  // `docs-app/` is a separate Nx project (the osw docs remote) nested in this folder
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/js-utils',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/index.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
  ],
  coverageReporters: ['text', 'json', 'html', 'lcov'],
};
