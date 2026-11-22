import { clientHttp } from '../../../api/clientHttp';
import type { Profil } from '../types/profilTypes';

/**
 * Service du module profil : endpoints /api/v1/profil (document 04).
 * Seul ce service appelle le client HTTP pour le profil ; pages, composants et hooks passent par lui.
 */
export const profilService = {
  lire: () => clientHttp.get<Profil>('/profil'),

  modifier: (donnees: { nom: string }) => clientHttp.patch<Profil>('/profil', donnees),

  changerMotDePasse: (motDePasseActuel: string, nouveauMotDePasse: string) =>
    clientHttp.post<void>('/profil/mot-de-passe', {
      mot_de_passe_actuel: motDePasseActuel,
      nouveau_mot_de_passe: nouveauMotDePasse,
    }),
};
