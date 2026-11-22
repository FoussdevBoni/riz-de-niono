export type StatutCampagne = 'brouillon' | 'ouverte' | 'cloturee';

/** Fiche renvoyée par /campagnes-agricoles (document 04). */
export interface CampagneAgricole {
  _id: string;
  code: string;
  nom: string;
  date_debut: string;
  date_fin: string;
  site_ids: string[];
  statut: StatutCampagne;
  created_at: string;
  updated_at: string;
}

export interface DonneesCampagneAgricole {
  code?: string;
  nom?: string;
  date_debut?: string;
  date_fin?: string;
  site_ids?: string[];
}
