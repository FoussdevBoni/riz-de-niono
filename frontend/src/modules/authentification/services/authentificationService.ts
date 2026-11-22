import { clientHttp } from '../../../api/clientHttp';
import type { Profil } from '../../profil/types/profilTypes';

export interface ResultatConnexion {
  jeton: string;
  expire_at: string;
  profil: Profil;
}

/**
 * Service du module authentification : endpoints /api/v1/auth/* (document 04).
 * Il enregistre le jeton de session auprès du client HTTP après la connexion et l'efface à la déconnexion.
 */
export const authentificationService = {
  async connecter(email: string, motDePasse: string): Promise<Profil> {
    const resultat = await clientHttp.post<ResultatConnexion>('/auth/connexion', { email, mot_de_passe: motDePasse });
    clientHttp.definirJeton(resultat.jeton);
    return resultat.profil;
  },

  /** Révoque la session côté serveur ; le jeton local est effacé même si l'appel échoue. */
  async deconnecter(): Promise<void> {
    try {
      await clientHttp.post<void>('/auth/deconnexion');
    } finally {
      clientHttp.effacerJeton();
    }
  },

  /** Réponse 202 que l'adresse corresponde ou non à un compte. */
  demanderReinitialisation: (email: string) => clientHttp.post<void>('/auth/reinitialisation', { email }),

  confirmerReinitialisation: (jeton: string, nouveauMotDePasse: string) =>
    clientHttp.post<void>('/auth/reinitialisation/confirmation', { jeton, nouveau_mot_de_passe: nouveauMotDePasse }),

  possedeSession: () => clientHttp.possedeJeton(),

  /** Action à exécuter quand l'API refuse la session (expirée ou révoquée). */
  surSessionInvalide: (action: () => void) => clientHttp.definirSurSessionInvalide(action),
};
