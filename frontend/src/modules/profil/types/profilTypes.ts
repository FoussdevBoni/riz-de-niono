/** Activités de l'entreprise (document 05 : trois espaces métier). */
export type Activite = 'production' | 'transformation' | 'commercialisation';

export type CodeAction = 'consultation' | 'saisie' | 'validation' | 'cloture' | 'administration';

/** Permission d'un rôle : un module (code de collection) et une action (document 03). */
export interface Permission {
  module: string;
  action: CodeAction;
}

/** Profil de la session renvoyé par POST /auth/connexion et GET /profil (document 04). */
export interface Profil {
  _id: string;
  nom: string;
  email: string;
  actif: boolean;
  role: { _id: string; code: string; nom: string } | null;
  activites: Activite[];
  /** Liste vide : tous les sites. */
  site_ids: string[];
  permissions: Permission[];
}
