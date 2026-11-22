/** Fiche renvoyée par /equipes-production (document 04). */
export interface EquipeProduction {
  _id: string;
  nom: string;
  membres: string[];
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface DonneesEquipeProduction {
  nom?: string;
  membres?: string[];
  actif?: boolean;
}
