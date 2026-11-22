/** Conversion entre les saisies des formulaires et les valeurs de l'API (décimaux en chaînes, dates ISO). */

/** Décimal saisi (« 12,5 ») vers le format de l'API (« 12.5 ») ; une saisie vide donne null. */
export function decimalSaisi(valeur: string): string | null {
  const nettoyee = valeur.trim().replace(/\s/g, '').replace(',', '.');
  return nettoyee === '' ? null : nettoyee;
}

/** Décimal de l'API vers le champ de saisie. */
export function decimalVersSaisie(valeur: string | null | undefined): string {
  return valeur ?? '';
}

/** Date de l'API (ISO) vers un champ date (AAAA-MM-JJ). */
export function dateVersSaisie(valeur: string | null | undefined): string {
  return valeur ? valeur.slice(0, 10) : '';
}

/** Texte facultatif : une saisie vide efface la valeur (null). */
export function texteFacultatif(valeur: string): string | null {
  const nettoye = valeur.trim();
  return nettoye === '' ? null : nettoye;
}

/** Fin de la journée choisie (filtre « jusqu'au »), pour inclure toute la journée. */
export function finDeJournee(date: string | undefined): string | undefined {
  return date ? `${date}T23:59:59.999Z` : undefined;
}
