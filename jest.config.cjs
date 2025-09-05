module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests/unit'],
  setupFilesAfterEnv: ['<rootDir>/tests/unit/setup.js'],
  testMatch: ['**/*.spec.js'],
  moduleFileExtensions: ['js','json'],
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  transformIgnorePatterns: ['/node_modules/'],
  moduleNameMapper: {
    '\\.(css|scss)$': '<rootDir>/tests/unit/styleStub.js'
  }
};
