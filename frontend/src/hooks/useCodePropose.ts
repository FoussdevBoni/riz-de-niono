import { useEffect, useState } from 'react';

export type ProposerCode = (nom: string, signal?: AbortSignal) => Promise<{ code: string }>;

/**
 * Code interne proposé par l'API à partir du nom saisi (le service du module fait l'appel).
 * La proposition suit la frappe avec un court délai ; l'unicité définitive est garantie par l'API
 * au moment de la création. Sans service ou désactivée, aucune requête n'est faite.
 */
export function useCodePropose(proposer: ProposerCode | undefined, nom: string, actif: boolean): { code: string; recherche: boolean } {
  const [code, setCode] = useState('');
  const [recherche, setRecherche] = useState(false);

  useEffect(() => {
    if (!proposer || !actif) return;
    if (!nom.trim()) {
      setCode('');
      return;
    }
    const controleur = new AbortController();
    setRecherche(true);
    const delai = window.setTimeout(() => {
      proposer(nom.trim(), controleur.signal)
        .then((resultat) => {
          if (!controleur.signal.aborted) setCode(resultat.code);
        })
        .catch(() => undefined)
        .finally(() => {
          if (!controleur.signal.aborted) setRecherche(false);
        });
    }, 280);
    return () => {
      controleur.abort();
      window.clearTimeout(delai);
    };
  }, [proposer, nom, actif]);

  return { code, recherche };
}
