/** Fiche renvoyée par /clients (document 04). */
export interface Client {
  _id: string;
  nom: string;
  telephone: string | null;
  adresse: string | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

/** Situation cumulée des ventes validées visibles du client (document 04). */
export interface SituationClient {
  montant_total: string;
  montant_encaisse: string;
  montant_retours: string;
  solde: string;
  trop_percu: string;
}

export interface FicheClient extends Client {
  ventes: SituationClient;
}

export interface DonneesClient {
  nom?: string;
  telephone?: string | null;
  adresse?: string | null;
  actif?: boolean;
}
