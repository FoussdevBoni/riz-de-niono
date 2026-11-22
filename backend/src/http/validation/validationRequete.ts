import { erreurs } from '../erreurs/erreurApplication.js';

/**
 * Lecture et contrôle de format des données d'une requête, utilisés par les contrôleurs.
 * Chaque lecteur renvoie undefined quand le champ est absent ; obligatoire() le rend requis.
 * Une valeur mal formée produit une erreur 422 dont details.champ nomme le champ.
 */

export type Donnees = Record<string, unknown>;

const MOTIF_OBJECT_ID = /^[a-f0-9]{24}$/i;
const MOTIF_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function invalide(champ: string, message: string): never {
  throw erreurs.donneesInvalides(message, { champ });
}

export function lireCorps(corps: unknown): Donnees {
  if (corps === null || typeof corps !== 'object' || Array.isArray(corps)) {
    throw erreurs.donneesInvalides('Le corps de la requête doit être un objet JSON.');
  }
  return corps as Donnees;
}

export function obligatoire<T>(valeur: T | undefined, champ: string): T {
  if (valeur === undefined) invalide(champ, `Le champ ${champ} est obligatoire.`);
  return valeur;
}

export function estObjectId(valeur: unknown): valeur is string {
  return typeof valeur === 'string' && MOTIF_OBJECT_ID.test(valeur);
}

/** Identifiant de ressource lu dans l'URL : un format invalide équivaut à une ressource absente. */
export function lireIdentifiant(valeur: unknown): string {
  if (!estObjectId(valeur)) throw erreurs.ressourceIntrouvable();
  return valeur.toLowerCase();
}

export function lireChaine(
  donnees: Donnees,
  champ: string,
  { min = 1, max = 200 }: { min?: number; max?: number } = {},
): string | undefined {
  const valeur = donnees[champ];
  if (valeur === undefined) return undefined;
  if (typeof valeur !== 'string') invalide(champ, `Le champ ${champ} doit être une chaîne de caractères.`);
  const texte = valeur.trim();
  if (texte.length < min || texte.length > max) {
    invalide(champ, `Le champ ${champ} doit contenir entre ${min} et ${max} caractères.`);
  }
  return texte;
}

/** Mot de passe lu tel quel, sans suppression des espaces. La règle de robustesse relève du service. */
export function lireMotDePasse(donnees: Donnees, champ: string): string | undefined {
  const valeur = donnees[champ];
  if (valeur === undefined) return undefined;
  if (typeof valeur !== 'string' || valeur.length === 0 || valeur.length > 200) {
    invalide(champ, `Le champ ${champ} doit être une chaîne de 1 à 200 caractères.`);
  }
  return valeur;
}

export function lireEmail(donnees: Donnees, champ = 'email'): string | undefined {
  const valeur = lireChaine(donnees, champ, { max: 254 });
  if (valeur === undefined) return undefined;
  if (!MOTIF_EMAIL.test(valeur)) invalide(champ, `Le champ ${champ} doit être une adresse électronique.`);
  return valeur.toLowerCase();
}

export function lireBooleen(donnees: Donnees, champ: string): boolean | undefined {
  const valeur = donnees[champ];
  if (valeur === undefined) return undefined;
  if (typeof valeur !== 'boolean') invalide(champ, `Le champ ${champ} doit valoir true ou false.`);
  return valeur;
}

export function lireObjectId(donnees: Donnees, champ: string): string | undefined {
  const valeur = donnees[champ];
  if (valeur === undefined) return undefined;
  if (!estObjectId(valeur)) invalide(champ, `Le champ ${champ} doit être un identifiant valide.`);
  return valeur.toLowerCase();
}

export function lireListe(donnees: Donnees, champ: string): unknown[] | undefined {
  const valeur = donnees[champ];
  if (valeur === undefined) return undefined;
  if (!Array.isArray(valeur)) invalide(champ, `Le champ ${champ} doit être une liste.`);
  return valeur;
}

/** Liste de valeurs choisies dans un ensemble fermé, sans doublon. */
export function lireListeValeurs<T extends string>(
  donnees: Donnees,
  champ: string,
  valeursAutorisees: readonly T[],
): T[] | undefined {
  const liste = lireListe(donnees, champ);
  if (liste === undefined) return undefined;
  for (const valeur of liste) {
    if (!valeursAutorisees.includes(valeur as T)) {
      invalide(champ, `Valeurs autorisées pour ${champ} : ${valeursAutorisees.join(', ')}.`);
    }
  }
  return [...new Set(liste as T[])];
}

export function lireListeObjectIds(donnees: Donnees, champ: string): string[] | undefined {
  const liste = lireListe(donnees, champ);
  if (liste === undefined) return undefined;
  if (!liste.every(estObjectId)) invalide(champ, `Le champ ${champ} doit contenir des identifiants valides.`);
  return [...new Set((liste as string[]).map((id) => id.toLowerCase()))];
}

const MOTIF_CODE = /^[A-Z0-9][A-Z0-9_.-]{0,29}$/;
const MOTIF_DECIMAL = /^\d{1,12}(\.\d{1,4})?$/;
const MOTIF_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/;

/** Code de référentiel métier, normalisé en majuscules (ex. « SITE-01 »). */
export function lireCode(donnees: Donnees, champ = 'code'): string | undefined {
  const valeur = lireChaine(donnees, champ, { max: 30 });
  if (valeur === undefined) return undefined;
  const code = valeur.toUpperCase();
  if (!MOTIF_CODE.test(code)) {
    invalide(champ, 'Le code contient de 1 à 30 caractères : lettres, chiffres, « _ », « . » ou « - ».');
  }
  return code;
}

/** Décimal positif transmis en chaîne (document 04), par exemple "12500" ou "10.5". */
export function lireDecimal(donnees: Donnees, champ: string): string | undefined {
  const valeur = donnees[champ];
  if (valeur === undefined) return undefined;
  if (typeof valeur !== 'string' || !MOTIF_DECIMAL.test(valeur.trim())) {
    invalide(champ, `Le champ ${champ} doit être un nombre décimal positif transmis en chaîne, par exemple "10.5".`);
  }
  return valeur.trim();
}

/** Date ISO 8601 (« 2026-06-01 » ou date et heure). */
export function lireDate(donnees: Donnees, champ: string): Date | undefined {
  const valeur = donnees[champ];
  if (valeur === undefined) return undefined;
  const date = typeof valeur === 'string' && MOTIF_DATE.test(valeur) ? new Date(valeur) : undefined;
  if (!date || Number.isNaN(date.getTime())) invalide(champ, `Le champ ${champ} doit être une date ISO 8601.`);
  return date;
}

/** Liste de textes non vides, sans doublon (ex. membres d'une équipe). */
export function lireListeTextes(donnees: Donnees, champ: string, { max = 100 }: { max?: number } = {}): string[] | undefined {
  const liste = lireListe(donnees, champ);
  if (liste === undefined) return undefined;
  const textes = liste.map((element) =>
    typeof element === 'string' && element.trim().length > 0 && element.trim().length <= max
      ? element.trim()
      : invalide(champ, `Le champ ${champ} doit contenir des textes de 1 à ${max} caractères.`),
  );
  return [...new Set(textes)];
}

/**
 * Champ facultatif effaçable : null efface la valeur, undefined la laisse inchangée,
 * sinon le lecteur indiqué contrôle la valeur.
 */
export function lireEffacable<T>(
  donnees: Donnees,
  champ: string,
  lecteur: (donnees: Donnees, champ: string) => T | undefined,
): T | null | undefined {
  return donnees[champ] === null ? null : lecteur(donnees, champ);
}

/* Paramètres de requête (filtres de liste). */

export function lireFiltreObjectId(query: Donnees, nom: string): string | undefined {
  const valeur = query[nom];
  if (valeur === undefined || valeur === '') return undefined;
  if (!estObjectId(valeur)) invalide(nom, `Le paramètre ${nom} doit être un identifiant valide.`);
  return valeur.toLowerCase();
}

export function lireFiltreValeur<T extends string>(
  query: Donnees,
  nom: string,
  valeursAutorisees: readonly T[],
): T | undefined {
  const valeur = query[nom];
  if (valeur === undefined || valeur === '') return undefined;
  if (!valeursAutorisees.includes(valeur as T)) {
    invalide(nom, `Valeurs autorisées pour ${nom} : ${valeursAutorisees.join(', ')}.`);
  }
  return valeur as T;
}

/** Motif obligatoire d'une annulation ou d'une correction (1 à 500 caractères). */
export function lireMotif(corps: unknown): string {
  return obligatoire(lireChaine(lireCorps(corps), 'motif', { max: 500 }), 'motif');
}

export function lireFiltreDate(query: Donnees, nom: string): Date | undefined {
  const valeur = query[nom];
  if (valeur === undefined || valeur === '') return undefined;
  return lireDate({ [nom]: valeur }, nom);
}

/** Fin de période incluse : une date seule (« 2026-11-30 ») couvre toute la journée. */
export function lireFiltreFinPeriode(query: Donnees, nom = 'date_fin'): Date | undefined {
  const date = lireFiltreDate(query, nom);
  if (date && typeof query[nom] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query[nom] as string)) {
    return new Date(date.getTime() + 24 * 3600_000 - 1);
  }
  return date;
}

/** Filtre MongoDB d'intervalle de dates (bornes incluses), ou undefined sans borne. */
export function intervalleDates(debut?: Date, fin?: Date): Record<string, Date> | undefined {
  if (!debut && !fin) return undefined;
  return { ...(debut ? { $gte: debut } : {}), ...(fin ? { $lte: fin } : {}) };
}

/** Quantité décimale strictement positive (« 0 » refusé). */
export function lireQuantite(donnees: Donnees, champ: string): string | undefined {
  const valeur = lireDecimal(donnees, champ);
  if (valeur !== undefined && Number(valeur) === 0) invalide(champ, `Le champ ${champ} doit être strictement positif.`);
  return valeur;
}

export function lireFiltreBooleen(query: Donnees, nom: string): boolean | undefined {
  const valeur = lireFiltreValeur(query, nom, ['true', 'false'] as const);
  return valeur === undefined ? undefined : valeur === 'true';
}
