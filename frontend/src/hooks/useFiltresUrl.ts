import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Filtres d'une page conservés dans l'URL (?campagne_id=…) : la page se partage et se recharge
 * avec les mêmes filtres. Une valeur vide retire le paramètre.
 */
export function useFiltresUrl<N extends string>(noms: readonly N[]) {
  const [parametres, setParametres] = useSearchParams();
  const filtres = useMemo(() => {
    const valeurs = {} as Partial<Record<N, string>>;
    for (const nom of noms) {
      const valeur = parametres.get(nom);
      if (valeur) valeurs[nom] = valeur;
    }
    return valeurs;
    // noms est une liste constante fournie par la page.
  }, [parametres]);

  const definir = useCallback(
    (nom: N, valeur: string) => {
      setParametres(
        (actuels) => {
          const suivants = new URLSearchParams(actuels);
          if (valeur) suivants.set(nom, valeur);
          else suivants.delete(nom);
          // Un nouveau filtre ramène la liste à sa première page.
          if (nom !== 'page') suivants.delete('page');
          return suivants;
        },
        { replace: true },
      );
    },
    [setParametres],
  );

  const reinitialiser = useCallback(() => setParametres(new URLSearchParams(), { replace: true }), [setParametres]);
  return { filtres, definir, reinitialiser };
}
