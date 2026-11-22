import { createContext } from 'react';

import type { Profil } from '../../profil/types/profilTypes';

export type EtatSession = 'chargement' | 'connecte' | 'deconnecte';

export interface ValeurSession {
  etat: EtatSession;
  profil: Profil | null;
  /** Vrai après un refus de session par l'API (expirée ou révoquée), jusqu'à la prochaine connexion. */
  sessionExpiree: boolean;
  connecter: (email: string, motDePasse: string) => Promise<Profil>;
  deconnecter: () => Promise<void>;
  /** Remplace le profil en mémoire (après modification du nom, par exemple). */
  mettreAJourProfil: (profil: Profil) => void;
}

export const ContexteSession = createContext<ValeurSession | null>(null);
