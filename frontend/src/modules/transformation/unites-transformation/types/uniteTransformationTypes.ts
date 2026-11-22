/** Fiche renvoyée par /unites-transformation (document 04). */
export interface UniteTransformation {
  _id: string;
  code: string;
  nom: string;
  localisation: string | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface DonneesUniteTransformation {
  code?: string;
  nom?: string;
  localisation?: string | null;
  actif?: boolean;
}
