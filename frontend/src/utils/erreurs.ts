/** Lecture des erreurs de l'API (format du document 04 : code, message, details.champ). */

interface ErreurDetaillee {
  message?: string;
  code?: string;
  details?: Record<string, unknown>;
}

export function messageErreur(erreur: unknown, parDefaut = 'Une erreur est survenue.'): string {
  return (erreur as ErreurDetaillee | null)?.message ?? parDefaut;
}

export function codeErreur(erreur: unknown): string | undefined {
  return (erreur as ErreurDetaillee | null)?.code;
}

/** Champ désigné par l'erreur (details.champ), pour placer le message sous la bonne saisie. */
export function champErreur(erreur: unknown): string | undefined {
  const champ = (erreur as ErreurDetaillee | null)?.details?.champ;
  return typeof champ === 'string' ? champ : undefined;
}

/** Détails complémentaires d'une erreur de l'API (par exemple produit_id et quantite_disponible). */
export function detailsErreur(erreur: unknown): Record<string, unknown> {
  return (erreur as ErreurDetaillee | null)?.details ?? {};
}
