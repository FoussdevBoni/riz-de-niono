import { useEffect, useState } from 'react';

import type { OptionFiltre } from '../components/SelectFiltre';

/**
 * Charge une liste de référence (via le service d'un module) pour un filtre, un formulaire ou des libellés.
 * Sans permission (403) ou en cas d'erreur, la liste reste vide : la page masque alors le filtre
 * ou affiche des identifiants courts.
 */
export function useListeReference<T>(charger: ((signal: AbortSignal) => Promise<T[]>) | null, dependances: unknown[] = []): T[] {
  const [elements, setElements] = useState<T[]>([]);
  useEffect(() => {
    if (!charger) {
      setElements([]);
      return;
    }
    const controleur = new AbortController();
    charger(controleur.signal)
      .then((resultat) => {
        if (!controleur.signal.aborted) setElements(resultat);
      })
      .catch(() => {
        if (!controleur.signal.aborted) setElements([]);
      });
    return () => controleur.abort();
    // Les dépendances sont fournies par l'appelant.
  }, dependances);
  return elements;
}

/** Liste de référence déjà mise sous forme d'options de filtre. */
export function useOptionsReference(
  charger: ((signal: AbortSignal) => Promise<OptionFiltre[]>) | null,
  dependances: unknown[] = [],
): OptionFiltre[] {
  return useListeReference(charger, dependances);
}

/** Libellé d'une référence, ou identifiant abrégé si la liste n'est pas accessible. */
export function libelleReference(options: OptionFiltre[], id: string | null | undefined, secours = "Libellé indisponible"): string {
  if (!id) return '—';
  return options.find((option) => option.valeur === id)?.libelle ?? secours;
}
