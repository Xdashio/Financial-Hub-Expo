module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    // pnpm-compatible: package code lives under node_modules/.pnpm/<pkg>@ver/
    // node_modules/<pkg>/, so the plain "node_modules/(?!...)" allowlist
    // matched at the ROOT node_modules (followed by .pnpm) and silently
    // ignored even allowlisted packages — their ESM setup files then failed
    // to parse. The optional `\.pnpm/` group + prefix alternatives make the
    // lookahead check the real package directory instead. @financial-hub is
    // allowlisted too: the M11 lock test imports shared through the real
    // dist/ build, which is compiled as ESM.
    'node_modules/(?!(\\.pnpm/)?(jest-|@react-native|react-native|@expo|expo|@react-navigation|@react-native-community|@financial-hub))',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['**/__tests__/**/*.{ts,tsx}', '**/*.spec.{ts,tsx}'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.spec.{ts,tsx}',
  ],
  coverageDirectory: 'coverage',
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  passWithNoTests: true,
};