module.exports = {
  root: true,
  ignorePatterns: ['/src/extra_modules/**/*', '/dist/**/*'],
  parserOptions: {
    ecmaVersion: 11,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  globals: {
    enz: true,
    xhr_calls: true,
  },
  extends: ['typescript', 'prettier'],
  rules: {
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'no-constant-condition': 'off',
    'react/jsx-uses-react': 'off',
  },
}
