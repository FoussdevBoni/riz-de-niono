import type { Activite } from '../../profil/types/profilTypes';

/** Utilisateur renvoyé par /utilisateurs (document 04), sans mot de passe ni condensat. */
export interface UtilisateurResume {
  _id: string;
  nom: string;
  email: string;
  actif: boolean;
  role_id: string;
  activites: Activite[];
  /** Liste vide : tous les sites. */
  site_ids: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Saisie d'un utilisateur. mot_de_passe est obligatoire à la création ; transmis en modification, il redéfinit
 * le mot de passe et révoque les sessions. Un utilisateur ne change pas son propre rôle, périmètre ni activation.
 */
export interface DonneesUtilisateur {
  nom?: string;
  email?: string;
  mot_de_passe?: string;
  role_id?: string;
  activites?: Activite[];
  site_ids?: string[];
  actif?: boolean;
}
