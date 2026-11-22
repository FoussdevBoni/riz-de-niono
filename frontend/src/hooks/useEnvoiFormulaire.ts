import { ContexteBrouillon } from './useChampBrouillon';
import { useCallback, useContext, useRef, useState } from 'react';

import { champErreur, messageErreur } from '../utils/erreurs';

interface ErreurEnvoi {
  message: string;
  champ?: string;
}

/**
 * Envoi d'un formulaire vers un service : état d'envoi et erreur métier de l'API.
 * L'erreur désignant un champ (details.champ) s'affiche sous ce champ ; les autres en tête du formulaire.
 * La saisie n'est jamais réinitialisée en cas d'échec : le formulaire garde son propre état.
 */
export function useEnvoiFormulaire() {
  const brouillon = useContext(ContexteBrouillon);
  const verrou = useRef(false);
  const [erreur, setErreur] = useState<ErreurEnvoi | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const executer = useCallback(async (action: () => Promise<void>) => {
    if (verrou.current) return;
    verrou.current = true;
    brouillon?.envoi(true);
    setErreur(null);
    setEnvoi(true);
    try {
      await action();
      brouillon?.effacer();
    } catch (cause) {
      setErreur({ message: messageErreur(cause), champ: champErreur(cause) });
    } finally {
      verrou.current = false;
      brouillon?.envoi(false);
      setEnvoi(false);
    }
  }, [brouillon]);

  /** Message à placer sous le champ nommé, s'il est concerné. */
  const erreurChamp = (nom: string): string | null => (erreur?.champ === nom ? erreur.message : null);

  /** Message à afficher en tête : erreur générale ou portant sur un champ absent du formulaire. */
  const erreurGenerale = (champsAffiches: readonly string[]): string | null =>
    erreur && (!erreur.champ || !champsAffiches.includes(erreur.champ)) ? erreur.message : null;

  return { envoi, executer, erreurChamp, erreurGenerale, signalerErreur: setErreur };
}
