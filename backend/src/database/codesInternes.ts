import type { Model } from 'mongoose';

import { estErreurDoublon } from './erreursMongo.js';

/**
 * Codes internes des référentiels (sites, campagnes, produits…).
 *
 * Le code est proposé à partir du nom saisi (« Casier de Kokry » → « CASIER-KOKRY »), puis complété
 * d'un suffixe numérique s'il est déjà pris (« CASIER-KOKRY-2 »). L'unicité repose sur l'index unique
 * du champ `code` : en cas de créations simultanées, l'insertion perdante est rejouée avec le code
 * libre suivant. Un code saisi par l'utilisateur est conservé tel quel et n'est jamais remplacé.
 */

const LONGUEUR_MAXIMALE = 30;
const LONGUEUR_BASE = 26;
const TENTATIVES = 8;

const MOTS_VIDES = new Set([
  'A', 'AU', 'AUX', 'D', 'DE', 'DES', 'DU', 'EN', 'ET', 'L', 'LA', 'LE', 'LES', 'POUR', 'SUR', 'UN', 'UNE',
]);

/** Base lisible tirée du nom : majuscules sans accents, mots significatifs reliés par des tirets. */
export function baseCodeDepuisNom(nom: string | undefined, prefixeSecours: string): string {
  const mots = (nom ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((mot) => mot && !MOTS_VIDES.has(mot));

  let base = '';
  for (const mot of mots) {
    const suivant = base ? `${base}-${mot}` : mot;
    if (suivant.length > LONGUEUR_BASE) break;
    base = suivant;
  }

  if (!base && mots[0]) base = mots[0].slice(0, LONGUEUR_BASE);
  return base || prefixeSecours;
}

function candidat(base: string, rang: number): string {
  if (rang <= 1) return base.slice(0, LONGUEUR_MAXIMALE);
  const suffixe = `-${rang}`;
  return `${base.slice(0, LONGUEUR_MAXIMALE - suffixe.length)}${suffixe}`;
}

/** Premier code libre pour cette base : la base elle-même, puis BASE-2, BASE-3… */
export async function premierCodeLibre(modele: Model<{ code: string }>, base: string): Promise<string> {
  const existants = await modele
    .find({ code: { $regex: `^${base.replace(/[.\\-]/g, '\\$&')}(-\\d+)?$` } }, { code: 1 })
    .lean<{ code: string }[]>();
  const pris = new Set(existants.map(({ code }) => code));

  let rang = 1;
  while (pris.has(candidat(base, rang))) rang += 1;
  return candidat(base, rang);
}

function doublonSurCode(erreur: unknown): boolean {
  if (!estErreurDoublon(erreur)) return false;
  const cle = (erreur as { keyPattern?: Record<string, unknown> }).keyPattern;
  return !cle || 'code' in cle;
}

/**
 * Crée un document avec un code unique.
 * - code fourni : vérifié puis utilisé tel quel ; un doublon renvoie l'erreur métier du module ;
 * - code absent : généré depuis le nom et rejoué automatiquement si une création concurrente l'a pris.
 */
export async function creerAvecCodeUnique<T>({
  modele,
  codeFourni,
  nom,
  prefixe,
  erreurDoublon,
  creer,
}: {
  modele: Model<{ code: string }>;
  codeFourni: string | undefined;
  nom: string | undefined;
  prefixe: string;
  erreurDoublon: () => Error;
  creer: (code: string) => Promise<T>;
}): Promise<T> {
  if (codeFourni) {
    if (await modele.exists({ code: codeFourni })) throw erreurDoublon();
    try {
      return await creer(codeFourni);
    } catch (erreur) {
      if (doublonSurCode(erreur)) throw erreurDoublon();
      throw erreur;
    }
  }

  const base = baseCodeDepuisNom(nom, prefixe);
  for (let tentative = 0; tentative < TENTATIVES; tentative += 1) {
    const code = await premierCodeLibre(modele, base);
    try {
      return await creer(code);
    } catch (erreur) {
      if (!doublonSurCode(erreur)) throw erreur;
    }
  }
  throw erreurDoublon();
}
