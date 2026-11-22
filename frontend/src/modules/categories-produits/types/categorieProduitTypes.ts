/** Fiche renvoyée par /categories-produits (document 04). */
export interface CategorieProduit {
  _id: string;
  code: string;
  nom: string;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface DonneesCategorieProduit {
  code?: string;
  nom?: string;
  actif?: boolean;
}
