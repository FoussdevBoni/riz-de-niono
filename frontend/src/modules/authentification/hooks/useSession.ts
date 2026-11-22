import { useContext } from 'react';

import { ContexteSession, type ValeurSession } from './contexteSession';

/** Session courante : état, profil et actions de connexion et de déconnexion. */
export function useSession(): ValeurSession {
  const valeur = useContext(ContexteSession);
  if (!valeur) throw new Error('useSession doit être utilisé sous FournisseurSession.');
  return valeur;
}
