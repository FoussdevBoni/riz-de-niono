import { useCallback, useEffect, useState, type DependencyList } from 'react';

/** Erreur renvoyée par un service : statut HTTP et code de l'API quand ils existent. */
type ErreurRequete = Error & { statut?: number; code?: string };

export interface EtatRequete<T> {
  donnees: T | null;
  erreur: ErreurRequete | null;
  chargement: boolean;
  recharger: () => void;
}

/**
 * État de chargement d'un appel de service (jamais d'appel HTTP direct ici).
 * L'appel précédent est abandonné quand les dépendances changent.
 */
export function useRequete<T>(charger: (signal: AbortSignal) => Promise<T>, dependances: DependencyList): EtatRequete<T> {
  const [donnees, setDonnees] = useState<T | null>(null);
  const [erreur, setErreur] = useState<ErreurRequete | null>(null);
  const [chargement, setChargement] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controleur = new AbortController();
    setChargement(true);
    setErreur(null);
    charger(controleur.signal)
      .then((resultat) => {
        if (!controleur.signal.aborted) setDonnees(resultat);
      })
      .catch((cause: unknown) => {
        if (controleur.signal.aborted) return;
        setErreur(cause instanceof Error ? cause : new Error(String(cause)));
        setDonnees(null);
      })
      .finally(() => {
        if (!controleur.signal.aborted) setChargement(false);
      });
    return () => controleur.abort();
    // Les dépendances sont fournies par l'appelant (comme pour useEffect).
  }, [...dependances, version]);

  const recharger = useCallback(() => setVersion((valeur) => valeur + 1), []);
  return { donnees, erreur, chargement, recharger };
}
