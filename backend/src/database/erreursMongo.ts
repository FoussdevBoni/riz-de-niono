/** Indique une violation d'index unique MongoDB (code 11000). */
export function estErreurDoublon(erreur: unknown): boolean {
  return typeof erreur === 'object' && erreur !== null && (erreur as { code?: unknown }).code === 11000;
}
