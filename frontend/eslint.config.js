import tseslint from 'typescript-eslint';

/**
 * Séparation des couches du document 06 :
 * page ou composant → hook → service → client HTTP.
 * Seuls les services importent le client HTTP, et seul le client HTTP appelle fetch.
 */
const clientHttpReserveAuxServices = {
  patterns: [
    {
      group: ['**/api/clientHttp', '**/api/clientHttp.ts', 'axios'],
      message: 'Seuls les services des modules utilisent le client HTTP. Passer par le service du module.',
    },
  ],
};

export default tseslint.config(
  { ignores: ['dist/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/modules/**/services/**', 'src/api/**'],
    rules: { 'no-restricted-imports': ['error', clientHttpReserveAuxServices] },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/api/clientHttp.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Les appels HTTP passent par le service du module.' },
        { name: 'XMLHttpRequest', message: 'Les appels HTTP passent par le service du module.' },
      ],
    },
  },
);
