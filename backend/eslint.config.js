import tseslint from 'typescript-eslint';

/**
 * Les règles « no-restricted-imports » appliquent la séparation des couches du document 06 :
 * route → contrôleur → service → modèle. Seuls les services accèdent aux modèles.
 * Les SDK des services externes restent dans leur module : Resend dans email/, Cloudinary dans media/.
 * Un bloc ESLint qui redéfinit une règle remplace le précédent : chaque bloc reprend donc SDK_EXTERNES.
 */
const SDK_EXTERNES = [
  { name: 'resend', message: 'Passer par emailService (module email).' },
  { name: 'cloudinary', message: 'Passer par mediaService (module media).' },
];

const modulesExternes = ['src/modules/email/**', 'src/modules/media/**'];

export default tseslint.config(
  { ignores: ['dist/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    ignores: modulesExternes,
    rules: { 'no-restricted-imports': ['error', { paths: SDK_EXTERNES }] },
  },
  {
    files: ['src/**/controllers/**/*.ts', 'src/**/routes/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: SDK_EXTERNES,
          patterns: [
            {
              group: ['**/models/*', '**/schemas/*', 'mongoose'],
              message: 'Seuls les services et les modèles accèdent à MongoDB. Passer par le service du module.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/models/**/*.ts', 'src/**/schemas/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: SDK_EXTERNES,
          patterns: [
            {
              group: ['**/services/*', '**/controllers/*', '**/routes/*'],
              message: 'Un modèle ou un schéma ne dépend pas des couches supérieures.',
            },
          ],
        },
      ],
    },
  },
);
