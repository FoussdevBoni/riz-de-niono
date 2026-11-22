/** Fiche renvoyée par /types-operations-agricoles (document 04). */
export interface TypeOperationAgricole {
  _id: string;
  code: string;
  nom: string;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface DonneesTypeOperationAgricole {
  code?: string;
  nom?: string;
  actif?: boolean;
}
