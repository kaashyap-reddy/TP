import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'vite.config.ts', 'playwright.config.ts', 'e2e'] },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Just the two classic hook-correctness rules; the v6 "recommended" set adds React
      // Compiler-era style rules (set-state-in-effect etc.) that flag long-established
      // patterns here without being bugs — revisit if/when the compiler is adopted.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // ignoreRestSiblings: `const { omitted, ...rest } = obj` is the codebase's omit idiom
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }]
    }
  }
);
