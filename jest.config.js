/**
 * Lightweight Jest setup for pure utility modules.
 * We deliberately scope to src/utils/, src/rewards/, and src/appLinks.ts so we
 * avoid pulling in React Native / Expo native modules — those need a much
 * heavier preset (jest-expo) and a real test runner. The CI gate covers the
 * pure logic where regressions are most likely; UI testing happens via the
 * Maestro e2e suite in the release workflow.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  collectCoverageFrom: [
    'src/utils/**/*.ts',
    'src/rewards/**/*.ts',
    'src/appLinks.ts',
  ],
};
