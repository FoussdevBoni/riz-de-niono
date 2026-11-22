/*
 * Les valeurs et leurs unités sont reliées par une espace insécable : elles ne se séparent jamais
 * d'une ligne à l'autre (« 1 250 000 FCFA », « 66 t », « 5 300 kg/ha »).
 */
/** Mise en forme des valeurs de l'API (décimaux transmis en chaînes, document 04) pour l'affichage. */

const nombre = (decimales: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: decimales });

export function formaterNombre(valeur: string | number | null | undefined, decimales = 2): string {
  if (valeur === null || valeur === undefined || valeur === '') return '—';
  const n = typeof valeur === 'number' ? valeur : Number(valeur);
  return Number.isFinite(n) ? nombre(decimales).format(n) : String(valeur);
}

/** Montant en FCFA, sans décimales. */
export function formaterMontant(valeur: string | null | undefined): string {
  return valeur === null || valeur === undefined ? '—' : `${formaterNombre(valeur, 0)} FCFA`;
}

export function formaterQuantite(valeur: string | null | undefined, unite: string | null | undefined): string {
  return `${formaterNombre(valeur)}${unite ? ` ${unite}` : ''}`;
}

export function formaterDate(valeur: string | null | undefined): string {
  if (!valeur) return '—';
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? valeur : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(date);
}

/** Vrai si toutes les valeurs numériques transmises sont nulles (aucune donnée à afficher). */
export function estNul(...valeurs: (string | number | null | undefined)[]): boolean {
  return valeurs.every((valeur) => valeur === null || valeur === undefined || Number(valeur) === 0);
}

const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

/** Montant abrégé pour les graphiques et indicateurs (« 1,5 M FCFA »). */
export function formaterMontantCompact(valeur: string | number | null | undefined): string {
  if (valeur === null || valeur === undefined || valeur === '') return '—';
  const n = Number(valeur);
  return Number.isFinite(n) ? `${compact.format(n)} FCFA` : String(valeur);
}

/** Quantité lisible : les kilogrammes au-delà de 10 tonnes sont exprimés en tonnes. */
export function formaterQuantiteLisible(valeur: string | number | null | undefined, unite: string | null | undefined): string {
  const n = Number(valeur);
  if (unite === 'kg' && Number.isFinite(n) && Math.abs(n) >= 10000) return `${formaterNombre(n / 1000, 1)} t`;
  return formaterQuantite(valeur === null || valeur === undefined ? valeur : String(valeur), unite);
}

/** Part en pourcentage arrondi, ou « — » si le total est nul. */
export function formaterPart(valeur: number, total: number): string {
  return total > 0 ? `${Math.round((valeur / total) * 100)} %` : '—';
}
