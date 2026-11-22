/** Fiche renvoyée par /sites-production (document 04). */
export interface SiteProduction {
  _id: string;
  code: string;
  nom: string;
  localisation: string | null;
  superficie_ha: string | null;
  responsable_id: string | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

/** Saisie d'un site : null efface un champ facultatif. */
export interface DonneesSiteProduction {
  code?: string;
  nom?: string;
  localisation?: string | null;
  superficie_ha?: string | null;
  responsable_id?: string | null;
  actif?: boolean;
}
