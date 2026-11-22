import { produitService } from './produitService.js';

/** Enrichit les références présentes dans les données métier déjà autorisées. */
export async function avecNomsProduits<T>(donnees: T): Promise<T> {
  const references: { ligne: Record<string, unknown>; id: string; champ: string }[] = [];

  function parcourir(valeur: unknown): void {
    if (!valeur || typeof valeur !== 'object') return;
    if (Array.isArray(valeur)) {
      valeur.forEach(parcourir);
      return;
    }

    const ligne = valeur as Record<string, unknown>;
    for (const [champ, contenu] of Object.entries(ligne)) {
      if ((champ === 'produit_id' || champ === 'paddy_produit_id') && typeof contenu === 'string') {
        references.push({ ligne, id: contenu, champ: champ.replace(/_id$/, '_nom') });
      } else {
        parcourir(contenu);
      }
    }
  }

  parcourir(donnees);
  if (!references.length) return donnees;

  const noms = await produitService.lireNoms([...new Set(references.map(({ id }) => id))]);
  for (const { ligne, id, champ } of references) {
    ligne[champ] = noms.get(id) ?? null;
  }
  return donnees;
}
