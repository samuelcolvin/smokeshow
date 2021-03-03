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
}
