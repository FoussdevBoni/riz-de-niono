import { Types } from 'mongoose';

/** Conversion des décimaux : chaîne dans l'API, Decimal128 dans MongoDB (documents 03 et 04). */
export function versDecimal(valeur: string): Types.Decimal128;
export function versDecimal(valeur: string | null): Types.Decimal128 | null;
export function versDecimal(valeur: string | null): Types.Decimal128 | null {
  return valeur === null ? null : Types.Decimal128.fromString(valeur);
}

export function depuisDecimal(valeur: Types.Decimal128 | null | undefined): string | null {
  return valeur == null ? null : valeur.toString();
}

/** Opposé d'une quantité positive, pour décrémenter un solde avec $inc. */
export function decimalNegatif(valeur: string): Types.Decimal128 {
  return Types.Decimal128.fromString(`-${valeur}`);
}

/*
 * Calcul décimal exact en virgule fixe (8 décimales) sur des entiers BigInt, pour les montants
 * en chaînes de l'API : quantité × prix unitaire (4 décimales chacun au plus), totaux et soldes.
 */
const DECIMALES = 8;
const FACTEUR = 10n ** BigInt(DECIMALES);

function versEntier(valeur: string): bigint {
  const texte = /e/i.test(valeur) ? Number(valeur).toFixed(DECIMALES) : valeur.trim();
  const negatif = texte.startsWith('-');
  const [entiere, decimale = ''] = texte.replace(/^[-+]/, '').split('.');
  const entier = BigInt(`${entiere || '0'}${decimale.slice(0, DECIMALES).padEnd(DECIMALES, '0')}`);
  return negatif ? -entier : entier;
}

function versTexte(entier: bigint): string {
  const negatif = entier < 0n;
  const absolu = negatif ? -entier : entier;
  const decimale = (absolu % FACTEUR).toString().padStart(DECIMALES, '0').replace(/0+$/, '');
  return `${negatif ? '-' : ''}${absolu / FACTEUR}${decimale ? `.${decimale}` : ''}`;
}

export const decimal = {
  additionner: (...valeurs: string[]): string => versTexte(valeurs.reduce((somme, v) => somme + versEntier(v), 0n)),
  soustraire: (a: string, b: string): string => versTexte(versEntier(a) - versEntier(b)),
  multiplier: (a: string, b: string): string => versTexte((versEntier(a) * versEntier(b)) / FACTEUR),
  /** -1, 0 ou 1. */
  comparer: (a: string, b: string): number => {
    const ecart = versEntier(a) - versEntier(b);
    return ecart === 0n ? 0 : ecart < 0n ? -1 : 1;
  },
  normaliser: (valeur: string): string => versTexte(versEntier(valeur)),
  /** a / b arrondi à `decimales` chiffres (arrondi au plus proche) ; null si b vaut zéro. */
  diviser: (a: string, b: string, decimales = 2): string | null => {
    const numerateur = versEntier(a);
    const denominateur = versEntier(b);
    if (denominateur === 0n) return null;
    const precision = 10n ** BigInt(decimales);
    const negatif = numerateur < 0n !== denominateur < 0n;
    const n = (numerateur < 0n ? -numerateur : numerateur) * precision;
    const d = denominateur < 0n ? -denominateur : denominateur;
    const quotient = (2n * n + d) / (2n * d);
    return versTexte(((negatif ? -quotient : quotient) * FACTEUR) / precision);
  },
};

export function versObjectIds(ids: readonly string[]): Types.ObjectId[] {
  return ids.map((id) => new Types.ObjectId(id));
}
