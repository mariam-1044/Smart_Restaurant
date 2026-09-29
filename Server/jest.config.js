// CommonJS project — no ESM flags. Existing src/ uses require/module.exports.
module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.afterEnv.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/helpers/', '/__tests__/fixtures/'],
  collectCoverageFrom: [
    'src/application/services/**/*.js',
    'src/interfaces/controllers/**/*.js',
    'src/routes/**/*.js',
    'src/middlewares/**/*.js',
    'src/application/validations/**/*.js',
    'src/domain/models/**/*.js',
    'src/infrastructure/csv/**/*.js'
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    // Add exclusions here only with a comment explaining why.
  ],
  coverageThreshold: {
    global: { lines: 80, branches: 80, functions: 80, statements: 80 }
  },
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 20000,
  clearMocks: true
};