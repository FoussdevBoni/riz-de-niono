import { createContext, useContext, useRef, useState, type Dispatch, type SetStateAction } from 'react';

export interface GestionBrouillon {
  valeurs: Record<string, unknown>;
  modifier: (champ: string, valeur: unknown) => void;
  effacer: () => void;
  envoi: (actif: boolean) => void;
}

export const ContexteBrouillon = createContext<GestionBrouillon | null>(null);

/** Conserve les valeurs métier structurées, y compris les lignes encore incomplètes. */
export function useChampBrouillon<T>(champ: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const brouillon = useContext(ContexteBrouillon);
  const [valeur, definir] = useState<T>(() => {
    if (brouillon && Object.hasOwn(brouillon.valeurs, champ)) {
      return brouillon.valeurs[champ] as T;
    }
    const resultat = typeof initial === 'function' ? (initial as () => T)() : initial;
    if (brouillon) brouillon.valeurs[champ] = resultat;
    return resultat;
  });

  const actuelle = useRef(valeur);

  function changer(suivant: SetStateAction<T>) {
    const resultat = typeof suivant === 'function'
      ? (suivant as (valeur: T) => T)(actuelle.current)
      : suivant;
    actuelle.current = resultat;
    brouillon?.modifier(champ, resultat);
    definir(resultat);
  }

  return [valeur, changer];
}
