import { existsSync } from 'node:fs';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

function lireVariable(nom: string, valeurParDefaut?: string): string {
  const valeur = process.env[nom] ?? valeurParDefaut;
  if (valeur === undefined || valeur === '') {
    throw new Error(`Variable d'environnement manquante : ${nom}`);
  }
  return valeur;
}

export const configuration = {
  environnement: lireVariable('NODE_ENV', 'development'),
  port: Number(lireVariable('PORT', '3000')),
  /** Chaîne de connexion MongoDB Atlas, sans nom de base. */
  mongodbUri: lireVariable('MONGODB_URI'),
  /** Base de l'application ; l'option --base-tests (npm run dev:tests) ouvre la base de tests. */
  mongodbBase: process.argv.includes('--base-tests')
    ? lireVariable('MONGODB_BASE_TESTS', 'riz_de_niono_tests')
    : lireVariable('MONGODB_BASE', 'riz_de_niono'),
  /** Base réservée aux tests, sur le même cluster Atlas. */
  mongodbBaseTests: lireVariable('MONGODB_BASE_TESTS', 'riz_de_niono_tests'),
  prefixeApi: '/api/v1',
  /** Durée de validité d'une session ouverte à la connexion. */
  sessionDureeHeures: Number(lireVariable('SESSION_DUREE_HEURES', '12')),
  /** Durée de validité d'un jeton de réinitialisation du mot de passe. */
  reinitialisationDureeMinutes: Number(lireVariable('REINITIALISATION_DUREE_MINUTES', '60')),
  /** Adresse du frontend, utilisée pour construire le lien de réinitialisation. */
  urlFrontend: lireVariable('URL_FRONTEND', 'http://localhost:5173'),
  /**
   * Origines autorisées à appeler l'API depuis un navigateur (frontend hébergé sur un autre domaine),
   * séparées par des virgules. Vide : aucune origine externe (développement via le relais Vite).
   */
  originesAutorisees: (process.env.ORIGINES_AUTORISEES ?? '')
    .split(',')
    .map((origine) => origine.trim().replace(/\/+$/, ''))
    .filter(Boolean),
  /**
   * Services externes. Leurs variables ne sont exigées qu'au premier envoi ou téléversement,
   * pour que l'API démarre même si l'un d'eux n'est pas encore configuré.
   */
  email: {
    resendApiKey: process.env.RESEND_API_KEY,
    /** Expéditeur, par exemple « Riz de Niono <ne-pas-repondre@domaine> ». */
    expediteur: process.env.RESEND_FROM,
  },
  media: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    /** Préfixe des dossiers Cloudinary ; l'environnement y est ajouté (riz-de-niono/development/...). */
    dossierRacine: lireVariable('CLOUDINARY_DOSSIER', 'riz-de-niono'),
  },
} as const;

/** Lit une valeur de configuration facultative au démarrage mais requise pour un service. */
export function exigerConfiguration(valeur: string | undefined, nomVariable: string): string {
  if (!valeur) throw new Error(`Variable d'environnement manquante : ${nomVariable}`);
  return valeur;
}
